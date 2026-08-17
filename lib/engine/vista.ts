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
import type { Marcador, PartidaConfig, PartidaState } from './partida'
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

/**
 * A whole partida as one seat may see it: the ronda in play reduced to that
 * seat's view, and everything above the ronda — the scoreboard, the totals,
 * which contract we are on — which was always public.
 *
 * This is the payload the server sends each player (Phase 34). It is
 * `PartidaState` with exactly one field replaced, so the client can render
 * the table and the marcador from it and nothing else.
 */
export type VistaDePartida = {
  readonly asiento: number
  readonly config: PartidaConfig
  readonly players: number
  readonly seed: string
  readonly indiceContrato: number
  /** Null once every contract has been played. */
  readonly ronda: VistaDeAsiento | null
  readonly historial: readonly Marcador[]
  readonly totales: readonly number[]
  readonly ganadores: readonly number[] | null
}

export function vistaDePartida(
  state: PartidaState,
  asiento: number,
): VistaDePartida {
  return {
    asiento,
    config: state.config,
    players: state.players,
    seed: state.seed,
    indiceContrato: state.indiceContrato,
    ronda: state.ronda ? vistaDeAsiento(state.ronda, asiento) : null,
    historial: state.historial,
    totales: state.totales,
    ganadores: state.ganadores,
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

export type ResultadoEnVista =
  | { readonly ok: true; readonly vista: VistaDeAsiento }
  | { readonly ok: false; readonly code: MoveErrorCode | 'SECRETO' }

/**
 * Play one of **your own** moves against your view, so the table can show it
 * before the server answers (Phase 34).
 *
 * The same trick as `probarEnMesa`, one step further: every move a seat makes
 * out of its own hand — discarding, laying down, unloading, freeing a
 * comodín, and taking the face-up card — depends only on public information
 * plus that hand, so the real `apply` run over the imagined ronda produces
 * exactly the view the server will send back.
 *
 * The one move it refuses is drawing from the stock, and refusing it is the
 * point: which card you drew is genuinely unknowable until the server says.
 * Guessing would mean the table showing a card that is not there.
 */
export function aplicarEnVista(
  vista: VistaDeAsiento,
  move: Move,
): ResultadoEnVista {
  if (move.type === 'robar' && move.de === 'stock') {
    return { ok: false, code: 'SECRETO' }
  }

  const result = apply(rondaImaginada(vista), move)
  if (!result.ok) return result

  return { ok: true, vista: vistaDeAsiento(result.state, vista.asiento) }
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
