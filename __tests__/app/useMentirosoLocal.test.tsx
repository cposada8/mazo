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

describe('useMentirosoLocal', () => {
  it('a whole partida, the person playing one card a turn, reaches a winner', () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'local-entera', jugadores: 4, segundosVentana: 3, segundosBot: 1 }),
    )
    for (let paso = 0; paso < 2_000 && result.current.vista.ganador === null; paso++) {
      const v = result.current.vista
      if (v.fase === 'jugar' && v.turno === TU_ASIENTO) {
        act(() => result.current.onJugar([v.mano[0].id]))
      } else {
        act(() => {
          vi.advanceTimersByTime(500)
        })
      }
    }
    expect(result.current.vista.ganador).not.toBeNull()
    expect(result.current.eventos.at(-1)?.tipo).toBe('gano')
  })

  it('opens a window after every play, with its deadline, and closes it', () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'ventana', jugadores: 3, segundosVentana: 3, segundosBot: 1 }),
    )
    // Let the table run until some play is in its window.
    for (let i = 0; i < 40 && result.current.vista.fase !== 'ventana'; i++) {
      const v = result.current.vista
      if (v.turno === TU_ASIENTO && v.fase === 'jugar') {
        act(() => result.current.onJugar([v.mano[0].id]))
      } else {
        act(() => {
          vi.advanceTimersByTime(250)
        })
      }
    }
    expect(result.current.vista.fase).toBe('ventana')
    expect(result.current.ventanaHasta).toBeGreaterThan(Date.now())
    act(() => {
      vi.advanceTimersByTime(3_100)
    })
    expect(result.current.vista.fase).toBe('jugar')
    expect(result.current.ventanaHasta).toBeNull()
  })

  it("the person's call, made first, is the one that counts", () => {
    const { result } = renderHook(() =>
      useMentirosoLocal({ seed: 'grito', jugadores: 3, segundosVentana: 3, segundosBot: 1 }),
    )
    // Wait for a bot's play to be open to a call, then call at once.
    for (let i = 0; i < 40; i++) {
      const v = result.current.vista
      if (v.fase === 'ventana' && v.ultimaJugada?.asiento !== TU_ASIENTO) break
      if (v.turno === TU_ASIENTO && v.fase === 'jugar') {
        act(() => result.current.onJugar([v.mano[0].id]))
      } else {
        act(() => {
          vi.advanceTimersByTime(250)
        })
      }
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
    // Let bots play until it is your turn.
    for (let i = 0; i < 60 && !screen.queryByText(/Elige 1 a 4 cartas/); i++) {
      act(() => {
        vi.advanceTimersByTime(500)
      })
    }
    expect(screen.getByText(/Elige 1 a 4 cartas: van como/)).toBeInTheDocument()
    const cartas = screen.getAllByRole('button', { pressed: false }).filter((b) =>
      / de (picas|corazones|diamantes|tréboles)$/.test(b.getAttribute('aria-label') ?? ''),
    )
    fireEvent.click(cartas[0])
    fireEvent.click(cartas[1])
    expect(screen.getByRole('button', { name: /^Jugar 2 como / })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /^Jugar 2 como / }))
    expect(screen.getByRole('button', { name: '¡Mentiroso!' })).toBeDisabled()
    expect(screen.getByText(/¿Te creerán\?/)).toBeInTheDocument()
  })
})
