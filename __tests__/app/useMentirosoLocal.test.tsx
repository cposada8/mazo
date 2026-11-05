import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TU_ASIENTO, useMentirosoLocal } from '@/app/mentiroso/useMentirosoLocal'
import { MesaMentirosoLocal } from '@/components/mentiroso/local'

/**
 * Phase 79: a Mentiroso partida in this browser, on fake timers — the bots
 * play on their clock, the window opens and closes, and somebody wins.
 */

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The person, playing one card whenever it is their turn — or accepting a last play. */
function turnoDeLaPersona(result: { current: ReturnType<typeof useMentirosoLocal> }) {
  const v = result.current.vista
  if (v.ganador !== null || v.turno !== TU_ASIENTO) return false
  const ultima = v.fase === 'ventana' && v.ultimaJugada && v.cartasPorAsiento[v.ultimaJugada.asiento] === 0
  act(() => (ultima ? result.current.onCreer() : result.current.onJugar([v.mano[0].id])))
  return true
}

const esperar = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('useMentirosoLocal', () => {
  it('a whole partida, the person playing one card a turn, reaches a winner', () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'local-entera', jugadores: 4, segundosBot: 1 }),
    )
    for (let paso = 0; paso < 2_000 && result.current.vista.ganador === null; paso++) {
      if (!turnoDeLaPersona(result)) esperar(500)
    }
    expect(result.current.vista.ganador).not.toBeNull()
    expect(result.current.eventos.at(-1)?.tipo).toBe('gano')
  })

  it("the next play closes a play's window: there is no other clock on it", () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'ventana', jugadores: 3, segundosBot: 1 }),
    )
    // Run until a play by somebody else is open with the person in turn.
    for (let i = 0; i < 80; i++) {
      const v = result.current.vista
      if (v.fase === 'ventana' && v.turno === TU_ASIENTO && v.cartasPorAsiento[v.ultimaJugada!.asiento] > 0) break
      if (!turnoDeLaPersona(result)) esperar(250)
    }
    const v = result.current.vista
    expect(v.fase).toBe('ventana')
    const abierta = v.ultimaJugada!
    // Nothing closes it while the person thinks…
    esperar(60_000)
    expect(result.current.vista.ultimaJugada).toEqual(abierta)
    // …and their play does.
    act(() => result.current.onJugar([result.current.vista.mano[0].id]))
    expect(result.current.vista.ultimaJugada!.asiento).toBe(TU_ASIENTO)
  })

  it("the person's call, made first, is the one that counts", () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'grito', jugadores: 3, segundosBot: 1 }),
    )
    for (let i = 0; i < 80; i++) {
      const v = result.current.vista
      if (v.fase === 'ventana' && v.ultimaJugada?.asiento !== TU_ASIENTO) break
      if (!turnoDeLaPersona(result)) esperar(100)
    }
    act(() => result.current.onMentiroso())
    const ultimo = result.current.eventos.at(-1)
    expect(ultimo?.tipo).toBe('acusacion')
    expect(ultimo?.tipo === 'acusacion' && ultimo.acusador).toBe(TU_ASIENTO)
  })
})

describe('MesaMentirosoLocal', () => {
  it('your turn: pick cards and the button says what they go as', () => {
    render(
      <MesaMentirosoLocal
        seed="pantalla"
        jugadores={4}
        nombres={['Tú', 'B1', 'B2', 'B3']}
        onSalir={() => {}}
      />,
    )
    for (let i = 0; i < 60 && !screen.queryByText(/elige tus cartas para los/); i++) esperar(500)
    expect(screen.getByText(/elige tus cartas para los/)).toBeInTheDocument()
    expect(screen.getByText('Tu turno')).toBeInTheDocument()
    const cartas = screen.getAllByRole('button', { pressed: false }).filter((b) =>
      / de (picas|corazones|diamantes|tréboles)$/.test(b.getAttribute('aria-label') ?? ''),
    )
    fireEvent.click(cartas[0])
    fireEvent.click(cartas[1])
    fireEvent.click(screen.getByRole('button', { name: /^Jugar 2 como / }))
    // Your own play: declared, and no button to call it.
    expect(screen.getByText(/Declaraste/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '¡Mentiroso!' })).toBeNull()
  })
})
