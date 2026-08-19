import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG_POR_DEFECTO, contratoPorId, describeCard } from '@/lib/engine'
import { acomodar } from '@/lib/mano'
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
    expect(result.current.vista!.fase).toBe('draw')
    expect(result.current.vista!.mano).toHaveLength(12)
  })
})

describe('drawing', () => {
  it('takes a card from the stock and moves on to acting', () => {
    const { result } = montar()

    act(() => result.current.robar('stock'))

    expect(result.current.vista!.mano).toHaveLength(13)
    expect(result.current.vista!.fase).toBe('act')
  })

  it('takes the top of the descarte instead', () => {
    const { result } = montar()
    const arriba = result.current.vista!.descarte.at(-1)!

    act(() => result.current.robar('descarte'))

    const mano = result.current.vista!.mano
    expect(mano.map((card) => card.id)).toContain(arriba.id)
  })

  it('ignores a second draw in the same turn', () => {
    const { result } = montar()

    act(() => result.current.robar('stock'))
    act(() => result.current.robar('stock'))

    expect(result.current.vista!.mano).toHaveLength(13)
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

    expect(result.current.vista!.jugadores[TU_ASIENTO].grupos).toHaveLength(2)
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
    expect(result.current.vista!.fase).toBe('act')
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

describe('a latched sort', () => {
  it('files a drawn card into place while held down', () => {
    const { result } = montar()

    act(() => result.current.acomodarMano('numeros'))
    expect(result.current.acomodoActivo).toBe('numeros')

    act(() => result.current.robar('stock'))

    // The hand is exactly what sorting it would produce: the drawn card has
    // already found its slot, not the end of the row.
    const mano = result.current.mano
    expect(mano).toHaveLength(13)
    expect(mano.map((card) => card.id)).toEqual(
      acomodar([...mano], 'numeros').map((card) => card.id),
    )
  })

  it('releases without moving a card, and newcomers go back to the end', () => {
    const { result } = montar()

    act(() => result.current.acomodarMano('pintas'))
    const sorted = result.current.mano.map((card) => card.id)

    act(() => result.current.acomodarMano('pintas'))
    expect(result.current.acomodoActivo).toBeNull()
    expect(result.current.mano.map((card) => card.id)).toEqual(sorted)

    // Released: the next draw lands at the end, easy to notice.
    act(() => result.current.robar('stock'))
    const despues = result.current.mano
    expect(despues.slice(0, -1).map((card) => card.id)).toEqual(sorted)
  })

  it('is released by moving cards by hand', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('pintas'))
    act(() =>
      result.current.alternarCarta(result.current.disponibles[3].id),
    )
    act(() => result.current.moverCartas('izquierda'))
    expect(result.current.acomodoActivo).toBeNull()
  })
})

describe('the drawn card is marked', () => {
  it('marks exactly the card that arrived, even under a latched sort', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('numeros'))

    const habia = new Set(result.current.mano.map((card) => card.id))
    act(() => result.current.robar('stock'))

    const nueva = result.current.mano.find((card) => !habia.has(card.id))!
    expect(result.current.recienRobada).toBe(nueva.id)
  })

  it('unmarks when the discard ends the turn', () => {
    const { result } = montar()
    act(() => result.current.robar('descarte'))
    expect(result.current.recienRobada).not.toBeNull()

    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())
    expect(result.current.recienRobada).toBeNull()
  })

  it('never marks a bot draw', async () => {
    const { result } = montar()
    act(() => result.current.robar('stock'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())

    await waitFor(() => expect(result.current.esTuTurno).toBe(true), {
      timeout: 5000,
    })
    // The bot drew during its turn; your mark stayed clear.
    expect(result.current.recienRobada).toBeNull()
  })
})

describe('the public story', () => {
  it('accumulates relatos as moves land', async () => {
    const { result } = montar()

    act(() => result.current.robar('descarte'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())

    // The log itself is immediate: it is the record, and the record is the
    // engine's.
    expect(result.current.historia.map((r) => r.tipo)).toEqual([
      'descarte',
      'bota',
    ])

    // The *line* is told rather than displayed (Phase 41): two moves that
    // landed in the same instant are narrated one after the other, so the
    // strip catches up on the next beat rather than skipping the first.
    await waitFor(() => expect(result.current.relato?.tipo).toBe('bota'))
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
    expect(result.current.vista!.fase).toBe('draw')
  })

  it('adopt a new thinking time mid-partida, on the turn in progress', async () => {
    const { result, rerender } = renderHook(
      ({ segundosBot }) =>
        usePartida({ jugadores: 2, seed: 'ritmo', config: soloDosTrios, segundosBot }),
      { initialProps: { segundosBot: 600 } },
    )

    act(() => result.current.robar('stock'))
    act(() => result.current.alternarCarta(result.current.disponibles[0].id))
    act(() => result.current.descartar())
    expect(result.current.esTuTurno).toBe(false)

    // At 600 seconds the bot's first move would land in minutes. Dropping the
    // time reschedules the turn already in progress — the change is
    // immediate, not saved up for the next partida.
    rerender({ segundosBot: 0.05 })

    await waitFor(() => expect(result.current.esTuTurno).toBe(true), {
      timeout: 5000,
    })
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
    expect(result.current.partida!.historial.at(-1)).toBe(resumen)
    expect(result.current.partida!.totales[resumen.ganador as number]).toBe(0)
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
    expect(result.current.vista!.contrato.id).toBe('c2')
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
