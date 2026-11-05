/**
 * The comodín gallery: the faces a comodín may wear.
 *
 * Since Phase 71 the images live in Vercel Blob and the list in the
 * `Comodin` table, one store and one database per environment, so dev's
 * faces never reach production's partidas. Before that the gallery was a
 * folder in `public/`, curated by editing files and deploying; a deployed
 * function cannot write to its own files, and the owner wanted to edit it
 * from the app (Phase 72).
 *
 * Each entry is a URL an <img> or next/image can load.
 */

import { prisma } from './db'
import { limpiarCodigo } from '@/lib/codigo'

/** The gallery as it is now, oldest face first. */
export async function galeriaDeComodines(): Promise<string[]> {
  try {
    const filas = await prisma.comodin.findMany({
      orderBy: [{ creadoEn: 'asc' }, { nombre: 'asc' }],
      select: { url: true },
    })
    return filas.map((fila) => fila.url)
  } catch (error) {
    // No gallery is not a broken game: the comodín keeps its drawn ★.
    console.error('[galeria] no se pudo leer la galería', error)
    return []
  }
}

/**
 * The faces a partida deals from: its own copy, taken when it was created,
 * so a face added or removed later never changes it. A partida older than
 * the copy — or one that does not exist yet — gets the gallery as it is now.
 */
export async function galeriaDePartida(codigo: string): Promise<string[]> {
  const fila = await prisma.partida
    .findUnique({
      where: { codigo: limpiarCodigo(codigo) },
      select: { caras: true },
    })
    .catch(() => null)
  if (fila?.caras) {
    try {
      const caras = JSON.parse(fila.caras) as unknown
      if (Array.isArray(caras)) return caras.filter((c) => typeof c === 'string')
    } catch {
      // A copy that does not parse is no copy.
    }
  }
  return galeriaDeComodines()
}
