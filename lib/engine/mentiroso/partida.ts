/**
 * El Mentiroso: the whole game as a pure state machine (Phase 76).
 *
 * The rules are `specs/mentiroso-rules.md`; every rule there is enforced here
 * and nowhere else. Like Carioca's `apply`, the referee validates and never
 * decides: a move is accepted or refused with a reason, and an accepted move
 * returns a new state.
 *
 * Two phases:
 *
 *   'jugar'   — nothing is open to a call: the start, and right after a call.
 *               The seat in turn plays 1–4 cards, announced as the rank in turn.
 *   'ventana' — the last play is on the pile and open to a call by anyone but
 *               who made it. **The next player's play closes it** (the owner,
 *               2026-11-05, as Plato plays it): the seat in turn may call or
 *               play, and the moment its cards land the play before is safe.
 *
 * One exception keeps a last card honest. If the open play emptied its
 * player's hand, the seat in turn cannot simply play over it — that would let
 * them out unchallenged by doing nothing. It must call, or accept with
 * `cerrarVentana` («Le creo»), which is also what the player's clock sends.
 */

import { construirBaraja } from '../comun/baraja'
import { type Card, type Rank, RANKS, isNormal, rankAfter } from '../comun/cards'
import { createRng, shuffle } from '../comun/random'

export const MIN_JUGADORES = 3
export const MAX_JUGADORES = 6
export const MIN_CARTAS_POR_JUGADA = 1
export const MAX_CARTAS_POR_JUGADA = 4
/** Bullets each player starts with (the owner's table, as Plato plays it). */
export const BALAS_POR_DEFECTO = 3
/** What the lobby offers. */
export const OPCIONES_DE_BALAS = [1, 2, 3, 4, 5] as const
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
  /** The caller spent a bullet: the play was true. A lie gives it back. */
  readonly gastoBala: boolean
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
  /**
   * Bullets per seat (2026-11-05): calling costs one, a lie found gives it
   * back, none left and you cannot call. Absent only in a partida dealt
   * before bullets existed, which calls without limit.
   */
  readonly balas?: readonly number[]
  /**
   * Seats that left on purpose (Phase 80): no cards, no turn, no call.
   * Absent means nobody has — every partida before leaving existed.
   */
  readonly retirados?: readonly number[]
  /** Ended with nobody out: fewer than two seats left (Phase 80). */
  readonly sinGanador?: boolean
}

/** Is this seat still playing? */
export function estaEnJuego(estado: EstadoMentiroso, asiento: number): boolean {
  return !(estado.retirados ?? []).includes(asiento)
}

/** The next seat after `asiento` that is still playing, in turn order. */
export function siguienteEnJuego(estado: EstadoMentiroso, asiento: number): number {
  for (let paso = 1; paso <= estado.jugadores; paso++) {
    const otro = (asiento + paso) % estado.jugadores
    if (estaEnJuego(estado, otro)) return otro
  }
  return asiento
}

/** Over: somebody went out, or too few seats were left to play on. */
export function terminada(estado: EstadoMentiroso): boolean {
  return estado.ganador !== null || estado.sinGanador === true
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
  /** The open play emptied a hand: call it or accept it, but do not play over it. */
  | 'ultima-jugada-pendiente'
  /** No bullets left: this player can no longer call. */
  | 'sin-balas'

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
  /** Bullets each player starts with. Default 3. */
  balas?: number
}): EstadoMentiroso {
  const { jugadores, seed, balas = BALAS_POR_DEFECTO } = opciones
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
    balas: Array.from({ length: jugadores }, () => balas),
  }
}

/** Bullets this seat has left; a partida without bullets never runs out. */
export function balasDe(estado: { balas?: readonly number[] }, asiento: number): number {
  return estado.balas ? estado.balas[asiento] : Number.POSITIVE_INFINITY
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

  // Playing closes the open window — unless the play in it emptied a hand.
  if (estado.fase === 'ventana' && estado.ultimaJugada) {
    if (estado.manos[estado.ultimaJugada.asiento].length === 0) {
      return rechazo(
        'ultima-jugada-pendiente',
        'that play emptied a hand: call it or accept it first',
      )
    }
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
      turno: siguienteEnJuego(estado, asiento),
      fase: 'ventana',
      numeroDeJugada: estado.numeroDeJugada + 1,
    },
  }
}

