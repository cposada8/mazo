import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CONFIG_POR_DEFECTO,
  type PartidaState,
  contratoPorId,
  startPartida,
} from '@/lib/engine'
import { TU_ASIENTO, usePartida } from '@/app/jugar/usePartida'
import { makeRonda, n } from '../engine/helpers'

/**
 * The bug found at the table after Phase 26: the *engine* closed a ronda
 * emptied by ligar, but the controller recorded the move without checking
 * whether it had ended anything — so the game dealt straight past the
 * who-won screen into the next reparto.
 *
 * Reaching "bajado, mesa open, one card that fits a grupo" through real
 * deals would take a seed hunt, so startPartida is stubbed to hand the
 * controller that exact table. Everything after the deal is real.
 */
vi.mock('@/lib/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/engine')>()
  return { ...real, startPartida: vi.fn(real.startPartida) }
})

describe('going out by ligando, seen from the table', () => {
  it('pauses on the who-won screen instead of dealing past it', () => {
    const ultima = n('7', 'diamonds')
    const ronda = makeRonda({
      jugadores: [
        {
          hand: [ultima],
          grupos: [
            {
              kind: 'trio',
              rank: '7',
              cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
            },
          ],
          bajadoEnTurno: 1,
        },
        { hand: [n('K', 'spades'), n('9', 'hearts')] },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })

    const config = {
      ...CONFIG_POR_DEFECTO,
      contratos: [contratoPorId('c1')!, contratoPorId('c2')!],
    }
    vi.mocked(startPartida).mockReturnValue({
      config,
      players: 2,
      seed: 'ligada',
      indiceContrato: 0,
      ronda,
      historial: [],
      totales: [0, 0],
      ganadores: null,
    } satisfies PartidaState)

    const { result } = renderHook(() =>
      usePartida({ jugadores: 2, seed: 'ligada', config }),
    )

    act(() => result.current.alternarCarta(ultima.id))
    act(() => result.current.agregarA(TU_ASIENTO, 0))

    // The pause is up, saying who won and what it cost everyone else.
    const resumen = result.current.resumen
    expect(resumen).not.toBeNull()
    expect(resumen!.ganador).toBe(TU_ASIENTO)
    expect(resumen!.puntos).toEqual([0, 19])

    // The next reparto was dealt behind the pause, and nobody plays into it.
    expect(result.current.partida!.indiceContrato).toBe(1)
    expect(result.current.esTuTurno).toBe(false)
    expect(result.current.esperando).toBe(false)
  })
})
