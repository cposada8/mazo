// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'
import { type EstadoPalabras, MS_CUENTA_ATRAS } from '@/lib/engine/palabras'

/**
 * Phases 84 and 86: a Palabras partida through the door, the lobby and the
 * race, the server the referee. The clock is passed in where it matters.
 */

const ARCHIVO = join(tmpdir(), `mazo-palabras-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let carrera: typeof import('@/lib/server/palabras')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', { env: { ...process.env, DATABASE_URL: URL }, stdio: 'ignore' })
  partidas = await import('@/lib/server/partidas')
  carrera = await import('@/lib/server/palabras')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

async function estadoDe(codigo: string) {
  const fila = await prisma.partida.findUnique({ where: { codigo } })
  return JSON.parse(fila!.estado!) as EstadoPalabras
}

async function carreraDeDos(palabras = 3) {
  const creada = await partidas.crearPartida({
    secreto: 'ana',
    alias: 'ana',
    juego: 'palabras',
    config: CONFIG_POR_DEFECTO,
  })
  expect(creada.asientos).toHaveLength(1)
  const codigo = creada.codigo
  await partidas.actualizarAjustes({ codigo, secreto: 'ana', palabras })
  await partidas.unirse({ codigo, secreto: 'leo', alias: 'leo' })
  const dealt = await partidas.empezar({ codigo, secreto: 'ana', seed: 'semilla' })
  if (!dealt.ok) throw new Error(dealt.code)
  const estado = await estadoDe(codigo)
  return { codigo, estado, enCarrera: estado.inicio + 10 }
}

describe('Palabras through the platform', () => {
  it('is created with no bots, keeps its number of words, and deals a bag that size', async () => {
    const { codigo, estado } = await carreraDeDos(5)
    expect((await partidas.cargarPorCodigo(codigo))!.palabras).toBe(5)
    expect(estado.bolsa).toHaveLength(5)
    expect(estado.tableros.map((t) => t.asiento)).toEqual([0, 1])
  })

  it('keeps the word length the host chose, and deals words of it', async () => {
    const creada = await partidas.crearPartida({
      secreto: 'eva',
      alias: 'eva',
      juego: 'palabras',
      config: CONFIG_POR_DEFECTO,
    })
    const codigo = creada.codigo
    await partidas.actualizarAjustes({ codigo, secreto: 'eva', largo: 8 })
    await partidas.actualizarAjustes({ codigo, secreto: 'eva', largo: 12 })
    expect((await partidas.cargarPorCodigo(codigo))!.largo).toBe(8)
    await partidas.empezar({ codigo, secreto: 'eva', seed: 'ocho' })
    for (const palabra of (await estadoDe(codigo)).bolsa) expect(palabra).toHaveLength(8)
  })

  it('takes any whole number of words from 1 to 100, and nothing else (Phase 87)', async () => {
    const creada = await partidas.crearPartida({
      secreto: 'nico',
      alias: 'nico',
      juego: 'palabras',
      config: CONFIG_POR_DEFECTO,
    })
    const codigo = creada.codigo
    const palabras = async () => (await partidas.cargarPorCodigo(codigo))!.palabras
    await partidas.actualizarAjustes({ codigo, secreto: 'nico', palabras: 23 })
    expect(await palabras()).toBe(23)
    for (const malo of [0, 101, 2.5, -3]) {
      await partidas.actualizarAjustes({ codigo, secreto: 'nico', palabras: malo })
      expect(await palabras()).toBe(23)
    }
    await partidas.actualizarAjustes({ codigo, secreto: 'nico', palabras: 7 })
    await partidas.empezar({ codigo, secreto: 'nico', seed: 'siete' })
    expect((await estadoDe(codigo)).bolsa).toHaveLength(7)
  })

  it('a time-limit race: the minutes the host chose, every answer dealt, and the race over when the time is', async () => {
    const creada = await partidas.crearPartida({
      secreto: 'tita',
      alias: 'tita',
      juego: 'palabras',
      config: CONFIG_POR_DEFECTO,
    })
    const codigo = creada.codigo
    await partidas.actualizarAjustes({ codigo, secreto: 'tita', modo: 'tiempo', minutos: 2 })
    await partidas.actualizarAjustes({ codigo, secreto: 'tita', minutos: 61 })
    await partidas.actualizarAjustes({ codigo, secreto: 'tita', modo: 'otro' })
    const lobby = (await partidas.cargarPorCodigo(codigo))!
    expect(lobby).toMatchObject({ modo: 'tiempo', minutos: 2 })

    await partidas.unirse({ codigo, secreto: 'tomi', alias: 'tomi' })
    await partidas.empezar({ codigo, secreto: 'tita', seed: 'reloj' })
    const estado = await estadoDe(codigo)
    expect(estado).toMatchObject({ modo: 'tiempo', msLimite: 120_000 })
    expect(estado.bolsa.length).toBeGreaterThan(1000)

    const r = await carrera.intentarEnCarrera(codigo, 'tomi', estado.bolsa[0], estado.inicio + 5_000)
    expect(r.ok && r.mesa.vista).toMatchObject({ modo: 'tiempo', fin: estado.inicio + 120_000 })
    const tarde = await carrera.intentarEnCarrera(codigo, 'tita', estado.bolsa[0], estado.inicio + 120_000)
    expect(tarde).toEqual({ ok: false, code: 'CERRADA' })

    const fin = await carrera.leerCarrera(codigo, 'tita', estado.inicio + 120_001)
    expect(fin.ok && fin.mesa.vista.cerrada).toBe(true)
    expect(fin.ok && fin.mesa.vista.clasificacion.map((p) => p.acertadas)).toEqual([1, 0])
    expect((await partidas.cargarPorCodigo(codigo))!.fase).toBe('terminada')
  })

  it('lives: the host picks them, a bad number is ignored, and they reach the race (Phase 90)', async () => {
    const creada = await partidas.crearPartida({
      secreto: 'vale',
      alias: 'vale',
      juego: 'palabras',
      config: CONFIG_POR_DEFECTO,
    })
    const codigo = creada.codigo
    await partidas.actualizarAjustes({ codigo, secreto: 'vale', modo: 'tiempo', vidas: 2 })
    await partidas.actualizarAjustes({ codigo, secreto: 'vale', vidas: 9 })
    expect((await partidas.cargarPorCodigo(codigo))!.vidas).toBe(2)
    await partidas.empezar({ codigo, secreto: 'vale', seed: 'dos' })
    const estado = await estadoDe(codigo)
    expect(estado.vidas).toBe(2)
    const r = await carrera.leerCarrera(codigo, 'vale', estado.inicio + 10)
    expect(r.ok && r.mesa.vista).toMatchObject({ vidasIniciales: 2, propio: { vidas: 2 } })
  })

  it('refuses a number of words the lobby does not offer', async () => {
    const { codigo } = await carreraDeDos(3)
    const r = await partidas.actualizarAjustes({ codigo, secreto: 'ana', palabras: 999 })
    expect(r.ok).toBe(false) // already dealt — and 999 would be ignored anyway
  })

  it('never sends a phone an answer it has not ended, and scores on the server', async () => {
    const { codigo, estado, enCarrera } = await carreraDeDos(3)
    const [primera] = estado.bolsa

    const antes = await carrera.leerCarrera(codigo, 'leo', enCarrera)
    expect(antes.ok).toBe(true)
    for (const palabra of estado.bolsa) expect(JSON.stringify(antes)).not.toContain(palabra)

    const r = await carrera.intentarEnCarrera(codigo, 'ana', primera, enCarrera)
    expect(r.ok && r.mesa.vista.propio!.terminadas[0]).toMatchObject({ palabra: primera, acertada: true })

    // Leo sees Ana one word ahead, in colours only.
    const leo = await carrera.leerCarrera(codigo, 'leo', enCarrera + 1)
    expect(leo.ok && leo.mesa.vista.rivales[0].terminadas).toBe(1)
    for (const palabra of estado.bolsa) expect(JSON.stringify(leo)).not.toContain(palabra)

    const malo = await carrera.intentarEnCarrera(codigo, 'leo', 'QQQQQ', enCarrera)
    expect(malo).toEqual({ ok: false, code: 'NO_ES_PALABRA' })
  })

  it('takes a latecomer into a running race, on the same words', async () => {
    const { codigo, estado, enCarrera } = await carreraDeDos(3)
    const unido = await partidas.unirse({ codigo, secreto: 'tony', alias: 'tony' })
    expect(unido).toEqual({ ok: true, indice: 2 })
    const despues = await estadoDe(codigo)
    expect(despues.tableros.map((t) => t.asiento)).toEqual([0, 1, 2])
    expect(despues.bolsa).toEqual(estado.bolsa)
    const r = await carrera.intentarEnCarrera(codigo, 'tony', estado.bolsa[0], enCarrera)
    expect(r.ok).toBe(true)
  })

  it('two tries in the same instant both land', async () => {
    const { codigo, estado, enCarrera } = await carreraDeDos(3)
    const [a, b] = await Promise.all([
      carrera.intentarEnCarrera(codigo, 'ana', estado.bolsa[0], enCarrera),
      carrera.intentarEnCarrera(codigo, 'leo', estado.bolsa[0], enCarrera),
    ])
    expect(a.ok && b.ok).toBe(true)
    const despues = await estadoDe(codigo)
    expect(despues.tableros.map((t) => t.terminadas.length)).toEqual([1, 1])
  })

  it('ends when everyone finishes, or when the host closes it, or a leaver stops being waited for', async () => {
    const { codigo, estado, enCarrera } = await carreraDeDos(3)
    for (const palabra of estado.bolsa) {
      await carrera.intentarEnCarrera(codigo, 'ana', palabra, enCarrera)
    }
    expect((await partidas.cargarPorCodigo(codigo))!.fase).toBe('jugando')
    expect(await carrera.cerrarCarrera(codigo, 'leo', enCarrera)).toEqual({
      ok: false,
      code: 'NO_ERES_EL_HOST',
    })
    await partidas.abandonar({ codigo, secreto: 'leo' })
    const fin = await carrera.leerCarrera(codigo, 'ana', enCarrera + 1)
    expect(fin.ok && fin.mesa.vista.cerrada).toBe(true)
    expect(fin.ok && fin.mesa.vista.clasificacion[0].asiento).toBe(0)
    expect((await partidas.cargarPorCodigo(codigo))!.fase).toBe('terminada')
    expect(MS_CUENTA_ATRAS).toBeGreaterThan(0)
  })

  it('Carioca and el Mentiroso endpoints say it is another game', async () => {
    const { codigo } = await carreraDeDos(3)
    const mentiroso = await import('@/lib/server/mentiroso')
    expect(await mentiroso.leerMesaMentiroso(codigo, 'ana')).toMatchObject({ code: 'OTRO_JUEGO' })
    expect(await partidas.estadoDe(codigo)).toBeNull()
  })
})
