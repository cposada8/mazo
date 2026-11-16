/**
 * The finish table's data (Phase 92), apart from its drawing so it can be
 * tested: players as columns in standing order, words as rows in bag order.
 *
 * Built from one player's view only. It holds a rival's letters only when
 * the view does — once the player looking has finished (Phase 88's rule).
 */

import type { PalabraTerminada, Puesto, VistaPalabras } from '@/lib/engine/palabras'

export type ColumnaDeLlegada = {
  readonly asiento: number
  readonly puesto: Puesto
  /** Every word this player has ended, in bag order; null if not to be shown. */
  readonly palabras: readonly PalabraTerminada[] | null
}

export type FilaDeLlegada = {
  /** 0-based place in the bag. */
  readonly indice: number
  /** The word, from whichever column has ended it. */
  readonly palabra: string
  /** One cell per column, in column order; null where that player never ended it. */
  readonly celdas: readonly (PalabraTerminada | null)[]
}

export function tablaDeLlegada(vista: VistaPalabras): {
  columnas: ColumnaDeLlegada[]
  filas: FilaDeLlegada[]
} {
  // Each player's ended words, then — once the race is closed — the one they
  // were on, unfinished, so a word cut off by the clock is never lost.
  const conEnCurso = (
    terminadas: readonly PalabraTerminada[] | null,
    enCurso: PalabraTerminada | null,
  ) => (terminadas && enCurso ? [...terminadas, enCurso] : terminadas)
  const palabrasDe = (asiento: number): readonly PalabraTerminada[] | null => {
    if (vista.propio?.asiento === asiento) {
      return conEnCurso(vista.propio.terminadas, vista.propio.enCurso)
    }
    const rival = vista.rivales.find((r) => r.asiento === asiento)
    return rival ? conEnCurso(rival.palabras, rival.enCurso) : null
  }

  // Standing order is the race's own (`clasificacion`): fastest, or most words.
  const columnas = vista.clasificacion.map((puesto) => ({
    asiento: puesto.asiento,
    puesto,
    palabras: palabrasDe(puesto.asiento),
  }))

  // As many rows as the furthest player got.
  const largo = Math.max(0, ...columnas.map((c) => c.palabras?.length ?? 0))
  const filas = Array.from({ length: largo }, (_, indice) => {
    const celdas = columnas.map((c) => c.palabras?.[indice] ?? null)
    const palabra = celdas.find((c) => c !== null)!.palabra
    return { indice, palabra, celdas }
  })

  return { columnas, filas }
}
