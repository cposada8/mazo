// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 37: leaving on purpose, and coming back after merely being gone.
 *
 * The two are different things and the difference is only ever what the
 * player pressed — which is exactly what these pin.
 */

const ARCHIVO = join(tmpdir(), `mazo-abandono-${process.pid}.db`)
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

/**
 * A secreto per case. Sitting at two live partidas at once is legal — the
 * door offers the most recent — so sharing one across tests would have each
 * case find the previous case's table.
 */
const ana = (caso: string) => `s-ana-${caso}`
const beto = (caso: string) => `s-beto-${caso}`

/** Ana hosting, Beto beside her, and two bots. */
async function mesa(caso: string, repartir = true) {
  const creada = await partidas.crearPartida({
    secreto: ana(caso),
    alias: 'ana',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 1,
    bots: 2,
  })
  await partidas.unirse({
    codigo: creada.codigo,
    secreto: beto(caso),
    alias: 'beto',
  })
  if (!repartir) return (await partidas.cargarPorCodigo(creada.codigo))!

  const empezada = await partidas.empezar({
    codigo: creada.codigo,
    secreto: ana(caso),
    seed: caso,
  })
  if (!empezada.ok) throw new Error(empezada.code)
  return empezada.partida
}

describe('leaving before the deal', () => {
  it('the seat simply goes, and the others close up', async () => {
    const partida = await mesa('lobby', false)
    expect(partida.asientos).toHaveLength(4)

    const salida = await partidas.abandonar({ codigo: partida.codigo, secreto: beto('lobby') })
    expect(salida).toEqual({ ok: true, enLobby: true })

    const despues = await partidas.cargarPorCodigo(partida.codigo)
    expect(despues?.asientos.map((a) => a.alias)).toEqual([
      'ana',
      'El Codicioso 1',
      'El Codicioso 2',
    ])
    expect(despues?.asientos.map((a) => a.indice)).toEqual([0, 1, 2])
  })
})

