import { describe, expect, it } from 'vitest'
import { ritmo } from '@/app/partida/[codigo]/useMesaRemota'
import { CONFIG_POR_DEFECTO, vistaDeAsiento } from '@/lib/engine'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 41: how often to ask depends on what you are waiting for.
 *
 * Phase 38 measured one interval for everything. Watching somebody else play
 * is what reopened it: on your own turn nothing changes without you, and while
 * another seat is up a bot's turn is landing in pieces you want to see.
 */

const respuesta = (turno: number) => ({
  ok: true as const,
  mesa: {
    vista: {
      asiento: 0,
      config: CONFIG_POR_DEFECTO,
      players: 2,
      seed: 'ritmo',
      indiceContrato: 0,
      ronda: vistaDeAsiento(
        makeRonda({ jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }], turno }),
        0,
      ),
      historial: [],
      totales: [0, 0],
      ganadores: null,
    },
    relatos: [],
    turnoDesde: null,
    segundosBot: 2,
    segundosPorTurno: 45,
    verDescarte: true,
    verHistorial: true,
    asientos: [],
  },
})

describe('how often the table asks', () => {
  it('asks faster while somebody else is playing', () => {
    expect(ritmo(respuesta(1))).toBeLessThan(ritmo(respuesta(0)))
  })

  it('slows down on your own turn — nothing moves until you move it', () => {
    expect(ritmo(respuesta(0))).toBeGreaterThanOrEqual(1000)
  })

  it('keeps a plain rhythm when there is no answer to read yet', () => {
    expect(ritmo(undefined)).toBeGreaterThan(0)
    expect(ritmo({ ok: false, code: 'NO_EXISTE' })).toBeGreaterThan(0)
  })
})
