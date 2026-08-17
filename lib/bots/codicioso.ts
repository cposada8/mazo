/**
 * El Codicioso — the simplest bot that can finish a game.
 *
 * It plays legally and to the end, and no better than that. It lays down the
 * moment it can, unloads anything that fits, and throws the card that is
 * furthest from being useful. There is no memory of what has been discarded, no
 * reading of opponents, and no waiting for a better hand — those belong to the
 * bots with difficulty levels, later.
 *
 * It looks only at its own seat and the public piles. Never at another hand.
 */

import {
  type Card,
  type Move,
  type RondaState,
  apply,
  isComodin,
  puntosDeCarta,
} from '@/lib/engine'
import { buscarAgrupacion, utilidadDeCarta } from './agrupar'

export type Bot = {
  readonly nombre: string
  /** One legal move for the seat whose turn it is. */
  decidir(state: RondaState): Move
}

export const codicioso: Bot = {
  nombre: 'El Codicioso',
  decidir: decidirCodicioso,
}

export function decidirCodicioso(state: RondaState): Move {
  const jugador = state.jugadores[state.turno]

  if (state.fase === 'draw') return decidirRobo(state)

  // Lay down at the first opportunity. A patient bot would sometimes wait; this
  // one never does, which is exactly what makes it a baseline.
  if (jugador.bajadoEnTurno === null) {
    const agrupacion = buscarAgrupacion(jugador.hand, state.contrato)
    if (agrupacion) return { type: 'bajarse', propuestas: agrupacion }
  } else {
    const descarga = buscarDescarga(state)
    if (descarga) return descarga
  }

  return { type: 'descartar', cardId: peorCarta(state).id }
}

/**
 * Only take the face-up card if it puts this hand at least halfway to a grupo
 * the **contrato** is asking for. Otherwise draw blind.
 *
 * This threshold matters more than it looks. A looser rule — take anything with
 * a partner — measurably stops rondas from ending: the hand fills with pairs and
 * chains that pair up nicely and serve no contrato, and there is never room to
 * collect what is actually needed.
 */
const MITAD_DEL_CAMINO = 0.5

function decidirRobo(state: RondaState): Move {
  const jugador = state.jugadores[state.turno]
  const arriba = state.discard.at(-1)

  if (arriba) {
    const conLaCarta = utilidadDeCarta(arriba, [...jugador.hand, arriba], state.contrato)
    if (conLaCarta >= MITAD_DEL_CAMINO) return { type: 'robar', de: 'descarte' }
  }

  return state.stock.length > 0 || state.discard.length > 1
    ? { type: 'robar', de: 'stock' }
    : { type: 'robar', de: 'descarte' }
}

/**
 * The first card that the engine will accept onto some grupo already on the
 * mesa. Proposing and letting the referee answer avoids re-implementing the
 * rules about who may touch what and when.
 */
function buscarDescarga(state: RondaState): Move | null {
  const jugador = state.jugadores[state.turno]

  // Own grupos first, simply as a preference: on the turn it bajó the engine
  // refuses every one of these, and the bot falls through to a discard.
  const asientos = [
    state.turno,
    ...state.jugadores.map((_, seat) => seat).filter((seat) => seat !== state.turno),
  ]

  for (const card of jugador.hand) {
    // Never unload the last card this way — the turn still has to end in a
    // discard.
    if (jugador.hand.length <= 1) return null

    for (const seat of asientos) {
      const grupos = state.jugadores[seat].grupos
      for (let grupoIndex = 0; grupoIndex < grupos.length; grupoIndex++) {
        for (const end of ['tail', 'head'] as const) {
          const move: Move = {
            type: 'agregar',
            seat,
            grupoIndex,
            cardIds: [card.id],
            end,
          }
          if (apply(state, move).ok) return move
        }
      }
    }
  }

  return null
}

/**
 * The card to throw: least useful first, and among equally useless ones the
 * most expensive, since points are penalties.
 */
function peorCarta(state: RondaState): Card {
  const jugador = state.jugadores[state.turno]

  return jugador.hand.reduce((peor, card) => {
    const utilidadCard = utilidadDeCarta(card, jugador.hand, state.contrato)
    const utilidadPeor = utilidadDeCarta(peor, jugador.hand, state.contrato)

    if (utilidadCard !== utilidadPeor) return utilidadCard < utilidadPeor ? card : peor
    if (isComodin(card) || isComodin(peor)) return isComodin(peor) ? card : peor
    return puntosDeCarta(card) > puntosDeCarta(peor) ? card : peor
  })
}
