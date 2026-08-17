import { describe, expect, it } from 'vitest'
import { RANKS, puntosDeCarta, puntosDeMano } from '@/lib/engine'
import { c, n } from './helpers'

describe('puntosDeCarta', () => {
  it.each([
    ['2', 2],
    ['5', 5],
    ['9', 9],
    ['10', 10],
  ] as const)('scores the %s at face value', (rank, expected) => {
    expect(puntosDeCarta(n(rank, 'spades'))).toBe(expected)
  })

  it.each(['J', 'Q', 'K'] as const)('scores the %s at 10', (rank) => {
    expect(puntosDeCarta(n(rank, 'hearts'))).toBe(10)
  })

  it('scores the ace at 20', () => {
    expect(puntosDeCarta(n('A', 'clubs'))).toBe(20)
  })

  it('scores the comodín at 50 — the most expensive card to be caught with', () => {
    expect(puntosDeCarta(c())).toBe(50)
  })

  it('has a value for every rank', () => {
    for (const rank of RANKS) {
      expect(puntosDeCarta(n(rank, 'spades'))).toBeGreaterThan(0)
    }
  })
})

describe('puntosDeMano', () => {
  it('is zero for a hand that went out', () => {
    expect(puntosDeMano([])).toBe(0)
  })

  it('adds up the worked example from the rules', () => {
    // Beto: K♠ 9♥ comodín = 10 + 9 + 50
    expect(puntosDeMano([n('K', 'spades'), n('9', 'hearts'), c()])).toBe(69)
    // Caro: A♦ 4♣ 4♠ J♥ = 20 + 4 + 4 + 10
    expect(
      puntosDeMano([n('A', 'diamonds'), n('4', 'clubs'), n('4', 'spades'), n('J', 'hearts')]),
    ).toBe(38)
  })
})
