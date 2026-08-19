// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO, type Move } from '@/lib/engine'

/**
 * Phase 35: several people at one table.
 *
 * The machinery is Phase 34's and is seat-count-blind, so what this pins is
 * the promise itself — three people in three places finish a partida from one
 * code, and no payload any of them ever received held another player's cards.
 */

const ARCHIVO = join(tmpdir(), `mazo-varios-${process.pid}.db`)
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

const GENTE = [
  { secreto: 's-ana', alias: 'ana' },
  { secreto: 's-beto', alias: 'beto' },
  { secreto: 's-cami', alias: 'cami' },
]

/** Three people and one bot, from one code. */
async function mesaDeTres(seed: string) {
  const partida = await partidas.crearPartida({
    secreto: GENTE[0].secreto,
    alias: GENTE[0].alias,
    config: CONFIG_POR_DEFECTO,
    segundosBot: 1,
    bots: 1,
  })
  for (const quien of GENTE.slice(1)) {
    const entro = await partidas.unirse({ codigo: partida.codigo, ...quien })
    expect(entro.ok).toBe(true)
  }
  const empezada = await partidas.empezar({
    codigo: partida.codigo,
    secreto: GENTE[0].secreto,
    seed,
  })
  if (!empezada.ok) throw new Error(empezada.code)
  return empezada.partida
}

describe('the lobby carries no hand', () => {
  it('a dealt partida is read by everyone, and holds only its seed', async () => {
    const partida = await mesaDeTres('lobby-limpio')
    const leida = await partidas.cargarPorCodigo(partida.codigo)
    const estado = await partidas.estadoDe(partida.codigo)

    expect(leida?.repartida).toBe(true)
    expect(leida?.seed).toBe('lobby-limpio')

    // Every card in play, and none of them in the shape everyone reads.
    const serializada = JSON.stringify(leida)
    const ronda = estado!.ronda!
    const cartas = [
      ...ronda.stock,
      ...ronda.jugadores.flatMap((jugador) => jugador.hand),
    ]
    expect(cartas.length).toBeGreaterThan(40)
    for (const card of cartas) {
      expect(serializada).not.toContain(`"${card.id}"`)
    }
  })
})

describe('three people, one code', () => {
  it('each sees only their own hand, all through the partida', async () => {
    const partida = await mesaDeTres('tres-vistas')
    const vistas = await Promise.all(
      GENTE.map((quien) => juego.leerMesa(partida.codigo, quien.secreto)),
    )

    const manos = vistas.map((v) => {
      if (!v.ok) throw new Error(v.code)
      return v.mesa.vista.ronda!.mano.map((card) => card.id)
    })

    expect(manos.map((m) => m.length)).toEqual([12, 12, 12])
    // No two people hold the same card…
    expect(new Set(manos.flat()).size).toBe(36)
    // …and nobody's payload mentions anybody else's.
    for (const [i, vista] of vistas.entries()) {
      const serializada = JSON.stringify(vista)
      for (const [j, mano] of manos.entries()) {
        if (i === j) continue
        for (const id of mano) expect(serializada).not.toContain(`"${id}"`)
      }
    }
  })

  it('finish a partida together, and nobody ever saw another hand', async () => {
    const partida = await mesaDeTres('tres-completa')
    const asientos = new Map<number, string>()
    for (const quien of GENTE) {
      const indice = await partidas.asientoDe(partida.id, quien.secreto)
      asientos.set(indice!, quien.secreto)
    }

    let ahora = Date.now()
    let terminada = false

    for (let paso = 0; paso < 6000 && !terminada; paso++) {
      // Everybody is watching, so everybody reads — which is also what makes
      // the bot's turn come due.
      for (const quien of GENTE) {
        const mesa = await juego.leerMesa(partida.codigo, quien.secreto, ahora)
        if (!mesa.ok) throw new Error(mesa.code)

        /*
         * The *live* payload, which is where a hand could leak from. The
         * historial is excluded on purpose since Phase 42: it carries a
         * picture of the mesa each finished ronda ended on, and a card id is
         * per-deal — `J-hearts#0` names the first J♥ in every reparto — so a
         * card that was face up on the mesa last ronda shares its id with
         * whoever holds that card now. Nothing about this ronda is revealed
         * by a photograph of the last one, and everything in the photograph
         * was face up when it was taken.
         */
        const serializada = JSON.stringify({
          ...mesa.mesa,
          vista: { ...mesa.mesa.vista, historial: [] },
        })
        const propia = new Set(
          mesa.mesa.vista.ronda?.mano.map((card) => card.id) ?? [],
        )
        const estado = await partidas.estadoDe(partida.codigo)
        for (const jugador of estado?.ronda?.jugadores ?? []) {
          for (const card of jugador.hand) {
            if (propia.has(card.id)) continue
            expect(serializada).not.toContain(`"${card.id}"`)
          }
        }
      }

      const mesa = await juego.leerMesa(partida.codigo, GENTE[0].secreto, ahora)
      if (!mesa.ok) throw new Error(mesa.code)
      const ronda = mesa.mesa.vista.ronda
      if (!ronda) {
        terminada = true
        break
      }

      const secreto = asientos.get(ronda.turno)
      if (!secreto) {
        ahora += 2000 // the bot's second has to pass
        continue
      }

      const suya = await juego.leerMesa(partida.codigo, secreto, ahora)
      if (!suya.ok) throw new Error(suya.code)
      const vista = suya.mesa.vista.ronda!
      const move: Move =
        vista.fase === 'draw'
          ? { type: 'robar', de: 'stock' }
          : { type: 'descartar', cardId: vista.mano[0].id }

      const jugada = await juego.jugarEnMesa(partida.codigo, secreto, move, ahora)
      if (!jugada.ok) throw new Error(`${jugada.code}: ${jugada.detail ?? ''}`)
    }

    expect(terminada).toBe(true)
    const fin = await partidas.estadoDe(partida.codigo)
    expect(fin?.ganadores).not.toBeNull()
    expect(fin?.historial).toHaveLength(CONFIG_POR_DEFECTO.contratos.length)
  }, 120_000)
})
