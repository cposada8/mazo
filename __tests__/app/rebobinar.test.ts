import { describe, expect, it } from 'vitest'
import { type Grupo, describeCard, vistaDeAsiento } from '@/lib/engine'
import { cartaDeTexto, rebobinar } from '@/lib/rebobinar'
import type { Relato } from '@/lib/relato'
import { c, makeRonda, n } from '../engine/helpers'

/**
 * Phase 59: the table drawn as it has been told. The moves still waiting to
 * land are undone on screen — piles, counts, mesa — and nothing else is.
 */

const sietes: Grupo = {
  kind: 'trio',
  rank: '7',
  cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
}
const escala: Grupo = {
  kind: 'escala',
  suit: 'hearts',
  start: '4',
  cards: [n('4', 'hearts'), n('5', 'hearts'), n('6', 'hearts'), n('7', 'hearts'), n('8', 'hearts')],
}

const mesa = () =>
  vistaDeAsiento(
    makeRonda({
      jugadores: [
        { hand: [n('K', 'clubs'), n('2', 'spades')] },
        { hand: [n('3', 'clubs')], grupos: [sietes, escala], bajadoEnTurno: 1 },
      ],
      discard: [n('9', 'diamonds'), n('J', 'hearts')],
      stock: [n('2', 'clubs'), n('3', 'clubs'), n('4', 'clubs')],
    }),
    0,
  )

describe('rebobinar', () => {
  it('changes nothing when every move has landed', () => {
    const vista = mesa()
    const { vista: contada, ocultas } = rebobinar(vista, [])
    expect(contada).toBe(vista)
    expect(ocultas.size).toBe(0)
  })

  it('keeps a thrown card off the descarte until it lands', () => {
    const vista = mesa()
    const { vista: contada } = rebobinar(vista, [{ tipo: 'bota', seat: 1, carta: 'J♥' }])
    expect(contada.descarte.map(describeCard)).toEqual(['9♦'])
    expect(contada.jugadores[1].cartas).toBe(vista.jugadores[1].cartas + 1)
  })

  it('puts a taken card back on the pile, and a drawn one back in the stock', () => {
    const vista = mesa()
    const pendientes: Relato[] = [
      { tipo: 'descarte', seat: 1, carta: 'Q♠' },
      { tipo: 'mazo', seat: 0 },
    ]
    const { vista: contada } = rebobinar(vista, pendientes)
    expect(contada.descarte.map(describeCard)).toEqual(['9♦', 'J♥', 'Q♠'])
    expect(contada.stock).toBe(vista.stock + 1)
    expect(contada.jugadores[1].cartas).toBe(vista.jugadores[1].cartas - 1)
  })

  it('hides a bajada on the mesa rather than removing it, and the seat is not down yet', () => {
    const vista = mesa()
    const { vista: contada, ocultas } = rebobinar(vista, [{ tipo: 'bajada', seat: 1, grupos: 2 }])
    expect(contada.jugadores[1].grupos).toBe(vista.jugadores[1].grupos)
    expect(ocultas.size).toBe(8)
    expect(contada.jugadores[1].bajadoEnTurno).toBeNull()
    expect(contada.jugadores[1].cartas).toBe(vista.jugadores[1].cartas + 8)
  })

  it('hides just the cards an agregar put on somebody else’s grupo', () => {
    const vista = mesa()
    const { ocultas } = rebobinar(vista, [
      { tipo: 'agrega', seat: 0, cartas: ['8♥'], dueno: 1 },
    ])
    expect([...ocultas]).toEqual([escala.cards[4].id])
  })

  it('never rewinds the reader’s own hand', () => {
    const vista = mesa()
    const { vista: contada } = rebobinar(vista, [{ tipo: 'bota', seat: 0, carta: 'J♥' }])
    expect(contada.mano).toBe(vista.mano)
  })

  it('leaves a step alone when the view does not agree with it', () => {
    const vista = mesa()
    // The top of the descarte is the J♥, not a 5♣: nothing to take back.
    const { vista: contada } = rebobinar(vista, [{ tipo: 'bota', seat: 1, carta: '5♣' }])
    expect(contada.descarte).toEqual(vista.descarte)
    expect(contada.jugadores[1].cartas).toBe(vista.jugadores[1].cartas)
  })
})

describe('the move in the air (Phase 60)', () => {
  it('shows a card taken off the descarte gone from the pile while it flies', () => {
    const vista = mesa()
    // The seat took the J♥: the state has it in their hand, off the pile.
    const tomada = { ...vista, descarte: vista.descarte.slice(0, -1) }
    const relato: Relato = { tipo: 'descarte', seat: 1, carta: 'J♥' }

    const enVuelo = rebobinar(tomada, [relato], true).vista
    expect(enVuelo.descarte.map(describeCard)).toEqual(['9♦'])
    // Not in the hand yet either: it is in the air.
    expect(enVuelo.jugadores[1].cartas).toBe(tomada.jugadores[1].cartas - 1)

    // Still queued, it has not left the pile at all.
    expect(rebobinar(tomada, [relato]).vista.descarte.map(describeCard)).toEqual(['9♦', 'J♥'])
  })

  it('takes a drawn card off the stock at take-off, and into the hand on landing', () => {
    const vista = mesa()
    const enVuelo = rebobinar(vista, [{ tipo: 'mazo', seat: 0 }], true).vista
    expect(enVuelo.stock).toBe(vista.stock)
    expect(enVuelo.jugadores[0].cartas).toBe(vista.jugadores[0].cartas - 1)
  })

  it('takes a thrown card out of the hand at take-off, and onto the pile on landing', () => {
    const vista = mesa()
    const enVuelo = rebobinar(vista, [{ tipo: 'bota', seat: 1, carta: 'J♥' }], true).vista
    expect(enVuelo.descarte.map(describeCard)).toEqual(['9♦'])
    expect(enVuelo.jugadores[1].cartas).toBe(vista.jugadores[1].cartas)
  })

  it('keeps a bajada off the mesa and out of the hand while it flies', () => {
    const vista = mesa()
    const { vista: enVuelo, ocultas } = rebobinar(vista, [{ tipo: 'bajada', seat: 1, grupos: 2 }], true)
    expect(ocultas.size).toBe(8)
    expect(enVuelo.jugadores[1].cartas).toBe(vista.jugadores[1].cartas)
  })

  it('holds back only the first move: the ones queued behind it are undone whole', () => {
    const vista = mesa()
    const { vista: contada } = rebobinar(
      vista,
      [
        { tipo: 'mazo', seat: 1 },
        { tipo: 'bota', seat: 1, carta: 'J♥' },
      ],
      true,
    )
    expect(contada.descarte.map(describeCard)).toEqual(['9♦'])
    expect(contada.stock).toBe(vista.stock)
    // +1 back from the throw, −1 for the draw still in the air.
    expect(contada.jugadores[1].cartas).toBe(vista.jugadores[1].cartas)
  })
})

describe('cartaDeTexto', () => {
  it('reads a comodín the way a relato names it', () => {
    // describeCard says «comodin»; the old reader only knew «★» and «**», so a
    // thrown comodín never flew.
    expect(describeCard(c())).toBe('comodin')
    expect(cartaDeTexto('comodin', 'x')).toEqual({ id: 'x', kind: 'comodin' })
    expect(cartaDeTexto('10♦', 'y')).toEqual({ id: 'y', kind: 'normal', rank: '10', suit: 'diamonds' })
  })
})
