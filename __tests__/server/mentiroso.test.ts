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

  it('a Mentiroso partida is four seats: Mentiroso bots, no gallery copy', async () => {
    const partida = await crear('mentiroso')
    expect(partida.juego).toBe('mentiroso')
    expect(partida.segundosVentana).toBe(3)
    expect(partida.asientos).toHaveLength(4)
    expect(partida.asientos.filter((a) => a.esBot).map((a) => a.bot)).toEqual([
      'embustero',
      'embustero',
      'embustero',
    ])
    const fila = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    expect(fila!.caras).toBeNull()
  })

  it('always four: no bot added, none removed', async () => {
    const partida = await crear('mentiroso')
    const otro = await servidor.agregarBot({ codigo: partida.codigo, secreto: HOST })
    expect(otro.ok ? null : otro.code).toBe('MESA_LLENA')
    await servidor.quitarAsiento({ codigo: partida.codigo, secreto: HOST, indice: 3 })
    const cargada = await servidor.cargarPorCodigo(partida.codigo)
    expect(cargada!.asientos).toHaveLength(4)
  })

  it('a person joining takes the last bot seat; four people fill it', async () => {
    const partida = await crear('mentiroso')
    const ana = await servidor.unirse({ codigo: partida.codigo, secreto: 'ana', alias: 'ana' })
    expect(ana).toEqual({ ok: true, indice: 3 })
    await servidor.unirse({ codigo: partida.codigo, secreto: 'leo', alias: 'leo' })
    await servidor.unirse({ codigo: partida.codigo, secreto: 'tony', alias: 'tony' })
    const quinto = await servidor.unirse({ codigo: partida.codigo, secreto: 'zeus', alias: 'zeus' })
    expect(quinto.ok ? null : quinto.code).toBe('MESA_LLENA')
    const cargada = await servidor.cargarPorCodigo(partida.codigo)
    expect(cargada!.asientos.map((a) => a.esBot)).toEqual([false, false, false, false])
    expect(cargada!.asientos[3].alias).toBe('ana')
  })

  it('leaving the lobby gives the seat back to a bot, and the host passes on', async () => {
    const partida = await crear('mentiroso')
    await servidor.unirse({ codigo: partida.codigo, secreto: 'ana', alias: 'ana' })
    await servidor.abandonar({ codigo: partida.codigo, secreto: HOST })
    const cargada = await servidor.cargarPorCodigo(partida.codigo)
    expect(cargada!.asientos).toHaveLength(4)
    expect(cargada!.asientos[0]).toMatchObject({ esBot: true, bot: 'embustero', esHost: false })
    expect(cargada!.asientos[3]).toMatchObject({ alias: 'ana', esHost: true })
  })

  it('leaving a dealt partida hands the hand to a bot and plays on', async () => {
    const partida = await crear('mentiroso')
    await servidor.unirse({ codigo: partida.codigo, secreto: 'ana', alias: 'ana' })
    await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 'relevo' })
    const antes = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    await servidor.abandonar({ codigo: partida.codigo, secreto: 'ana' })
    const despues = await prisma.partida.findUnique({
      where: { codigo: partida.codigo },
      include: { asientos: true },
    })
    expect(despues!.fase).toBe('jugando')
    expect(despues!.estado).toBe(antes!.estado) // the hand stays exactly as it was
    const asiento = despues!.asientos.find((a) => a.indice === 3)!
    expect(asiento).toMatchObject({ esBot: true, bot: 'embustero', secreto: null })
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

  it('the last person leaving a dealt partida ends it', async () => {
    const partida = await crear('mentiroso')
    await servidor.empezar({ codigo: partida.codigo, secreto: HOST, seed: 'sale' })
    const salida = await servidor.abandonar({ codigo: partida.codigo, secreto: HOST })
    expect(salida.ok).toBe(true)
    const fila = await prisma.partida.findUnique({ where: { codigo: partida.codigo } })
    expect(fila!.fase).toBe('terminada')
  })
})
