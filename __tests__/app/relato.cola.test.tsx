import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMesa } from '@/app/jugar/useMesa'
import { GrupoEnMesa } from '@/components/mesa'
import {
  CONFIG_POR_DEFECTO,
  type Grupo,
  type RondaState,
  type VistaDePartida,
  vistaDeAsiento,
} from '@/lib/engine'
import type { Relato } from '@/lib/relato'
import { makeRonda, n } from '../engine/helpers'

/**
 * A turn you can follow (Phase 41).
 *
 * Three moves used to arrive together and only the newest was ever shown —
 * *de repente el jugador ya botó y cogió*. The log is a queue now: what has
 * been told is counted, and the rest is told in order, one line at a time.
 *
 * And what a turn puts on the mesa is marked while it is there to be seen.
 */

const vistaDe = (ronda: RondaState): VistaDePartida => ({
  asiento: 0,
  config: CONFIG_POR_DEFECTO,
  players: 2,
  seed: 'cola',
  indiceContrato: 0,
  ronda: vistaDeAsiento(ronda, 0),
  historial: [],
  totales: [0, 0],
  ganadores: null,
})

const transporte = (vista: VistaDePartida, relatos: readonly Relato[]) => ({
  vista,
  relatos,
  segundosDelTurno: 45,
  aviso: null,
  limpiarAviso: () => {},
  jugar: () => {},
})

/** A bot's whole turn, as the log tells it: drew, laid down, threw. */
const TURNO_AJENO: Relato[] = [
  { tipo: 'mazo', seat: 1 },
  { tipo: 'bajada', seat: 1, grupos: 2 },
  { tipo: 'bota', seat: 1, carta: '4♦' },
]

const manoSuelta = () => [n('7', 'spades'), n('8', 'spades'), n('9', 'spades')]

describe('the story is told one line at a time', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('tells three that arrived together in the order they happened', () => {
    const vista = vistaDe(makeRonda({ jugadores: [{ hand: manoSuelta() }, { hand: [] }] }))
    const { result, rerender } = renderHook(
      ({ relatos }: { relatos: Relato[] }) => useMesa(transporte(vista, relatos)),
      { initialProps: { relatos: [] as Relato[] } },
    )

    expect(result.current.relato).toBeNull()

    // The whole turn lands in one poll.
    rerender({ relatos: TURNO_AJENO })

    // The first line goes up at once — nothing is gained by making the table
    // wait before it starts talking.
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current.relato).toEqual(TURNO_AJENO[0])

    act(() => void vi.advanceTimersByTime(300))
    expect(result.current.relato).toEqual(TURNO_AJENO[1])

    // The last of a batch waits the ordinary beat rather than the catching-up
    // one: there is nothing behind it to hurry for.
    act(() => void vi.advanceTimersByTime(750))
    expect(result.current.relato).toEqual(TURNO_AJENO[2])
  })

  it('sends the card travelling with the line that names it, not before', () => {
    const vista = vistaDe(makeRonda({ jugadores: [{ hand: manoSuelta() }, { hand: [] }] }))
    const { result, rerender } = renderHook(
      ({ relatos }: { relatos: Relato[] }) => useMesa(transporte(vista, relatos)),
      { initialProps: { relatos: [] as Relato[] } },
    )

    rerender({ relatos: TURNO_AJENO })
    act(() => void vi.advanceTimersByTime(0))

    // The stock draw: face down, from the pile to the seat that took it.
    expect(result.current.viaje).toMatchObject({
      desde: { pila: 'stock' },
      hasta: { seat: 1 },
      carta: null,
    })
    const primera = result.current.viaje!.clave

    // The bajada moves nothing anyone can follow, so the card in flight is
    // still the one the line before named.
    act(() => void vi.advanceTimersByTime(300))
    expect(result.current.viaje!.clave).toBe(primera)

    // The discard travels the other way, face up.
    act(() => void vi.advanceTimersByTime(750))
    expect(result.current.viaje).toMatchObject({ hasta: { pila: 'descarte' } })
    expect(result.current.viaje!.clave).toBeGreaterThan(primera)
  })

  it('lands where the table is when the backlog is a reload, not a turn', () => {
    const vista = vistaDe(makeRonda({ jugadores: [{ hand: manoSuelta() }, { hand: [] }] }))
    const muchos: Relato[] = [
      ...TURNO_AJENO,
      ...TURNO_AJENO,
      { tipo: 'mazo', seat: 0 },
    ]

    const { result, rerender } = renderHook(
      ({ relatos }: { relatos: Relato[] }) => useMesa(transporte(vista, relatos)),
      { initialProps: { relatos: [] as Relato[] } },
    )

    rerender({ relatos: muchos })
    act(() => void vi.advanceTimersByTime(0))

    // Seven at once is a tab that was away. Nothing is replayed and nothing
    // travels: the line is simply the last thing that happened.
    expect(result.current.relato).toEqual(muchos.at(-1))
    expect(result.current.viaje).toBeNull()
  })

  it('forgets what was queued when the reparto changes under it', () => {
    const vista = vistaDe(makeRonda({ jugadores: [{ hand: manoSuelta() }, { hand: [] }] }))
    const { result, rerender } = renderHook(
      ({ relatos }: { relatos: Relato[] }) => useMesa(transporte(vista, relatos)),
      { initialProps: { relatos: [] as Relato[] } },
    )

    rerender({ relatos: TURNO_AJENO })
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current.relato).toEqual(TURNO_AJENO[0])

    // A new ronda empties the log. What was still queued belonged to a ronda
    // that is over, and telling it now would be a lie about this one.
    rerender({ relatos: [] })
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.relato).toBeNull()
  })
})

