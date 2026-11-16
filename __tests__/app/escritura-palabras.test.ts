import { describe, expect, it } from 'vitest'
import {
  borrar,
  completa,
  escribir,
  escrituraVacia,
  mover,
  palabraDe,
} from '@/components/palabras/escritura'

/** Writing a try anywhere in the row (the owner, 2026-11-15). */

const teclear = (e: ReturnType<typeof escrituraVacia>, texto: string) =>
  [...texto].reduce(escribir, e)

describe('writing a try', () => {
  it('left to right, as before', () => {
    const e = teclear(escrituraVacia(5), 'FLECO')
    expect(palabraDe(e)).toBe('FLECO')
    expect(completa(e)).toBe(true)
  })

  it('«**ECO»: touch the third tile, type the end, and typing carries on at the first empty tile', () => {
    let e = teclear(mover(escrituraVacia(5), 2), 'ECO')
    expect(e.letras).toEqual([null, null, 'E', 'C', 'O'])
    expect(e.cursor).toBe(0)
    e = teclear(e, 'FL')
    expect(palabraDe(e)).toBe('FLECO')
  })

  it('«**C*A»: two letters apart, then the gaps fill in order', () => {
    let e = escribir(mover(escrituraVacia(5), 2), 'C')
    e = escribir(mover(e, 4), 'A')
    expect(e.letras).toEqual([null, null, 'C', null, 'A'])
    e = teclear(e, 'MAR')
    expect(palabraDe(e)).toBe('MACRA')
  })

  it('typing skips tiles already written', () => {
    let e = escribir(mover(escrituraVacia(5), 1), 'X')
    e = teclear(mover(e, 0), 'AB')
    expect(e.letras).toEqual(['A', 'X', 'B', null, null])
  })

  it('⌫ clears the tile under the cursor, or steps back on an empty one', () => {
    let e = teclear(escrituraVacia(5), 'ABC')
    expect(e.cursor).toBe(3)
    e = borrar(e)
    expect(e.letras).toEqual(['A', 'B', null, null, null])
    expect(e.cursor).toBe(2)
    e = borrar(mover(e, 0))
    expect(e.letras).toEqual([null, 'B', null, null, null])
    expect(borrar(e).letras).toEqual(e.letras)
  })

  it('a row filled by typing ignores more letters, as the puzzle does', () => {
    const e = teclear(escrituraVacia(5), 'FLECO')
    expect(e.cursor).toBeNull()
    expect(palabraDe(teclear(e, 'XYZ'))).toBe('FLECO')
    // ⌫ takes the last letter back.
    const b = borrar(e)
    expect(b.letras).toEqual(['F', 'L', 'E', 'C', null])
    expect(b.cursor).toBe(4)
  })

  it('touching a tile of a full row retypes that letter', () => {
    let e = teclear(escrituraVacia(5), 'FLECO')
    e = escribir(mover(e, 1), 'R')
    expect(palabraDe(e)).toBe('FRECO')
    expect(e.cursor).toBeNull()
  })
})
