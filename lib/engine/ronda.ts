/**
 * A ronda: one deal, played until somebody goes out.
 *
 * The engine is the referee. Every move goes through `apply`, which either
 * returns a new state or refuses with a reason — callers never decide what is
 * legal, and never mutate a state in place.
 *
 * State is plain data. The random stream is carried as a single number so a
 * ronda can be stored, reloaded, and keep reshuffling deterministically.
 */

import {
  type Card,
  type NormalCard,
  isComodin,
} from './cards'
import { type Contrato } from './contratos'
import { buildDeck, deal } from './deck'
import {
  type Escala,
  type Grupo,
  type Propuesta,
  type Trio,
  validateGrupo,
} from './grupos'
import { addToTrio, extendEscala, repositionComodin } from './mesa'
import { createRng, shuffle } from './random'

export type JugadorState = {
  readonly hand: readonly Card[]
  readonly grupos: readonly Grupo[]
  /** Turn number on which this player bajó, or null while still in hand. */
  readonly bajadoEnTurno: number | null
}

/** A turn is draw, then optionally act, then discard. In that order, always. */
export type TurnPhase = 'draw' | 'act'

export type RondaState = {
  readonly contrato: Contrato
  readonly jugadores: readonly JugadorState[]
  readonly stock: readonly Card[]
  /** Face up. The last element is the top card, the only one in play. */
  readonly discard: readonly Card[]
  /** Seat to move. */
  readonly turno: number
  /** 1-based, increases with every turn taken by anyone. */
  readonly numeroDeTurno: number
  readonly fase: TurnPhase
  readonly rngState: number
  /** Seat that went out, once the ronda is over. */
  readonly ganador: number | null
}

export type Move =
  | { readonly type: 'robar'; readonly de: 'stock' | 'descarte' }
  | { readonly type: 'bajarse'; readonly propuestas: readonly Propuesta[] }
  | {
      readonly type: 'agregar'
      readonly seat: number
      readonly grupoIndex: number
      readonly cardIds: readonly string[]
      /** Escalas only. Ignored by trios, which have no ends. */
      readonly end?: 'head' | 'tail'
    }
  | {
      readonly type: 'moverComodin'
      readonly seat: number
      readonly grupoIndex: number
      /** The card that the comodín was standing for. Comes from the hand. */
      readonly cardId: string
      readonly to: 'head' | 'tail'
    }
  | { readonly type: 'descartar'; readonly cardId: string }

export type MoveErrorCode =
  | 'RONDA_TERMINADA'
  | 'FASE_EQUIVOCADA'
  | 'CARTA_NO_ESTA_EN_LA_MANO'
  | 'CARTA_REPETIDA'
  | 'YA_SE_BAJO'
  | 'NO_SE_HA_BAJADO'
  | 'MESA_BLOQUEADA_MISMO_TURNO'
  | 'CONTRATO_NO_COINCIDE'
  | 'GRUPO_INVALIDO'
  | 'SIN_CARTA_PARA_DESCARTAR'
  | 'DESCARTE_VACIO'
  | 'SIN_CARTAS'
  | 'NO_EXISTE_EL_GRUPO'
  | 'NO_ES_UNA_ESCALA'
  | 'COMODIN_NO_SE_PUEDE_MOVER'
  | 'EDICION_INVALIDA'

export type MoveResult =
  | { readonly ok: true; readonly state: RondaState }
  | { readonly ok: false; readonly code: MoveErrorCode; readonly detail: string }

const fail = (code: MoveErrorCode, detail: string): MoveResult => ({
  ok: false,
  code,
  detail,
})

export function startRonda(options: {
  contrato: Contrato
  players: number
  comodines?: boolean
  seed: string | number
  /** Seat that plays first. Rotates between rondas so no seat is always first. */
  empieza?: number
}): RondaState {
  const { contrato, players, comodines = true, seed, empieza = 0 } = options
  const rng = createRng(seed)
  const dealt = deal(buildDeck({ comodines }), players, rng)

  return {
    contrato,
    jugadores: dealt.hands.map((hand) => ({
      hand,
      grupos: [],
      bajadoEnTurno: null,
    })),
    stock: dealt.stock,
    discard: dealt.discard,
    turno: ((empieza % players) + players) % players,
    numeroDeTurno: 1,
    fase: 'draw',
    rngState: rng.state(),
    ganador: null,
  }
}

export function apply(state: RondaState, move: Move): MoveResult {
  if (state.ganador !== null) {
    return fail('RONDA_TERMINADA', `seat ${state.ganador} already went out`)
  }

  switch (move.type) {
    case 'robar':
      return robar(state, move.de)
    case 'bajarse':
      return bajarse(state, move.propuestas)
    case 'agregar':
      return agregar(state, move)
    case 'moverComodin':
      return moverComodin(state, move)
    case 'descartar':
      return descartar(state, move.cardId)
  }
}

// ---------------------------------------------------------------- drawing