describe('leaving a dealt partida', () => {
  it('frees the chair: no cards, no turn, and nobody waits', async () => {
    const partida = await mesa('abandono')
    const antes = await partidas.estadoDe(partida.codigo)
    const suAsiento = (await partidas.asientoDe(partida.id, beto('abandono')))!
    expect(antes!.ronda!.jugadores[suAsiento].hand).toHaveLength(12)

    await partidas.abandonar({ codigo: partida.codigo, secreto: beto('abandono') })

    const despues = await partidas.estadoDe(partida.codigo)
    const jugador = despues!.ronda!.jugadores[suAsiento]
    expect(jugador.retirado).toBe(true)
    expect(jugador.hand).toHaveLength(0)
    // The turn never lands on them again.
    expect(despues!.ronda!.turno).not.toBe(suAsiento)
  })

  it('nothing takes the seat over — it is skipped, not played', async () => {
    const partida = await mesa('sin-relevo')
    const suAsiento = (await partidas.asientoDe(partida.id, beto('sin-relevo')))!
    await partidas.abandonar({ codigo: partida.codigo, secreto: beto('sin-relevo') })

    // Run the table well past several allotments: the empty chair never moves.
    let ahora = Date.now()
    for (let i = 0; i < 12; i++) {
      const leida = await juego.leerMesa(partida.codigo, ana('sin-relevo'), ahora)
      if (!leida.ok) throw new Error(leida.code)
      const ronda = leida.mesa.vista.ronda
      if (!ronda) break
      expect(ronda.turno).not.toBe(suAsiento)
      expect(ronda.jugadores[suAsiento].cartas).toBe(0)
      ahora += 4000
    }
  })

  it('is dealt nothing in the repartos that follow', async () => {
    const partida = await mesa('siguientes')
    const suAsiento = (await partidas.asientoDe(partida.id, beto('siguientes')))!
    await partidas.abandonar({ codigo: partida.codigo, secreto: beto('siguientes') })

    // Play on until the contract changes — a whole ronda later.
    let ahora = Date.now()
    let cambio = false
    for (let i = 0; i < 4000 && !cambio; i++) {
      const leida = await juego.leerMesa(partida.codigo, ana('siguientes'), ahora)
      if (!leida.ok) throw new Error(leida.code)
      const vista = leida.mesa.vista
      if (!vista.ronda) break
      if (vista.indiceContrato > 0) {
        cambio = true
        expect(vista.ronda.jugadores[suAsiento].cartas).toBe(0)
        expect(vista.ronda.turno).not.toBe(suAsiento)
        break
      }
      if (vista.ronda.turno === 0) {
        const move =
          vista.ronda.fase === 'draw'
            ? ({ type: 'robar', de: 'stock' } as const)
            : ({ type: 'descartar', cardId: vista.ronda.mano[0].id } as const)
        const r = await juego.jugarEnMesa(partida.codigo, ana('siguientes'), move, ahora)
        if (!r.ok) throw new Error(r.code)
      } else {
        ahora += 2000
      }
    }
    expect(cambio).toBe(true)
  })

  it('their score freezes where it stood', async () => {
    const partida = await mesa('puntaje')
    const suAsiento = (await partidas.asientoDe(partida.id, beto('puntaje')))!
    await partidas.abandonar({ codigo: partida.codigo, secreto: beto('puntaje') })

    let ahora = Date.now()
    for (let i = 0; i < 4000; i++) {
      const leida = await juego.leerMesa(partida.codigo, ana('puntaje'), ahora)
      if (!leida.ok) throw new Error(leida.code)
      const vista = leida.mesa.vista
      if (!vista.ronda) break
      if (vista.indiceContrato > 0) {
        // Every ronda scored since they left cost them nothing.
        for (const marcador of vista.historial) {
          expect(marcador.puntos[suAsiento]).toBe(0)
        }
        expect(vista.totales[suAsiento]).toBe(0)
        break
      }
      if (vista.ronda.turno === 0) {
        const move =
          vista.ronda.fase === 'draw'
            ? ({ type: 'robar', de: 'stock' } as const)
            : ({ type: 'descartar', cardId: vista.ronda.mano[0].id } as const)
        const r = await juego.jugarEnMesa(partida.codigo, ana('puntaje'), move, ahora)
        if (!r.ok) throw new Error(r.code)
      } else {
        ahora += 2000
      }
    }
  })

  it('a table down to one player ends rather than playing on alone', async () => {
    const partida = await partidas.crearPartida({
      secreto: ana('sola'),
      alias: 'ana',
      config: CONFIG_POR_DEFECTO,
      bots: 1,
    })
    await partidas.empezar({
      codigo: partida.codigo,
      secreto: ana('sola'),
      seed: 'sola',
    })
    await partidas.abandonar({ codigo: partida.codigo, secreto: ana('sola') })

    const despues = await partidas.cargarPorCodigo(partida.codigo)
    expect(despues?.fase).toBe('terminada')
  })
})

describe('being gone is not leaving', () => {
  it('the door remembers the table you are still sitting at', async () => {
    const partida = await mesa('vuelvo')
    // Beto's page closed; he pressed nothing.
    expect(await partidas.dondeEstoy(beto('vuelvo'))).toBe(partida.codigo)
    // And the seat is still his, hand and all.
    const suya = await juego.leerMesa(partida.codigo, beto('vuelvo'))
    expect(suya.ok).toBe(true)
    if (suya.ok) expect(suya.mesa.vista.ronda!.mano).toHaveLength(12)
  })

  it('stops offering the way back once you have left on purpose', async () => {
    const partida = await mesa('ya-no')
    expect(await partidas.dondeEstoy(beto('ya-no'))).toBe(partida.codigo)

    await partidas.abandonar({ codigo: partida.codigo, secreto: beto('ya-no') })
    expect(await partidas.dondeEstoy(beto('ya-no'))).toBeNull()
  })

  it('offers nothing to a browser that has never sat down', async () => {
    expect(await partidas.dondeEstoy('nadie-de-por-aqui')).toBeNull()
  })
})
