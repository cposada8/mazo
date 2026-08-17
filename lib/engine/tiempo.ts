/**
 * What a turn nobody played looks like (Phase 36).
 *
 * A seat that runs out of time loses exactly one turn: it draws from the
 * stock if the card for this turn has not been taken, throws one card at
 * random, and the turn passes. Not the worst card and not the best — a
 * timeout should cost what a timeout costs, and a program playing well on
 * your behalf is a different game.
 *
 * The randomness comes from the ronda's own stream, read without consuming
 * it, so which card goes is a pure function of the state: a replayed partida
 * replays its timeouts, exactly like everything else here.
 */

import { type Move, type RondaState } from './ronda'
import { createRng } from './random'

/** The card this seat would throw if its time ran out right now. */
export function cartaAlAzarDeLaMano(state: RondaState): string | null {
  const mano = state.jugadores[state.turno].hand
  if (mano.length === 0) return null
  return mano[createRng(state.rngState).nextInt(mano.length)].id
}

/**
 * The next move of a forced turn, or null when the turn is over.
 *
 * Called against the live state each step rather than planned up front: the
 * card drawn from the stock is not knowable before the draw lands, and the
 * discard has to be able to choose it.
 */
export function siguienteMovePorTiempo(state: RondaState): Move | null {
  if (state.ganador !== null) return null
  if (state.fase === 'draw') return { type: 'robar', de: 'stock' }

  const cardId = cartaAlAzarDeLaMano(state)
  return cardId ? { type: 'descartar', cardId } : null
}