function acusar(estado: EstadoMentiroso, acusador: number): ResultadoMentiroso {
  if (
    !Number.isInteger(acusador) ||
    acusador < 0 ||
    acusador >= estado.jugadores ||
    !estaEnJuego(estado, acusador)
  ) {
    return rechazo('asiento-invalido', `seat ${acusador} is not playing`)
  }
  const jugada = estado.ultimaJugada
  if (estado.fase !== 'ventana' || jugada === null) {
    return rechazo('fase-equivocada', 'there is no play open to a call')
  }
  if (acusador === jugada.asiento) {
    return rechazo('jugada-propia', 'nobody may call their own play')
  }
  if (balasDe(estado, acusador) <= 0) {
    return rechazo('sin-balas', `seat ${acusador} has no bullets left`)
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
        gastoBala: !eraMentira,
      },
      // The bullet is spent on a true play; a lie found gives it back.
      ...(estado.balas && !eraMentira
        ? { balas: estado.balas.map((b, i) => (i === acusador ? b - 1 : b)) }
        : {}),
      ganador: sale ? jugada.asiento : null,
    },
  }
}

function cerrarVentana(estado: EstadoMentiroso): ResultadoMentiroso {
  const jugada = estado.ultimaJugada
  if (estado.fase !== 'ventana' || jugada === null) {
    return rechazo('fase-equivocada', 'there is no window to close')
  }
  // Accepted — by the seat in turn, or by its clock: the play stands, and if
  // it was the last of a hand, that player is out.
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
 * A seat leaves on purpose (Phase 80, `mentiroso-rules.md` «Leaving»). Its
 * cards leave play, the turn skips it, and it can no longer call. Its own
 * play in the window stands and the window closes — leaving is never a way
 * to go out. Fewer than two seats left, and the partida ends with no winner.
 */
export function retirarMentiroso(estado: EstadoMentiroso, asiento: number): EstadoMentiroso {
  if (terminada(estado) || !estaEnJuego(estado, asiento)) return estado

  const retirados = [...(estado.retirados ?? []), asiento]
  const sinEl: EstadoMentiroso = {
    ...estado,
    manos: conMano(estado.manos, asiento, []),
    retirados,
  }
  const suJugadaEnVentana =
    estado.fase === 'ventana' && estado.ultimaJugada?.asiento === asiento
  const turno = estado.turno === asiento ? siguienteEnJuego(sinEl, asiento) : estado.turno
  const quedan = estado.jugadores - retirados.length

  return {
    ...sinEl,
    turno,
    fase: suJugadaEnVentana ? 'jugar' : estado.fase,
    ...(quedan < 2 ? { sinGanador: true } : {}),
  }
}

/** The open play emptied its player's hand: the seat in turn must call or accept. */
export function debeAceptarOAcusar(estado: EstadoMentiroso): boolean {
  return (
    estado.fase === 'ventana' &&
    estado.ultimaJugada !== null &&
    estado.manos[estado.ultimaJugada.asiento].length === 0
  )
}

/**
 * What the player's clock does for a person who let it run out (Phase 80):
 * accepts a play that emptied a hand, or plays one card from theirs, chosen
 * from the seed, announced as the rank in turn like any play. The same
 * partida at the same play always picks the same card, so a replay replays it.
 */
export function jugadaDelReloj(estado: EstadoMentiroso): MoveMentiroso | null {
  if (terminada(estado)) return null
  if (debeAceptarOAcusar(estado)) return { type: 'cerrarVentana' }
  const mano = estado.manos[estado.turno]
  if (mano.length === 0) return null
  const rng = createRng(`${estado.seed}#reloj#${estado.numeroDeJugada}`)
  return {
    type: 'jugar',
    asiento: estado.turno,
    cartaIds: [mano[rng.nextInt(mano.length)].id],
  }
}
