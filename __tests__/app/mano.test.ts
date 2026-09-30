import { describe, expect, it } from 'vitest'
import { type Card, crearEscenario, describeCard } from '@/lib/engine'
import {
  acomodar,
  aplanar,
  aplicarOrden,
  bloquear,
  distribuir,
  llevar,
  moverSeleccion,
  soltarBloque,
} from '@/lib/mano'

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

describe('llevar — dragging cards to a seam (Phases 63 and 65)', () => {
  const orden = ['a', 'b', 'c', 'd', 'e']
  const soloSueltas = (destino: Parameters<typeof llevar>[3], llevadas: string[]) =>
    llevar(orden, [], llevadas, destino).orden

  it('carries one card in front of another, or after it', () => {
    expect(soloSueltas({ antesDe: 'b' }, ['e'])).toEqual(['a', 'e', 'b', 'c', 'd'])
    expect(soloSueltas({ despuesDe: 'e' }, ['b'])).toEqual(['a', 'c', 'd', 'e', 'b'])
  })

  it('gathers scattered cards where they land, in the order given', () => {
    expect(soloSueltas({ antesDe: 'a' }, ['b', 'e'])).toEqual(['b', 'e', 'a', 'c', 'd'])
  })

  it('changes nothing at a seam beside a card it carries', () => {
    expect(soloSueltas({ antesDe: 'd' }, ['b', 'd'])).toEqual(orden)
    expect(soloSueltas({ despuesDe: 'b' }, ['b'])).toEqual(orden)
  })

  it('changes nothing for cards or a seam it does not hold', () => {
    expect(soloSueltas({ antesDe: 'a' }, ['z'])).toEqual(orden)
    expect(soloSueltas({ antesDe: 'z' }, ['a'])).toEqual(orden)
  })

  it('keeps its place among cards the screen does not show', () => {
    // x is set aside for a grupo: hidden, but still in the run.
    expect(llevar(['a', 'x', 'b', 'c'], [], ['c'], { antesDe: 'b' }).orden).toEqual([
      'a',
      'x',
      'c',
      'b',
    ])
  })

  describe('with bloques', () => {
    const bloques = [['p', 'q', 'r'], ['s', 't']]

    it('rearranges a bloque from inside', () => {
      const r = llevar(['a', 'b'], bloques, ['r'], { antesDe: 'p' })
      expect(r.bloques).toEqual([['r', 'p', 'q'], ['s', 't']])
      expect(r.orden).toEqual(['a', 'b'])
    })

    it('moves a card from one bloque to another', () => {
      const r = llevar(['a', 'b'], bloques, ['q'], { despuesDe: 't' })
      expect(r.bloques).toEqual([['p', 'r'], ['s', 't', 'q']])
    })

    it('pins a loose card by dropping it into a bloque', () => {
      const r = llevar(['a', 'b'], bloques, ['a'], { antesDe: 's' })
      expect(r.orden).toEqual(['b'])
      expect(r.bloques).toEqual([['p', 'q', 'r'], ['a', 's', 't']])
    })

    it('unpins a card by dropping it among the loose ones', () => {
      const r = llevar(['a', 'b'], bloques, ['p'], { despuesDe: 'a' })
      expect(r.orden).toEqual(['a', 'p', 'b'])
      expect(r.bloques).toEqual([['q', 'r'], ['s', 't']])
    })

    it('carries a selection from several places at once', () => {
      const r = llevar(['a', 'b'], bloques, ['q', 's', 'b'], { antesDe: 'a' })
      expect(r.orden).toEqual(['q', 's', 'b', 'a'])
      expect(r.bloques).toEqual([['p', 'r'], ['t']])
    })

    it('makes a bloque of its own in front of another (Phase 66)', () => {
      const r = llevar(['a', 'b'], bloques, ['b', 'q'], { nuevoBloqueAntesDe: 's' })
      expect(r.orden).toEqual(['a'])
      expect(r.bloques).toEqual([['p', 'r'], ['b', 'q'], ['s', 't']])
    })

    it('makes a bloque of its own after the others, for null', () => {
      const r = llevar(['a', 'b'], bloques, ['a'], { nuevoBloqueAntesDe: null })
      expect(r.bloques).toEqual([['p', 'q', 'r'], ['s', 't'], ['a']])
    })

    it('makes a new bloque in front of the one it empties', () => {
      const r = llevar(['a', 'b'], bloques, ['s', 't', 'a'], { nuevoBloqueAntesDe: 's' })
      expect(r.orden).toEqual(['b'])
      expect(r.bloques).toEqual([['p', 'q', 'r'], ['s', 't', 'a']])
    })

    it('lets a bloque emptied by the move disappear', () => {
      const r = llevar(['a', 'b'], bloques, ['s', 't'], { antesDe: 'b' })
      expect(r.orden).toEqual(['a', 's', 't', 'b'])
      expect(r.bloques).toEqual([['p', 'q', 'r']])
    })
  })
})