function robar(state: RondaState, de: 'stock' | 'descarte'): MoveResult {
  if (state.fase !== 'draw') {
    return fail('FASE_EQUIVOCADA', 'the card for this turn has been drawn already')
  }

  if (de === 'descarte') {
    const top = state.discard.at(-1)
    if (!top) return fail('DESCARTE_VACIO', 'there is no card to take')
    return {
      ok: true,
      state: {
        ...withHand(state, state.turno, [...currentHand(state), top]),
        discard: state.discard.slice(0, -1),
        fase: 'act',
      },
    }
  }

  const refilled = refillStockIfEmpty(state)
  const top = refilled.stock.at(-1)
  if (!top) {
    return fail('SIN_CARTAS', 'the stock is empty and the descarte cannot refill it')
  }

  return {
    ok: true,
    state: {
      ...withHand(refilled, refilled.turno, [...refilled.jugadores[refilled.turno].hand, top]),
      stock: refilled.stock.slice(0, -1),
      fase: 'act',
    },
  }
}

/**
 * When the stock runs out the descarte is shuffled back into it, keeping the
 * top card face up so the pile is never empty. A ronda ends because somebody
 * went out, never because the cards ran out.
 */
function refillStockIfEmpty(state: RondaState): RondaState {
  if (state.stock.length > 0 || state.discard.length <= 1) return state

  const top = state.discard.at(-1)!
  const rest = state.discard.slice(0, -1)
  const rng = createRng(state.rngState)

  return {
    ...state,
    stock: shuffle(rest, rng),
    discard: [top],
    rngState: rng.state(),
  }
}

// ---------------------------------------------------------------- bajarse

function bajarse(state: RondaState, propuestas: readonly Propuesta[]): MoveResult {
  if (state.fase !== 'act') {
    return fail('FASE_EQUIVOCADA', 'draw a card before laying down')
  }

  const jugador = state.jugadores[state.turno]
  if (jugador.bajadoEnTurno !== null) {
    return fail('YA_SE_BAJO', 'this player has already laid down this ronda')
  }

  const trios = propuestas.filter((p) => p.kind === 'trio').length
  const escalas = propuestas.filter((p) => p.kind === 'escala').length
  const { contrato } = state
  if (trios !== contrato.trios || escalas !== contrato.escalas) {
    return fail(
      'CONTRATO_NO_COINCIDE',
      `${contrato.nombre} needs ${contrato.trios} trios and ${contrato.escalas} escalas, got ${trios} and ${escalas}`,
    )
  }

  const taken = collectCards(
    jugador.hand,
    propuestas.flatMap((p) => p.cardIds),
  )
  if (!taken.ok) return taken.error

  const grupos: Grupo[] = []
  for (const propuesta of propuestas) {
    const cards = propuesta.cardIds.map((id) => taken.byId.get(id)!)
    const grupo: Grupo =
      propuesta.kind === 'trio'
        ? ({ kind: 'trio', rank: propuesta.rank, cards } satisfies Trio)
        : ({
            kind: 'escala',
            suit: propuesta.suit,
            start: propuesta.start,
            cards,
          } satisfies Escala)

    const check = validateGrupo(grupo, 'layDown')
    if (!check.ok) {
      return fail('GRUPO_INVALIDO', `${check.code}: ${check.detail}`)
    }
    grupos.push(grupo)
  }

  // A turn always ends with a discard, so laying down may never empty the hand.
  if (taken.rest.length < 1) {
    return fail(
      'SIN_CARTA_PARA_DESCARTAR',
      'laying these grupos would leave nothing to discard',
    )
  }

  return {
    ok: true,
    state: replaceJugador(state, state.turno, {
      hand: taken.rest,
      grupos,
      bajadoEnTurno: state.numeroDeTurno,
    }),
  }
}

// ------------------------------------------------------------------- mesa

function agregar(
  state: RondaState,
  move: Extract<Move, { type: 'agregar' }>,
): MoveResult {
  const gate = checkMesaAccess(state)
  if (gate) return gate

  const target = state.jugadores[move.seat]?.grupos[move.grupoIndex]
  if (!target) {
    return fail('NO_EXISTE_EL_GRUPO', `seat ${move.seat} has no grupo ${move.grupoIndex}`)
  }

  const taken = collectCards(currentHand(state), move.cardIds)
  if (!taken.ok) return taken.error
  const cards = move.cardIds.map((id) => taken.byId.get(id)!)

  const edited =
    target.kind === 'trio'
      ? addToTrio(target, cards)
      : extendEscala(target, cards, move.end ?? 'tail')

  if (!edited.ok) {
    return fail('EDICION_INVALIDA', `${edited.code}: ${edited.detail}`)
  }

  return {
    ok: true,
    state: withGrupo(
      withHand(state, state.turno, taken.rest),
      move.seat,
      move.grupoIndex,
      edited.grupo,
    ),
  }
}

