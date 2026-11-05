/**
 * Phase 71, run once per environment: the comodín folder goes to Blob and
 * the `Comodin` table.
 *
 *   npx tsx --env-file=<env> scripts/comodines-a-blob.ts <carpeta>
 *
 * The env file must hold that environment's DATABASE_URL (and
 * DATABASE_AUTH_TOKEN for Turso) and BLOB_READ_WRITE_TOKEN. Safe to run
 * again: a file whose name is already in the table is skipped.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { put } from '@vercel/blob'
import { prisma } from '../lib/server/db'

const carpeta = process.argv[2]
if (!carpeta) {
  console.error('Uso: tsx scripts/comodines-a-blob.ts <carpeta>')
  process.exit(1)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Falta BLOB_READ_WRITE_TOKEN.')
  process.exit(1)
}

const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

async function main() {
  const nombres = readdirSync(carpeta)
    .filter((nombre) => /\.(jpe?g|png|webp|avif)$/i.test(nombre))
    .sort()
  const ya = new Set(
    (await prisma.comodin.findMany({ select: { nombre: true } })).map((c) => c.nombre),
  )

  for (const nombre of nombres) {
    if (ya.has(nombre)) {
      console.log(`= ${nombre} (ya estaba)`)
      continue
    }
    const extension = nombre.split('.').pop()!.toLowerCase()
    const blob = await put(`comodines/${nombre}`, readFileSync(join(carpeta, nombre)), {
      access: 'public',
      addRandomSuffix: true,
      contentType: TIPOS[extension],
    })
    await prisma.comodin.create({
      data: { url: blob.url, pathname: blob.pathname, nombre },
    })
    console.log(`+ ${nombre}`)
  }
  console.log(`${await prisma.comodin.count()} caras en la galería.`)
}

main().finally(() => prisma.$disconnect())
