import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Mesa, escalaDeMesa } from '@/components/mesa'
import { type Escala, type Grupo, type Rank, vistaDeAsiento } from '@/lib/engine'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 45: the mesa that ran off the right edge.
 *
 * Phase 17 left the grupos as one row that scrolled sideways and called it
 * the honest minimum. Six players deep into *tres escalas* is eighteen grupos
 * and most of the table was off-screen — you had to go looking for the mesa
 * before you could read it.
 *
 * jsdom has no layout, so what is pinned here is the mechanism rather than
 * the pixels: the grupos wrap instead of scrolling sideways, and the cards
 * shrink by how many grupos there are. That the shrunk sizes actually fit was
 * settled by measuring a real table, not here.
 */

const PALOS = ['spades', 'hearts', 'diamonds', 'clubs'] as const

/** A four-card escala, distinct from every other one this file builds. */
const escala = (palo: (typeof PALOS)[number], desde: number): Escala => {
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  return {
    kind: 'escala',
    suit: palo,
    start: ranks[desde],
    cards: [0, 1, 2, 3].map((paso) => n(ranks[desde + paso], palo)),
  }
}

/** A table of six, each seat holding `porJugador` escalas. */
function mesaCon(porJugador: number) {
  const jugadores = Array.from({ length: 6 }, (_, seat) => ({
    hand: [n('K', 'clubs')],
    grupos: Array.from({ length: porJugador }, (_, i) =>
      escala(PALOS[(seat + i) % 4], (seat + i * 3) % 6),
    ) as Grupo[],
    bajadoEnTurno: 1,
  }))

  return vistaDeAsiento(makeRonda({ jugadores, fase: 'act' }), 0)
}

const grupos = (container: HTMLElement) =>
  container.querySelector('.grupos-en-mesa') as HTMLElement

describe('escalaDeMesa', () => {
  it('never grows, and never reaches zero', () => {
    let anterior = Infinity
    for (const cuantos of [0, 6, 7, 12, 13, 20, 21, 24, 40]) {
      const { carta } = escalaDeMesa(cuantos)
      expect(carta).toBeLessThanOrEqual(anterior)
      expect(carta).toBeGreaterThan(0.25)
      anterior = carta
    }
  })

  it('leaves an ordinary table exactly as it was', () => {
    // Two players with three grupos each is the common case, and Phase 45
    // must not have changed how it looks.
    expect(escalaDeMesa(6)).toEqual({ carta: 0.52, compacto: false })
  })

  it('drops the titles as soon as it starts shrinking', () => {
    // The two go together: a title is a whole line per grupo, and it is the
    // cheapest thing on the felt to lose.
    expect(escalaDeMesa(7).compacto).toBe(true)
    expect(escalaDeMesa(7).carta).toBeLessThan(0.52)
  })
})

describe('a full mesa on the table', () => {
  afterEach(cleanup)

  it('wraps rather than scrolling sideways', () => {
    const { container } = render(<Mesa state={mesaCon(3)} asiento={0} />)

    // The lane is a wrapping box now; nothing turns it into a sideways
    // scroller, which is what made the far half of the mesa unfindable.
    expect(grupos(container).className).not.toContain('overflow-x')
  })

  it('shrinks the cards once the table crowds, and not before', () => {
    const tranquila = render(<Mesa state={mesaCon(1)} asiento={0} />)
    expect(grupos(tranquila.container).style.getPropertyValue('--carta-xs')).toContain(
      '0.52',
    )
    cleanup()

    // Eighteen grupos: six seats, three escalas each — the worst case the
    // default contracts can produce.
    const llena = render(<Mesa state={mesaCon(3)} asiento={0} />)
    expect(grupos(llena.container).style.getPropertyValue('--carta-xs')).toContain(
      '0.37',
    )
  })

  it('keeps every grupo on the felt, whatever the count', () => {
    const { container } = render(<Mesa state={mesaCon(3)} asiento={0} />)

    // Nothing is dropped, paged or hidden to make it fit: eighteen grupos of
    // four cards are all there.
    expect(container.querySelectorAll('.grupos-en-mesa > *')).toHaveLength(18)
  })

  it('drops the grupo titles when crowded and keeps them when not', () => {
    render(<Mesa state={mesaCon(1)} asiento={0} />)
    expect(screen.getAllByText(/^Escala de/).length).toBe(6)
    cleanup()

    render(<Mesa state={mesaCon(3)} asiento={0} />)
    expect(screen.queryByText(/^Escala de/)).toBeNull()
  })
})
