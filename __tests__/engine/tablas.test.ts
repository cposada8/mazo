import { describe, expect, it } from 'vitest'
import {
  type PartidaState,
  REBARAJADAS_MAX,
  aplicarEnPartida,
  apply,
  cerrarRonda,
  contratoPorId,
  puntosDeMano,
} from '@/lib/engine'
import { relatar } from '@/lib/relato'
import { makeRonda, n } from './helpers'

/**
 * Phase 31: the ronda nobody can win still ends.
 *
 * The descarte may rebuild the stock twice; a stock draw that can no longer be
 * served closes the ronda en tablas — nobody out, everybody scores their hand,
 * no bonus, and the seat whose draw closed it opens the next ronda.
 */

const tresEnElDescarte = () => [n('4', 'clubs'), n('8', 'hearts'), n('9', 'diamonds')]

describe('the rebarajada cap', () => {
  it('rebuilds the stock and counts it', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [n('K', 'hearts')] }],
      stock: [],
      discard: tresEnElDescarte(),
    })

    const result = apply(state, { type: 'robar', de: 'stock' })
    if (!result.ok) throw new Error(result.code)

    expect(result.state.rebarajadas).toBe(1)
    expect(result.state.ganador).toBeNull()
    // Two went back into the stock, one was drawn, the top stayed face up.
    expect(result.state.stock).toHaveLength(1)
    expect(result.state.discard).toHaveLength(1)
  })

  it('closes en tablas on the draw after the last permitted rebarajada', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [n('K', 'hearts')] }],
      stock: [],
      discard: tresEnElDescarte(),
      rebarajadas: REBARAJADAS_MAX,
    })

    const result = apply(state, { type: 'robar', de: 'stock' })
    if (!result.ok) throw new Error(result.code)

    expect(result.state.ganador).toBe('nadie')
    // No card moved: hands and piles are exactly as they were.
    expect(result.state.jugadores[0].hand).toHaveLength(1)
    expect(result.state.discard).toHaveLength(3)
    expect(result.state.fase).toBe('draw')
  })

  it('refuses everything after the tablas close', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }],
      stock: [],
      discard: tresEnElDescarte(),
      rebarajadas: REBARAJADAS_MAX,
    })
    const cerrada = apply(state, { type: 'robar', de: 'stock' })
    if (!cerrada.ok) throw new Error(cerrada.code)

    const despues = apply(cerrada.state, { type: 'robar', de: 'descarte' })
    expect(despues.ok).toBe(false)
    if (!despues.ok) expect(despues.code).toBe('RONDA_TERMINADA')
  })
})

describe('scoring a ronda en tablas', () => {
  const partidaEnTablas = (): PartidaState => {
    const manoCara = [n('K', 'spades'), n('Q', 'hearts')]
    const manoBarata = [n('2', 'clubs')]
    const ronda = makeRonda({
      jugadores: [{ hand: manoCara }, { hand: manoBarata }],
      contrato: contratoPorId('c1')!,
      stock: [],
      discard: tresEnElDescarte(),
      rebarajadas: REBARAJADAS_MAX,
      turno: 1,
    })

    return {
      config: {
        contratos: [contratoPorId('c1')!, contratoPorId('c2')!],
        comodines: true,
        bonusGanadorRonda: 10,
        empiezaPrimeraRonda: 0,
      },
      players: 2,
      seed: 'tablas',
      indiceContrato: 0,
      ronda,
      historial: [],
      totales: [0, 0],
      ganadores: null,
    }
  }

  it('charges every seat its hand and pays nobody the bonus', () => {
    const partida = partidaEnTablas()
    const result = aplicarEnPartida(partida, { type: 'robar', de: 'stock' })
    if (!result.ok) throw new Error(result.code)

    const marcador = result.state.historial[0]
    expect(marcador.ganador).toBe('nadie')
    expect(marcador.puntos[0]).toBe(puntosDeMano(partida.ronda!.jugadores[0].hand))
    expect(marcador.puntos[1]).toBe(puntosDeMano(partida.ronda!.jugadores[1].hand))
    expect(marcador.puntos.every((p) => p >= 0)).toBe(true)
  })

  it('deals the next contract, opened by the seat whose draw closed it', () => {
    const partida = partidaEnTablas()
    const result = aplicarEnPartida(partida, { type: 'robar', de: 'stock' })
    if (!result.ok) throw new Error(result.code)

    expect(result.state.indiceContrato).toBe(1)
    expect(result.state.ronda).not.toBeNull()
    expect(result.state.ronda!.turno).toBe(1)
    expect(result.state.ronda!.rebarajadas).toBe(0)
  })

  it('cerrarRonda accepts a tablas close and still refuses a live ronda', () => {
    const partida = partidaEnTablas()
    expect(() => cerrarRonda(partida)).toThrow()
    const cerrada = {
      ...partida,
      ronda: { ...partida.ronda!, ganador: 'nadie' as const },
    }
    expect(() => cerrarRonda(cerrada)).not.toThrow()
  })
})

describe('the relato of a tablas close', () => {
  it('says tablas and names no card', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }],
      stock: [],
      discard: tresEnElDescarte(),
      rebarajadas: REBARAJADAS_MAX,
    })

    const relato = relatar({ type: 'robar', de: 'stock' }, state)
    expect(relato?.tipo).toBe('tablas')
    expect(JSON.stringify(relato)).not.toMatch(/[♠♥♦♣]/)
  })

  it('still narrates an ordinary stock draw as a draw', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }],
      stock: [n('3', 'clubs')],
      discard: tresEnElDescarte(),
      rebarajadas: REBARAJADAS_MAX,
    })

    expect(relatar({ type: 'robar', de: 'stock' }, state)?.tipo).toBe('mazo')
  })
})
