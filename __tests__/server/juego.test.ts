// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO, type Move } from '@/lib/engine'

/**
 * Phase 34: the partida refereed on the server.
 *
 * The load-bearing claims: a move is judged by the same engine, a payload
 * never carries another hand, bots move because time passed rather than
 * because a timer fired, and playing out of turn is refused.
 */

const ARCHIVO = join(tmpdir(), `mazo-juego-${process.pid}.db`)
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

const HOST = 'secreto-host'

/** A dealt partida whose seat 0 is human and whose other seats are bots. */
async function repartida(seed = 'servidor') {
  const partida = await partidas.crearPartida({
    secreto: HOST,
    alias: 'milo',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 2,
  })
  const empezada = await partidas.empezar({
    codigo: partida.codigo,
    secreto: HOST,
    seed,
  })
  if (!empezada.ok) throw new Error(empezada.code)
  return empezada.partida
}

/** Wind the deal on until seat 0 is the one to move. */
async function hastaTuTurno(codigo: string, desde: number): Promise<number> {
  let ahora = desde
  for (let i = 0; i < 40; i++) {
    const mesa = await juego.leerMesa(codigo, HOST, ahora)
    if (!mesa.ok) throw new Error(mesa.code)
    if (mesa.mesa.vista.ronda?.turno === 0) return ahora
    ahora += 5000
  }
  throw new Error('seat 0 never got the turn')
}

describe('reading the table', () => {
  it('sends one seat’s view and no other hand', async () => {
    const partida = await repartida('vistas-servidor')
    const mesa = await juego.leerMesa(partida.codigo, HOST)
    expect(mesa.ok).toBe(true)
    if (!mesa.ok) return

    const { vista } = mesa.mesa
    expect(vista.asiento).toBe(0)
    expect(vista.ronda?.mano).toHaveLength(12)
    // Everyone else is a count, and the stock is a number.
    expect(vista.ronda?.jugadores.map((j) => j.cartas)).toEqual([12, 12, 12, 12])
    expect(typeof vista.ronda?.stock).toBe('number')

    const serializada = JSON.stringify(mesa.mesa)
    const completa = partida.estado!.ronda!
    for (const jugador of completa.jugadores.slice(1)) {
      for (const card of jugador.hand) {
        expect(serializada).not.toContain(`"${card.id}"`)
      }
    }
    for (const card of completa.stock) {
      expect(serializada).not.toContain(`"${card.id}"`)
    }
  })

  it('refuses a secreto that owns no seat here', async () => {
    const partida = await repartida('ajeno')
    expect(await juego.leerMesa(partida.codigo, 'no-soy-nadie')).toEqual({
      ok: false,
      code: 'NO_ES_TU_ASIENTO',
    })
  })
})

describe('bots move because time passed', () => {
  it('does not move a bot before its thinking time is up', async () => {
    const partida = await repartida('reloj-bots')
    const inicio = Date.now()

    const primera = await juego.leerMesa(partida.codigo, HOST, inicio)
    if (!primera.ok) return
    const turnoInicial = primera.mesa.vista.ronda!.turno

    // Half a second later: nothing is due.
    const enseguida = await juego.leerMesa(partida.codigo, HOST, inicio + 500)
    if (!enseguida.ok) return
    expect(enseguida.mesa.vista.ronda!.turno).toBe(turnoInicial)
  })

  it('catches up several overdue bot turns in one read', async () => {
    const partida = await repartida('atrasado')
    const inicio = Date.now()
    await juego.leerMesa(partida.codigo, HOST, inicio)

    // Twenty seconds away from the table, with bots thinking two seconds
    // each: everything due is played, and the table comes back caught up.
    const despues = await juego.leerMesa(partida.codigo, HOST, inicio + 20_000)
    if (!despues.ok) return

    const ronda = despues.mesa.vista.ronda!
    expect(ronda.numeroDeTurno).toBeGreaterThan(1)
    // It stops at a human: a bot never plays a person's turn.
    expect(ronda.turno).toBe(0)
    expect(despues.mesa.relatos.length).toBeGreaterThan(0)
  })

  it('narrates bot turns publicly — a stock draw names no card', async () => {
    const partida = await repartida('relatos')
    const inicio = Date.now()
    await juego.leerMesa(partida.codigo, HOST, inicio)
    const despues = await juego.leerMesa(partida.codigo, HOST, inicio + 20_000)
    if (!despues.ok) return

    for (const relato of despues.mesa.relatos) {
      if (relato.tipo === 'mazo') {
        expect(JSON.stringify(relato)).not.toMatch(/[♠♥♦♣]/)
      }
    }
  })
})

