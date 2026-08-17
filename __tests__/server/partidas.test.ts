// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO, startPartida } from '@/lib/engine'

/**
 * Phase 32: partidas at rest, seats claimed by secreto.
 *
 * These run against a real SQLite file, schema pushed fresh each run — the
 * whole point of the phase is that the state survives outside the process,
 * so an in-memory fake would test nothing.
 */

const ARCHIVO = join(tmpdir(), `mazo-test-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let servidor: typeof import('@/lib/server/partidas')

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  servidor = await import('@/lib/server/partidas')
}, 60_000)

const SECRETO_HOST = 'secreto-del-host'

const crear = () =>
  servidor.crearPartida({
    secreto: SECRETO_HOST,
    alias: 'milo',
    config: CONFIG_POR_DEFECTO,
  })

describe('creating a partida', () => {
  it('opens a lobby with the host seated and three bots, one door style', async () => {
    const partida = await crear()

    expect(partida.fase).toBe('lobby')
    expect(partida.codigo).toHaveLength(servidor.LARGO_DE_CODIGO)
    expect(partida.asientos).toHaveLength(4)
    expect(partida.asientos[0]).toMatchObject({ indice: 0, alias: 'milo', esHost: true, esBot: false })
    expect(partida.asientos.slice(1).every((asiento) => asiento.esBot)).toBe(true)
    expect(partida.segundosPorTurno).toBe(45)
  })

  it('never leaks a secreto in the public shape', async () => {
    const partida = await crear()
    expect(JSON.stringify(partida)).not.toContain(SECRETO_HOST)
  })

  it('round-trips the config through the row', async () => {
    const partida = await crear()
    const cargada = await servidor.cargarPorCodigo(partida.codigo)
    expect(cargada?.config).toEqual(CONFIG_POR_DEFECTO)
  })
})

describe('claiming seats', () => {
  it('reload keeps you you: the same secreto always gets its seat back', async () => {
    const partida = await crear()
    const primera = await servidor.unirse({
      codigo: partida.codigo,
      secreto: 'secreto-de-ana',
      alias: 'zeus',
    })
    const segunda = await servidor.unirse({
      codigo: partida.codigo,
      secreto: 'secreto-de-ana',
      alias: 'otro-alias',
    })

    expect(primera).toEqual({ ok: true, indice: 4 })
    expect(segunda).toEqual({ ok: true, indice: 4 })
    expect((await servidor.cargarPorCodigo(partida.codigo))?.asientos).toHaveLength(5)
  })

  it('refuses a full table', async () => {
    const partida = await crear()
    await servidor.unirse({ codigo: partida.codigo, secreto: 's5', alias: 'leo' })
    await servidor.unirse({ codigo: partida.codigo, secreto: 's6', alias: 'hao' })
    const septimo = await servidor.unirse({
      codigo: partida.codigo,
      secreto: 's7',
      alias: 'eren',
    })
    expect(septimo).toEqual({ ok: false, code: 'MESA_LLENA' })
  })

  it('refuses a stranger once the partida has started, but not a return', async () => {
    const partida = await crear()
    await servidor.unirse({ codigo: partida.codigo, secreto: 's-b', alias: 'levy' })
    await servidor.guardarEstado(
      partida.id,
      startPartida({ players: 5, seed: 'claims' }),
    )

    const extrano = await servidor.unirse({
      codigo: partida.codigo,
      secreto: 's-nuevo',
      alias: 'hao',
    })
    const regreso = await servidor.unirse({
      codigo: partida.codigo,
      secreto: 's-b',
      alias: 'levy',
    })

    expect(extrano).toEqual({ ok: false, code: 'YA_EMPEZO' })
    expect(regreso).toEqual({ ok: true, indice: 4 })
  })

  it('a code that does not exist is refused, not guessed', async () => {
    const nadie = await servidor.unirse({ codigo: 'XXXXX', secreto: 's', alias: 'a' })
    expect(nadie).toEqual({ ok: false, code: 'NO_EXISTE' })
  })
})

describe('the state survives outside the process', () => {
  it('round-trips a dealt PartidaState byte for byte', async () => {
    const partida = await crear()
    const estado = startPartida({ players: 4, seed: 'persistencia' })
    await servidor.guardarEstado(partida.id, estado)

    const cargada = await servidor.cargarPorId(partida.id)
    expect(cargada?.fase).toBe('jugando')
    expect(cargada?.estado).toEqual(estado)
  })
})

describe('who may see a hand', () => {
  it('the right secreto gets exactly its seat’s view; the wrong one gets null', async () => {
    const partida = await crear()
    const estado = startPartida({ players: 4, seed: 'vistas' })
    await servidor.guardarEstado(partida.id, estado)

    const vista = await servidor.vistaParaSecreto(partida.id, SECRETO_HOST)
    expect(vista?.asiento).toBe(0)
    expect(vista?.mano).toEqual(estado.ronda!.jugadores[0].hand)

    // No other hand hides anywhere in the payload.
    const serializada = JSON.stringify(vista)
    for (const jugador of estado.ronda!.jugadores.slice(1)) {
      for (const card of jugador.hand) {
        expect(serializada).not.toContain(`"${card.id}"`)
      }
    }

    expect(await servidor.vistaParaSecreto(partida.id, 'secreto-equivocado')).toBeNull()
  })
})
