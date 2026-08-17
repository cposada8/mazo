import { describe, expect, it } from 'vitest'
import { asientosRivales } from '@/lib/asientos'

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
    expect(rival.y).toBeLessThan(20) // top of the table
  })

  it('goes round in turn order, starting on your left', () => {
    const rivales = asientosRivales(4, 0)
    expect(rivales.map((a) => a.seat)).toEqual([1, 2, 3])

    // Left to right on screen is the same as the order of play.
    const xs = rivales.map((a) => a.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it('counts round from whichever seat is yours', () => {
    const rivales = asientosRivales(4, 2)
    expect(rivales.map((a) => a.seat)).toEqual([3, 0, 1])
    expect(rivales.map((a) => a.vuelta)).toEqual([1, 2, 3])
  })

  it('keeps every seat on the table', () => {
    for (let jugadores = 2; jugadores <= 6; jugadores++) {
      for (const asiento of asientosRivales(jugadores, 0)) {
        expect(asiento.x).toBeGreaterThan(2)
        expect(asiento.x).toBeLessThan(98)
        expect(asiento.y).toBeGreaterThan(2)
        // Well clear of the bottom, which is your hand.
        expect(asiento.y).toBeLessThan(75)
      }
    }
  })

  it('refuses a table nobody can play at', () => {
    expect(() => asientosRivales(1, 0)).toThrow()
  })
})
