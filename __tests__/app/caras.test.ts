import { describe, expect, it } from 'vitest'
import { carasDeRonda } from '@/lib/caras'

/**
 * The faces the comodines wear: paint dealt from the seed, like the cards.
 * Determinism is the whole contract — a replayed partida replays its
 * comodines — and the gallery can be any size, including empty.
 */

const GALERIA = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']

describe('carasDeRonda', () => {
  it('deals one face to each of the four comodines', () => {
    const caras = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 0 })
    expect([...caras.keys()].sort()).toEqual([
      'comodin#0-0',
      'comodin#0-1',
      'comodin#1-0',
      'comodin#1-1',
    ])
    for (const cara of caras.values()) expect(GALERIA).toContain(cara)
  })

  it('is deterministic: the same seed and ronda deal the same faces', () => {
    const una = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 2 })
    const otra = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 2 })
    expect([...otra.entries()]).toEqual([...una.entries()])
  })

  it('deals different faces on different rondas of the same partida', () => {
    const primera = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 0 })
    const segunda = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 1 })
    const cambia = [...primera.keys()].some(
      (id) => primera.get(id) !== segunda.get(id),
    )
    expect(cambia).toBe(true)
  })

  it('gives the four comodines four distinct faces when it can', () => {
    const caras = carasDeRonda({ imagenes: GALERIA, seed: 'x', ronda: 0 })
    expect(new Set(caras.values()).size).toBe(4)
  })

  it('cycles a short gallery instead of failing', () => {
    const caras = carasDeRonda({ imagenes: ['solo.jpg'], seed: 'x', ronda: 0 })
    expect(caras.size).toBe(4)
    expect(new Set(caras.values())).toEqual(new Set(['solo.jpg']))
  })

  it('is empty when there is no gallery, so the drawn design stands', () => {
    expect(carasDeRonda({ imagenes: [], seed: 'x', ronda: 0 }).size).toBe(0)
  })
})
