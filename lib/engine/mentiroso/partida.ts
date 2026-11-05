/**
 * El Mentiroso: the whole game as a pure state machine (Phase 76).
 *
 * The rules are `specs/mentiroso-rules.md`; every rule there is enforced here
 * and nowhere else. Like Carioca's `apply`, the referee validates and never
 * decides: a move is accepted or refused with a reason, and an accepted move
 * returns a new state.
 *
 * A turn has two phases:
 *
 *   'jugar'   — the seat in turn puts 1–4 cards on the pile, announced as the
 *               rank in turn.
 *   'ventana' — that play is on the pile and open to a call. Nobody may play
 *               yet. It ends with a call («¡Mentiroso!») or with the window
 *               being closed.
 *
 * How long a window lasts is not a rule but a clock, so it is not here: the
 * engine knows a window is open and what closes it, and whoever keeps time
 * (the browser for a bots-only table, the server online) sends
 * `cerrarVentana` when it has run out.
 */

import { construirBaraja } from '../comun/baraja'
import { type Card, type Rank, RANKS, isNormal, rankAfter } from '../comun/cards'
import { createRng, shuffle } from '../comun/random'

export const MIN_JUGADORES = 3
export const MAX_JUGADORES = 6
export const MIN_CARTAS_POR_JUGADA = 1
export const MAX_CARTAS_POR_JUGADA = 4
/** The first play of a partida announces aces; then A, 2 … K and round again. */
export const PRIMER_RANGO: Rank = RANKS[0]

/** The play on top of the pile. Its cards are the last `cantidad` of the pile. */
export type Jugada = {
  readonly asiento: number
  readonly cantidad: number
  /** What was announced — always the rank that was in turn. */
  readonly rango: Rank
}

/** What the last call turned over and where the pile went. All public. */
export type Acusacion = {
  readonly acusador: number
  readonly acusado: number
  /** The called play's cards, face up for everybody. */
  readonly cartas: readonly Card[]
  readonly rango: Rank
  readonly eraMentira: boolean
  /** Who took the pile: the liar, or the one who doubted the truth. */
  readonly seLlevo: number
  /** How many cards the pile held when it was taken. */
  readonly cartasDeLaPila: number
}

export type EstadoMentiroso = {
  readonly jugadores: number
  readonly seed: string
  /** One hand per seat. */
  readonly manos: readonly (readonly Card[])[]
  /** Face down, oldest first. The last play's cards are at the end. */
  readonly pila: readonly Card[]
  readonly ultimaJugada: Jugada | null
  /** The rank the next play must announce. */
  readonly rangoEnTurno: Rank
  /** The seat that plays next — during a window, the one waiting for it. */
  readonly turno: number
  readonly fase: 'jugar' | 'ventana'
  /** The most recent call, until the next one. */
  readonly ultimaAcusacion: Acusacion | null
  /** 1-based count of plays made, for ordering what happened. */
  readonly numeroDeJugada: number
  readonly ganador: number | null
}

/** Over: somebody went out. */
export function terminada(estado: EstadoMentiroso): boolean {
  return estado.ganador !== null
}

export type MoveMentiroso =
  /** The seat in turn plays these cards, announced as the rank in turn. */
  | { readonly type: 'jugar'; readonly asiento: number; readonly cartaIds: readonly string[] }
  /** «¡Mentiroso!» on the play in the window, by anyone but who made it. */
  | { readonly type: 'mentiroso'; readonly asiento: number }
  /** The window ran out with no call: the play stands. Sent by the clock. */
  | { readonly type: 'cerrarVentana' }

export type CodigoDeRechazo =
  | 'partida-terminada'
  | 'fase-equivocada'
  | 'no-es-tu-turno'
  | 'cantidad-invalida'
  | 'carta-repetida'
  | 'carta-que-no-tienes'
  | 'jugada-propia'
  | 'asiento-invalido'

export type ResultadoMentiroso =
  | { readonly ok: true; readonly estado: EstadoMentiroso }
  | { readonly ok: false; readonly code: CodigoDeRechazo; readonly detail: string }

const rechazo = (code: CodigoDeRechazo, detail: string): ResultadoMentiroso => ({
  ok: false,
  code,
  detail,
})

/**
 * Deal a partida. The whole single deck, no comodines, one card at a time
 * starting with the seat that opens — so when 52 does not divide evenly, the
 * first seats hold one card more. Who opens is drawn from the seed, so the
 * same seed always deals the same partida.
 */
export function empezarMentiroso(opciones: {
  jugadores: number
  seed: string
}): EstadoMentiroso {
  const { jugadores, seed } = opciones
  if (
    !Number.isInteger(jugadores) ||
    jugadores < MIN_JUGADORES ||
    jugadores > MAX_JUGADORES
  ) {
    throw new Error(
      `El Mentiroso takes ${MIN_JUGADORES} to ${MAX_JUGADORES} players, got ${jugadores}`,
    )
  }

  const rng = createRng(`${seed}#mentiroso`)
  const abre = rng.nextInt(jugadores)
  const mazo = shuffle(construirBaraja({ copias: 1, comodinesPorCopia: 0 }), rng)
  const manos: Card[][] = Array.from({ length: jugadores }, () => [])
  mazo.forEach((carta, i) => manos[(abre + i) % jugadores].push(carta))

  return {
    jugadores,
    seed,
    manos,
    pila: [],
    ultimaJugada: null,
    rangoEnTurno: PRIMER_RANGO,
    turno: abre,
    fase: 'jugar',
    ultimaAcusacion: null,
    numeroDeJugada: 0,
    ganador: null,
  }
}

