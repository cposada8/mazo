import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '@/lib/engine/cards'
import {
  type Escala,
  type Trio,
  comodinesIn,
  escalaRankAt,
  validateEscala,
  validateGrupo,
  validateTrio,
} from '@/lib/engine/grupos'

/** Test builders. `n` is a real card, `c` a comodin; both get unique ids. */
let counter = 0
const n = (rank: Rank, suit: Suit): Card => ({
  id: `${rank}-${suit}#${counter++}`,
  kind: 'normal',
  rank,
  suit,
})
const c = (): Card => ({ id: `comodin#${counter++}`, kind: 'comodin' })

const trio = (rank: Rank, cards: Card[]): Trio => ({ kind: 'trio', rank, cards })
const escala = (suit: Suit, start: Rank, cards: Card[]): Escala => ({
  kind: 'escala',
  suit,
  start,
  cards,
})

describe('trios', () => {
  it('accepts three of a rank', () => {
    const grupo = trio('7', [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')])
    expect(validateTrio(grupo, 'layDown').ok).toBe(true)
  })

  it('accepts two copies of the same card — two decks are in play', () => {
    const grupo = trio('7', [n('7', 'spades'), n('7', 'spades'), n('7', 'clubs')])
    expect(validateTrio(grupo, 'layDown').ok).toBe(true)
  })

  it('accepts more than three: 7 7 7 7 and 7 7 7 7 7 are each one trio', () => {
    const four = trio('7', Array.from({ length: 4 }, () => n('7', 'spades')))
    const five = trio('7', Array.from({ length: 5 }, () => n('7', 'hearts')))
    expect(validateTrio(four, 'layDown').ok).toBe(true)
    expect(validateTrio(five, 'layDown').ok).toBe(true)
  })

  it('rejects fewer than three', () => {
    const grupo = trio('7', [n('7', 'spades'), n('7', 'hearts')])
    expect(validateTrio(grupo, 'layDown')).toMatchObject({ code: 'TOO_SHORT' })
    expect(validateTrio(grupo, 'mesa')).toMatchObject({ code: 'TOO_SHORT' })
  })

  it('rejects a card of another rank', () => {
    const grupo = trio('7', [n('7', 'spades'), n('7', 'hearts'), n('8', 'clubs')])
    expect(validateTrio(grupo, 'layDown')).toMatchObject({ code: 'RANK_MISMATCH' })
  })

  it('rejects the same physical card twice', () => {
    const card = n('7', 'spades')
    const grupo = trio('7', [card, card, n('7', 'clubs')])
    expect(validateTrio(grupo, 'layDown')).toMatchObject({ code: 'DUPLICATE_CARD' })
  })

  it('rejects a trio of comodines only', () => {
    const grupo = trio('7', [c(), c(), c()])
    expect(validateTrio(grupo, 'mesa')).toMatchObject({ code: 'NO_REAL_CARDS' })
  })
})

describe('comodines in a trio', () => {
  const withOne = trio('7', [n('7', 'spades'), n('7', 'hearts'), c()])
  const withTwo = trio('7', [n('7', 'spades'), c(), c()])
  const withThree = trio('7', [n('7', 'spades'), n('7', 'hearts'), c(), c(), c()])

  it('accepts one at lay-down: 7 7 comodin is a trio', () => {
    expect(validateTrio(withOne, 'layDown').ok).toBe(true)
  })

  it('rejects two at lay-down: 7 comodin comodin is not', () => {
    expect(validateTrio(withTwo, 'layDown')).toMatchObject({
      code: 'TOO_MANY_COMODINES',
    })
  })

  it('accepts any number once on the mesa', () => {
    expect(validateTrio(withTwo, 'mesa').ok).toBe(true)
    expect(validateTrio(withThree, 'mesa').ok).toBe(true)
  })
})

describe('escalas', () => {
  it('accepts four consecutive cards of one suit', () => {
    const grupo = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'spades'), n('3', 'spades'), n('4', 'spades'),
    ])
    expect(validateEscala(grupo, 'layDown').ok).toBe(true)
  })

  it('accepts an escala ending on the ace: J Q K A', () => {
    const grupo = escala('hearts', 'J', [
      n('J', 'hearts'), n('Q', 'hearts'), n('K', 'hearts'), n('A', 'hearts'),
    ])
    expect(validateEscala(grupo, 'layDown').ok).toBe(true)
  })

  it('accepts a cyclic escala: K A 2 3', () => {
    const grupo = escala('diamonds', 'K', [
      n('K', 'diamonds'), n('A', 'diamonds'), n('2', 'diamonds'), n('3', 'diamonds'),
    ])
    expect(validateEscala(grupo, 'layDown').ok).toBe(true)
  })

  it('accepts more than four as a single escala', () => {
    const grupo = escala('clubs', '5', [
      n('5', 'clubs'), n('6', 'clubs'), n('7', 'clubs'), n('8', 'clubs'),
      n('9', 'clubs'), n('10', 'clubs'),
    ])
    expect(validateEscala(grupo, 'layDown').ok).toBe(true)
  })

  it('rejects fewer than four', () => {
    const grupo = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'spades'), n('3', 'spades'),
    ])
    expect(validateEscala(grupo, 'layDown')).toMatchObject({ code: 'TOO_SHORT' })
  })

  it('rejects more than thirteen — the ring has no more positions', () => {
    const cards = Array.from({ length: 14 }, () => c())
    const grupo = escala('spades', 'A', cards)
    expect(validateEscala(grupo, 'mesa')).toMatchObject({ code: 'TOO_LONG' })
  })

  it('rejects a mixed suit', () => {
    const grupo = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'hearts'), n('3', 'spades'), n('4', 'spades'),
    ])
    expect(validateEscala(grupo, 'layDown')).toMatchObject({ code: 'SUIT_MISMATCH' })
  })

  it('rejects a gap', () => {
    const grupo = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'spades'), n('4', 'spades'), n('5', 'spades'),
    ])
    expect(validateEscala(grupo, 'layDown')).toMatchObject({ code: 'RANK_MISMATCH' })
  })

  it('rejects cards out of order', () => {
    const grupo = escala('spades', 'A', [
      n('2', 'spades'), n('A', 'spades'), n('3', 'spades'), n('4', 'spades'),
    ])
    expect(validateEscala(grupo, 'layDown')).toMatchObject({ code: 'RANK_MISMATCH' })
  })
})