describe('playing a move', () => {
  it('refuses a move from a seat whose turn it is not', async () => {
    const partida = await repartida('fuera-de-turno')
    const inicio = Date.now()
    const mesa = await juego.leerMesa(partida.codigo, HOST, inicio)
    if (!mesa.ok) return

    // Wind to a bot's turn if seat 0 opens, then try to play anyway.
    if (mesa.mesa.vista.ronda!.turno === 0) {
      const robo = await juego.jugarEnMesa(
        partida.codigo,
        HOST,
        { type: 'robar', de: 'stock' },
        inicio,
      )
      expect(robo.ok).toBe(true)
      const carta = robo.ok ? robo.mesa.vista.ronda!.mano[0].id : ''
      await juego.jugarEnMesa(
        partida.codigo,
        HOST,
        { type: 'descartar', cardId: carta },
        inicio,
      )
    }

    const fuera = await juego.jugarEnMesa(
      partida.codigo,
      HOST,
      { type: 'robar', de: 'stock' },
      inicio,
    )
    expect(fuera.ok).toBe(false)
    if (!fuera.ok) expect(fuera.code).toBe('NO_ES_TU_TURNO')
  })

  it('refuses an illegal move with the engine’s own code', async () => {
    const partida = await repartida('ilegal')
    const ahora = await hastaTuTurno(partida.codigo, Date.now())

    // Discarding before drawing is the engine's FASE_EQUIVOCADA.
    const mesa = await juego.leerMesa(partida.codigo, HOST, ahora)
    if (!mesa.ok) return
    const carta = mesa.mesa.vista.ronda!.mano[0].id

    const refusada = await juego.jugarEnMesa(
      partida.codigo,
      HOST,
      { type: 'descartar', cardId: carta },
      ahora,
    )
    expect(refusada.ok).toBe(false)
    if (!refusada.ok) expect(refusada.code).toBe('FASE_EQUIVOCADA')
  })

  it('accepts a legal move, and the next read agrees with it', async () => {
    const partida = await repartida('legal')
    const ahora = await hastaTuTurno(partida.codigo, Date.now())

    const robo = await juego.jugarEnMesa(
      partida.codigo,
      HOST,
      { type: 'robar', de: 'stock' },
      ahora,
    )
    expect(robo.ok).toBe(true)
    if (!robo.ok) return
    expect(robo.mesa.vista.ronda!.mano).toHaveLength(13)
    expect(robo.mesa.vista.ronda!.fase).toBe('act')

    // The state is on the server, so another read sees the same thing.
    const releida = await juego.leerMesa(partida.codigo, HOST, ahora)
    if (!releida.ok) return
    expect(releida.mesa.vista.ronda!.mano).toHaveLength(13)

    const descarte: Move = {
      type: 'descartar',
      cardId: robo.mesa.vista.ronda!.mano[0].id,
    }
    const botada = await juego.jugarEnMesa(partida.codigo, HOST, descarte, ahora)
    expect(botada.ok).toBe(true)
    if (!botada.ok) return
    expect(botada.mesa.vista.ronda!.turno).not.toBe(0)
    expect(botada.mesa.relatos.at(-1)?.tipo).toBe('bota')
  })
})

describe('a whole partida, refereed on the server', () => {
  it('plays to the end with a human seat drawing and discarding', async () => {
    const partida = await repartida('completa')
    let ahora = Date.now()

    for (let paso = 0; paso < 4000; paso++) {
      const mesa = await juego.leerMesa(partida.codigo, HOST, ahora)
      if (!mesa.ok) throw new Error(mesa.code)

      const { vista } = mesa.mesa
      if (!vista.ronda) break // every contract played

      if (vista.ronda.turno !== 0) {
        // Nothing to do but let the bots' time come due.
        ahora += 3000
        continue
      }

      const move: Move =
        vista.ronda.fase === 'draw'
          ? { type: 'robar', de: 'stock' }
          : { type: 'descartar', cardId: vista.ronda.mano[0].id }

      const jugada = await juego.jugarEnMesa(partida.codigo, HOST, move, ahora)
      if (!jugada.ok) throw new Error(`${jugada.code}: ${jugada.detail ?? ''}`)
    }

    const fin = await partidas.cargarPorCodigo(partida.codigo)
    expect(fin?.fase).toBe('terminada')
    expect(fin?.estado?.ganadores).not.toBeNull()
    expect(fin?.estado?.historial).toHaveLength(
      CONFIG_POR_DEFECTO.contratos.length,
    )
  }, 60_000)
})
