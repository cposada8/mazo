import { describe, expect, it } from 'vitest'
import {
  CATALOGO,
  CONFIG_POR_DEFECTO,
  type RondaState,
  contratoPorId,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import {
  calculador,
  decidirTahur,
  imaginarRonda,
  jugarTorneo,
  juegaConComodines,
  olvidarDescartes,
  tahur,
  valorParaQuedarse,
} from '@/lib/bots'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 56: El Tahúr. What has to hold whatever its strength: the rondas it
 * imagines are consistent with what its seat knows, its decisions are the
 * same every time it is asked, and it plays whole partidas cleanly.
 */

describe('imaginarRonda', () => {
  const partida = startPartida({ players: 4, seed: 'imaginar' })
  const vista = vistaDeAsiento(partida.ronda!, 1)

  it('keeps what the seat knows and deals the rest in the right amounts', () => {
    const imaginada = imaginarRonda(vista, 3)
    expect(imaginada.jugadores[1].hand).toEqual(vista.mano)
    expect(imaginada.discard).toEqual(vista.descarte)
    expect(imaginada.jugadores.map((j) => j.hand.length)).toEqual(
      partida.ronda!.jugadores.map((j) => j.hand.length),
    )
    expect(imaginada.stock).toHaveLength(partida.ronda!.stock.length)
  })

  it('uses every card exactly once', () => {
    const imaginada = imaginarRonda(vista, 5)
    const ids = [
      ...imaginada.jugadores.flatMap((j) => j.hand),
      ...imaginada.stock,
      ...imaginada.discard,
    ].map((card) => card.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(108)
  })

  it('tells a partida without comodines from the count of cards', () => {
    const sin = startPartida({
      players: 3,
      seed: 'sin',
      config: { ...CONFIG_POR_DEFECTO, comodines: false },
    })
    expect(juegaConComodines(vista)).toBe(true)
    expect(juegaConComodines(vistaDeAsiento(sin.ronda!, 0))).toBe(false)
  })
})

describe('decidirTahur', () => {
  const mesa = (): RondaState =>
    makeRonda({
      jugadores: [
        {
          hand: [
            n('K', 'clubs'), n('Q', 'diamonds'), n('3', 'spades'),
            n('7', 'spades'), n('7', 'hearts'), n('9', 'clubs'), n('9', 'hearts'),
          ],
        },
        { hand: [n('2', 'clubs'), n('4', 'clubs'), n('5', 'hearts')] },
      ],
      contrato: contratoPorId('c1')!,
      fase: 'act',
      stock: [n('6', 'spades'), n('8', 'diamonds'), n('J', 'hearts'), n('2', 'hearts')],
    })

  it('throws one of the cards El Calculador likes least, and the same one every time', () => {
    const vista = vistaDeAsiento(mesa(), 0)
    const primera = decidirTahur(vista)
    expect(primera.type).toBe('descartar')
    if (primera.type !== 'descartar') return

    const menosQueridas = [...vista.mano]
      .sort((a, b) => valorParaQuedarse(a, vista) - valorParaQuedarse(b, vista))
      .slice(0, 3)
      .map((card) => card.id)
    expect(menosQueridas).toContain(primera.cardId)

    // Worked out again from nothing — as a server resuming the turn would —
    // the same deals give the same discard.
    olvidarDescartes()
    expect(decidirTahur(structuredClone(vista))).toEqual(primera)
  })

  it('leaves drawing and laying down to El Calculador', () => {
    const robar = { ...mesa(), fase: 'draw' as const }
    expect(decidirTahur(vistaDeAsiento(robar, 0))).toEqual(
      calculador.decidir(vistaDeAsiento(robar, 0)),
    )
  })
})

describe('at the table', () => {
  it('plays a partida through without a single falta', () => {
    const reporte = jugarTorneo({
      bots: [tahur, calculador],
      partidas: 1,
      asientos: 2,
      semilla: 'tahur',
      config: { ...CONFIG_POR_DEFECTO, contratos: CATALOGO.slice(0, 2) },
    })
    expect(reporte.faltas).toEqual([])
    expect(reporte.terminadas).toBe(1)
  }, 120_000)

  it('plays under the strict bajada without a single falta', () => {
    const reporte = jugarTorneo({
      bots: [tahur, calculador],
      partidas: 1,
      asientos: 2,
      semilla: 'tahur-estricta',
      config: { ...CONFIG_POR_DEFECTO, bajada: 'estricta', contratos: CATALOGO.slice(1, 3) },
    })
    expect(reporte.faltas).toEqual([])
    expect(reporte.terminadas).toBe(1)
  }, 120_000)
})
