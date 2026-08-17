import { describe, expect, it } from 'vitest'
import {
  CATALOGO,
  type Card,
  CONFIG_POR_DEFECTO,
  CARDS_PER_HAND,
  type PartidaConfig,
  type PartidaState,
  aplicarEnPartida,
  cerrarRonda,
  contratoActual,
  contratoPorId,
  seatsConMenosPuntos,
  startPartida,
} from '@/lib/engine'
import { c, ids, makeRonda, n } from './helpers'

const CUATRO_TRIOS = contratoPorId('c8')!

const config = (overrides: Partial<PartidaConfig> = {}): PartidaConfig => ({
  ...CONFIG_POR_DEFECTO,
  ...overrides,
})

/** A ronda that seat 0 can win in a single turn: four trios is twelve cards. */
function rondaGanableEnUnTurno(perdedor: Card[]) {
  const doce = [
    n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'),
    n('Q', 'spades'), n('Q', 'hearts'), n('Q', 'clubs'),
    n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs'),
    n('4', 'spades'), n('4', 'hearts'), n('4', 'clubs'),
  ]
  const drawn = n('9', 'diamonds')

  return {
    doce,
    drawn,
    ronda: makeRonda({
      contrato: CUATRO_TRIOS,
      jugadores: [{ hand: doce }, { hand: perdedor }],
      stock: [n('8', 'clubs'), drawn],
    }),
    movimientos: [
      { type: 'robar' as const, de: 'stock' as const },
      {
        type: 'bajarse' as const,
        propuestas: [
          { kind: 'trio' as const, rank: '7' as const, cardIds: ids(doce.slice(0, 3)) },
          { kind: 'trio' as const, rank: 'Q' as const, cardIds: ids(doce.slice(3, 6)) },
          { kind: 'trio' as const, rank: 'K' as const, cardIds: ids(doce.slice(6, 9)) },
          { kind: 'trio' as const, rank: '4' as const, cardIds: ids(doce.slice(9, 12)) },
        ],
      },
      { type: 'descartar' as const, cardId: drawn.id },
    ],
  }
}

describe('startPartida', () => {
  const state = startPartida({ players: 4, seed: 'partida' })

  it('starts on the first enabled contract with a ronda dealt', () => {
    expect(contratoActual(state)).toEqual(CATALOGO[0])
    expect(state.ronda?.jugadores).toHaveLength(4)
    expect(state.ronda?.jugadores[0].hand).toHaveLength(CARDS_PER_HAND)
  })

  it('starts everyone on zero, with nobody having won', () => {
    expect(state.totales).toEqual([0, 0, 0, 0])
    expect(state.historial).toEqual([])
    expect(state.ganadores).toBeNull()
  })

  it('plays the first seven contracts by default', () => {
    expect(state.config.contratos).toHaveLength(7)
    expect(state.config.contratos.map((contrato) => contrato.id)).toEqual([
      'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
    ])
  })

  it('is repeatable from its seed', () => {
    const again = startPartida({ players: 4, seed: 'partida' })
    expect(again.ronda!.jugadores.map((j) => ids(j.hand))).toEqual(
      state.ronda!.jugadores.map((j) => ids(j.hand)),
    )
  })

  it('refuses an empty contract list', () => {
    expect(() =>
      startPartida({ players: 3, seed: 'x', config: config({ contratos: [] }) }),
    ).toThrow(/at least one contract/)
  })

  it('refuses an impossible number of players', () => {
    expect(() => startPartida({ players: 1, seed: 'x' })).toThrow(/2 to 6 players/)
    expect(() => startPartida({ players: 7, seed: 'x' })).toThrow(/2 to 6 players/)
  })
})

describe('who opens the first ronda', () => {
  it('is the seat the host chose', () => {
    for (const asiento of [0, 1, 2, 3]) {
      const state = startPartida({
        players: 4,
        seed: 'elegido',
        config: config({ empiezaPrimeraRonda: asiento }),
      })
      expect(state.ronda?.turno).toBe(asiento)
    }
  })

  it('is drawn when left random, and drawn from the partida seed', () => {
    const state = startPartida({ players: 4, seed: 'sorteo' })
    expect(state.config.empiezaPrimeraRonda).toBe('aleatorio')
    expect(state.ronda!.turno).toBeGreaterThanOrEqual(0)
    expect(state.ronda!.turno).toBeLessThan(4)

    const otra = startPartida({ players: 4, seed: 'sorteo' })
    expect(otra.ronda!.turno).toBe(state.ronda!.turno)
  })

  it('draws differently for different partidas', () => {
    const turnos = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
      (seed) => startPartida({ players: 4, seed }).ronda!.turno,
    )
    expect(new Set(turnos).size).toBeGreaterThan(1)
  })

  it('refuses a seat that is not at the table', () => {
    expect(() =>
      startPartida({
        players: 3,
        seed: 'x',
        config: config({ empiezaPrimeraRonda: 5 }),
      }),
    ).toThrow(/cannot open a partida/)
  })
})

