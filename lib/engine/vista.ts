/**
 * The seat's view: what one seat can legitimately see.
 *
 * The discipline is structural, not behavioral — the same trick that keeps
 * `Relato`'s `mazo` variant from ever naming a hidden card. There is exactly
 * one hand anywhere in this type: the seat's own. Everyone else appears as a
 * count of cards, their grupos, and whether they have bajado — all public.
 * The stock is a number, not a pile, and `rngState` does not appear at all:
 * whoever holds the stream can predict the stock, so a view never carries it.
 *
 * Bots decide from a view. The server sends each player a view. A client that
 * only ever receives views cannot leak what it never had.
 */

import { type Card } from './cards'
import { type Contrato } from './contratos'
import { type Grupo } from './grupos'
import {
  type Move,
  type MoveErrorCode,
  type RondaState,
  type TurnPhase,
  apply,
} from './ronda'

export type VistaJugador = {
  /** How many cards this seat holds — a fanned back, never faces. */
  readonly cartas: number
  /** Grupos on the mesa are communal knowledge. */
  readonly grupos: readonly Grupo[]
  readonly bajadoEnTurno: number | null
}

export type VistaDeAsiento = {
  /** The seat this view belongs to. */
  readonly asiento: number
  /** The only hand in the whole structure: this seat's own. */
  readonly mano: readonly Card[]
  readonly contrato: Contrato
  /** Every seat, this one included, reduced to what everybody can see. */
  readonly jugadores: readonly VistaJugador[]
  /** Cards left in the stock. Their order and faces are secret. */
  readonly stock: number
  /** The whole descarte, top card last: every card in it fell face up. */
  readonly descarte: readonly Card[]
  /** Everybody watched the descarte rebuild the stock — a public count. */
  readonly rebarajadas: number
  readonly turno: number
  readonly numeroDeTurno: number
  readonly fase: TurnPhase
  readonly ganador: number | 'nadie' | null
}

export function vistaDeAsiento(
  state: RondaState,
  asiento: number,
): VistaDeAsiento {
  return {
    asiento,
    mano: state.jugadores[asiento].hand,
    contrato: state.contrato,
    jugadores: state.jugadores.map((jugador) => ({
      cartas: jugador.hand.length,
      grupos: jugador.grupos,
      bajadoEnTurno: jugador.bajadoEnTurno,
    })),
    stock: state.stock.length,
    descarte: state.discard,
    rebarajadas: state.rebarajadas,
    turno: state.turno,
    numeroDeTurno: state.numeroDeTurno,
    fase: state.fase,
    ganador: state.ganador,
  }
}

/** The moves whose target sits on the mesa. */
export type MoveDeMesa = Extract<Move, { type: 'agregar' | 'moverComodin' }>

export type ResultadoDeEnsayo =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: MoveErrorCode; readonly detail: string }

/**
 * Whether the referee would accept a mesa move, judged from the view alone.
 *
 * A mesa move's legality depends only on public information plus the mover's
 * own hand — exactly what a view holds. So the trial imagines the ronda around
 * the view (other hands empty, stock empty, a dummy rng) and asks the actual
 * `apply`. The imagined parts are never read by the mesa code paths, so
 * agreement with the real referee is structural, not hoped for.
 *
 * Only meaningful for the seat in turn: touching the mesa is something you do
 * on your own turn, and the view knows whose turn it is.
 */
export function probarEnMesa(
  vista: VistaDeAsiento,
  move: MoveDeMesa,
): ResultadoDeEnsayo {
  const result = apply(rondaImaginada(vista), move)
  return result.ok ? { ok: true } : result
}

/**
 * A ronda that agrees with the view on everything public and invents nothing
 * else: hands it cannot know are empty, the stock is empty, the rng is a
 * stand-in. Good only for trying moves that never look at those parts.
 */
function rondaImaginada(vista: VistaDeAsiento): RondaState {
  return {
    contrato: vista.contrato,
    jugadores: vista.jugadores.map((jugador, seat) => ({
      hand: seat === vista.asiento ? vista.mano : [],
      grupos: jugador.grupos,
      bajadoEnTurno: jugador.bajadoEnTurno,
    })),
    stock: [],
    discard: vista.descarte,
    rebarajadas: vista.rebarajadas,
    turno: vista.turno,
    numeroDeTurno: vista.numeroDeTurno,
    fase: vista.fase,
    rngState: 1,
    ganador: vista.ganador,
  }
}
