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
  /**
   * The player left the partida (Phase 37). Their cards are out of play, the
   * turn order skips them, and they are dealt nothing again — but whatever
   * they laid on the mesa stays, because a grupo is communal once it lands.
   */
  readonly retirado?: boolean
}

/** A turn is draw, then optionally act, then discard. In that order, always. */
export type TurnPhase = 'draw' | 'act'

/** The descarte may rebuild the stock this many times per ronda (Phase 31). */
export const REBARAJADAS_MAX = 2

export type RondaState = {
  readonly contrato: Contrato
  readonly jugadores: readonly JugadorState[]
  readonly stock: readonly Card[]
  /** Face up. The last element is the top card, the only one in play. */
  readonly discard: readonly Card[]
  /** Times the descarte has rebuilt the stock. Capped at REBARAJADAS_MAX. */
  readonly rebarajadas: number
  /** Seat to move. */
  readonly turno: number
  /** 1-based, increases with every turn taken by anyone. */
  readonly numeroDeTurno: number
  readonly fase: TurnPhase
  readonly rngState: number
  /**
   * How the ronda ended: the seat that went out, `'nadie'` for a ronda closed
   * en tablas (Phase 31), or null while it is still being played.
   */
  readonly ganador: number | 'nadie' | null
  /**
   * What the turn in play has put on the mesa, and which turn that was
   * (Phase 42).
   *
   * Kept because the interesting question at the end of a ronda is *what did
   * the winner put down to go out*, and the answer is a whole turn rather
   * than a single move: bajarse and then botar leaves the mesa untouched by
   * the closing move and six cards heavier than it was a moment before.
   * Accumulated in `apply`, which is the one door every move goes through,
   * and stamped with the turn it belongs to rather than cleared when the turn
   * passes — the closing move of a turn is a discard, and it advances the
   * count before anybody has looked.
   *
   * Optional: a ronda saved before this existed simply has nothing to show.
   */
  readonly puestas?: {
    readonly turno: number
    readonly ids: readonly string[]
  }
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
  | 'DESCARTE_VACIO'
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
  /** Seats whose players left the partida; they are dealt nothing (Phase 37). */
  retirados?: readonly number[]
}): RondaState {
  const { contrato, players, comodines = true, seed, empieza = 0, retirados } = options
  const rng = createRng(seed)
  const dealt = deal(buildDeck({ comodines }), players, rng)

  return {
    contrato,
    jugadores: dealt.hands.map((hand, seat) => ({
      // A seat that left is dealt nothing again.
      hand: retirados?.includes(seat) ? [] : hand,
      grupos: [],
      bajadoEnTurno: null,
      ...(retirados?.includes(seat) ? { retirado: true } : {}),
    })),
    stock: dealt.stock,
    discard: dealt.discard,
    rebarajadas: 0,
    turno: primerTurno(((empieza % players) + players) % players, retirados, players),
    numeroDeTurno: 1,
    fase: 'draw',
    rngState: rng.state(),
    ganador: null,
  }
}

/** The opening seat, skipping anyone who has left. */
function primerTurno(
  empieza: number,
  retirados: readonly number[] | undefined,
  players: number,
): number {
  if (!retirados?.length) return empieza
  for (let paso = 0; paso < players; paso++) {
    const seat = (empieza + paso) % players
    if (!retirados.includes(seat)) return seat
  }
  return empieza
}

/**
 * Take a seat out of the partida: its cards leave play, and the turn order
 * closes over the gap from here on (Phase 37).
 *
 * Not a move — nobody plays this, the person leaves — so it does not go
 * through `apply`. What it must not do is change anything else: grupos on the
 * mesa stay, because they became communal the moment they landed.
 */
export function retirarAsiento(state: RondaState, seat: number): RondaState {
  const jugador = state.jugadores[seat]
  if (!jugador || jugador.retirado) return state

  const conRetiro: RondaState = {
    ...state,
    jugadores: state.jugadores.map((otro, i) =>
      i === seat ? { ...otro, hand: [], retirado: true } : otro,
    ),
  }

  // Whoever is left plays on; if it was their turn, it passes at once.
  if (conRetiro.ganador !== null || conRetiro.turno !== seat) return conRetiro
  return { ...conRetiro, ...pasaElTurno(conRetiro) }
}

