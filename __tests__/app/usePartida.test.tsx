import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_POR_DEFECTO, contratoPorId, describeCard } from '@/lib/engine'
import { TU_ASIENTO, usePartida } from '@/app/jugar/usePartida'

/**
 * The controller behind the play page: what a tap actually does.
 *
 * Driving it directly instead of through the DOM keeps these tests about the
 * rules of interaction — what is allowed, what is refused, what a refusal says
 * — rather than about markup.
 */

type Juego = ReturnType<typeof usePartida>

const soloDosTrios = {
  ...CONFIG_POR_DEFECTO,
  contratos: [contratoPorId('c1')!],
  empiezaPrimeraRonda: TU_ASIENTO,
}

const montar = (seed = 'controlador') =>
  renderHook(() => usePartida({ jugadores: 2, seed, config: soloDosTrios }))

afterEach(() => {
  vi.useRealTimers()
})

describe('starting a partida', () => {
  it('opens on your turn, waiting for a draw', () => {
    const { result } = montar()
    expect(result.current.esTuTurno).toBe(true)
    expect(result.current.ronda!.fase).toBe('draw')
    expect(result.current.ronda!.jugadores[TU_ASIENTO].hand).toHaveLength(12)
  })
})

describe('drawing', () => {
  it('takes a card from the stock and moves on to acting', () => {
    const { result } = montar()

    act(() => result.current.robar('stock'))

    expect(result.current.ronda!.jugadores[TU_ASIENTO].hand).toHaveLength(13)
    expect(result.current.ronda!.fase).toBe('act')
  })

  it('takes the top of the descarte instead', () => {
    const { result } = montar()
    const arriba = result.current.ronda!.discard.at(-1)!

    act(() => result.current.robar('descarte'))

    const mano = result.current.ronda!.jugadores[TU_ASIENTO].hand
    expect(mano.map((card) => card.id)).toContain(arriba.id)
  })

  it('ignores a second draw in the same turn', () => {
    const { result } = montar()

    act(() => result.current.robar('stock'))
    act(() => result.current.robar('stock'))

    expect(result.current.ronda!.jugadores[TU_ASIENTO].hand).toHaveLength(13)
  })
})

describe('selecting cards', () => {
  it('toggles a card on and off', () => {
    const { result } = montar()
    const primera = result.current.disponibles[0]

    act(() => result.current.alternarCarta(primera.id))
    expect(result.current.seleccion).toEqual([primera.id])

    act(() => result.current.alternarCarta(primera.id))
    expect(result.current.seleccion).toEqual([])
  })

  it('refuses a selection that is not a grupo, and says why', () => {
    const { result } = montar()
    act(() => result.current.robar('stock'))

    // Two cards can never be a grupo.
    act(() => {
      result.current.alternarCarta(result.current.disponibles[0].id)
      result.current.alternarCarta(result.current.disponibles[1].id)
    })
    act(() => result.current.apartarGrupo())

    expect(result.current.propuestas).toHaveLength(0)
    expect(result.current.aviso).toMatch(/tres cartas/)
  })
})

describe('laying down', () => {
  /** Find a hand that can make two trios, so the flow can be driven for real. */
  const conDosTrios = () => {
    for (let i = 0; i < 400; i++) {
      const montado = montar(`bajarse-${i}`)
      const mano = montado.result.current.disponibles
      const porRango = new Map<string, string[]>()
      for (const card of mano) {
        if (card.kind !== 'normal') continue
        porRango.set(card.rank, [...(porRango.get(card.rank) ?? []), card.id])
      }
      const trios = [...porRango.values()].filter((ids) => ids.length >= 3)
      if (trios.length >= 2) return { montado, trios }
      montado.unmount()
    }
    throw new Error('no seed produced a hand with two trios')
  }

  it('sets grupos aside and only then lets you bajarte', () => {
    const { montado, trios } = conDosTrios()
    const { result } = montado

    act(() => result.current.robar('stock'))

    act(() => {
      for (const id of trios[0].slice(0, 3)) result.current.alternarCarta(id)
    })
    act(() => result.current.apartarGrupo())

    expect(result.current.propuestas).toHaveLength(1)
    expect(result.current.contratoCompleto).toBe(false)

    act(() => {
      for (const id of trios[1].slice(0, 3)) result.current.alternarCarta(id)
    })
    act(() => result.current.apartarGrupo())

    expect(result.current.contratoCompleto).toBe(true)

    act(() => result.current.bajarse())

    expect(result.current.ronda!.jugadores[TU_ASIENTO].grupos).toHaveLength(2)
    expect(result.current.propuestas).toHaveLength(0)
    expect(result.current.yaBajado).toBe(true)
  })

  it('takes cards set aside out of the pool you can still pick', () => {
    const { montado, trios } = conDosTrios()
    const { result } = montado

    act(() => result.current.robar('stock'))
    const antes = result.current.disponibles.length

    act(() => {
      for (const id of trios[0].slice(0, 3)) result.current.alternarCarta(id)
    })
    act(() => result.current.apartarGrupo())

    expect(result.current.disponibles).toHaveLength(antes - 3)
  })

  it('gives a grupo back when you drop it', () => {
    const { montado, trios } = conDosTrios()
    const { result } = montado

    act(() => result.current.robar('stock'))
    act(() => {
      for (const id of trios[0].slice(0, 3)) result.current.alternarCarta(id)
    })
    act(() => result.current.apartarGrupo())
    act(() => result.current.soltarGrupo(0))

    expect(result.current.propuestas).toHaveLength(0)
  })
})

