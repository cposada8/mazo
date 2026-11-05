// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 71: the gallery is a table, and a partida deals from its own copy.
 * Against a real SQLite file, schema pushed fresh, like the other server
 * tests — the copy only means something if it survives in the database.
 */

const ARCHIVO = join(tmpdir(), `mazo-galeria-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let galeria: typeof import('@/lib/server/galeria')
let partidas: typeof import('@/lib/server/partidas')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  galeria = await import('@/lib/server/galeria')
  partidas = await import('@/lib/server/partidas')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

const cara = (nombre: string, creadoEn: Date) =>
  prisma.comodin.create({
    data: {
      url: `https://x.public.blob.vercel-storage.com/comodines/${nombre}`,
      pathname: `comodines/${nombre}`,
      nombre,
      creadoEn,
    },
  })

describe('la galería de comodines', () => {
  it('lists the table, oldest face first', async () => {
    await cara('b.jpg', new Date(2026, 0, 2))
    await cara('a.jpg', new Date(2026, 0, 1))
    const lista = await galeria.galeriaDeComodines()
    expect(lista.map((u) => u.split('/').pop())).toEqual(['a.jpg', 'b.jpg'])
  })

  it('a partida keeps the gallery it was created with', async () => {
    const partida = await partidas.crearPartida({
      secreto: 's',
      alias: 'milo',
      config: CONFIG_POR_DEFECTO,
    })
    const antes = await galeria.galeriaDePartida(partida.codigo)

    await prisma.comodin.deleteMany({ where: { nombre: 'a.jpg' } })
    await cara('c.jpg', new Date(2026, 0, 3))

    expect(await galeria.galeriaDePartida(partida.codigo)).toEqual(antes)
    expect((await galeria.galeriaDeComodines()).map((u) => u.split('/').pop())).toEqual([
      'b.jpg',
      'c.jpg',
    ])
  })

  it('an unknown code, or a partida without a copy, gets the gallery as it is', async () => {
    expect(await galeria.galeriaDePartida('ZZZZ')).toEqual(
      await galeria.galeriaDeComodines(),
    )
  })
})