/** Seats still in the partida. Two is the fewest a table can be played with. */
export function asientosActivos(state: RondaState): number[] {
  return state.jugadores.flatMap((jugador, seat) =>
    jugador.retirado ? [] : [seat],
  )
}

/** The next seat and turn number, skipping anyone who has left. */
function pasaElTurno(state: RondaState): Pick<
  RondaState,
  'turno' | 'numeroDeTurno' | 'fase'
> {
  const total = state.jugadores.length
  for (let paso = 1; paso <= total; paso++) {
    const seat = (state.turno + paso) % total
    if (!state.jugadores[seat].retirado) {
      return { turno: seat, numeroDeTurno: state.numeroDeTurno + 1, fase: 'draw' }
    }
  }
  return { turno: state.turno, numeroDeTurno: state.numeroDeTurno + 1, fase: 'draw' }
}

export function apply(state: RondaState, move: Move): MoveResult {
  if (state.ganador !== null) {
    return fail(
      'RONDA_TERMINADA',
      state.ganador === 'nadie'
        ? 'the ronda ended en tablas'
        : `seat ${state.ganador} already went out`,
    )
  }

  const crudo = applyMove(state, move)
  if (!crudo.ok) return crudo

  // What this move added to the mesa, kept with the rest of its turn's work.
  const result = { ...crudo, state: conPuestas(state, crudo.state) }
  if (result.state.ganador !== null) return result

  // Going out is running out of cards, however it happened: a hand emptied by
  // ligar — or by a bajada that consumed all thirteen — closes the ronda as
  // surely as discarding the last card does. Checked here, once, so no move
  // can leave the ronda in a state it cannot get out of.
  if (result.state.jugadores[state.turno].hand.length === 0) {
    return { ok: true, state: { ...result.state, ganador: state.turno } }
  }

  return result
}

/** Every card sitting on the mesa, whoever laid it down. */
export function cartasEnMesa(state: RondaState): readonly string[] {
  return state.jugadores.flatMap((jugador) =>
    jugador.grupos.flatMap((grupo) => grupo.cards.map((card) => card.id)),
  )
}

/**
 * Carry the turn's work forward: what was on the mesa before this move, what
 * is on it now, and the difference added to whatever the same turn had
 * already put there.
 *
 * Stamped with the turn the *move* belonged to — `state`, before it was
 * applied — because a discard passes the turn, and the last thing a winning
 * turn does is usually exactly that.
 */
function conPuestas(antes: RondaState, despues: RondaState): RondaState {
  const habia = new Set(cartasEnMesa(antes))
  const nuevas = cartasEnMesa(despues).filter((id) => !habia.has(id))
  const previas =
    antes.puestas?.turno === antes.numeroDeTurno ? antes.puestas.ids : []

  if (nuevas.length === 0 && previas.length === 0) {
    return despues.puestas ? { ...despues, puestas: undefined } : despues
  }

  return {
    ...despues,
    puestas: { turno: antes.numeroDeTurno, ids: [...previas, ...nuevas] },
  }
}

function applyMove(state: RondaState, move: Move): MoveResult {
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
    // The stock cannot be served and cannot be rebuilt — the two rebarajadas
    // are spent, or there is nothing to rebuild it from. The ronda ends right
    // here, en tablas: nobody goes out, and scoring falls to the partida
    // (Phase 31). The draw itself never happens.
    return { ok: true, state: { ...state, ganador: 'nadie' } }
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
 * top card face up so the pile is never empty — at most REBARAJADAS_MAX times
 * per ronda. The third empty mazo does not refill; it closes the ronda en
 * tablas (Phase 31), so a ronda nobody can win still ends.
 */
function refillStockIfEmpty(state: RondaState): RondaState {
  if (state.stock.length > 0 || state.discard.length <= 1) return state
  if (state.rebarajadas >= REBARAJADAS_MAX) return state

  const top = state.discard.at(-1)!
  const rest = state.discard.slice(0, -1)
  const rng = createRng(state.rngState)

  return {
    ...state,
    stock: shuffle(rest, rng),
    discard: [top],
    rebarajadas: state.rebarajadas + 1,
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
    state: { ...discarded, ...pasaElTurno(discarded) },
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
