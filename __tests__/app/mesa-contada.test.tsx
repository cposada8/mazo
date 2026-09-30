import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMesa } from '@/app/jugar/useMesa'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Grupo,
  type RondaState,
  type VistaDePartida,
  describeCard,
  vistaDeAsiento,
} from '@/lib/engine'
import { MS_DE_VIAJE, type Relato } from '@/lib/relato'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phases 58 and 59: what reaches the table is seen arriving, and nothing
 * lands before its flight. With quick bots the thrown card used to sit on the
 * descarte first and fly in after.
 */

const vistaDe = (ronda: RondaState): VistaDePartida => ({
  asiento: 0,
  config: CONFIG_POR_DEFECTO,
  players: 2,
  seed: 'contada',
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

const manoPropia = () => [n('K', 'clubs'), n('2', 'spades')]
const arriba = (cards: readonly Card[] | undefined) => (cards?.length ? describeCard(cards.at(-1)!) : null)

describe('the descarte waits for the card to land', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a thrown card on the pile only when its flight ends', () => {
    const nueve = n('9', 'diamonds')
    const antes = vistaDe(
      makeRonda({ jugadores: [{ hand: manoPropia() }, { hand: [n('J', 'hearts'), n('3', 'clubs')] }], discard: [nueve] }),
    )
    const despues = vistaDe(
      makeRonda({
        jugadores: [{ hand: manoPropia() }, { hand: [n('3', 'clubs')] }],
        discard: [nueve, n('J', 'hearts')],
        turno: 0,
      }),
    )
    const { result, rerender } = renderHook(
      ({ vista, relatos }: { vista: VistaDePartida; relatos: Relato[] }) =>
        useMesa(transporte(vista, relatos)),
      { initialProps: { vista: antes, relatos: [] as Relato[] } },
    )
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('9♦')

    // The bot has thrown: the state says J♥ is on top.
    rerender({ vista: despues, relatos: [{ tipo: 'bota', seat: 1, carta: 'J♥' }] })
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('9♦')

    // Told: the card is in the air, and the pile still waits for it.
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current.viaje?.hasta).toEqual({ pila: 'descarte' })
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('9♦')

    // Landed.
    act(() => void vi.advanceTimersByTime(MS_DE_VIAJE))
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('J♥')
  })
})

describe('a card taken off the descarte is never in two places (Phase 60)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('leaves the pile as its flight to the hand starts', () => {
    const nueve = n('9', 'diamonds')
    const jota = n('J', 'hearts')
    const antes = vistaDe(
      makeRonda({ jugadores: [{ hand: manoPropia() }, { hand: [n('3', 'clubs')] }], discard: [nueve, jota] }),
    )
    const despues = vistaDe(
      makeRonda({
        jugadores: [{ hand: manoPropia() }, { hand: [n('3', 'clubs'), jota] }],
        discard: [nueve],
        fase: 'act',
        turno: 1,
      }),
    )
    const { result, rerender } = renderHook(
      ({ vista, relatos }: { vista: VistaDePartida; relatos: Relato[] }) =>
        useMesa(transporte(vista, relatos)),
      { initialProps: { vista: antes, relatos: [] as Relato[] } },
    )

    rerender({ vista: despues, relatos: [{ tipo: 'descarte', seat: 1, carta: 'J♥' }] })
    // Queued: nothing has happened yet on screen.
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('J♥')

    // In the air: gone from the pile, not yet in the hand.
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current.viaje?.desde).toEqual({ pila: 'descarte' })
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('9♦')
    expect(result.current.mesaContada?.vista.jugadores[1].cartas).toBe(1)

    // Landed in the hand.
    act(() => void vi.advanceTimersByTime(MS_DE_VIAJE))
    expect(arriba(result.current.mesaContada?.vista.descarte)).toBe('9♦')
    expect(result.current.mesaContada?.vista.jugadores[1].cartas).toBe(2)
  })
})