describe('what the turn put on the mesa is marked', () => {
  const trio = (rank: '5' | '6'): Grupo => ({
    kind: 'trio',
    rank,
    cards: [n(rank, 'spades'), n(rank, 'hearts'), n(rank, 'clubs')],
  })

  const conMesa = (grupos: Grupo[], numeroDeTurno: number, turno = 1) =>
    vistaDe(
      makeRonda({
        jugadores: [{ hand: manoSuelta() }, { hand: [], grupos, bajadoEnTurno: 1 }],
        numeroDeTurno,
        turno,
      }),
    )

  it('marks nothing on a mesa that has not changed', () => {
    const puesto = trio('5')
    const { result } = renderHook(() =>
      useMesa(transporte(conMesa([puesto], 4), [])),
    )
    expect(result.current.doradas.size).toBe(0)
  })

  it('marks the cards a grupo gained during the turn in play', () => {
    const puesto = trio('5')
    const { result, rerender } = renderHook(
      ({ vista }: { vista: VistaDePartida }) => useMesa(transporte(vista, [])),
      { initialProps: { vista: conMesa([puesto], 4) } },
    )

    const crecido: Grupo = { ...puesto, cards: [...puesto.cards, n('5', 'diamonds')] }
    rerender({ vista: conMesa([crecido], 4) })

    expect([...result.current.doradas]).toEqual([crecido.cards.at(-1)!.id])
  })

  it('keeps a whole turn visible when it arrives in one poll', () => {
    const { result, rerender } = renderHook(
      ({ vista }: { vista: VistaDePartida }) => useMesa(transporte(vista, [])),
      { initialProps: { vista: conMesa([], 4) } },
    )

    // The turn number and the new grupo land together, which is what a poll
    // spanning a whole turn looks like. Measuring against the look before —
    // rather than against this one — is what keeps the bajada marked.
    const bajado = trio('6')
    rerender({ vista: conMesa([bajado], 5) })
    expect(result.current.doradas.size).toBe(3)

    // And it clears when the next turn passes without adding anything.
    rerender({ vista: conMesa([bajado], 6) })
    expect(result.current.doradas.size).toBe(0)
  })
})

describe('the mark, on the table', () => {
  const trio: Grupo = {
    kind: 'trio',
    rank: '9',
    cards: [n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs')],
  }

  it('rings the cards it was given and leaves the rest alone', () => {
    const nueva = trio.cards[2]
    const { container } = render(
      <GrupoEnMesa grupo={trio} doradas={new Set([nueva.id])} />,
    )

    const anilladas = container.querySelectorAll('.ring-amber-400')
    expect(anilladas).toHaveLength(1)
    // Raised as well, or the card overlapping it would paint over the ring.
    expect(anilladas[0].className).toContain('z-10')
  })

  it('rings nothing when the turn has put nothing there', () => {
    const { container } = render(<GrupoEnMesa grupo={trio} />)
    expect(container.querySelectorAll('.ring-amber-400')).toHaveLength(0)
  })
})
