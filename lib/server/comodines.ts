/**
 * Editing the comodín gallery (Phase 72) — the owner's, behind the panel's
 * key. The checks on *who* happen in the Server Actions; this module only
 * knows how a face enters and leaves.
 *
 * A face leaves the gallery at once: the row goes, and new partidas stop
 * dealing it. Its image is another matter — a partida in progress deals from
 * its own copy of the list (Phase 71) and may still be showing it. So the
 * image is only deleted from Blob when no open partida lists it any more,
 * and every removal sweeps for images that have become free.
 */

import { del, list, put } from '@vercel/blob'
import { prisma } from './db'

/** After the browser has shrunk it; a camera original never gets this far. */
export const BYTES_MAXIMOS = 900 * 1024

/** What a face may be, told by its first bytes rather than by its name. */
function tipoDeImagen(bytes: Uint8Array): string | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b)
  if (empieza(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  const texto = (desde: number, largo: number) =>
    String.fromCharCode(...bytes.slice(desde, desde + largo))
  if (texto(0, 4) === 'RIFF' && texto(8, 4) === 'WEBP') return 'image/webp'
  if (texto(4, 4) === 'ftyp' && /^avi[fs]$/.test(texto(8, 4))) return 'image/avif'
  return null
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export type ComodinEditable = {
  readonly id: string
  readonly url: string
  readonly nombre: string
}

export async function listarComodines(): Promise<ComodinEditable[]> {
  return prisma.comodin.findMany({
    orderBy: [{ creadoEn: 'asc' }, { nombre: 'asc' }],
    select: { id: true, url: true, nombre: true },
  })
}

/** A name a person would recognize, safe to put in a pathname. */
function nombreLimpio(nombre: string, extension: string): string {
  const base = nombre
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'comodin'}.${extension}`
}

export async function agregarComodin(
  archivo: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (archivo.size === 0) return { ok: false, error: 'Elige una foto.' }
  if (archivo.size > BYTES_MAXIMOS) {
    return { ok: false, error: 'La foto pesa demasiado.' }
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const tipo = tipoDeImagen(bytes)
  if (!tipo) return { ok: false, error: 'Eso no es una foto (jpg, png, webp o avif).' }

  const nombre = nombreLimpio(archivo.name, EXTENSION[tipo])
  const blob = await put(`comodines/${nombre}`, Buffer.from(bytes), {
    access: 'public',
    addRandomSuffix: true,
    contentType: tipo,
  })
  await prisma.comodin.create({
    data: { url: blob.url, pathname: blob.pathname, nombre },
  })
  return { ok: true }
}

export async function quitarComodin(id: string): Promise<void> {
  await prisma.comodin.deleteMany({ where: { id } })
  await soltarImagenesLibres()
}

/**
 * Deletes every image under `comodines/` that neither the gallery nor any
 * open partida's copy lists. A finished partida no longer counts: it is not
 * dealt again.
 */
export async function soltarImagenesLibres(): Promise<number> {
  const enUso = new Set<string>(
    (await prisma.comodin.findMany({ select: { url: true } })).map((c) => c.url),
  )
  const abiertas = await prisma.partida.findMany({
    where: { fase: { not: 'terminada' } },
    select: { caras: true },
  })
  for (const { caras } of abiertas) {
    if (!caras) continue
    try {
      for (const url of JSON.parse(caras) as unknown[]) {
        if (typeof url === 'string') enUso.add(url)
      }
    } catch {
      // A copy that does not parse holds nothing.
    }
  }

  const libres: string[] = []
  let cursor: string | undefined
  do {
    const pagina = await list({ prefix: 'comodines/', cursor })
    for (const blob of pagina.blobs) if (!enUso.has(blob.url)) libres.push(blob.url)
    cursor = pagina.hasMore ? pagina.cursor : undefined
  } while (cursor)

  if (libres.length > 0) await del(libres)
  return libres.length
}
