/**
 * A quick way to play a ronda out, for El Tahúr's imagined rondas (Phase 56).
 *
 * A simulation needs every seat to play hundreds of turns per decision, so
 * the players inside it have to be cheap. This one plays every seat the same
 * plain way — never cleverly, always legally enough that the engine accepts
 * it — and its decisions touch the engine only to apply a move, never to try
 * one out. It sees the imagined state whole, which is fine: it is the
 * imagination, not a player at the real table.
 *
 * Plain, not foolish: it lays down as soon as it can, puts on the mesa what
 * fits an open end or a trío, and throws its most expensive loose card —
 * roughly how rondas go, which is all the simulation needs from it.
 */

import {
  type Card,
  type Grupo,
  type Move,
  type RondaState,
  apply,
  isComodin,
  puntosDeCarta,
  puntosDeMano,
  rankAfter,
  vistaDeAsiento,
} from '@/lib/engine'
import { buscarAgrupacion } from './agrupar'
import { decidirCalculador } from './calculador'

/** A played-out ronda stops here, move-wise, whatever happened. */
const TOPE_DE_MOVIMIENTOS = 1500

/**
 * The ronda played to its end from `inicio`; what `yo` scores in it: nothing
 * for going out, the hand otherwise.
 */
export function jugarRapido(inicio: RondaState, yo: number): number {
  let estado = inicio
  for (let i = 0; i < TOPE_DE_MOVIMIENTOS && estado.ganador === null; i++) {
    const result = apply(estado, moverRapido(estado))
    if (!result.ok) break
    estado = result.state
  }
  return estado.ganador === yo ? 0 : puntosDeMano(estado.jugadores[yo].hand)
}

export function moverRapido(estado: RondaState): Move {
  const jugador = estado.jugadores[estado.turno]
  const mano = jugador.hand
  const bajado = jugador.bajadoEnTurno !== null

  if (estado.fase === 'draw') {
    const arriba = estado.discard.at(-1)
    if (arriba && !isComodin(arriba)) {
      const sirve = bajado
        ? mesaAbierta(estado) && dondeCabe(arriba, estado) !== null
        : mano.filter((card) => !isComodin(card) && card.rank === arriba.rank).length >= 2
      if (sirve) return { type: 'robar', de: 'descarte' }
    }
    if (arriba && isComodin(arriba)) return { type: 'robar', de: 'descarte' }
    return estado.stock.length > 0 || estado.discard.length > 1
      ? { type: 'robar', de: 'stock' }
      : { type: 'robar', de: 'descarte' }
  }

  if (!bajado) {
    const agrupacion = buscarAgrupacion(mano, estado.contrato)
    if (agrupacion) return { type: 'bajarse', propuestas: agrupacion }
  } else if (mesaAbierta(estado) && mano.length > 1) {
    for (const card of mano) {
      if (isComodin(card)) continue
      const lugar = dondeCabe(card, estado)
      if (lugar) return { type: 'agregar', ...lugar, cardIds: [card.id] }
    }
  }

  return { type: 'descartar', cardId: peorSuelta(mano, bajado).id }
}

function mesaAbierta(estado: RondaState): boolean {
  const bajadoEnTurno = estado.jugadores[estado.turno].bajadoEnTurno
  return bajadoEnTurno !== null && bajadoEnTurno < estado.numeroDeTurno
}

/** A grupo on the mesa this card extends, found without asking the engine. */
function dondeCabe(
  card: Card,
  estado: RondaState,
): { seat: number; grupoIndex: number; end?: 'head' | 'tail' } | null {
  if (isComodin(card)) return null
  for (let seat = 0; seat < estado.jugadores.length; seat++) {
    const grupos: readonly Grupo[] = estado.jugadores[seat].grupos
    for (let grupoIndex = 0; grupoIndex < grupos.length; grupoIndex++) {
      const grupo = grupos[grupoIndex]
      if (grupo.kind === 'trio' && grupo.rank === card.rank) return { seat, grupoIndex }
      if (grupo.kind === 'escala' && grupo.suit === card.suit && grupo.cards.length < 13) {
        if (rankAfter(grupo.start, grupo.cards.length) === card.rank) {
          return { seat, grupoIndex, end: 'tail' }
        }
        if (rankAfter(grupo.start, -1) === card.rank) return { seat, grupoIndex, end: 'head' }
      }
    }
  }
  return null
}

/**
 * The card to throw: before bajarse, the dearest one with no partner of its
 * rango and no neighbour in its pinta; after, simply the dearest. A comodín
 * only when nothing else is left.
 */
function peorSuelta(mano: readonly Card[], bajado: boolean): Card {
  const reales = mano.filter((card) => !isComodin(card))
  if (reales.length === 0) return mano[0]

  const suelta = (card: Card) =>
    !isComodin(card) &&
    !reales.some(
      (otra) =>
        otra.id !== card.id &&
        !isComodin(otra) &&
        (otra.rank === card.rank ||
          (otra.suit === card.suit &&
            (rankAfter(otra.rank, 1) === card.rank || rankAfter(otra.rank, -1) === card.rank))),
    )

  const pool = bajado ? reales : reales.filter(suelta).length > 0 ? reales.filter(suelta) : reales
  return pool.reduce((peor, card) => (puntosDeCarta(card) > puntosDeCarta(peor) ? card : peor))
}

/**
 * The ronda played out with `yo` playing carefully — as El Calculador, the
 * way the bot asking will really play its own future turns — and everybody
 * else the quick way, since they make three moves in four.
 */
export function jugarConCuidado(inicio: RondaState, yo: number): number {
  let estado = inicio
  for (let i = 0; i < TOPE_DE_MOVIMIENTOS && estado.ganador === null; i++) {
    const move =
      estado.turno === yo ? decidirCalculador(vistaDeAsiento(estado, yo)) : moverRapido(estado)
    const result = apply(estado, move)
    if (!result.ok) break
    estado = result.state
  }
  return estado.ganador === yo ? 0 : puntosDeMano(estado.jugadores[yo].hand)
}
