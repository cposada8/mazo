/**
 * Writing a try (the owner, 2026-11-15): not only left to right. Touching a
 * tile of the row in play puts the cursor there, so «**ECO» can be typed
 * first and the start filled in after; typing then carries on to the next
 * empty tile, so nobody has to touch every tile to write a word.
 *
 * Pure, so the board only renders it.
 */

export type Escritura = {
  /** One slot per letter of the word; null is an empty tile. */
  readonly letras: readonly (string | null)[]
  /** The tile the next letter goes into. */
  readonly cursor: number
}

export function escrituraVacia(largo: number): Escritura {
  return { letras: Array.from({ length: largo }, () => null), cursor: 0 }
}

/** Where typing carries on: the next empty tile to the right, else the first empty one. */
function siguienteVacia(letras: readonly (string | null)[], desde: number): number | null {
  for (let i = desde + 1; i < letras.length; i++) if (letras[i] === null) return i
  for (let i = 0; i < letras.length; i++) if (letras[i] === null) return i
  return null
}

export function escribir(e: Escritura, letra: string): Escritura {
  const letras = e.letras.map((l, i) => (i === e.cursor ? letra : l))
  // A full row keeps the cursor where it was, so a letter can be retyped.
  const cursor = siguienteVacia(letras, e.cursor) ?? e.cursor
  return { letras, cursor }
}

/**
 * ⌫ clears the tile under the cursor if it holds a letter; on an empty tile
 * it steps left and clears that one, as typing backwards always has.
 */
export function borrar(e: Escritura): Escritura {
  if (e.letras[e.cursor] !== null) {
    return { letras: e.letras.map((l, i) => (i === e.cursor ? null : l)), cursor: e.cursor }
  }
  if (e.cursor === 0) return e
  const cursor = e.cursor - 1
  return { letras: e.letras.map((l, i) => (i === cursor ? null : l)), cursor }
}

export function mover(e: Escritura, cursor: number): Escritura {
  return { ...e, cursor: Math.max(0, Math.min(e.letras.length - 1, cursor)) }
}

export function completa(e: Escritura): boolean {
  return e.letras.every((l) => l !== null)
}

export function palabraDe(e: Escritura): string {
  return e.letras.map((l) => l ?? '').join('')
}
