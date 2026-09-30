import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMano } from '@/app/jugar/useMano'
import { crearEscenario, describeCard, vistaDeAsiento } from '@/lib/engine'

/**
 * Dropping a dragged card (Phase 63): the rule, not the gesture. Where the
 * finger lands needs a real layout; what landing there does to the hand does
 * not.
 */

const ronda = crearEscenario({
  manos: [['2♠', '5♥', '9♣', 'K♦', '7♠'], []],
  seed: 'arrastre',
})
// The scenario deals a full hand; the five named cards are the first five.
const vista = { ...vistaDeAsiento(ronda, 0), mano: ronda.jugadores[0].hand.slice(0, 5) }
const id = (carta: string) =>
  vista.mano.find((card) => describeCard(card) === carta)!.id

function montar() {
  return renderHook(() => useMano({ vista, reparto: 1, onAviso: () => {} }))
}

const escrita = (result: ReturnType<typeof montar>['result']) =>
  result.current.mano.map(describeCard)

describe('llevarCartas', () => {
  it('carries a card that is not selected alone, and leaves the selection be', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.llevarCartas(id('7♠'), id('2♠')))

    expect(escrita(result)).toEqual(['7♠', '2♠', '5♥', '9♣', 'K♦'])
    expect(result.current.seleccion).toEqual([id('9♣')])
  })

  it('carries the whole selection when the card is selected, gathered', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('K♦')))
    act(() => result.current.alternarCarta(id('2♠')))
    act(() => result.current.llevarCartas(id('K♦'), null))

    expect(escrita(result)).toEqual(['5♥', '9♣', '7♠', '2♠', 'K♦'])
  })

  it('releases a latched sort — a drag is a claim about where cards go', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('numeros'))
    expect(escrita(result)).toEqual(['2♠', '5♥', '7♠', '9♣', 'K♦'])

    act(() => result.current.llevarCartas(id('K♦'), id('2♠')))
    expect(escrita(result)).toEqual(['K♦', '2♠', '5♥', '7♠', '9♣'])
    expect(result.current.acomodoActivo).toBeNull()
  })

  it('keeps the sort latched when the drop changed nothing', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('numeros'))
    act(() => result.current.llevarCartas(id('5♥'), id('7♠')))

    expect(result.current.acomodoActivo).toBe('numeros')
  })

  it('leaves pinned cards where they are', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.fijarSeleccion())
    act(() => result.current.llevarCartas(id('9♣'), null))

    expect(escrita(result)).toEqual(['9♣', '2♠', '5♥', 'K♦', '7♠'])
  })
})
