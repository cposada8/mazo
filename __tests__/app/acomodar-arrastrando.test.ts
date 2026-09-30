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
    act(() => result.current.llevarCartas(id('7♠'), { antesDe: id('2♠') }))

    expect(escrita(result)).toEqual(['7♠', '2♠', '5♥', '9♣', 'K♦'])
    expect(result.current.seleccion).toEqual([id('9♣')])
  })

  it('carries the whole selection when the card is selected, gathered', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('K♦')))
    act(() => result.current.alternarCarta(id('2♠')))
    act(() => result.current.llevarCartas(id('K♦'), { despuesDe: id('7♠') }))

    expect(escrita(result)).toEqual(['5♥', '9♣', '7♠', '2♠', 'K♦'])
  })

  it('releases a latched sort — a drag is a claim about where cards go', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('numeros'))
    expect(escrita(result)).toEqual(['2♠', '5♥', '7♠', '9♣', 'K♦'])

    act(() => result.current.llevarCartas(id('K♦'), { antesDe: id('2♠') }))
    expect(escrita(result)).toEqual(['K♦', '2♠', '5♥', '7♠', '9♣'])
    expect(result.current.acomodoActivo).toBeNull()
  })

  it('keeps the sort latched when the drop changed nothing', () => {
    const { result } = montar()
    act(() => result.current.acomodarMano('numeros'))
    act(() => result.current.llevarCartas(id('5♥'), { antesDe: id('7♠') }))

    expect(result.current.acomodoActivo).toBe('numeros')
  })

  it('rearranges a bloque from inside (Phase 65)', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.alternarCarta(id('K♦')))
    act(() => result.current.fijarSeleccion())
    act(() => result.current.llevarCartas(id('K♦'), { antesDe: id('9♣') }))

    expect(escrita(result)).toEqual(['K♦', '9♣', '2♠', '5♥', '7♠'])
    expect(result.current.secciones[0]).toMatchObject({ bloqueada: true })
    expect(result.current.secciones[0].cards.map(describeCard)).toEqual(['K♦', '9♣'])
  })

  it('pins a loose card by dropping it into a bloque, and unpins one back out', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.fijarSeleccion())

    act(() => result.current.llevarCartas(id('7♠'), { despuesDe: id('9♣') }))
    expect(result.current.secciones[0].cards.map(describeCard)).toEqual(['9♣', '7♠'])

    act(() => result.current.llevarCartas(id('9♣'), { antesDe: id('2♠') }))
    expect(result.current.secciones[0].cards.map(describeCard)).toEqual(['7♠'])
    expect(escrita(result)).toEqual(['7♠', '9♣', '2♠', '5♥', 'K♦'])
  })

  it('moves a card between bloques, and a bloque it empties goes away', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('2♠')))
    act(() => result.current.fijarSeleccion())
    act(() => result.current.alternarCarta(id('K♦')))
    act(() => result.current.fijarSeleccion())

    act(() => result.current.llevarCartas(id('2♠'), { despuesDe: id('K♦') }))
    const fijas = result.current.secciones.filter((seccion) => seccion.bloqueada)
    expect(fijas.map((seccion) => seccion.cards.map(describeCard))).toEqual([['K♦', '2♠']])
  })

  it('carries a selection spread over bloque and loose run together', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.fijarSeleccion())
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.alternarCarta(id('K♦')))
    act(() => result.current.llevarCartas(id('K♦'), { despuesDe: id('7♠') }))

    expect(escrita(result)).toEqual(['2♠', '5♥', '7♠', '9♣', 'K♦'])
    expect(result.current.secciones.some((seccion) => seccion.bloqueada)).toBe(false)
  })

  it('keeps a latched sort when the drop only touches a bloque', () => {
    const { result } = montar()
    act(() => result.current.alternarCarta(id('9♣')))
    act(() => result.current.fijarSeleccion())
    act(() => result.current.acomodarMano('numeros'))
    act(() => result.current.llevarCartas(id('K♦'), { antesDe: id('9♣') }))

    expect(result.current.acomodoActivo).toBe('numeros')
    expect(escrita(result)).toEqual(['K♦', '9♣', '2♠', '5♥', '7♠'])
  })
})
