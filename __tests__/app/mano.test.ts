import { describe, expect, it } from 'vitest'
import { type Card, crearEscenario, describeCard } from '@/lib/engine'
import { acomodar, aplicarOrden, moverSeleccion } from '@/lib/mano'

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
  it('reads low to high', () => {
    const hand = mano(['K♦', '2♣', '9♥', '5♠'])
    expect(escrita(acomodar(hand, 'numeros'))).toEqual(['2♣', '5♠', '9♥', 'K♦'])
  })

  it('puts the ace at the top, not the bottom', () => {
    // On the ring the ace is position zero; to a person sorting a hand it is
    // the highest card.
    const hand = mano(['A♠', '2♣', 'K♦'])
    expect(escrita(acomodar(hand, 'numeros'))).toEqual(['2♣', 'K♦', 'A♠'])
  })

  it('puts cards of the same rango side by side', () => {
    const hand = mano(['5♠', 'K♦', '5♥', '2♣'])
    const ordenada = escrita(acomodar(hand, 'numeros'))
    expect(ordenada.indexOf('5♥') - ordenada.indexOf('5♠')).toBe(1)
  })

  it('keeps groups together while still reading in order', () => {
    const hand = mano(['8♥', '5♠', 'K♦', '8♣', '5♥', '8♠', '2♣'])
    expect(escrita(acomodar(hand, 'numeros'))).toEqual([
      '2♣', '5♠', '5♥', '8♠', '8♥', '8♣', 'K♦',
    ])
  })

  it('keeps every card', () => {
    const hand = mano(['5♠', '8♥', 'K♦', '8♣', '5♥', '**'])
    expect(acomodar(hand, 'numeros')).toHaveLength(hand.length)
  })
})

describe('moverSeleccion', () => {
  describe('one card', () => {
    const orden = ['a', 'b', 'c']

    it('moves it one place left', () => {
      expect(moverSeleccion(orden, ['c'], 'izquierda')).toEqual(['a', 'c', 'b'])
    })

    it('moves it one place right', () => {
      expect(moverSeleccion(orden, ['a'], 'derecha')).toEqual(['b', 'a', 'c'])
    })

    it('does nothing at the ends', () => {
      expect(moverSeleccion(orden, ['a'], 'izquierda')).toEqual(orden)
      expect(moverSeleccion(orden, ['c'], 'derecha')).toEqual(orden)
    })
  })

  describe('several cards, scattered', () => {
    // c c [s] c [s] [s]
    const orden = ['c1', 'c2', 's1', 'c3', 's2', 's3']
    const seleccion = ['s1', 's2', 's3']

    it('gathers them and lands them beside the leftmost one', () => {
      // c [s] [s] [s] c c
      expect(moverSeleccion(orden, seleccion, 'izquierda')).toEqual([
        'c1', 's1', 's2', 's3', 'c2', 'c3',
      ])
    })

    it('gathers them the same way going right', () => {
      expect(moverSeleccion(orden, seleccion, 'derecha')).toEqual([
        'c1', 'c2', 'c3', 's1', 's2', 's3',
      ])
    })

    it('keeps the selected cards in the order they were sitting in', () => {
      const revuelta = ['s3', 's1', 's2']
      expect(moverSeleccion(orden, revuelta, 'izquierda')).toEqual([
        'c1', 's1', 's2', 's3', 'c2', 'c3',
      ])
    })

    it('keeps sliding on repeated taps', () => {
      let actual = moverSeleccion(orden, seleccion, 'izquierda')
      actual = moverSeleccion(actual, seleccion, 'izquierda')
      expect(actual).toEqual(['s1', 's2', 's3', 'c1', 'c2', 'c3'])

      // And stops at the edge instead of wrapping or scrambling.
      expect(moverSeleccion(actual, seleccion, 'izquierda')).toEqual(actual)
    })
  })

  it('loses no card, whatever the selection', () => {
    const orden = ['a', 'b', 'c', 'd', 'e']
    for (const seleccion of [['a'], ['a', 'e'], ['b', 'c'], ['a', 'c', 'e']]) {
      for (const hacia of ['izquierda', 'derecha'] as const) {
        const resultado = moverSeleccion(orden, seleccion, hacia)
        expect([...resultado].sort()).toEqual([...orden].sort())
      }
    }
  })

  it('moves a card the stored order has never seen', () => {
    // The card just drawn is appended when the hand is laid out, so it is in
    // the hand before it is in any saved arrangement. Moving it must still work
    // — this is exactly the bug where the arrows did nothing to a fresh card.
    const comoSeVe = ['a', 'b', 'recien-robada']
    expect(moverSeleccion(comoSeVe, ['recien-robada'], 'izquierda')).toEqual([
      'a', 'recien-robada', 'b',
    ])
  })

  it('does nothing when everything is selected, or nothing is', () => {
    const orden = ['a', 'b', 'c']
    expect(moverSeleccion(orden, orden, 'izquierda')).toEqual(orden)
    expect(moverSeleccion(orden, [], 'derecha')).toEqual(orden)
  })

  it('never mutates the order it was given', () => {
    const orden = ['a', 'b', 'c']
    const antes = [...orden]
    moverSeleccion(orden, ['b'], 'derecha')
    expect(orden).toEqual(antes)
  })
})
