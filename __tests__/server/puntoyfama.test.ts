// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'
import type { EstadoDuelo, EstadoPuntoYFama } from '@/lib/engine/puntoyfama'

/**
 * Punto y Fama through the platform: the door and the lobby (Phase 101),
 * the races among people (Phase 103) and the duel (Phase 104).
 */

const ARCHIVO = join(tmpdir(), `mazo-puntoyfama-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let pf: typeof import('@/lib/server/puntoyfama')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', { env: { ...process.env, DATABASE_URL: URL }, stdio: 'ignore' })
  partidas = await import('@/lib/server/partidas')
  pf = await import('@/lib/server/puntoyfama')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

async function crear(secreto: string) {
  const creada = await partidas.crearPartida({
    secreto,
    alias: secreto,
    juego: 'puntoyfama',
    config: CONFIG_POR_DEFECTO,
  })
  return creada
}
async function estadoDe<T>(codigo: string) {
  const fila = await prisma.partida.findUnique({ where: { codigo } })
  return JSON.parse(fila!.estado!) as T
}

describe('the lobby (Phase 101)', () => {
  it('is created with no bots, four digits and five numbers', async () => {
    const creada = await crear('ana')
    expect(creada.juego).toBe('puntoyfama')
    expect(creada.asientos).toHaveLength(1)
    expect(creada).toMatchObject({ largo: 4, palabras: 5, modo: 'palabras' })
  })

  it('takes its own ranges: 3–6 digits, 1–50 numbers, and the duel', async () => {
    const { codigo } = await crear('beto')
    const ajustar = (cambio: object) => partidas.actualizarAjustes({ codigo, secreto: 'beto', ...cambio })
    await ajustar({ largo: 3, palabras: 50, modo: 'duelo' })
    let p = (await partidas.cargarPorCodigo(codigo))!
    expect(p).toMatchObject({ largo: 3, palabras: 50, modo: 'duelo' })
    await ajustar({ largo: 7, palabras: 51 })
    p = (await partidas.cargarPorCodigo(codigo))!
    expect(p).toMatchObject({ largo: 3, palabras: 50 })
  })

  it('Palabras still refuses the duel and keeps its own ranges', async () => {
    const creada = await partidas.crearPartida({ secreto: 'cata', alias: 'cata', juego: 'palabras', config: CONFIG_POR_DEFECTO })
    await partidas.actualizarAjustes({ codigo: creada.codigo, secreto: 'cata', modo: 'duelo', largo: 4 })
    expect((await partidas.cargarPorCodigo(creada.codigo))!).toMatchObject({ modo: 'palabras', largo: 5 })
  })

  it('a duel starts with exactly two people', async () => {
    const { codigo } = await crear('dani')
    await partidas.actualizarAjustes({ codigo, secreto: 'dani', modo: 'duelo' })
    expect(await partidas.empezar({ codigo, secreto: 'dani', seed: 's' })).toEqual({ ok: false, code: 'MESA_MUY_CHICA' })
    await partidas.unirse({ codigo, secreto: 'eli', alias: 'eli' })
    await partidas.unirse({ codigo, secreto: 'fede', alias: 'fede' })
    expect(await partidas.empezar({ codigo, secreto: 'dani', seed: 's' })).toEqual({ ok: false, code: 'MESA_LLENA' })
    await partidas.abandonar({ codigo, secreto: 'fede' })
    const r = await partidas.empezar({ codigo, secreto: 'dani', seed: 's' })
    expect(r.ok).toBe(true)
    const estado = await estadoDe<EstadoDuelo>(codigo)
    expect(estado.lados.map((l) => l.asiento)).toEqual([0, 1])
  })
})

describe('the races among people (Phase 103)', () => {
  it('the same numbers for all, answers only for the rivals, a latecomer welcome', async () => {
    const { codigo } = await crear('gabi')
    await partidas.actualizarAjustes({ codigo, secreto: 'gabi', palabras: 2 })
    await partidas.unirse({ codigo, secreto: 'hugo', alias: 'hugo' })
    await partidas.empezar({ codigo, secreto: 'gabi', seed: 'carrera' })
    const estado = await estadoDe<EstadoPuntoYFama>(codigo)
    const t = estado.inicio + 10
    const [a] = estado.bolsa
    const malo = ['0123', '4567', '8901'].find((n) => n !== a)!

    const r = await pf.intentarEnCarreraPF(codigo, 'hugo', malo, t)
    expect(r.ok && r.mesa.vista.propio!.intentos[0].palabra).toBe(malo)
    const gabi = await pf.leerCarreraPF(codigo, 'gabi', t + 1)
    expect(gabi.ok && gabi.mesa.vista.rivales[0].colores).toHaveLength(1)
    const texto = JSON.stringify(gabi)
    expect(texto).not.toContain(malo)
    for (const n of estado.bolsa) expect(texto).not.toContain(n)

    expect(await partidas.unirse({ codigo, secreto: 'ines', alias: 'ines' })).toEqual({ ok: true, indice: 2 })
    expect((await estadoDe<EstadoPuntoYFama>(codigo)).tableros).toHaveLength(3)
    expect(await pf.intentarEnCarreraPF(codigo, 'gabi', '1123', t)).toMatchObject({ ok: false, code: 'REPETIDO' })
  })
})

describe('the duel (Phase 104)', () => {
  async function duelo() {
    const { codigo } = await crear('juan')
    await partidas.actualizarAjustes({ codigo, secreto: 'juan', modo: 'duelo' })
    await partidas.unirse({ codigo, secreto: 'kari', alias: 'kari' })
    await partidas.empezar({ codigo, secreto: 'juan', seed: 'duelo' })
    return codigo
  }

  it('each sets the other a number; neither sees the other’s before the end', async () => {
    const codigo = await duelo()
    expect((await pf.ponerSecretoEnDuelo(codigo, 'juan', '1234', 0)).ok).toBe(true)
    expect(await pf.ponerSecretoEnDuelo(codigo, 'kari', '1123', 0)).toMatchObject({ ok: false, code: 'REPETIDO' })
    const r = await pf.ponerSecretoEnDuelo(codigo, 'kari', '5678', 0)
    expect(r.ok && r.mesa.vista.inicio).toBeGreaterThan(0)
    const inicio = r.ok ? r.mesa.vista.inicio! : 0

    await pf.intentarEnDueloServidor(codigo, 'kari', '9012', inicio + 100)
    const juan = await pf.leerDuelo(codigo, 'juan')
    expect(juan.ok && juan.mesa.vista.rival?.respuestas).toEqual([{ famas: 0, puntos: 2 }])
    const texto = JSON.stringify(juan)
    expect(texto).not.toContain('5678')
    expect(texto).not.toContain('9012')

    await pf.intentarEnDueloServidor(codigo, 'juan', '5678', inicio + 200)
    await pf.intentarEnDueloServidor(codigo, 'kari', '1234', inicio + 300)
    const fin = await pf.leerDuelo(codigo, 'juan')
    expect(fin.ok && fin.mesa.vista.resultado).toEqual({ tipo: 'gana', asiento: 0, porque: 'intentos' })
    expect(fin.ok && fin.mesa.vista.rival?.secreto).toBe('5678')
    expect((await partidas.cargarPorCodigo(codigo))!.fase).toBe('terminada')
  })

  it('leaving a duel hands it to the other', async () => {
    const codigo = await duelo()
    await partidas.abandonar({ codigo, secreto: 'kari' })
    const r = await pf.leerDuelo(codigo, 'juan')
    expect(r.ok && r.mesa.vista.resultado).toEqual({ tipo: 'gana', asiento: 0, porque: 'retiro' })
  })

  it('a duel takes no latecomer', async () => {
    const codigo = await duelo()
    expect(await partidas.unirse({ codigo, secreto: 'lalo', alias: 'lalo' })).toEqual({ ok: false, code: 'YA_EMPEZO' })
  })
})
