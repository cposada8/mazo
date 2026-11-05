// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'
import type { EstadoMentiroso } from '@/lib/engine/mentiroso'

/**
 * Phase 78: a partida is *of* a game. El Mentiroso is created, seated and
 * dealt through the same door and lobby as Carioca, and never reaches a path
 * that would read its state as Carioca's.
 */

const ARCHIVO = join(tmpdir(), `mazo-mentiroso-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let servidor: typeof import('@/lib/server/partidas')
let mesa: typeof import('@/lib/server/juego')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  servidor = await import('@/lib/server/partidas')
  mesa = await import('@/lib/server/juego')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

const HOST = 'secreto-host-mentiroso'

const crear = (juego?: 'carioca' | 'mentiroso') =>
  servidor.crearPartida({ secreto: HOST, alias: 'milo', juego, config: CONFIG_POR_DEFECTO })

describe('the game a partida is', () => {
  it('is Carioca when nobody says, as every partida before the choice was', async () => {
    const partida = await crear()
    expect(partida.juego).toBe('carioca')
    expect(partida.asientos[1].bot).toBe('codicioso')
  })

  it('a Mentiroso partida seats Mentiroso bots, with no gallery copy', async () => {
    const partida = await crear('mentiroso')
    expect(partida.juego).toBe('mentiroso')
    expect(partida.segundosVentana).toBe(3)
    expect(partida.asientos.filter((a) => a.esBot).map((a) => a.bot)).toEqual([
      'embustero',
      'embustero',
      'embustero',
    ])
    const fila = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    expect(fila!.caras).toBeNull()

    const otro = await servidor.agregarBot({ codigo: partida.codigo, secreto: HOST })
    expect(otro.ok && otro.partida.asientos.at(-1)!.bot).toBe('embustero')
  })

  it('a Mentiroso partida takes three seats at least, six at most', async () => {
    const partida = await crear('mentiroso')
    await servidor.quitarAsiento({ codigo: partida.codigo, secreto: HOST, indice: 3 })
    await servidor.quitarAsiento({ codigo: partida.codigo, secreto: HOST, indice: 2 })
    const corta = await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 's' })
    expect(corta.ok ? null : corta.code).toBe('MESA_MUY_CHICA')

    const llena = await crear('mentiroso')
    await servidor.agregarBot({ codigo: llena.codigo, secreto: HOST })
    await servidor.agregarBot({ codigo: llena.codigo, secreto: HOST })
    const septimo = await servidor.agregarBot({ codigo: llena.codigo, secreto: HOST })
    expect(septimo.ok ? null : septimo.code).toBe('MESA_LLENA')
  })

  it("deals el Mentiroso's own state, and keeps its window setting", async () => {
    const partida = await crear('mentiroso')
    await servidor.actualizarAjustes({ codigo: partida.codigo, secreto: HOST, segundosVentana: 5 })
    const dealt = await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 'reparto' })
    expect(dealt.ok).toBe(true)
    if (!dealt.ok) return
    expect(dealt.partida.segundosVentana).toBe(5)
    expect(dealt.partida.seed).toBe('reparto')

    const fila = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    const estado = JSON.parse(fila!.estado!) as EstadoMentiroso
    expect(estado.manos.flat()).toHaveLength(52)
    expect(estado.rangoEnTurno).toBe('A')
  })

  it("never reaches Carioca's table, views or panel as if it were Carioca", async () => {
    const partida = await crear('mentiroso')
    await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 'aparte' })

    const leida = await mesa.leerMesa(partida.codigo, HOST)
    expect(leida.ok ? null : leida.code).toBe('OTRO_JUEGO')
    expect(await servidor.estadoDe(partida.codigo)).toBeNull()
    expect(await servidor.vistaParaSecreto(partida.id, HOST)).toBeNull()

    const { listarPartidas } = await import('@/lib/server/panel')
    const fila = (await listarPartidas()).partidas.find((p) => p.codigo === partida.codigo)!
    expect(fila.juego).toBe('mentiroso')
    expect(fila.reparto).toBeNull()
  })

  it('leaving a dealt Mentiroso partida alone with bots ends it', async () => {
    const partida = await crear('mentiroso')
    await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 'sale' })
    const salida = await servidor.abandonar({ codigo: partida.codigo, secreto: HOST })
    expect(salida.ok).toBe(true)
    const fila = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    expect(fila!.fase).toBe('terminada')
  })
})
