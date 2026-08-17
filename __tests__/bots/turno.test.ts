import { describe, expect, it } from 'vitest'
import { movesDelTurno, tiemposDeMoves } from '@/lib/bots'
import { aplicarEnPartida, startPartida } from '@/lib/engine'

/**
 * The clock times the whole turn, so the whole turn has to be knowable up
 * front. These tests pin the two halves: the planned moves really are one
 * complete legal turn, and the times they land at fill the allotment.
 */

describe('movesDelTurno', () => {
  it('plans one complete turn: draw first, discard (or going out) last', () => {
    let partida = startPartida({ players: 3, seed: 'reloj' })

    for (let turno = 0; turno < 30 && partida.ronda; turno++) {
      const seat = partida.ronda.turno
      const antesDeHistorial = partida.historial.length
      const moves = movesDelTurno(partida)

      expect(moves.length).toBeGreaterThanOrEqual(2)
      expect(moves[0].type).toBe('robar')

      // Applying the plan is legal from start to end…
      for (const move of moves) {
        const result = aplicarEnPartida(partida, move)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        partida = result.state
      }

      // …and afterwards the turn has genuinely passed.
      if (partida.ronda && partida.historial.length === antesDeHistorial) {
        expect(partida.ronda.turno).not.toBe(seat)
      }
    }
  })

  it('returns nothing for a finished partida', () => {
    const partida = startPartida({ players: 2, seed: 'x' })
    expect(movesDelTurno({ ...partida, ronda: null })).toEqual([])
  })
})

describe('tiemposDeMoves', () => {
  it('spreads the moves and lands the last one at the whole allotment', () => {
    expect(tiemposDeMoves(2, 2000)).toEqual([1000, 2000])
    expect(tiemposDeMoves(4, 2000)).toEqual([500, 1000, 1500, 2000])
  })

  it('keeps times strictly increasing', () => {
    const tiempos = tiemposDeMoves(7, 3000)
    for (let i = 1; i < tiempos.length; i++) {
      expect(tiempos[i]).toBeGreaterThan(tiempos[i - 1])
    }
  })
})