describe('discarding', () => {
  it('needs exactly one card', () => {
    const { result } = montar()
    act(() => result.current.robar('stock'))
    act(() => result.current.descartar())

    expect(result.current.aviso).toMatch(/exactamente una/)
    expect(result.current.ronda!.fase).toBe('act')
  })

  it('ends the turn and hands it to the bot', () => {
    const { result } = montar()
    act(() => result.current.robar('stock'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())

    expect(result.current.esTuTurno).toBe(false)
    expect(result.current.esperando).toBe(true)
  })
})

describe('the bots', () => {
  it('take their turn on their own and give it back', async () => {
    const { result } = montar()

    act(() => result.current.robar('stock'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())

    expect(result.current.esTuTurno).toBe(false)

    await waitFor(() => expect(result.current.esTuTurno).toBe(true), {
      timeout: 5000,
    })
    expect(result.current.ronda!.fase).toBe('draw')
  })
})

describe('the end of a ronda', () => {
  const dosRondas = {
    ...CONFIG_POR_DEFECTO,
    contratos: [contratoPorId('c1')!, contratoPorId('c2')!],
    empiezaPrimeraRonda: TU_ASIENTO,
  }

  /**
   * Play the dullest possible game — draw, discard, never bajarse — until a bot
   * goes out. Fake timers so the bots' thinking pause costs nothing.
   */
  const hastaQueAlguienGane = (result: { current: Juego }) => {
    for (let turno = 0; turno < 600 && !result.current.resumen; turno++) {
      if (result.current.esTuTurno) {
        act(() => result.current.robar('stock'))
        act(() => result.current.alternarCarta(result.current.disponibles[0].id))
        act(() => result.current.descartar())
      } else {
        act(() => void vi.advanceTimersByTime(1000))
      }
    }
    if (!result.current.resumen) throw new Error('no bot ever went out')
  }

  const partidaLarga = (seed = 'fin-de-ronda') => {
    vi.useFakeTimers()
    return renderHook(() =>
      usePartida({ jugadores: 2, seed, config: dosRondas }),
    )
  }

  it('holds on the winner instead of dealing straight past them', () => {
    const { result } = partidaLarga()
    hastaQueAlguienGane(result)

    const resumen = result.current.resumen!
    expect(resumen.ganador).not.toBe(TU_ASIENTO)
    expect(resumen.contrato.id).toBe('c1')
    // The scoreboard says the same thing, because it is the same record.
    expect(result.current.partida.historial.at(-1)).toBe(resumen)
    expect(result.current.partida.totales[resumen.ganador]).toBe(0)
  })

  it('freezes the table while the summary is up', () => {
    const { result } = partidaLarga()
    hastaQueAlguienGane(result)

    expect(result.current.esTuTurno).toBe(false)
    expect(result.current.esperando).toBe(false)

    const antes = result.current.partida
    act(() => void vi.advanceTimersByTime(10_000))
    expect(result.current.partida).toBe(antes)
  })

  it('deals a hand with nothing pinned and nothing arranged', () => {
    const { result } = partidaLarga()

    // Pin the whole hand, so a leak cannot be missed by luck: whichever of
    // these cards is dealt again next ronda would come back already pinned.
    const fijadas = result.current.disponibles.map((card) => card.id)
    act(() => {
      for (const id of fijadas) result.current.alternarCarta(id)
    })
    act(() => result.current.fijarSeleccion())
    expect(result.current.secciones.some((s) => s.bloqueada)).toBe(true)

    hastaQueAlguienGane(result)
    act(() => result.current.siguiente())

    // Card ids repeat between deals — `7-s#0` is the same string every time —
    // so this seed really does deal some of them back.
    const nueva = result.current.disponibles.map((card) => card.id)
    expect(nueva.filter((id) => fijadas.includes(id)).length).toBeGreaterThan(0)
    expect(result.current.secciones.some((s) => s.bloqueada)).toBe(false)
    expect(result.current.seleccion).toEqual([])
  })

  it('deals the next reparto when you move on', () => {
    const { result } = partidaLarga()
    hastaQueAlguienGane(result)

    act(() => result.current.siguiente())

    expect(result.current.resumen).toBeNull()
    expect(result.current.seAcabo).toBe(false)
    expect(result.current.ronda!.contrato.id).toBe('c2')
    // Whoever went out opens the next one, so it is the bot's turn.
    expect(result.current.esperando).toBe(true)

    // Two ticks: a bot's turn is a draw and then an act, each after its pause.
    act(() => void vi.advanceTimersByTime(1000))
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.esTuTurno).toBe(true)
  })
})

describe('refusals reach the player in words', () => {
  it('explains that the mesa is closed before bajarse', () => {
    const { result } = montar()
    act(() => result.current.robar('stock'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.agregarA(TU_ASIENTO, 0))

    expect(result.current.aviso).toBeTruthy()
    expect(result.current.aviso).not.toMatch(/[A-Z_]{6,}/) // never a raw code
  })

  it('never shows an engine code to a person', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())

    expect(result.current.aviso).toBeTruthy()
    expect(result.current.aviso).not.toContain('FASE_EQUIVOCADA')
  })
})

describe('describeCard', () => {
  it('is what the table shows', () => {
    const { result } = montar()
    const card = result.current.disponibles[0]
    expect(describeCard(card)).toMatch(/^(A|[2-9]|10|J|Q|K)[♠♥♦♣]$|^comodin$/)
  })
})