describe('bloques — cards you pin so sorting leaves them alone', () => {
  const hand = mano(['7♠', '2♦', '7♥', 'K♣', '7♣', '4♦'])
  const sietes = [hand[0].id, hand[2].id, hand[4].id]

  const cartasDe = (secciones: ReturnType<typeof distribuir>) =>
    secciones.map((seccion) => ({
      bloqueada: seccion.bloqueada,
      cards: escrita(seccion.cards),
    }))

  it('lays pinned cards out first, then the loose ones', () => {
    expect(cartasDe(distribuir(hand, [], [sietes]))).toEqual([
      { bloqueada: true, cards: ['7♠', '7♥', '7♣'] },
      { bloqueada: false, cards: ['2♦', 'K♣', '4♦'] },
    ])
  })

  it('leaves a hand with nothing pinned as one loose run', () => {
    expect(cartasDe(distribuir(hand, [], []))).toEqual([
      { bloqueada: false, cards: escrita(hand) },
    ])
  })

  it('keeps a pinned trío together when the rest is sorted by pinta', () => {
    const secciones = distribuir(hand, [], [sietes])
    const sueltas = secciones.find((s) => !s.bloqueada)!.cards
    const orden = acomodar(sueltas, 'pintas').map((card) => card.id)

    expect(cartasDe(distribuir(hand, orden, [sietes]))).toEqual([
      { bloqueada: true, cards: ['7♠', '7♥', '7♣'] },
      { bloqueada: false, cards: ['2♦', '4♦', 'K♣'] },
    ])
  })

  it('drops a card that has left the hand, and the bloque with it', () => {
    const jugadas = hand.filter((card) => !sietes.includes(card.id))
    expect(distribuir(jugadas, [], [sietes]).every((s) => !s.bloqueada)).toBe(true)
  })

  it('keeps the part of a bloque that is still in hand', () => {
    const sinUno = hand.filter((card) => card.id !== hand[2].id)
    const secciones = distribuir(sinUno, [], [sietes])
    expect(escrita(secciones[0].cards)).toEqual(['7♠', '7♣'])
  })

  it('never shows a card twice, even if two bloques claim it', () => {
    const secciones = distribuir(hand, [], [sietes, [hand[0].id, hand[1].id]])
    const todas = aplanar(secciones).map((card) => card.id)
    expect(new Set(todas).size).toBe(todas.length)
    expect(todas).toHaveLength(hand.length)
  })
})

describe('bloquear and soltarBloque', () => {
  it('pins a set of cards', () => {
    expect(bloquear([], ['a', 'b'])).toEqual([['a', 'b']])
  })

  it('takes the cards out of any bloque they were in', () => {
    // Pinning 'b' with 'c' must not leave 'b' in the first bloque as well.
    expect(bloquear([['a', 'b']], ['b', 'c'])).toEqual([['a'], ['b', 'c']])
  })

  it('drops a bloque left empty by the move', () => {
    expect(bloquear([['a']], ['a', 'b'])).toEqual([['a', 'b']])
  })

  it('allows a bloque of one', () => {
    expect(bloquear([], ['solo'])).toEqual([['solo']])
  })

  it('does nothing with an empty selection', () => {
    expect(bloquear([['a']], [])).toEqual([['a']])
  })

  it('unpins by position', () => {
    expect(soltarBloque([['a'], ['b'], ['c']], 1)).toEqual([['a'], ['c']])
  })

  it('never mutates what it was given', () => {
    const bloques = [['a', 'b']]
    bloquear(bloques, ['b'])
    soltarBloque(bloques, 0)
    expect(bloques).toEqual([['a', 'b']])
  })
})