describe('scoring a finished ronda', () => {
  const partidaCon = (ronda: PartidaState['ronda'], overrides: Partial<PartidaConfig> = {}) => {
    const base = startPartida({
      players: 2,
      seed: 'puntaje',
      config: config({ contratos: [CUATRO_TRIOS], ...overrides }),
    })
    return { ...base, ronda }
  }

  it('gives the winner zero and charges everyone else their hand', () => {
    const perdedor = [n('K', 'spades'), n('9', 'hearts'), c()] // 10 + 9 + 50
    const { ronda, movimientos } = rondaGanableEnUnTurno(perdedor)

    let state = partidaCon(ronda)
    for (const move of movimientos) {
      const result = aplicarEnPartida(state, move)
      expect(result.ok).toBe(true)
      if (result.ok) state = result.state
    }

    expect(state.historial).toHaveLength(1)
    expect(state.historial[0].ganador).toBe(0)
    expect(state.historial[0].puntos).toEqual([0, 69])
    expect(state.totales).toEqual([0, 69])
  })

  it('subtracts the bonus from the winner when one is configured', () => {
    const perdedor = [n('5', 'clubs')]
    const { ronda, movimientos } = rondaGanableEnUnTurno(perdedor)

    let state = partidaCon(ronda, { bonusGanadorRonda: 10 })
    for (const move of movimientos) {
      const result = aplicarEnPartida(state, move)
      if (result.ok) state = result.state
    }

    expect(state.totales).toEqual([-10, 5])
  })

  it('does not count cards already on the mesa', () => {
    // Seat 0 laid twelve cards down and still scores zero for them.
    const perdedor = [n('2', 'clubs')]
    const { ronda, movimientos } = rondaGanableEnUnTurno(perdedor)

    let state = partidaCon(ronda)
    for (const move of movimientos) {
      const result = aplicarEnPartida(state, move)
      if (result.ok) state = result.state
    }

    expect(state.totales[0]).toBe(0)
  })

  it('refuses to close a ronda nobody has gone out of', () => {
    const state = startPartida({ players: 2, seed: 'abierta' })
    expect(() => cerrarRonda(state)).toThrow(/gone out/)
  })
})

describe('moving from one contract to the next', () => {
  const dosContratos = config({
    contratos: [CUATRO_TRIOS, contratoPorId('c1')!],
  })

  const jugarPrimeraRonda = () => {
    const { ronda, movimientos } = rondaGanableEnUnTurno([n('3', 'clubs')])
    let state: PartidaState = {
      ...startPartida({ players: 2, seed: 'dos', config: dosContratos }),
      ronda,
    }
    for (const move of movimientos) {
      const result = aplicarEnPartida(state, move)
      if (result.ok) state = result.state
    }
    return state
  }

  it('deals the next contract automatically', () => {
    const state = jugarPrimeraRonda()
    expect(state.indiceContrato).toBe(1)
    expect(contratoActual(state)?.id).toBe('c1')
    expect(state.ronda?.jugadores[0].hand).toHaveLength(CARDS_PER_HAND)
    expect(state.ganadores).toBeNull()
  })

  it('lets whoever won the ronda open the next one', () => {
    const state = jugarPrimeraRonda()
    expect(state.historial[0].ganador).toBe(0)
    expect(state.ronda?.turno).toBe(0)
  })

  it('carries the totals forward', () => {
    const state = jugarPrimeraRonda()
    expect(state.totales).toEqual([0, 3])
    expect(state.historial).toHaveLength(1)
  })

  it('gives each ronda its own deal', () => {
    const primera = startPartida({ players: 2, seed: 'dos', config: dosContratos })
    const segunda = jugarPrimeraRonda()
    expect(ids(segunda.ronda!.jugadores[0].hand)).not.toEqual(
      ids(primera.ronda!.jugadores[0].hand),
    )
  })
})

describe('finishing the partida', () => {
  const unSoloContrato = config({ contratos: [CUATRO_TRIOS] })

  const jugarHastaElFinal = (perdedor: Card[]) => {
    const { ronda, movimientos } = rondaGanableEnUnTurno(perdedor)
    let state: PartidaState = {
      ...startPartida({ players: 2, seed: 'final', config: unSoloContrato }),
      ronda,
    }
    for (const move of movimientos) {
      const result = aplicarEnPartida(state, move)
      if (result.ok) state = result.state
    }
    return state
  }

  it('stops dealing and names the winner', () => {
    const state = jugarHastaElFinal([n('K', 'spades')])
    expect(state.ronda).toBeNull()
    expect(state.ganadores).toEqual([0])
    expect(state.totales).toEqual([0, 10])
  })

  it('refuses further moves once it is over', () => {
    const state = jugarHastaElFinal([n('K', 'spades')])
    const result = aplicarEnPartida(state, { type: 'robar', de: 'stock' })
    expect(result).toMatchObject({ ok: false, code: 'PARTIDA_TERMINADA' })
  })
})

describe('who wins', () => {
  it('is whoever has the fewest points', () => {
    expect(seatsConMenosPuntos([120, 45, 200])).toEqual([1])
  })

  it('is everybody tied at the bottom — a tie is a shared win', () => {
    expect(seatsConMenosPuntos([45, 45, 200])).toEqual([0, 1])
    expect(seatsConMenosPuntos([80, 80, 80])).toEqual([0, 1, 2])
  })

  it('handles negative totals from the bonus', () => {
    expect(seatsConMenosPuntos([-30, 10, -30, 5])).toEqual([0, 2])
  })
})
