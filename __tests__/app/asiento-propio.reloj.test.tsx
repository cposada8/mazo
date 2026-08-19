import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Mano, type Reloj } from '@/components/mesa'
import { n } from '../engine/helpers'

/**
 * Your own clock, and the row it lives in (Phase 40).
 *
 * Phase 36 drew your own countdown as a wash behind the words «Tu mano» —
 * legible once you know it is there, invisible if you do not, and, upright,
 * often scrolled off the screen entirely. It is a ring now, the same shape
 * the table already draws on everybody else.
 */

const RELOJ: Reloj = { segundos: 45, clave: '0:3:1', transcurrido: 12, propio: true }

const secciones = [
  { id: 'sueltas', cards: [n('7', 'spades'), n('8', 'spades'), n('9', 'spades')], bloqueada: false },
]

/** The draining arc, wherever it is drawn: one class, one animation. */
const arcos = (container: HTMLElement) => container.querySelectorAll('.reloj-arco')

describe('your own clock', () => {
  it('draws the ring on your turn, and starts it where the server says', () => {
    const { container } = render(
      <Mano secciones={secciones} esTuTurno reloj={RELOJ} />,
    )

    const arco = arcos(container)[0]
    expect(arco).toBeTruthy()
    expect(arco.getAttribute('style')).toContain('animation-duration: 45s')
    // A negative delay is "this turn began twelve seconds ago", which is what
    // keeps a phone that joined late showing what everybody else sees.
    expect(arco.getAttribute('style')).toContain('animation-delay: -12s')
  })

  it('keeps the draining badge too — one countdown, two ways to read it', () => {
    const { container } = render(
      <Mano secciones={secciones} esTuTurno reloj={RELOJ} />,
    )
    expect(container.querySelector('.badge-agota')).toBeTruthy()
  })

  it('draws nothing when the turn is not yours', () => {
    const { container } = render(
      <Mano secciones={secciones} esTuTurno={false} reloj={RELOJ} />,
    )
    expect(arcos(container)).toHaveLength(0)
    expect(container.querySelector('.badge-agota')).toBeNull()
  })

  it('draws nothing where no clock hurries you — a table alone with bots', () => {
    const { container } = render(<Mano secciones={secciones} esTuTurno />)
    expect(arcos(container)).toHaveLength(0)
  })
})

describe('the heading row gives way in the right order', () => {
  it('never lets the passed-in strip shrink the hand controls out of reach', () => {
    const { getByText } = render(
      <Mano
        secciones={secciones}
        esTuTurno
        cabecera={<span>algo que ocupa la fila</span>}
        acciones={<button type="button">acomodar</button>}
      />,
    )

    // The controls keep their size; the strip beside them is what gives way.
    const controles = getByText('acomodar')
    const fila = controles.parentElement!
    expect(fila.className).toContain('flex-wrap')
    expect(fila.querySelector('h2')!.className).toContain('shrink-0')
    // And the row is not a sideways scroller any more: what does not fit
    // wraps, rather than sitting off the edge waiting to be swiped into view.
    expect(fila.className).not.toContain('overflow-x-auto')
    expect(getByText('algo que ocupa la fila')).toBeTruthy()
  })
})
