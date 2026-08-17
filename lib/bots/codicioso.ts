/**
 * El Codicioso — the simplest bot that can finish a game.
 *
 * It plays legally and to the end, and no better than that. It lays down the
 * moment it can, unloads anything that fits, and throws the card that is
 * furthest from being useful. There is no memory of what has been discarded, no
 * reading of opponents, and no waiting for a better hand — those belong to the
 * bots with difficulty levels, later.
 *
 * It cannot peek at another hand, because it never receives one: a bot decides
 * from a `VistaDeAsiento` — what its seat can legitimately see — and the view
 * has no field that could carry anyone else's cards (Phase 30).
 */

import {
  type Card,
  type Move,
  type VistaDeAsiento,
  isComodin,
  probarEnMesa,
  puntosDeCarta,
} from '@/lib/engine'
import { buscarAgrupacion, utilidadDeCarta } from './agrupar'

export type Bot = {
  readonly nombre: string
  /** One legal move for the seat whose turn it is, decided from its view. */
  decidir(vista: VistaDeAsiento): Move
}

export const codicioso: Bot = {
  nombre: 'El Codicioso',
  decidir: decidirCodicioso,
}

export function decidirCodicioso(vista: VistaDeAsiento): Move {
  if (vista.fase === 'draw') return decidirRobo(vista)

  // Lay down at the first opportunity. A patient bot would sometimes wait; this
  // one never does, which is exactly what makes it a baseline.
  if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
    const agrupacion = buscarAgrupacion(vista.mano, vista.contrato)
    if (agrupacion) return { type: 'bajarse', propuestas: agrupacion }
  } else {
    const descarga = buscarDescarga(vista)
    if (descarga) return descarga
  }

  return { type: 'descartar', cardId: peorCarta(vista).id }
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

function decidirRobo(vista: VistaDeAsiento): Move {
  const arriba = vista.descarte.at(-1)

  if (arriba) {
    if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
      const conLaCarta = utilidadDeCarta(arriba, [...vista.mano, arriba], vista.contrato)
      if (conLaCarta >= MITAD_DEL_CAMINO) return { type: 'robar', de: 'descarte' }
    } else if (ligaDeInmediato(vista, arriba)) {
      // Once bajado, "useful for the contract" means nothing — the contract is
      // already on the mesa. The face-up card is only worth taking if it can
      // be unloaded right now. Anything looser loops: two bajado bots passing
      // each other's "useful" discards forever is how the one soak stall that
      // survived the tablas rule actually happened (seed soak-204).
      return { type: 'robar', de: 'descarte' }
    }
  }

  return vista.stock > 0 || vista.descarte.length > 1
    ? { type: 'robar', de: 'stock' }
    : { type: 'robar', de: 'descarte' }
}

/** Whether the descarte's top card could be ligada this very turn. */
function ligaDeInmediato(vista: VistaDeAsiento, arriba: Card): boolean {
  const trasTomarla: VistaDeAsiento = {
    ...vista,
    fase: 'act',
    mano: [...vista.mano, arriba],
    descarte: vista.descarte.slice(0, -1),
  }
  return ligaEnAlgunGrupo(trasTomarla, arriba) !== null
}

/**
 * The first card that the referee will accept onto some grupo already on the
 * mesa. Proposing and letting the referee answer avoids re-implementing the
 * rules about who may touch what and when — `probarEnMesa` runs the real
 * `apply` over the view, so the trial and the real move cannot disagree.
 */
function buscarDescarga(vista: VistaDeAsiento): Move | null {
  // Own grupos first, simply as a preference: on the turn it bajó the engine
  // refuses every one of these, and the bot falls through to a discard.
  const asientos = [
    vista.asiento,
    ...vista.jugadores.map((_, seat) => seat).filter((seat) => seat !== vista.asiento),
  ]

  for (const card of vista.mano) {
    // Never unload the last card this way — the turn still has to end in a
    // discard.
    if (vista.mano.length <= 1) return null

    const move = ligaEnAlgunGrupo(vista, card, asientos)
    if (move) return move
  }

  return null
}

/** The first grupo on the mesa that the referee lets this card join. */
function ligaEnAlgunGrupo(
  vista: VistaDeAsiento,
  card: Card,
  asientos: readonly number[] = vista.jugadores.map((_, seat) => seat),
): Move | null {
  for (const seat of asientos) {
    const grupos = vista.jugadores[seat].grupos
    for (let grupoIndex = 0; grupoIndex < grupos.length; grupoIndex++) {
      for (const end of ['tail', 'head'] as const) {
        const move = {
          type: 'agregar',
          seat,
          grupoIndex,
          cardIds: [card.id],
          end,
        } satisfies Move
        if (probarEnMesa(vista, move).ok) return move
      }
    }
  }
  return null
}

/**
 * The card to throw: least useful first, and among equally useless ones the
 * most expensive, since points are penalties.
 */
function peorCarta(vista: VistaDeAsiento): Card {
  return vista.mano.reduce((peor, card) => {
    const utilidadCard = utilidadDeCarta(card, vista.mano, vista.contrato)
    const utilidadPeor = utilidadDeCarta(peor, vista.mano, vista.contrato)

    if (utilidadCard !== utilidadPeor) return utilidadCard < utilidadPeor ? card : peor
    if (isComodin(card) || isComodin(peor)) return isComodin(peor) ? card : peor
    return puntosDeCarta(card) > puntosDeCarta(peor) ? card : peor
  })
}
