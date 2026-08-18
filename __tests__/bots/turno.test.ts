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

  /**
   * The seating is what the lobby stores and what both homes hand back
   * (Phase 39). If the runner ignored it, every table would quietly be four
   * Codiciosos again and nobody would see a thing.
   */
  it('plays the bot the seat says, not the default one', () => {
    const partida = startPartida({ players: 3, seed: 'elenco' })
    const seat = partida.ronda!.turno

    const asientos = Array.from({ length: 3 }, (_, i) =>
      i === seat ? 'paciente' : 'codicioso',
    )
    // Turn after turn one of them lays down where the other would not: over a
    // whole partida the two plans have to part company somewhere.
    let comoCodicioso = 0
    let comoPaciente = 0
    let estado = partida

    for (let turno = 0; turno < 40 && estado.ronda; turno++) {
      if (estado.ronda.turno === seat) {
        comoCodicioso += movesDelTurno(estado).filter((m) => m.type === 'bajarse').length
        comoPaciente += movesDelTurno(estado, asientos).filter(
          (m) => m.type === 'bajarse',
        ).length
      }
      for (const move of movesDelTurno(estado)) {
        const result = aplicarEnPartida(estado, move)
        if (!result.ok) break
        estado = result.state
      }
    }

    expect(comoCodicioso).toBeGreaterThan(comoPaciente)
  })

  it('reads an unknown or missing id as the default bot', () => {
    const partida = startPartida({ players: 3, seed: 'fantasma' })

    expect(movesDelTurno(partida, ['no-existe', 'no-existe', 'no-existe'])).toEqual(
      movesDelTurno(partida),
    )
    expect(movesDelTurno(partida, [])).toEqual(movesDelTurno(partida))
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