export function aplicarMentiroso(
  estado: EstadoMentiroso,
  move: MoveMentiroso,
): ResultadoMentiroso {
  if (terminada(estado)) {
    return rechazo('partida-terminada', 'the partida is over')
  }
  switch (move.type) {
    case 'jugar':
      return jugar(estado, move.asiento, move.cartaIds)
    case 'mentiroso':
      return acusar(estado, move.asiento)
    case 'cerrarVentana':
      return cerrarVentana(estado)
  }
}

function jugar(
  estado: EstadoMentiroso,
  asiento: number,
  cartaIds: readonly string[],
): ResultadoMentiroso {
  if (estado.fase !== 'jugar') {
    return rechazo('fase-equivocada', 'a play is waiting for its window to close')
  }
  if (asiento !== estado.turno) {
    return rechazo('no-es-tu-turno', `seat ${estado.turno} is in turn, not ${asiento}`)
  }
  if (
    cartaIds.length < MIN_CARTAS_POR_JUGADA ||
    cartaIds.length > MAX_CARTAS_POR_JUGADA
  ) {
    return rechazo(
      'cantidad-invalida',
      `a play holds ${MIN_CARTAS_POR_JUGADA} to ${MAX_CARTAS_POR_JUGADA} cards, not ${cartaIds.length}`,
    )
  }
  if (new Set(cartaIds).size !== cartaIds.length) {
    return rechazo('carta-repetida', 'the same card twice in one play')
  }

  const mano = estado.manos[asiento]
  const jugadas = cartaIds.map((id) => mano.find((carta) => carta.id === id))
  if (jugadas.some((carta) => carta === undefined)) {
    return rechazo('carta-que-no-tienes', 'a card that is not in this hand')
  }

  const ids = new Set(cartaIds)
  return {
    ok: true,
    estado: {
      ...estado,
      manos: conMano(estado.manos, asiento, mano.filter((carta) => !ids.has(carta.id))),
      pila: [...estado.pila, ...(jugadas as Card[])],
      ultimaJugada: { asiento, cantidad: cartaIds.length, rango: estado.rangoEnTurno },
      rangoEnTurno: rankAfter(estado.rangoEnTurno),
      turno: (asiento + 1) % estado.jugadores,
      fase: 'ventana',
      numeroDeJugada: estado.numeroDeJugada + 1,
    },
  }
}

function acusar(estado: EstadoMentiroso, acusador: number): ResultadoMentiroso {
  if (!Number.isInteger(acusador) || acusador < 0 || acusador >= estado.jugadores) {
    return rechazo('asiento-invalido', `no seat ${acusador}`)
  }
  const jugada = estado.ultimaJugada
  if (estado.fase !== 'ventana' || jugada === null) {
    return rechazo('fase-equivocada', 'there is no play open to a call')
  }
  if (acusador === jugada.asiento) {
    return rechazo('jugada-propia', 'nobody may call their own play')
  }

  const cartas = estado.pila.slice(-jugada.cantidad)
  // A lie if any card is not the announced rank. There are no comodines, but a
  // comodín would not be the rank either.
  const eraMentira = cartas.some((carta) => !isNormal(carta) || carta.rank !== jugada.rango)
  const seLlevo = eraMentira ? jugada.asiento : acusador

  const manos = conMano(estado.manos, seLlevo, [...estado.manos[seLlevo], ...estado.pila])
  // The truth, called, on a player's last cards: they are out, and win.
  const sale = !eraMentira && manos[jugada.asiento].length === 0

  return {
    ok: true,
    estado: {
      ...estado,
      manos,
      pila: [],
      fase: 'jugar',
      ultimaAcusacion: {
        acusador,
        acusado: jugada.asiento,
        cartas,
        rango: jugada.rango,
        eraMentira,
        seLlevo,
        cartasDeLaPila: estado.pila.length,
      },
      ganador: sale ? jugada.asiento : null,
    },
  }
}

function cerrarVentana(estado: EstadoMentiroso): ResultadoMentiroso {
  const jugada = estado.ultimaJugada
  if (estado.fase !== 'ventana' || jugada === null) {
    return rechazo('fase-equivocada', 'there is no window to close')
  }
  // Nobody called: the play stands, and if it was the last of a hand, that
  // player is out.
  const sale = estado.manos[jugada.asiento].length === 0
  return {
    ok: true,
    estado: { ...estado, fase: 'jugar', ganador: sale ? jugada.asiento : null },
  }
}

function conMano(
  manos: readonly (readonly Card[])[],
  asiento: number,
  mano: readonly Card[],
): readonly (readonly Card[])[] {
  return manos.map((actual, i) => (i === asiento ? mano : actual))
}

/**
 * What the player's clock plays for a person who let it run out (Phase 80):
 * one card from their hand, chosen from the seed, announced as the rank in
 * turn like any play. The same partida at the same play always picks the
 * same card, so a replay replays it.
 */
export function jugadaDelReloj(estado: EstadoMentiroso): MoveMentiroso | null {
  if (terminada(estado) || estado.fase !== 'jugar') return null
  const mano = estado.manos[estado.turno]
  if (mano.length === 0) return null
  const rng = createRng(`${estado.seed}#reloj#${estado.numeroDeJugada}`)
  return {
    type: 'jugar',
    asiento: estado.turno,
    cartaIds: [mano[rng.nextInt(mano.length)].id],
  }
}
