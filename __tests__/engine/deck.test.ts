import { describe, expect, it } from 'vitest'
import { RANKS, SUITS, isComodin, type Card } from '@/lib/engine/cards'
import {
  CARDS_PER_HAND,
  MAX_PLAYERS,
  MIN_PLAYERS,
  buildDeck,
  deal,
} from '@/lib/engine/deck'
import { createRng } from '@/lib/engine/random'

const ids = (cards: readonly Card[]) => cards.map((card) => card.id)

describe('buildDeck', () => {
  it('is 108 cards with comodines and 104 without', () => {
    expect(buildDeck({ comodines: true })).toHaveLength(108)
    expect(buildDeck({ comodines: false })).toHaveLength(104)
  })

  it('holds exactly four comodines when they are on, none when off', () => {
    expect(buildDeck({ comodines: true }).filter(isComodin)).toHaveLength(4)
    expect(buildDeck({ comodines: false }).filter(isComodin)).toHaveLength(0)
  })

  it('holds exactly two of every rank and suit', () => {
    const deck = buildDeck({ comodines: true })
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const matches = deck.filter(
          (card) => !isComodin(card) && card.rank === rank && card.suit === suit,
        )
        expect(matches, `${rank} of ${suit}`).toHaveLength(2)
      }
    }
  })

  it('gives every physical card a unique id', () => {
    // Two 7♠ exist and are interchangeable in play, but the engine must still
    // be able to tell them apart.
    const deck = buildDeck({ comodines: true })
    expect(new Set(ids(deck)).size).toBe(deck.length)
  })
})

describe('deal', () => {
  const deck = buildDeck({ comodines: true })

  it.each([2, 3, 4, 5, 6])('gives each of %i players 12 cards', (players) => {
    const { hands } = deal(deck, players, createRng(`seed-${players}`))
    expect(hands).toHaveLength(players)
    for (const hand of hands) expect(hand).toHaveLength(CARDS_PER_HAND)
  })

  it('turns exactly one card face up to start the descarte', () => {
    const { discard } = deal(deck, 4, createRng('discard'))
    expect(discard).toHaveLength(1)
  })

  it.each([
    [2, 84 - 1],
    [3, 72 - 1],
    [4, 60 - 1],
    [5, 48 - 1],
    [6, 36 - 1],
  ])('leaves %i players a stock of %i', (players, expected) => {
    const { stock } = deal(deck, players, createRng('stock'))
    expect(stock).toHaveLength(expected)
  })

  it('loses no card and duplicates none', () => {
    const { hands, stock, discard } = deal(deck, 5, createRng('conservation'))
    const dealt = [...hands.flat(), ...stock, ...discard]
    expect(dealt).toHaveLength(deck.length)
    expect(new Set(ids(dealt))).toEqual(new Set(ids(deck)))
  })

  it('deals the same cards to the same seats for the same seed', () => {
    const a = deal(deck, 4, createRng('repeatable'))
    const b = deal(deck, 4, createRng('repeatable'))
    expect(a.hands.map(ids)).toEqual(b.hands.map(ids))
    expect(ids(a.stock)).toEqual(ids(b.stock))
    expect(ids(a.discard)).toEqual(ids(b.discard))
  })

  it('deals differently for a different seed', () => {
    const a = deal(deck, 4, createRng('seed-a'))
    const b = deal(deck, 4, createRng('seed-b'))
    expect(a.hands.map(ids)).not.toEqual(b.hands.map(ids))
  })

  it('never mutates the deck it was given', () => {
    const before = ids(deck)
    deal(deck, 6, createRng('immutable'))
    expect(ids(deck)).toEqual(before)
  })

  it('works without comodines', () => {
    const short = buildDeck({ comodines: false })
    const { hands, stock } = deal(short, 6, createRng('no-comodines'))
    expect(hands.flat()).toHaveLength(72)
    expect(stock).toHaveLength(104 - 72 - 1)
  })

  it.each([1, 0, -1, 7, 2.5])('rejects %s players', (players) => {
    expect(() => deal(deck, players, createRng('invalid'))).toThrow(
      new RegExp(`${MIN_PLAYERS} to ${MAX_PLAYERS} players`),
    )
  })

  it('rejects a deck too small to deal from', () => {
    expect(() => deal(deck.slice(0, 20), 2, createRng('tiny'))).toThrow(
      /needs 25 cards/,
    )
  })
})
