import { describe, expect, it } from 'vitest'
import {
  CONFIG_POR_DEFECTO,
  LIMITES_DE_REBARAJADAS,
  type LimiteDeRebarajadas,
  type RondaState,
  apply,
  limiteDeRebarajadas,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { relatar } from '@/lib/relato'
import { makeRonda, n } from './helpers'

/**
 * Phase 74: how many times the descarte rebuilds the stock is the table's
 * choice — 0 to 5 or sin límite, two by default.
 */

/** A ronda whose stock is empty and whose descarte can rebuild it. */
const sinMazo = (rebarajadas: number, limite?: LimiteDeRebarajadas): RondaState => ({
  ...makeRonda({
    jugadores: [{ hand: [n('7', 'spades')] }, { hand: [n('K', 'hearts')] }],
    stock: [],
    discard: [n('4', 'clubs'), n('8', 'hearts'), n('9', 'diamonds')],
    rebarajadas,
  }),
  ...(limite === undefined ? {} : { limiteDeRebarajadas: limite }),
})

const robar = (state: RondaState) => {
  const result = apply(state, { type: 'robar', de: 'stock' })
  if (!result.ok) throw new Error(result.code)
  return result.state
}

describe('the rebarajada limit', () => {
  it('offers 0 to 5 and sin límite, and reads anything else as two', () => {
    expect(LIMITES_DE_REBARAJADAS).toEqual([0, 1, 2, 3, 4, 5, 'sinLimite'])
    expect(limiteDeRebarajadas(undefined)).toBe(2)
    expect(limiteDeRebarajadas(-1)).toBe(2)
    expect(limiteDeRebarajadas(99)).toBe(2)
    expect(limiteDeRebarajadas('sinLimite')).toBe('sinLimite')
    expect(limiteDeRebarajadas(0)).toBe(0)
  })

  it('with 0, the first empty mazo closes the ronda en tablas', () => {
    expect(robar(sinMazo(0, 0)).ganador).toBe('nadie')
  })

  it('with 3, rebuilds a third time and closes on the fourth', () => {
    const tercera = robar(sinMazo(2, 3))
    expect(tercera.rebarajadas).toBe(3)
    expect(tercera.ganador).toBeNull()
    expect(robar(sinMazo(3, 3)).ganador).toBe('nadie')
  })

  it('sin límite rebuilds past any count', () => {
    const despues = robar(sinMazo(40, 'sinLimite'))
    expect(despues.rebarajadas).toBe(41)
    expect(despues.ganador).toBeNull()
  })

  it('sin límite still closes when the descarte cannot rebuild the stock', () => {
    const state = { ...sinMazo(0, 'sinLimite'), discard: [n('9', 'diamonds')] }
    expect(robar(state).ganador).toBe('nadie')
  })

  it('a ronda saved before the choice plays two', () => {
    expect(robar(sinMazo(1)).ganador).toBeNull()
    expect(robar(sinMazo(2)).ganador).toBe('nadie')
  })

  it('the relato tells tablas exactly when the referee closes', () => {
    expect(relatar({ type: 'robar', de: 'stock' }, sinMazo(3, 5))?.tipo).toBe('mazo')
    expect(relatar({ type: 'robar', de: 'stock' }, sinMazo(5, 5))?.tipo).toBe('tablas')
    expect(relatar({ type: 'robar', de: 'stock' }, sinMazo(9, 'sinLimite'))?.tipo).toBe(
      'mazo',
    )
  })
})

describe('the partida carries it into every ronda', () => {
  it('from the config to the ronda and to every seat', () => {
    const partida = startPartida({
      config: { ...CONFIG_POR_DEFECTO, rebarajadas: 'sinLimite' },
      players: 3,
      seed: 'limite',
    })
    expect(partida.ronda!.limiteDeRebarajadas).toBe('sinLimite')
    expect(vistaDeAsiento(partida.ronda!, 1).limiteDeRebarajadas).toBe('sinLimite')
  })

  it('the default stays out of the stored ronda', () => {
    const partida = startPartida({ config: CONFIG_POR_DEFECTO, players: 3, seed: 'limite' })
    expect('limiteDeRebarajadas' in partida.ronda!).toBe(false)
    expect(vistaDeAsiento(partida.ronda!, 0).limiteDeRebarajadas).toBe(2)
  })

  it('new partidas default to the strict bajada and two rebarajadas', () => {
    expect(CONFIG_POR_DEFECTO.bajada).toBe('estricta')
    expect(CONFIG_POR_DEFECTO.rebarajadas).toBe(2)
  })
})
