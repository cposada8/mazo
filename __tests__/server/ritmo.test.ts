// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 41: a bot's turn lands in pieces.
 *
 * It used to be applied whole — one write, one jump, and the next poll was
 * handed draw, bajada and discard as a single change. The browser has always
 * spread a bot's moves across its seconds; the server now divides the same
 * allotment into deadlines, and a request plays only what is due.
 *
 * What must not change: the turn still takes exactly the seconds the lobby
 * set, and it still passes only when the last move has landed.
 */

const ARCHIVO = join(tmpdir(), `mazo-ritmo-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let juego: typeof import('@/lib/server/juego')

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  partidas = await import('@/lib/server/partidas')
  juego = await import('@/lib/server/juego')
}, 60_000)

const HOST = 'secreto-ritmo'

/** Seat 1 opens, so a bot's turn is the first thing that happens. */
const CONFIG = { ...CONFIG_POR_DEFECTO, empiezaPrimeraRonda: 1 }

/** A dealt partida: seat 0 is the reader, the rest are bots thinking 2s. */
async function repartida(seed: string, segundosBot = 2) {
  const partida = await partidas.crearPartida({
    secreto: `${HOST}-${seed}`,
    alias: 'milo',
    config: CONFIG,
    segundosBot,
  })
  const empezada = await partidas.empezar({
    codigo: partida.codigo,
    secreto: `${HOST}-${seed}`,
    seed,
  })
  if (!empezada.ok) throw new Error(empezada.code)
  return { codigo: partida.codigo, secreto: `${HOST}-${seed}` }
}

const leer = async (mesa: { codigo: string; secreto: string }, ahora: number) => {
  const respuesta = await juego.leerMesa(mesa.codigo, mesa.secreto, ahora)
  if (!respuesta.ok) throw new Error(respuesta.code)
  return respuesta.mesa
}

describe("a bot's turn arrives in pieces", () => {
  it('plays part of it partway through, and passes the turn only at the end', async () => {
    const mesa = await repartida('por-partes')
    const inicio = Date.now()

    // The first read is what sets the turn's start line.
    const abre = await leer(mesa, inicio)
    expect(abre.vista.ronda!.turno).toBe(1)
    expect(abre.relatos).toHaveLength(0)

    // Halfway: the bot has started its turn and not finished it. Whatever it
    // has done is public — that is what there is to watch — and the turn is
    // still its own.
    const mitad = await leer(mesa, inicio + 1000)
    expect(mitad.relatos.length).toBeGreaterThan(0)
    expect(mitad.vista.ronda!.turno).toBe(1)
    expect(mitad.turnoDesde).toBe(abre.turnoDesde)

    // At the end of the allotment the last move lands and the turn passes.
    const final = await leer(mesa, inicio + 2000)
    expect(final.vista.ronda!.turno).not.toBe(1)
    expect(final.relatos.length).toBeGreaterThan(mitad.relatos.length)
  })

  it('still hands back a whole turn to a poll that was late', async () => {
    const mesa = await repartida('tarde')
    const inicio = Date.now()
    await leer(mesa, inicio)

    // Nobody asked for two seconds: everything due lands at once, exactly as
    // it did before the pacing existed.
    const despues = await leer(mesa, inicio + 2000)
    expect(despues.vista.ronda!.turno).not.toBe(1)
  })

  it('never lets a piece of a turn arrive before its share of the time', async () => {
    const mesa = await repartida('temprano', 10)
    const inicio = Date.now()
    await leer(mesa, inicio)

    // Ten seconds to think, and a turn is at most a handful of moves: a fifth
    // of a second in, none of it can be due.
    const enseguida = await leer(mesa, inicio + 200)
    expect(enseguida.relatos).toHaveLength(0)
    expect(enseguida.vista.ronda!.turno).toBe(1)
  })

  it('catches several whole turns up in one read, and stops at the person', async () => {
    const mesa = await repartida('muchos')
    const inicio = Date.now()
    await leer(mesa, inicio)

    const despues = await leer(mesa, inicio + 30_000)
    expect(despues.vista.ronda!.turno).toBe(0)
    expect(despues.vista.ronda!.numeroDeTurno).toBeGreaterThan(1)
  })

  it('gives two watchers the same table when both find the same move due', async () => {
    const mesa = await repartida('a-la-vez')
    const inicio = Date.now()
    await leer(mesa, inicio)

    // The write is conditional on the state it was computed from, so the
    // request that loses reads the winner's answer instead of overwriting it.
    // Whichever order they land in, both callers see one table.
    const [una, otra] = await Promise.all([
      leer(mesa, inicio + 1500),
      leer(mesa, inicio + 1500),
    ])

    expect(una.relatos).toEqual(otra.relatos)
    expect(una.vista.ronda!.numeroDeTurno).toBe(otra.vista.ronda!.numeroDeTurno)

    // And the table did not go backwards: a later read holds everything.
    const despues = await leer(mesa, inicio + 1500)
    expect(despues.relatos.length).toBeGreaterThanOrEqual(una.relatos.length)
  })
})
