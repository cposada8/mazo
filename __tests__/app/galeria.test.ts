import { describe, expect, it } from 'vitest'
import { carasDeRonda } from '@/lib/caras'
import { ordenarGaleria } from '@/lib/galeria'

/**
 * The gallery's order (Phase 70): the faces on this ronda's comodines first,
 * marked, then the rest — each face once.
 */

const GALERIA = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg']

describe('ordenarGaleria', () => {
  it('outside a partida is the gallery as it is, nothing in play', () => {
    expect(ordenarGaleria(GALERIA)).toEqual(
      GALERIA.map((src) => ({ src, enJuego: false })),
    )
  })

  it('puts the faces in play first, in the order dealt, then the rest', () => {
    const caras = ordenarGaleria(GALERIA, ['e.jpg', 'b.jpg'])
    expect(caras.map((cara) => cara.src)).toEqual([
      'e.jpg',
      'b.jpg',
      'a.jpg',
      'c.jpg',
      'd.jpg',
      'f.jpg',
    ])
    expect(caras.map((cara) => cara.enJuego)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('shows a face once when two comodines wear it', () => {
    const caras = ordenarGaleria(
      ['a.jpg', 'b.jpg'],
      ['b.jpg', 'a.jpg', 'b.jpg', 'a.jpg'],
    )
    expect(caras).toEqual([
      { src: 'b.jpg', enJuego: true },
      { src: 'a.jpg', enJuego: true },
    ])
  })

  it('keeps a face in play that the gallery no longer lists', () => {
    const caras = ordenarGaleria(['a.jpg'], ['z.jpg'])
    expect(caras).toEqual([
      { src: 'z.jpg', enJuego: true },
      { src: 'a.jpg', enJuego: false },
    ])
  })

  it('leads with exactly the faces a ronda dealt', () => {
    const dealt = carasDeRonda({ imagenes: GALERIA, seed: 's', ronda: 2 })
    const caras = ordenarGaleria(GALERIA, [...dealt.values()])
    const enJuego = caras.filter((cara) => cara.enJuego).map((c) => c.src)
    expect(new Set(enJuego)).toEqual(new Set(dealt.values()))
    expect(caras).toHaveLength(GALERIA.length)
    expect(caras.slice(0, enJuego.length).every((c) => c.enJuego)).toBe(true)
  })
})
