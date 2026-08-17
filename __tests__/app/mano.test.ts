import { describe, expect, it } from 'vitest'
import { type Card, crearEscenario, describeCard } from '@/lib/engine'
import { acomodar, aplicarOrden, mover } from '@/lib/mano'

const mano = (cartas: string[]): Card[] =>
  crearEscenario({ manos: [cartas, []], seed: 'mano' }).jugadores[0].hand.slice(
    0,
    cartas.length,
  )

const escrita = (cards: readonly Card[]) => cards.map(describeCard)

describe('aplicarOrden', () => {
  const hand = mano(['7♠', '3♥', 'K♦'])

  it('puts the hand in the remembered order', () => {
    const orden = [hand[2].id, hand[0].id, hand[1].id]
    expect(escrita(aplicarOrden(hand, orden))).toEqual(['K♦', '7♠', '3♥'])
  })

  it('leaves the dealt order alone when nothing was arranged', () => {
    expect(escrita(aplicarOrden(hand, []))).toEqual(['7♠', '3♥', 'K♦'])
  })

  it('puts a card the order does not know about on the end', () => {
    // The card just drawn: easy to spot, never buried mid-hand.
    const orden = [hand[1].id, hand[0].id]
    expect(escrita(aplicarOrden(hand, orden))).toEqual(['3♥', '7♠', 'K♦'])
  })

  it('drops cards that have left the hand', () => {
    const orden = [hand[0].id, 'una-que-ya-no-esta', hand[1].id]
    expect(escrita(aplicarOrden(hand, orden))).toEqual(['7♠', '3♥', 'K♦'])
  })

  it('keeps every card exactly once', () => {
    const revuelto = [hand[1].id, hand[1].id, hand[0].id]
    const resultado = aplicarOrden(hand, revuelto)
    expect(resultado).toHaveLength(hand.length)
    expect(new Set(resultado.map((c) => c.id)).size).toBe(hand.length)
  })
})

describe('acomodar por pintas', () => {
  it('groups each suit and runs it low to high', () => {
    const hand = mano(['7♠', '3♥', '5♠', 'A♥', '4♠', 'K♥'])
    expect(escrita(acomodar(hand, 'pintas'))).toEqual([
      '4♠', '5♠', '7♠',
      'A♥', '3♥', 'K♥',
    ])
  })

  it('puts an escala together and in order', () => {
    const hand = mano(['9♦', '6♦', '8♦', '7♦', 'Q♣'])
    expect(escrita(acomodar(hand, 'pintas'))).toEqual([
      '6♦', '7♦', '8♦', '9♦', 'Q♣',
    ])
  })

  it('leaves comodines at the end, out of the way', () => {
    const hand = mano(['**', '5♠', '4♠', '**'])
    const ordenada = escrita(acomodar(hand, 'pintas'))
    expect(ordenada.slice(0, 2)).toEqual(['4♠', '5♠'])
    expect(ordenada.slice(2)).toEqual(['comodin', 'comodin'])
  })
})

describe('acomodar por números', () => {
  it('puts cards of the same rango side by side', () => {
    const hand = mano(['5♠', 'K♦', '5♥', '2♣'])
    const ordenada = escrita(acomodar(hand, 'numeros'))
    expect(ordenada.indexOf('5♥') - ordenada.indexOf('5♠')).toBe(1)
  })

  it('leads with the biggest group', () => {
    // Three eights ahead of two fives, and the loners last.
    const hand = mano(['5♠', '8♥', 'K♦', '8♣', '5♥', '8♠', '2♣'])
    const ordenada = escrita(acomodar(hand, 'numeros'))
    expect(ordenada.slice(0, 3).every((c) => c.startsWith('8'))).toBe(true)
    expect(ordenada.slice(3, 5).every((c) => c.startsWith('5'))).toBe(true)
  })

  it('keeps every card', () => {
    const hand = mano(['5♠', '8♥', 'K♦', '8♣', '5♥', '**'])
    expect(acomodar(hand, 'numeros')).toHaveLength(hand.length)
  })
})

describe('mover', () => {
  const orden = ['a', 'b', 'c']

  it('swaps a card one place left', () => {
    expect(mover(orden, 'c', 'izquierda')).toEqual(['a', 'c', 'b'])
  })

  it('swaps a card one place right', () => {
    expect(mover(orden, 'a', 'derecha')).toEqual(['b', 'a', 'c'])
  })

  it('does nothing at the ends', () => {
    expect(mover(orden, 'a', 'izquierda')).toEqual(orden)
    expect(mover(orden, 'c', 'derecha')).toEqual(orden)
  })

  it('ignores a card that is not there', () => {
    expect(mover(orden, 'z', 'izquierda')).toEqual(orden)
  })

  it('never mutates the order it was given', () => {
    const antes = [...orden]
    mover(orden, 'b', 'derecha')
    expect(orden).toEqual(antes)
  })
})
