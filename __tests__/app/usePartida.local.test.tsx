import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePartida } from '@/app/jugar/usePartida'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/** Seat 0 opens, so the test can play the first turn without winding to it. */
const CONFIG = { ...CONFIG_POR_DEFECTO, empiezaPrimeraRonda: 0 as const }

/**
 * Phase 34, the local home: a bots-only partida lives in this browser, so it
 * has to survive the browser — a closed tab, a reload, a lost signal.
 */
describe('a local partida is kept where it is played', () => {
  beforeEach(() => localStorage.clear())

  it('comes back mid-turn instead of dealing again', () => {
    const opciones = { jugadores: 4, seed: 'guardada', segundosBot: 600, config: CONFIG, id: 'ABC12' }
    const primera = renderHook(() => usePartida(opciones))

    // Play into the turn: draw, so the hand is one card bigger than dealt.
    act(() => primera.result.current.robar('stock'))
    const mano = primera.result.current.vista!.mano.map((card) => card.id)
    expect(mano).toHaveLength(13)
    primera.unmount()

    // A fresh mount is a reload. The hand is the one that was being held.
    const segunda = renderHook(() => usePartida(opciones))
    expect(segunda.result.current.vista!.mano.map((c) => c.id)).toEqual(mano)
    expect(segunda.result.current.vista!.fase).toBe('act')
  })

  it('deals fresh for a different partida — a code names a partida, not a deal', () => {
    const primera = renderHook(() =>
      usePartida({ jugadores: 4, seed: 'una', segundosBot: 600, config: CONFIG, id: 'UNA11' }),
    )
    act(() => primera.result.current.robar('stock'))
    primera.unmount()

    const otra = renderHook(() =>
      usePartida({ jugadores: 4, seed: 'otra', segundosBot: 600, config: CONFIG, id: 'OTRA2' }),
    )
    expect(otra.result.current.vista!.mano).toHaveLength(12)
    expect(otra.result.current.vista!.fase).toBe('draw')
  })

  it('keeps the public log alongside the state', () => {
    const opciones = { jugadores: 4, seed: 'con-relato', segundosBot: 600, config: CONFIG, id: 'REL33' }
    const primera = renderHook(() => usePartida(opciones))
    act(() => primera.result.current.robar('stock'))
    const cuantos = primera.result.current.historia.length
    expect(cuantos).toBeGreaterThan(0)
    primera.unmount()

    const segunda = renderHook(() => usePartida(opciones))
    expect(segunda.result.current.historia).toHaveLength(cuantos)
    expect(segunda.result.current.relato?.tipo).toBe('mazo')
  })
})