describe('a bajada flies to the mesa', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('flies the grupos to their place, hidden there until they land', () => {
    const sietes: Grupo = {
      kind: 'trio',
      rank: '7',
      cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
    }
    const reyes: Grupo = {
      kind: 'trio',
      rank: 'K',
      cards: [n('K', 'spades'), n('K', 'hearts'), n('K', 'diamonds')],
    }
    const antes = vistaDe(makeRonda({ jugadores: [{ hand: manoPropia() }, { hand: [n('3', 'clubs')] }] }))
    const despues = vistaDe(
      makeRonda({
        jugadores: [
          { hand: manoPropia() },
          { hand: [n('3', 'clubs')], grupos: [sietes, reyes], bajadoEnTurno: 1 },
        ],
      }),
    )
    const { result, rerender } = renderHook(
      ({ vista, relatos }: { vista: VistaDePartida; relatos: Relato[] }) =>
        useMesa(transporte(vista, relatos)),
      { initialProps: { vista: antes, relatos: [] as Relato[] } },
    )

    rerender({ vista: despues, relatos: [{ tipo: 'bajada', seat: 1, grupos: 2 }] })
    act(() => void vi.advanceTimersByTime(0))

    expect(result.current.viaje?.desde).toEqual({ seat: 1 })
    expect(result.current.viaje?.hasta).toEqual({ grupo: '1-0' })
    expect(result.current.viaje?.cartas?.map(describeCard)).toEqual(['7♠', 'K♠'])
    expect(result.current.mesaContada?.ocultas.size).toBe(6)

    act(() => void vi.advanceTimersByTime(MS_DE_VIAJE))
    expect(result.current.mesaContada?.ocultas.size).toBe(0)
  })

  it('flies an agregar to the grupo that took it', () => {
    const escala: Grupo = {
      kind: 'escala',
      suit: 'hearts',
      start: '4',
      cards: [n('4', 'hearts'), n('5', 'hearts'), n('6', 'hearts'), n('7', 'hearts'), n('8', 'hearts')],
    }
    const sietes: Grupo = {
      kind: 'trio',
      rank: '7',
      cards: [n('7', 'spades'), n('7', 'diamonds'), n('7', 'clubs')],
    }
    const vista = vistaDe(
      makeRonda({
        jugadores: [
          { hand: manoPropia() },
          { hand: [n('3', 'clubs')], grupos: [sietes, escala], bajadoEnTurno: 1 },
        ],
      }),
    )
    const { result, rerender } = renderHook(
      ({ relatos }: { relatos: Relato[] }) => useMesa(transporte(vista, relatos)),
      { initialProps: { relatos: [] as Relato[] } },
    )

    rerender({ relatos: [{ tipo: 'agrega', seat: 1, cartas: ['8♥'], dueno: 1 }] })
    act(() => void vi.advanceTimersByTime(0))

    expect(result.current.viaje?.hasta).toEqual({ grupo: '1-1' })
    expect([...(result.current.mesaContada?.ocultas ?? [])]).toEqual([escala.cards[4].id])
  })
})

describe('your draw waits for the throw that handed you the turn (Phase 69)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is still telling while the card flies, and done once it lands', () => {
    const nueve = n('9', 'diamonds')
    const antes = vistaDe(
      makeRonda({ jugadores: [{ hand: manoPropia() }, { hand: [n('J', 'hearts'), n('3', 'clubs')] }], discard: [nueve], turno: 1, fase: 'act' }),
    )
    const despues = vistaDe(
      makeRonda({
        jugadores: [{ hand: manoPropia() }, { hand: [n('3', 'clubs')] }],
        discard: [nueve, n('J', 'hearts')],
        turno: 0,
      }),
    )
    const { result, rerender } = renderHook(
      ({ vista, relatos }: { vista: VistaDePartida; relatos: Relato[] }) =>
        useMesa(transporte(vista, relatos)),
      { initialProps: { vista: antes, relatos: [] as Relato[] } },
    )
    expect(result.current.contando).toBe(false)

    // The state already says it is your turn to draw…
    rerender({ vista: despues, relatos: [{ tipo: 'bota', seat: 1, carta: 'J♥' }] })
    expect(result.current.esTuTurno).toBe(true)
    // …but the J♥ has not reached the pile, so the table is not done.
    expect(result.current.contando).toBe(true)
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current.contando).toBe(true)

    act(() => void vi.advanceTimersByTime(MS_DE_VIAJE))
    expect(result.current.contando).toBe(false)
  })
})
