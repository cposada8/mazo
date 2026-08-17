import { describe, expect, it } from 'vitest'
import {
  RANKS,
  RANK_COUNT,
  SUITS,
  cyclicDistance,
  isConsecutive,
  rankAfter,
  rankIndex,
} from '@/lib/engine/cards'

describe('ranks and suits', () => {
  it('has 13 ranks and 4 suits', () => {
    expect(RANKS).toHaveLength(13)
    expect(RANK_COUNT).toBe(13)
    expect(SUITS).toHaveLength(4)
  })

  it('indexes every rank uniquely', () => {
    const indexes = RANKS.map(rankIndex)
    expect(new Set(indexes).size).toBe(RANKS.length)
  })
})

describe('the rank ring', () => {
  it('wraps from K back to A', () => {
    expect(rankAfter('K')).toBe('A')
    expect(rankAfter('A')).toBe('2')
    expect(rankAfter('Q', 2)).toBe('A')
  })

  it('returns to where it started after a full lap', () => {
    for (const rank of RANKS) {
      expect(rankAfter(rank, RANK_COUNT)).toBe(rank)
    }
  })

  it.each([
    ['A', 'A', 0],
    ['A', '2', 1],
    ['A', 'K', 12],
    ['K', 'A', 1],
    ['K', '2', 2],
    ['J', 'A', 3],
  ] as const)('cyclicDistance(%s, %s) is %i', (from, to, expected) => {
    expect(cyclicDistance(from, to)).toBe(expected)
  })
})

describe('isConsecutive', () => {
  it.each([
    ['A', '2'],
    ['3', '4'],
    ['10', 'J'],
    ['Q', 'K'],
    // The two wraps that make K-A-2-3 a legal escala:
    ['K', 'A'],
  ] as const)('accepts %s then %s', (a, b) => {
    expect(isConsecutive(a, b)).toBe(true)
  })

  it.each([
    // Backwards is not consecutive — order matters.
    ['2', 'A'],
    ['A', 'K'],
    // Gaps.
    ['A', '3'],
    ['K', '2'],
    // A rank is not consecutive with itself.
    ['7', '7'],
  ] as const)('rejects %s then %s', (a, b) => {
    expect(isConsecutive(a, b)).toBe(false)
  })

  it('accepts exactly one successor for every rank', () => {
    for (const a of RANKS) {
      const successors = RANKS.filter((b) => isConsecutive(a, b))
      expect(successors).toEqual([rankAfter(a)])
    }
  })
})
