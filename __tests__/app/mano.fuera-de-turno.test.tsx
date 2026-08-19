import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Tablero } from '@/app/jugar/juego'
import { usePartida } from '@/app/jugar/usePartida'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'

/**
 * Arranging your hand while somebody else plays (Phase 40).
 *
 * Waiting is when there is time to think, and it was exactly the stretch in
 * which the hand went rigid: selecting was wired to your turn, and everything
 * that arranges a hand — gathering, sliding, pinning — needs cards selected
 * first. Selecting is not a move, so it is not the referee's business.
 *
 * The test drives the whole table rather than the `Mano` component, because
 * the lock was never in the hand: it was one conditional in `Tablero`.
 */

/** Seat 1 opens, so seat 0 — yours, in the local home — is left waiting. */
const CONFIG = { ...CONFIG_POR_DEFECTO, empiezaPrimeraRonda: 1 as const }

function Mesa() {
  // Bots that think for ten minutes never move during a test, which keeps the
  // turn where the config put it.
  const juego = usePartida({
    jugadores: 4,
    seed: 'fuera-de-turno',
    config: CONFIG,
    segundosBot: 600,
  })

  return (
    <Tablero
      juego={juego}
      jugadores={4}
      seed="fuera-de-turno"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

/**
 * The cards in your hand: the only buttons that carry a pressed state without
 * a label of their own. The sort controls are pressable too — they latch —
 * which is why this cannot simply ask for everything unpressed.
 */
const cartas = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'button[aria-pressed]:not([aria-label])',
    ),
  )

describe('the hand while another seat is thinking', () => {
  beforeEach(() => localStorage.clear())
  // No globals, so React Testing Library's automatic cleanup is not wired up:
  // without this every render leaves its table in the document and the queries
  // find the first one.
  afterEach(cleanup)

  it('takes a selection, and offers what a selection is for', () => {
    render(<Mesa />)

    // Nothing to move or pin until something is chosen — the controls that
    // need a selection are not on screen yet.
    expect(screen.queryByLabelText(/Mover las cartas seleccionadas/)).toBeNull()

    const carta = cartas()[0]
    fireEvent.click(carta)
    expect(carta).toHaveAttribute('aria-pressed', 'true')

    // And now they are: sliding either way, and pinning them together.
    expect(screen.getAllByLabelText(/Mover las cartas seleccionadas/)).toHaveLength(2)
    expect(screen.getByLabelText(/^Fijar:/)).toBeTruthy()
  })

  it('lets go of a card again, the way it does on your own turn', () => {
    render(<Mesa />)

    const carta = cartas()[0]
    fireEvent.click(carta)
    expect(carta).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(carta)
    expect(carta).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers nothing that would be a move: the turn is still not yours', () => {
    render(<Mesa />)
    fireEvent.click(cartas()[0])

    // Armar, bajarme and botar belong to the turn, and it belongs to seat 1.
    expect(screen.queryByText('Botar')).toBeNull()
    expect(screen.queryByText('Bajarme')).toBeNull()
    expect(screen.queryByText(/^Armar/)).toBeNull()
  })
})
