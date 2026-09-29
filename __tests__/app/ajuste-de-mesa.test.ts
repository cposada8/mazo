import { describe, expect, it } from 'vitest'
import { alturaDeCartaEnMesa, anchoDeGrupo, cabe } from '@/lib/ajuste-de-mesa'
import { iniciales } from '@/components/mesa'

/**
 * Phase 46: the mesa is measured, and its cards drawn at the largest height
 * at which every grupo fits. Phase 45 guessed with a step table and a real
 * phone proved the guess short — eighteen grupos overflowed the lane and the
 * top row slid under the seats.
 */

/** Six seats, three escalas each, of four to six cards. */
const DIECIOCHO = Array.from({ length: 18 }, (_, i) => 4 + (i % 3))

/** The mesa lane on the phone the bug was reported from, lying down. */
const TELEFONO = { ancho: 500, alto: 100 }

describe('alturaDeCartaEnMesa', () => {
  it('fits eighteen grupos into a landscape phone lane', () => {
    const carta = alturaDeCartaEnMesa({
      grupos: DIECIOCHO,
      ...TELEFONO,
      minimo: 22,
      maximo: 60,
    })
    expect(carta).toBeGreaterThan(22)
    expect(cabe(DIECIOCHO, TELEFONO.ancho, TELEFONO.alto, carta)).toBe(true)
    // And it is the largest that fits, not merely one that does.
    expect(cabe(DIECIOCHO, TELEFONO.ancho, TELEFONO.alto, carta + 1)).toBe(false)
  })

  it('draws a quiet table at full size', () => {
    expect(
      alturaDeCartaEnMesa({ grupos: [3, 4], ...TELEFONO, minimo: 22, maximo: 60 }),
    ).toBe(60)
  })

  it('never grows as grupos are added', () => {
    let anterior = Infinity
    for (let cuantos = 0; cuantos <= 24; cuantos++) {
      const carta = alturaDeCartaEnMesa({
        grupos: DIECIOCHO.concat(DIECIOCHO).slice(0, cuantos),
        ...TELEFONO,
        minimo: 22,
        maximo: 60,
      })
      expect(carta).toBeLessThanOrEqual(anterior)
      anterior = carta
    }
  })

  it('stops at the minimum rather than drawing cards nobody can read', () => {
    const muchas = Array.from({ length: 80 }, () => 7)
    expect(
      alturaDeCartaEnMesa({ grupos: muchas, ...TELEFONO, minimo: 22, maximo: 60 }),
    ).toBe(22)
  })

  it('draws at the maximum before the lane has been measured', () => {
    expect(
      alturaDeCartaEnMesa({ grupos: DIECIOCHO, ancho: 0, alto: 0, minimo: 22, maximo: 60 }),
    ).toBe(60)
  })
})

describe('anchoDeGrupo', () => {
  it('is one whole card, plus a corner for every card after it', () => {
    expect(anchoDeGrupo(1, 110)).toBeCloseTo(80)
    expect(anchoDeGrupo(3, 110)).toBeCloseTo(80 + 2 * 0.36 * 110)
  })
})

describe('iniciales', () => {
  it('tells the bots apart instead of printing their article', () => {
    // Five fichas reading «E» was the whole far edge saying nothing.
    expect(iniciales('El Codicioso 3')).toBe('C3')
    expect(iniciales('La Tortuga')).toBe('T')
  })

  it('takes one letter from a single-word alias', () => {
    expect(iniciales('lordcepm')).toBe('L')
    expect(iniciales('  ')).toBe('?')
  })
})
