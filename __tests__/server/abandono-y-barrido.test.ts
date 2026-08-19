// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 44: the tables that were still open, and why.
 *
 * Measured on the live database before this phase: thirteen partidas, all
 * thirteen `jugando`, none ever `terminada`, and nine of them with no human
 * left in them. These pin the three rules that make that impossible — the
 * last person out ends it, a retired seat is not a clock, and silence closes
 * a table on the next visitor.
 */

const ARCHIVO = join(tmpdir(), `mazo-abandono-barrido-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let juego: typeof import('@/lib/server/juego')
let panel: typeof import('@/lib/server/panel')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  partidas = await import('@/lib/server/partidas')
  juego = await import('@/lib/server/juego')
  panel = await import('@/lib/server/panel')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

/** A dealt partida: one person, three bots, which is what the door creates. */
async function conBots(caso: string) {
  const secreto = `s-${caso}`
  const partida = await partidas.crearPartida({
    secreto,
    alias: 'milo',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 2,
  })
  const empezada = await partidas.empezar({
    codigo: partida.codigo,
    secreto,
    seed: caso,
  })
  if (!empezada.ok) throw new Error(empezada.code)
  return { codigo: partida.codigo, secreto }
}

/**
 * The same table with a second person in it, seated **before the deal** —
 * seats only move in the lobby, which is the rule this test needs and not the
 * one it is testing.
 */
async function conDosPersonas(caso: string) {
  const secreto = `s-${caso}`
  const otra = `s-${caso}-b`
  const partida = await partidas.crearPartida({
    secreto,
    alias: 'milo',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 2,
  })
  const sitio = await partidas.quitarAsiento({
    codigo: partida.codigo,
    secreto,
    indice: 3,
  })
  if (!sitio.ok) throw new Error(sitio.code)
  const unida = await partidas.unirse({ codigo: partida.codigo, secreto: otra, alias: 'ana' })
  if (!unida.ok) throw new Error(unida.code)

  const empezada = await partidas.empezar({ codigo: partida.codigo, secreto, seed: caso })
  if (!empezada.ok) throw new Error(empezada.code)
  return { codigo: partida.codigo, secreto, otra }
}

const faseDe = async (codigo: string) =>
  (await prisma.partida.findUnique({ where: { codigo }, select: { fase: true } }))?.fase

describe('the last person out turns off the light', () => {
  it('ends a partida whose only human leaves three bots behind', async () => {
    const mesa = await conBots('solo-bots')
    expect(await faseDe(mesa.codigo)).toBe('jugando')

    const salida = await partidas.abandonar(mesa)
    expect(salida.ok).toBe(true)

    // Three seats are still "active" — they are bots. A table of bots is not
    // a partida, and this is the case nine of thirteen live rows were in.
    expect(await faseDe(mesa.codigo)).toBe('terminada')
  })

  it('keeps a partida alive while another person is still at it', async () => {
    const mesa = await conDosPersonas('dos-personas')

    await partidas.abandonar({ codigo: mesa.codigo, secreto: mesa.secreto })
    expect(await faseDe(mesa.codigo)).toBe('jugando')
  })
})

describe('a seat that left is not the clock any more', () => {
  it('serves the view but advances nothing', async () => {
    // Somebody else must still be at the table, or leaving would end it.
    const mesa = await conDosPersonas('reloj')
    const otra = mesa.otra
    const inicio = Date.now()
    await juego.leerMesa(mesa.codigo, mesa.secreto, inicio)
    await partidas.abandonar({ codigo: mesa.codigo, secreto: mesa.secreto })

    const antes = await juego.leerMesa(mesa.codigo, mesa.secreto, inicio)
    if (!antes.ok) throw new Error(antes.code)

    // Two minutes later, from the seat that walked away. A bot's two seconds
    // and a person's forty-five are both long overdue, and none of it lands:
    // the table is readable and has not moved a card.
    const tarde = inicio + 120_000
    const despues = await juego.leerMesa(mesa.codigo, mesa.secreto, tarde)
    if (!despues.ok) throw new Error(despues.code)
    expect(despues.mesa.vista.ronda!.numeroDeTurno).toBe(
      antes.mesa.vista.ronda!.numeroDeTurno,
    )
    expect(despues.mesa.relatos.length).toBe(antes.mesa.relatos.length)

    // The seat that is still there is still the clock, and everything overdue
    // lands the moment it asks.
    const viva = await juego.leerMesa(mesa.codigo, otra, tarde)
    if (!viva.ok) throw new Error(viva.code)
    expect(viva.mesa.vista.ronda!.numeroDeTurno).toBeGreaterThan(
      antes.mesa.vista.ronda!.numeroDeTurno,
    )
  })
})

describe('silence closes a table', () => {
  it('marks a played partida terminada after a day, and keeps it', async () => {
    const mesa = await conBots('silencio')
    const manana = Date.now() + 25 * 3_600_000

    const barrido = await partidas.barrer(manana)
    expect(barrido.terminadas).toBeGreaterThan(0)
    expect(await faseDe(mesa.codigo)).toBe('terminada')

    // Kept, not deleted: the score of a real game outlives its row.
    expect(
      await prisma.partida.findUnique({ where: { codigo: mesa.codigo } }),
    ).not.toBeNull()
  })

  it('deletes a lobby nobody ever dealt', async () => {
    const partida = await partidas.crearPartida({
      secreto: 's-lobby-muerto',
      alias: 'milo',
      config: CONFIG_POR_DEFECTO,
    })

    await partidas.barrer(Date.now() + 7 * 3_600_000)
    expect(
      await prisma.partida.findUnique({ where: { codigo: partida.codigo } }),
    ).toBeNull()
  })

  it('leaves a table somebody is still playing alone', async () => {
    const mesa = await conBots('reciente')
    const barrido = await partidas.barrer(Date.now())
    expect(barrido.terminadas).toBe(0)
    expect(await faseDe(mesa.codigo)).toBe('jugando')
  })
})

describe('the panel', () => {
  it('refuses everything when no key is configured', () => {
    delete process.env.CLAVE_DEL_PANEL
    expect(panel.hayPanel()).toBe(false)
    expect(panel.claveCorrecta('')).toBe(false)
    expect(panel.claveCorrecta('lo-que-sea')).toBe(false)
  })

  it('opens only for the exact key', () => {
    process.env.CLAVE_DEL_PANEL = 'la-clave'
    expect(panel.hayPanel()).toBe(true)
    expect(panel.claveCorrecta('la-clave')).toBe(true)
    expect(panel.claveCorrecta('la-clav')).toBe(false)
    expect(panel.claveCorrecta(undefined)).toBe(false)
    delete process.env.CLAVE_DEL_PANEL
  })

  it('lists a table with who is at it and when they were last heard from', async () => {
    const mesa = await conBots('listado')
    const ahora = Date.now()
    await juego.leerMesa(mesa.codigo, mesa.secreto, ahora)

    const { partidas: lista } = await panel.listarPartidas()
    const fila = lista.find((p) => p.codigo === mesa.codigo)
    expect(fila).toBeDefined()
    expect(fila!.asientos.filter((a) => a.esBot)).toHaveLength(3)
    // Presence: the column Phase 37 declared and never wrote is written now.
    expect(fila!.ultimaSenal).not.toBeNull()
    expect(fila!.reparto).toBe(1)
  })

  it('closes a played table without losing it, and deletes an undealt one', async () => {
    const mesa = await conBots('cerrar')
    expect(await panel.cerrarPartida(mesa.codigo)).toBe('cerrada')
    expect(await faseDe(mesa.codigo)).toBe('terminada')

    const lobby = await partidas.crearPartida({
      secreto: 's-cerrar-lobby',
      alias: 'milo',
      config: CONFIG_POR_DEFECTO,
    })
    expect(await panel.cerrarPartida(lobby.codigo)).toBe('borrada')
    expect(
      await prisma.partida.findUnique({ where: { codigo: lobby.codigo } }),
    ).toBeNull()
  })
})
