/**
 * The comodín gallery: the faces a comodín may wear.
 *
 * One function, so every reader asks the same place. Today the gallery is a
 * folder — `public/candidatos/comodines`, curated by editing files — and this
 * reads it; Phase 71 moves it to Blob and a table without any caller changing.
 * Each entry is a URL an <img> can load.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const CARPETA = join('candidatos', 'comodines')

export async function galeriaDeComodines(): Promise<string[]> {
  try {
    return readdirSync(join(process.cwd(), 'public', CARPETA))
      .filter((nombre) => /\.(jpe?g|png|webp|avif)$/i.test(nombre))
      .sort()
      .map((nombre) => `/${CARPETA}/${nombre}`)
  } catch {
    // No folder, no faces: the comodín keeps its drawn design.
    return []
  }
}
