import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Carta } from '@/components/carta'
import { CarasDeComodinProvider } from '@/components/caras'
import type { Comodin } from '@/lib/engine'

/**
 * The comodín wears the face its ronda dealt it — when a provider is there.
 * Everywhere else (/mesa, /pruebas, an empty gallery) it keeps the drawn
 * ★-and-☺ design, which is also why these assertions look for the ☺.
 */

const comodin: Comodin = { id: 'comodin#0-0', kind: 'comodin' }

describe('a comodín with a face', () => {
  it('shows the image its ronda dealt, and keeps the corner ★', () => {
    const caras = new Map([['comodin#0-0', '/candidatos/comodines/x.jpg']])
    const { container, getAllByText, queryByText } = render(
      <CarasDeComodinProvider value={caras}>
        <Carta card={comodin} />
      </CarasDeComodinProvider>,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(decodeURIComponent(img!.src)).toContain('/candidatos/comodines/x.jpg')
    // The corners still identify the card; the centre ☺ yields to the photo.
    expect(getAllByText('★')).toHaveLength(2)
    expect(queryByText('☺')).toBeNull()
  })

  it('falls back to the drawn design without a provider', () => {
    const { container, getByText } = render(<Carta card={comodin} />)
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('☺')).toBeTruthy()
  })

  it('falls back when the gallery dealt it nothing', () => {
    const { container } = render(
      <CarasDeComodinProvider value={new Map()}>
        <Carta card={comodin} />
      </CarasDeComodinProvider>,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
