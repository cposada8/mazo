// @vitest-environment node
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'
import type { EstadoMentiroso } from '@/lib/engine/mentiroso'

/**
 * Phase 80: el Mentiroso among several people, the server the referee.
 * Three people and no bots, so every decision is the test's; the clock is
 * passed in, so every deadline is the test's too.
 */

const ARCHIVO = join(tmpdir(), `mazo-mesa-mentiroso-${process.pid}.db`)
const URL = `file:${ARCHIVO}`

let partidas: typeof import('@/lib/server/partidas')
let mesa: typeof import('@/lib/server/mentiroso')
let prisma: typeof import('@/lib/server/db').prisma

beforeAll(async () => {
  rmSync(ARCHIVO, { force: true })
  process.env.DATABASE_URL = URL
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: URL },
    stdio: 'ignore',
  })
  partidas = await import('@/lib/server/partidas')
  mesa = await import('@/lib/server/mentiroso')
  prisma = (await import('@/lib/server/db')).prisma
}, 60_000)

const SECRETOS = ['ana', 'leo', 'tony']

/** A dealt table of three people, and the moment it was dealt. */
async function mesaDeTres(seed: string) {
  const creada = await partidas.crearPartida({
    secreto: 'ana',
    alias: 'ana',
    juego: 'mentiroso',
    config: CONFIG_POR_DEFECTO,
  })
  const codigo = creada.codigo
  await partidas.unirse({ codigo, secreto: 'leo', alias: 'leo' })
  await partidas.unirse({ codigo, secreto: 'tony', alias: 'tony' })
  for (const indice of [3, 2, 1]) {
    await partidas.quitarAsiento({ codigo, secreto: 'ana', indice })
  }
  const dealt = await partidas.empezar({ codigo, secreto: 'ana', seed })
  if (!dealt.ok) throw new Error(dealt.code)
  const fila = await prisma.partida.findUnique({ where: { codigo } })
  const estado = JSON.parse(fila!.estado!) as EstadoMentiroso
  // Seats were renumbered when the bots left: read who sits where.
  const asientos = (await partidas.cargarPorCodigo(codigo))!.asientos
  const secretoDe = (indice: number) =>
    SECRETOS[['ana', 'leo', 'tony'].indexOf(asientos.find((a) => a.indice === indice)!.alias)]
  const desde = fila!.actualizadaEn.getTime()
  return { codigo, estado, secretoDe, desde }
}

const leer = async (codigo: string, secreto: string, ahora: number) => {
  const r = await mesa.leerMesaMentiroso(codigo, secreto, ahora)
  if (!r.ok) throw new Error(r.code)
  return r.mesa
}

