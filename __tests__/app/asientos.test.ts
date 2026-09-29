import { describe, expect, it } from 'vitest'
import { asientosRivales, hayLados } from '@/lib/asientos'

/**
 * Seating is geometry, so it can be checked without a browser: who is where,
 * in what order, and whether anybody has been placed off the table.
 */

describe('asientosRivales', () => {
  it('seats everyone but you', () => {
    for (let jugadores = 2; jugadores <= 6; jugadores++) {
      const rivales = asientosRivales(jugadores, 0)
      expect(rivales).toHaveLength(jugadores - 1)
      expect(rivales.map((a) => a.seat)).not.toContain(0)
    }
  })

  it('puts a single opponent straight across from you', () => {
    const [rival] = asientosRivales(2, 0)
    expect(rival.x).toBe(50)
    expect(rival.y).toBe(0) // the top of the band: dead ahead
  })

  it('goes round anticlockwise: the next player is on your right', () => {
    const rivales = asientosRivales(4, 0)
    expect(rivales.map((a) => a.seat)).toEqual([1, 2, 3])

    // Turn order runs right to left on screen — play passes to the right.
    const xs = rivales.map((a) => a.x)
    expect([...xs].sort((a, b) => b - a)).toEqual(xs)
  })

  it('counts round from whichever seat is yours', () => {
    const rivales = asientosRivales(4, 2)
    expect(rivales.map((a) => a.seat)).toEqual([3, 0, 1])
    expect(rivales.map((a) => a.vuelta)).toEqual([1, 2, 3])
  })

  it('sits edge seats lower than the middle, on an arc', () => {
    const rivales = asientosRivales(6, 0).filter((a) => a.lado === 'arriba')
    const ys = rivales.map((a) => a.y)
    // Symmetric, and the middle is the top of the arc.
    expect(ys[0]).toBeCloseTo(ys[ys.length - 1], 5)
    expect(Math.min(...ys)).toBeLessThan(ys[0])
  })

  it('keeps every seat on the table, and the far edge between the sides', () => {
    for (let jugadores = 2; jugadores <= 6; jugadores++) {
      for (const asiento of asientosRivales(jugadores, 0)) {
        expect(asiento.x).toBeGreaterThanOrEqual(5)
        expect(asiento.x).toBeLessThanOrEqual(95)
        expect(asiento.y).toBeGreaterThanOrEqual(0)
        if (asiento.lado === 'arriba') {
          // The far edge: near the top, and clear of both side columns.
          expect(asiento.y).toBeLessThanOrEqual(10)
          expect(asiento.x).toBeGreaterThan(20)
          expect(asiento.x).toBeLessThan(80)
        }
      }
    }
  })

  it('uses the sides only once the far edge would crowd (Phase 46)', () => {
    // Five across the top is what ran the names into each other.
    for (const jugadores of [2, 3]) {
      expect(asientosRivales(jugadores, 0).every((a) => a.lado === 'arriba')).toBe(true)
      expect(hayLados(jugadores)).toBe(false)
    }
    for (const jugadores of [4, 5, 6]) {
      const rivales = asientosRivales(jugadores, 0)
      // The next player is on your right, the one before you on your left.
      expect(rivales[0].lado).toBe('derecha')
      expect(rivales.at(-1)?.lado).toBe('izquierda')
      expect(rivales.filter((a) => a.lado === 'arriba')).toHaveLength(jugadores - 3)
      expect(hayLados(jugadores)).toBe(true)
    }
  })

  it('refuses a table nobody can play at', () => {
    expect(() => asientosRivales(1, 0)).toThrow()
  })
})
