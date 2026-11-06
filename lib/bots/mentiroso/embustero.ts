/**
 * El Embustero: el Mentiroso's baseline bot (Phase 77) — what El Codicioso is
 * to Carioca. Plain, honest when it can afford to be, and never fooled by a
 * claim its own hand disproves.
 *
 * Playing:
 *   - Holding the rank in turn, it plays every copy it has, truthfully. A
 *     true play costs nothing and sheds the most cards.
 *   - Not holding it, it lies with one card: the one it will be asked for
 *     last. Its own turns come every `jugadores` plays, so each rank in its
 *     hand has a "next time I am asked for this" — the card furthest from
 *     that is the one it misses least.
 *
 * Calling:
 *   - Always, when the claim is impossible: what it holds of the announced
 *     rank plus what was claimed is more than the four a deck has.
 *   - Always, when the play would take that player out: letting it pass loses
 *     the partida for certain, a wrong call only costs the pile.
 *   - Otherwise never. A baseline that calls on hunches is a coin, not a
 *     player; stronger bots can weigh the pile against the odds.
 *   - Never with no bullets left. A certain call never costs one — what it
 *     calls is a lie, so the bullet comes back — only a last-play call can.
 */

import { type Card, type Rank, RANKS, isNormal, rankAfter } from '@/lib/engine'
import { MAX_CARTAS_POR_JUGADA } from '@/lib/engine/mentiroso'
import type { BotMentiroso } from './bot'

/** Copies of each rank in el Mentiroso's single deck. */
const COPIAS_POR_RANGO = 4

const deRango = (mano: readonly Card[], rango: Rank) =>
  mano.filter((carta) => isNormal(carta) && carta.rank === rango)

/**
 * How many of this seat's own turns until it is asked for `rango`, counting
 * from the turn it is playing now (which announces `enTurno`). Every rank
 * comes round: 13 is prime, so stepping by any table size from 3 to 6 visits
 * all thirteen.
 */
function turnosHasta(rango: Rank, enTurno: Rank, jugadores: number): number {
  for (let vuelta = 1; vuelta <= RANKS.length; vuelta++) {
    if (rankAfter(enTurno, vuelta * jugadores) === rango) return vuelta
  }
  return RANKS.length
}

export const EL_EMBUSTERO: BotMentiroso = {
  id: 'embustero',
  nombre: 'El Embustero',
  descripcion: 'Dice la verdad cuando puede y miente con lo que menos le sirve.',

  jugar(vista) {
    const verdad = deRango(vista.mano, vista.rangoEnTurno)
    if (verdad.length > 0) {
      return verdad.slice(0, MAX_CARTAS_POR_JUGADA).map((carta) => carta.id)
    }
    const jugadores = vista.cartasPorAsiento.length
    let elegida = vista.mano[0]
    let lejos = -1
    for (const carta of vista.mano) {
      const distancia = isNormal(carta)
        ? turnosHasta(carta.rank, vista.rangoEnTurno, jugadores)
        : RANKS.length
      if (distancia > lejos) {
        lejos = distancia
        elegida = carta
      }
    }
    return [elegida.id]
  },

  acusar(vista) {
    const jugada = vista.ultimaJugada
    if (vista.fase !== 'ventana' || !jugada || jugada.asiento === vista.asiento) return false
    // No bullets, no call (2026-11-05).
    if (vista.balas && vista.balas[vista.asiento] <= 0) return false
    const tengo = deRango(vista.mano, jugada.rango).length
    if (tengo + jugada.cantidad > COPIAS_POR_RANGO) return true
    return vista.cartasPorAsiento[jugada.asiento] === 0
  },
}
