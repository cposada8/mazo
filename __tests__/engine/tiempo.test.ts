import { describe, expect, it } from 'vitest'
import {
  type RondaState,
  apply,
  cartaAlAzarDeLaMano,
  siguienteMovePorTiempo,
} from '@/lib/engine'
import { makeRonda, n } from './helpers'

/**
 * Phase 36: a turn nobody played.
 *
 * It costs exactly one turn — draw, throw one at random, pass — and it is a
 * pure function of the state, so a replayed partida replays its timeouts.
 */

const mesa = (fase: 'draw' | 'act' = 'draw'): RondaState =>
  makeRonda({
    jugadores: [
      { hand: [n('7', 'spades'), n('K', 'hearts'), n('2', 'clubs')] },
      { hand: [n('9', 'diamonds')] },
    ],
    stock: [n('4', 'clubs'), n('5', 'clubs')],
    fase,
  })

describe('the forced turn', () => {
  it('draws first when the card for this turn has not been taken', () => {
    expect(siguienteMovePorTiempo(mesa('draw'))).toEqual({
      type: 'robar',
      de: 'stock',
    })
  })

  it('then throws one card, and the turn passes', () => {
    const state = mesa('act')
    const move = siguienteMovePorTiempo(state)
    expect(move?.type).toBe('descartar')

    const result = apply(state, move!)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.turno).toBe(1)
    expect(result.state.fase).toBe('draw')
    expect(result.state.jugadores[0].hand).toHaveLength(2)
  })

  it('plays out as draw-then-discard, in two moves', () => {
    let state = mesa('draw')
    const jugados: string[] = []

    for (let i = 0; i < 4; i++) {
      if (state.turno !== 0) break
      const move = siguienteMovePorTiempo(state)
      if (!move) break
      jugados.push(move.type)
      const result = apply(state, move)
      if (!result.ok) throw new Error(result.code)
      state = result.state
    }

    expect(jugados).toEqual(['robar', 'descartar'])
    expect(state.turno).toBe(1)
    // Drew one, threw one: the hand is the size it started at.
    expect(state.jugadores[0].hand).toHaveLength(3)
  })

  it('is deterministic — the same state always throws the same card', () => {
    const state = mesa('act')
    expect(cartaAlAzarDeLaMano(state)).toBe(cartaAlAzarDeLaMano(state))
  })

  it('does not always pick the same position, across states', () => {
    const elegidas = new Set<string>()
    for (let rng = 1; rng < 40; rng++) {
      const state = { ...mesa('act'), rngState: rng }
      elegidas.add(cartaAlAzarDeLaMano(state)!)
    }
    // Three cards in hand; a picker that always chose the first would be one.
    expect(elegidas.size).toBeGreaterThan(1)
  })

  it('has nothing to play once the ronda is over', () => {
    const cerrada = { ...mesa('act'), ganador: 0 as const }
    expect(siguienteMovePorTiempo(cerrada)).toBeNull()
  })
})