describe('the table on the server', () => {
  it("gives each person their own hand and nobody else's", async () => {
    const { codigo, estado, desde } = await mesaDeTres('vistas')
    const vista = (await leer(codigo, 'leo', desde)).vista
    const texto = JSON.stringify(vista)
    const suya = vista.mano.map((c) => c.id)
    for (const carta of estado.manos.flat()) {
      if (!suya.includes(carta.id)) expect(texto).not.toContain(`"${carta.id}"`)
    }
    expect(vista.cartasPorAsiento.reduce((a, b) => a + b, 0)).toBe(52)
  })

  it('a play opens the window, and the window closes by the clock', async () => {
    const { codigo, estado, secretoDe, desde } = await mesaDeTres('ventana')
    const jugador = secretoDe(estado.turno)
    const t0 = desde + 100
    const carta = estado.manos[estado.turno][0].id
    const jugada = await mesa.jugarMentirosoEnMesa(codigo, jugador, { type: 'jugar', cartaIds: [carta] }, t0)
    expect(jugada.ok && jugada.mesa.vista.fase).toBe('ventana')
    expect(jugada.ok && jugada.mesa.ventanaHasta).toBe(t0 + 3000)

    expect((await leer(codigo, jugador, t0 + 2999)).vista.fase).toBe('ventana')
    const cerrada = await leer(codigo, jugador, t0 + 3001)
    expect(cerrada.vista.fase).toBe('jugar')
    expect(cerrada.eventos.map((e) => e.tipo)).toEqual(['jugada', 'ventanaCerrada'])
  })

  it('a call after the window ran out is too late', async () => {
    const { codigo, estado, secretoDe, desde } = await mesaDeTres('tarde')
    const jugador = secretoDe(estado.turno)
    const otro = secretoDe((estado.turno + 1) % 3)
    const t0 = desde + 100
    await mesa.jugarMentirosoEnMesa(codigo, jugador, { type: 'jugar', cartaIds: [estado.manos[estado.turno][0].id] }, t0)
    const tarde = await mesa.jugarMentirosoEnMesa(codigo, otro, { type: 'mentiroso' }, t0 + 3500)
    expect(tarde.ok ? null : tarde.code).toBe('fase-equivocada')
  })

  it('of two calls sent in the same instant, exactly one counts', async () => {
    const { codigo, estado, secretoDe, desde } = await mesaDeTres('carrera')
    const jugador = secretoDe(estado.turno)
    const b = secretoDe((estado.turno + 1) % 3)
    const c = secretoDe((estado.turno + 2) % 3)
    const t0 = desde + 100
    await mesa.jugarMentirosoEnMesa(codigo, jugador, { type: 'jugar', cartaIds: [estado.manos[estado.turno][0].id] }, t0)

    const [una, otra] = await Promise.all([
      mesa.jugarMentirosoEnMesa(codigo, b, { type: 'mentiroso' }, t0 + 500),
      mesa.jugarMentirosoEnMesa(codigo, c, { type: 'mentiroso' }, t0 + 500),
    ])
    expect([una.ok, otra.ok].filter(Boolean)).toHaveLength(1)
    const perdedora = una.ok ? otra : una
    expect(perdedora.ok ? null : perdedora.code).toMatch(/fase-equivocada|OCUPADA/)

    const despues = await leer(codigo, jugador, t0 + 600)
    expect(despues.eventos.filter((e) => e.tipo === 'acusacion')).toHaveLength(1)
    expect(despues.vista.cartasPorAsiento.reduce((a, b2) => a + b2, 0) + despues.vista.pila).toBe(52)
  })

  it("the player's clock plays for a person who lets it run out", async () => {
    const { codigo, estado, secretoDe, desde } = await mesaDeTres('reloj')
    const enTurno = secretoDe(estado.turno)
    const fila = await prisma.partida.findUnique({ where: { codigo } })
    const plazo = fila!.segundosPorTurno * 1000
    expect((await leer(codigo, enTurno, desde + plazo - 10)).vista.fase).toBe('jugar')
    const jugada = await leer(codigo, enTurno, desde + plazo + 10)
    expect(jugada.vista.fase).toBe('ventana')
    expect(jugada.vista.ultimaJugada).toMatchObject({ asiento: estado.turno, cantidad: 1, rango: 'A' })
  })

  it('a person who leaves: cards out of play, the turn skips them', async () => {
    const { codigo, estado, secretoDe } = await mesaDeTres('salida')
    const sale = (estado.turno + 1) % 3
    await partidas.abandonar({ codigo, secreto: secretoDe(sale) })
    const fila = await prisma.partida.findUnique({ where: { codigo } })
    const despues = JSON.parse(fila!.estado!) as EstadoMentiroso
    expect(despues.manos[sale]).toEqual([])
    expect(despues.retirados).toEqual([sale])
    expect(fila!.fase).toBe('jugando')

    // Two left: one more leaving ends it with no winner.
    await partidas.abandonar({ codigo, secreto: secretoDe(estado.turno) })
    const fin = await prisma.partida.findUnique({ where: { codigo } })
    expect(fin!.fase).toBe('terminada')
  })

  it('refuses a secreto that is not at the table, and a Carioca partida', async () => {
    const { codigo } = await mesaDeTres('ajeno')
    const ajeno = await mesa.leerMesaMentiroso(codigo, 'nadie')
    expect(ajeno.ok ? null : ajeno.code).toBe('NO_ES_TU_ASIENTO')
    const carioca = await partidas.crearPartida({ secreto: 'ana', alias: 'ana', config: CONFIG_POR_DEFECTO })
    const otro = await mesa.leerMesaMentiroso(carioca.codigo, 'ana')
    expect(otro.ok ? null : otro.code).toBe('OTRO_JUEGO')
  })
})
