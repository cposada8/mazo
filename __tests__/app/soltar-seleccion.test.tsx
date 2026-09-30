import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Tablero } from '@/app/jugar/juego'
import { usePartida } from '@/app/jugar/usePartida'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Tapping the table lets go of the selection (Phase 64) — but only a tap on
 * nothing: the buttons that act on a selection must still find it there.
 */

function Mesa() {
  // Bots that think for ten minutes never move during a test.
  const juego = usePartida({
    jugadores: 4,
    seed: 'soltar-seleccion',
    config: CONFIG_POR_DEFECTO,
    segundosBot: 600,
  })

  return (
    <Tablero
      juego={juego}
      jugadores={4}
      seed="soltar-seleccion"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

/** The cards in your hand: pressable, and without a label of their own. */
const cartas = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]:not([aria-label])'),
  )
const elegidas = () => cartas().filter((carta) => carta.getAttribute('aria-pressed') === 'true')

describe('tapping the table', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('lets go of every selected card when it lands on the felt', () => {
    render(<Mesa />)
    fireEvent.click(cartas()[0])
    fireEvent.click(cartas()[3])
    expect(elegidas()).toHaveLength(2)

    fireEvent.click(document.querySelector('.fieltro')!)
    expect(elegidas()).toHaveLength(0)
  })

  it('keeps the selection for a button that acts on it', () => {
    render(<Mesa />)
    fireEvent.click(cartas()[2])
    fireEvent.click(screen.getByRole('button', { name: /mover las cartas seleccionadas a la derecha/i }))

    expect(elegidas()).toHaveLength(1)
  })

  it('still toggles only the card that was tapped', () => {
    render(<Mesa />)
    fireEvent.click(cartas()[0])
    fireEvent.click(cartas()[1])
    fireEvent.click(cartas()[0])

    expect(elegidas()).toHaveLength(1)
  })
})