function moverComodin(
  state: RondaState,
  move: Extract<Move, { type: 'moverComodin' }>,
): MoveResult {
  const gate = checkMesaAccess(state)
  if (gate) return gate

  const target = state.jugadores[move.seat]?.grupos[move.grupoIndex]
  if (!target) {
    return fail('NO_EXISTE_EL_GRUPO', `seat ${move.seat} has no grupo ${move.grupoIndex}`)
  }
  if (target.kind !== 'escala') {
    return fail(
      'NO_ES_UNA_ESCALA',
      'a trio has no order, so a comodín in one has nowhere to move',
    )
  }

  const taken = collectCards(currentHand(state), [move.cardId])
  if (!taken.ok) return taken.error
  const replacement = taken.byId.get(move.cardId)!
  if (isComodin(replacement)) {
    return fail(
      'COMODIN_NO_SE_PUEDE_MOVER',
      'a comodín cannot be the card that frees another comodín',
    )
  }

  const edited = repositionComodin(target, replacement as NormalCard, move.to)
  if (!edited.ok) {
    return fail('EDICION_INVALIDA', `${edited.code}: ${edited.detail}`)
  }

  return {
    ok: true,
    state: withGrupo(
      withHand(state, state.turno, taken.rest),
      move.seat,
      move.grupoIndex,
      edited.grupo,
    ),
  }
}

/**
 * The mesa is untouchable before bajarse, and still untouchable on the turn it
 * happens — one's own grupos included. Everything opens from the next turn on.
 *
 * The same-turn lock is what keeps "one comodín per grupo at lay-down" from
 * being a formality: bajarse with `K comodín(A) 2 3` and then, that same turn,
 * play a second comodín as the `4`, and the grupo ends up in a shape lay-down
 * validation would have refused. A grupo has to be finished when it lands.
 */
function checkMesaAccess(state: RondaState): MoveResult | null {
  if (state.fase !== 'act') {
    return fail('FASE_EQUIVOCADA', 'draw a card before touching the mesa')
  }

  const jugador = state.jugadores[state.turno]
  if (jugador.bajadoEnTurno === null) {
    return fail('NO_SE_HA_BAJADO', 'the mesa cannot be touched before laying down')
  }

  if (jugador.bajadoEnTurno >= state.numeroDeTurno) {
    return fail(
      'MESA_BLOQUEADA_MISMO_TURNO',
      'the mesa is open only from the turn after bajarse, own grupos included',
    )
  }

  return null
}

// --------------------------------------------------------------- discard

function descartar(state: RondaState, cardId: string): MoveResult {
  if (state.fase !== 'act') {
    return fail('FASE_EQUIVOCADA', 'draw a card before discarding')
  }

  const taken = collectCards(currentHand(state), [cardId])
  if (!taken.ok) return taken.error
  const card = taken.byId.get(cardId)!

  const discarded: RondaState = {
    ...withHand(state, state.turno, taken.rest),
    discard: [...state.discard, card],
  }

  // Going out: the hand is empty after discarding. Only reachable once the
  // contract is down, since the cards have nowhere else to go.
  if (taken.rest.length === 0) {
    return { ok: true, state: { ...discarded, ganador: state.turno } }
  }

  return {
    ok: true,
    state: {
      ...discarded,
      turno: (state.turno + 1) % state.jugadores.length,
      numeroDeTurno: state.numeroDeTurno + 1,
      fase: 'draw',
    },
  }
}

// --------------------------------------------------------------- helpers

const currentHand = (state: RondaState): readonly Card[] =>
  state.jugadores[state.turno].hand

type Collected =
  | { ok: true; byId: Map<string, Card>; rest: Card[] }
  | { ok: false; error: MoveResult }

/** Pull the named cards out of a hand, refusing anything not actually in it. */
function collectCards(hand: readonly Card[], ids: readonly string[]): Collected {
  const wanted = new Set(ids)
  if (wanted.size !== ids.length) {
    return {
      ok: false,
      error: fail('CARTA_REPETIDA', 'the same card was named more than once'),
    }
  }

  const byId = new Map<string, Card>()
  const rest: Card[] = []
  for (const card of hand) {
    if (wanted.has(card.id)) byId.set(card.id, card)
    else rest.push(card)
  }

  const missing = ids.find((id) => !byId.has(id))
  if (missing !== undefined) {
    return {
      ok: false,
      error: fail('CARTA_NO_ESTA_EN_LA_MANO', `card ${missing} is not in this hand`),
    }
  }

  return { ok: true, byId, rest }
}

function replaceJugador(
  state: RondaState,
  seat: number,
  jugador: JugadorState,
): RondaState {
  return {
    ...state,
    jugadores: state.jugadores.map((existing, i) => (i === seat ? jugador : existing)),
  }
}

function withHand(
  state: RondaState,
  seat: number,
  hand: readonly Card[],
): RondaState {
  return replaceJugador(state, seat, { ...state.jugadores[seat], hand })
}

function withGrupo(
  state: RondaState,
  seat: number,
  grupoIndex: number,
  grupo: Grupo,
): RondaState {
  const jugador = state.jugadores[seat]
  return replaceJugador(state, seat, {
    ...jugador,
    grupos: jugador.grupos.map((existing, i) => (i === grupoIndex ? grupo : existing)),
  })
}
