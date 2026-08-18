// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Phase 39: the host seats whoever they like, and the table remembers.
 *
 * The choice is stored as a bot's id and read back through `botPorId`, which
 * never returns null — a partida saved with a bot that no longer exists has to
 * stay playable, and a seat that cannot take its turn would be far worse than
 * a seat playing as El Codicioso.
 */

const ARCHIVO = join(tmpdir(), `mazo-elenco-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  partidas = await import('@/lib/server/partidas')
}, 60_000)

const host = (caso: string) => `s-host-${caso}`

async function mesa(caso: string, bots = 1) {
  return partidas.crearPartida({
    secreto: host(caso),
    alias: 'ana',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 1,
    bots,
  })
}

describe('who is sitting down', () => {
  it('opens with the default bot, named and recorded', async () => {
    const partida = await mesa('defecto', 3)
    const bots = partida.asientos.filter((asiento) => asiento.esBot)

    expect(bots).toHaveLength(3)
    expect(bots.map((asiento) => asiento.bot)).toEqual([
      'codicioso',
      'codicioso',
      'codicioso',
    ])
    expect(partida.asientos[0].bot).toBeNull()
  })

  it('seats the bot the host asked for', async () => {
    const partida = await mesa('elegido')

    const puesto = await partidas.agregarBot({
      codigo: partida.codigo,
      secreto: host('elegido'),
      bot: 'memorioso',
    })
    if (!puesto.ok) throw new Error(puesto.code)

    const nuevo = puesto.partida.asientos.at(-1)!
    expect(nuevo.bot).toBe('memorioso')
    expect(nuevo.alias).toBe('El Memorioso')
  })

  it('swaps a personality, and the name follows it', async () => {
    const partida = await mesa('cambio')

    const cambiada = await partidas.cambiarBot({
      codigo: partida.codigo,
      secreto: host('cambio'),
      indice: 1,
      bot: 'paciente',
    })
    if (!cambiada.ok) throw new Error(cambiada.code)

    expect(cambiada.partida.asientos[1].bot).toBe('paciente')
    expect(cambiada.partida.asientos[1].alias).toBe('El Paciente')
  })

  it('refuses to reseat a person', async () => {
    const partida = await mesa('persona')

    // Seat 0 is the host, who is not a bot and is not anybody's to swap.
    expect(
      await partidas.cambiarBot({
        codigo: partida.codigo,
        secreto: host('persona'),
        indice: 0,
        bot: 'memorioso',
      }),
    ).toEqual({ ok: false, code: 'NO_ES_UN_BOT' })
  })

  it('refuses anybody but the host rearranging the table', async () => {
    const partida = await mesa('ajeno')

    expect(
      await partidas.cambiarBot({
        codigo: partida.codigo,
        secreto: 's-alguien-mas',
        indice: 1,
        bot: 'memorioso',
      }),
    ).toEqual({ ok: false, code: 'NO_ERES_EL_HOST' })
  })

  it('falls back to El Codicioso for a bot that no longer exists', async () => {
    const partida = await mesa('fantasma')

    const puesto = await partidas.agregarBot({
      codigo: partida.codigo,
      secreto: host('fantasma'),
      bot: 'el-que-fue-borrado',
    })
    if (!puesto.ok) throw new Error(puesto.code)

    expect(puesto.partida.asientos.at(-1)!.bot).toBe('codicioso')
  })
})
