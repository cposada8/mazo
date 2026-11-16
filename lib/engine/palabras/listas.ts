/**
 * The word lists, by length (Phase 82, and the owner, 2026-11-15: words of
 * 5, 6, 7 and 8 letters). Each length has its answers — the only words a bag
 * is drawn from — and its accepted guesses, every real word of that length.
 */

import { ACEPTADAS_5 } from './aceptadas-5'
import { ACEPTADAS_6 } from './aceptadas-6'
import { ACEPTADAS_7 } from './aceptadas-7'
import { ACEPTADAS_8 } from './aceptadas-8'
import { type Largo, LARGO_POR_DEFECTO, esLargo } from './opciones'
import { RESPUESTAS_5 } from './respuestas-5'
import { RESPUESTAS_6 } from './respuestas-6'
import { RESPUESTAS_7 } from './respuestas-7'
import { RESPUESTAS_8 } from './respuestas-8'

const RESPUESTAS: Record<Largo, readonly string[]> = {
  5: RESPUESTAS_5,
  6: RESPUESTAS_6,
  7: RESPUESTAS_7,
  8: RESPUESTAS_8,
}
const ACEPTADAS: Record<Largo, readonly string[]> = {
  5: ACEPTADAS_5,
  6: ACEPTADAS_6,
  7: ACEPTADAS_7,
  8: ACEPTADAS_8,
}

export function respuestasDe(largo: number): readonly string[] {
  return esLargo(largo) ? RESPUESTAS[largo] : RESPUESTAS[LARGO_POR_DEFECTO]
}

const conjuntos = new Map<number, Set<string>>()

/** Every word a try of this length may be; answers are always in it. */
export function aceptadasDe(largo: number): Set<string> {
  const clave = esLargo(largo) ? largo : LARGO_POR_DEFECTO
  let conjunto = conjuntos.get(clave)
  if (!conjunto) {
    conjunto = new Set([...ACEPTADAS[clave], ...RESPUESTAS[clave]])
    conjuntos.set(clave, conjunto)
  }
  return conjunto
}
