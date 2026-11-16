// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 98, a Carioca bug: at a table the server referees, nobody — the
 * host included — could change the bots' thinking time once dealt. Now the
 * host can, mid-partida, and every seat reads the new pace.
 */

const ARCHIVO = join(tmpdir(), `mazo-ritmo-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let juego: typeof import('@/lib/server/juego')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', { env: { ...process.env, DATABASE_URL: URL }, stdio: 'ignore' })
  partidas = await import('@/lib/server/partidas')
  juego = await import('@/lib/server/juego')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

/** Two people and two bots, dealt: a table the server referees. */
async function mesaCompartida() {
  const creada = await partidas.crearPartida({
    secreto: 'host',
    alias: 'ana',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 2,
    bots: 2,
  })
  const codigo = creada.codigo
  await partidas.unirse({ codigo, secreto: 'otro', alias: 'leo' })
  const dealt = await partidas.empezar({ codigo, secreto: 'host', seed: 'ritmo' })
  if (!dealt.ok) throw new Error(dealt.code)
  return codigo
}

describe('the bots’ pace, mid-partida', () => {
  it('the host changes it once dealt, and every seat reads the new value', async () => {
    const codigo = await mesaCompartida()
    const r = await partidas.cambiarRitmo({ codigo, secreto: 'host', segundosBot: 5 })
    expect(r.ok && r.partida.segundosBot).toBe(5)

    const delOtro = await juego.leerMesa(codigo, 'otro')
    expect(delOtro.ok && delOtro.mesa.segundosBot).toBe(5)
    // The table says who hosts, so only the host's menu gets the buttons.
    expect(delOtro.ok && delOtro.mesa.asientos.find((a) => a.esHost)?.alias).toBe('ana')
  })

  it('nobody else may change it, and only the offered values are taken', async () => {
    const codigo = await mesaCompartida()
    expect(await partidas.cambiarRitmo({ codigo, secreto: 'otro', segundosBot: 1 })).toEqual({
      ok: false,
      code: 'NO_ERES_EL_HOST',
    })
    await partidas.cambiarRitmo({ codigo, secreto: 'host', segundosBot: 99 })
    expect((await partidas.cargarPorCodigo(codigo))!.segundosBot).toBe(2)
  })

  it('a bot’s deadline follows the new pace', async () => {
    const codigo = await mesaCompartida()
    const fila = await prisma.partida.findUnique({ where: { codigo }, include: { asientos: true } })
    const desde = fila!.turnoDesde?.getTime() ?? fila!.actualizadaEn.getTime()
    // Walk the table to the first bot's turn on the old 2-second pace…
    let ahora = desde
    for (let i = 0; i < 60; i++) {
      const mesa = await juego.leerMesa(codigo, 'host', ahora)
      if (!mesa.ok) throw new Error(mesa.code)
      const turno = mesa.mesa.vista.ronda?.turno
      if (mesa.mesa.asientos.find((a) => a.indice === turno)?.esBot) break
      // A person's turn: play it out by the clock.
      ahora += 60_000
    }
    // …then slow the bots to 5 s: 3 s on, the bot still has not moved.
    await partidas.cambiarRitmo({ codigo, secreto: 'host', segundosBot: 5 })
    const antes = await juego.leerMesa(codigo, 'host', ahora)
    if (!antes.ok) throw new Error(antes.code)
    const turnoDesde = antes.mesa.turnoDesde!
    const quien = antes.mesa.vista.ronda!.turno
    const tres = await juego.leerMesa(codigo, 'host', turnoDesde + 3_000)
    expect(tres.ok && tres.mesa.vista.ronda?.turno).toBe(quien)
  })
})