describe('comodines in an escala', () => {
  it('accepts one at lay-down, at either end or inside', () => {
    const leading = escala('spades', 'A', [
      c(), n('2', 'spades'), n('3', 'spades'), n('4', 'spades'),
    ])
    const inner = escala('spades', 'A', [
      n('A', 'spades'), c(), n('3', 'spades'), n('4', 'spades'),
    ])
    const trailing = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'spades'), n('3', 'spades'), c(),
    ])
    for (const grupo of [leading, inner, trailing]) {
      expect(validateEscala(grupo, 'layDown').ok).toBe(true)
    }
  })

  it('rejects two at lay-down even when they are apart', () => {
    // The worked example from the rules, judged at the wrong phase.
    const grupo = escala('hearts', '2', [
      c(), n('3', 'hearts'), n('4', 'hearts'), n('5', 'hearts'), c(), n('7', 'hearts'),
    ])
    expect(validateEscala(grupo, 'layDown')).toMatchObject({
      code: 'TOO_MANY_COMODINES',
    })
  })

  it('accepts comodin 3 4 5 comodin 7 on the mesa — they stand for 2 and 6', () => {
    const grupo = escala('hearts', '2', [
      c(), n('3', 'hearts'), n('4', 'hearts'), n('5', 'hearts'), c(), n('7', 'hearts'),
    ])
    expect(validateEscala(grupo, 'mesa').ok).toBe(true)
    expect(comodinesIn(grupo)).toBe(2)
    expect(escalaRankAt(grupo, 0)).toBe('2')
    expect(escalaRankAt(grupo, 4)).toBe('6')
  })

  it('rejects 2 3 4 comodin comodin 7 — the comodines are consecutive', () => {
    const grupo = escala('hearts', '2', [
      n('2', 'hearts'), n('3', 'hearts'), n('4', 'hearts'), c(), c(), n('7', 'hearts'),
    ])
    expect(validateEscala(grupo, 'mesa')).toMatchObject({
      code: 'ADJACENT_COMODINES',
    })
  })

  it('binds a comodin to its position, so a wrong real card is caught', () => {
    // Slot 4 stands for 6♥; putting the 7♥ there is a mismatch, not a shuffle.
    const grupo = escala('hearts', '2', [
      c(), n('3', 'hearts'), n('4', 'hearts'), n('5', 'hearts'), n('7', 'hearts'),
    ])
    expect(validateEscala(grupo, 'mesa')).toMatchObject({ code: 'RANK_MISMATCH' })
  })
})

describe('validateGrupo', () => {
  it('dispatches on the kind', () => {
    const t = trio('7', [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')])
    const e = escala('spades', 'A', [
      n('A', 'spades'), n('2', 'spades'), n('3', 'spades'), n('4', 'spades'),
    ])
    expect(validateGrupo(t, 'layDown').ok).toBe(true)
    expect(validateGrupo(e, 'layDown').ok).toBe(true)
  })
})
