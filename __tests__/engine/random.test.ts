import { describe, expect, it } from 'vitest'
import { createRng, shuffle } from '@/lib/engine/random'

const take = (n: number, seed: string) => {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => rng.next())
}

describe('createRng', () => {
  it('produces the same stream for the same seed', () => {
    expect(take(20, 'carioca')).toEqual(take(20, 'carioca'))
  })

  it('produces a different stream for a different seed', () => {
    expect(take(20, 'carioca')).not.toEqual(take(20, 'carioca!'))
  })

  it('stays in [0, 1)', () => {
    const rng = createRng('range')
    for (let i = 0; i < 5000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('keeps nextInt inside the bound', () => {
    const rng = createRng('bounds')
    for (let i = 0; i < 5000; i++) {
      const value = rng.nextInt(13)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(13)
    }
  })

  it('rejects a non-positive bound', () => {
    const rng = createRng('bad')
    expect(() => rng.nextInt(0)).toThrow()
    expect(() => rng.nextInt(-1)).toThrow()
    expect(() => rng.nextInt(1.5)).toThrow()
  })

  it('is a stream, not a single value: reshuffling keeps advancing', () => {
    // A ronda may reshuffle the descarte more than once. Two shuffles drawn
    // from one rng must differ, or every reshuffle would repeat the first.
    const rng = createRng('stream')
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(shuffle(items, rng)).not.toEqual(shuffle(items, rng))
  })
})

describe('shuffle', () => {
  const items = Array.from({ length: 52 }, (_, i) => i)

  it('is deterministic for a given seed', () => {
    expect(shuffle(items, createRng('deal'))).toEqual(
      shuffle(items, createRng('deal')),
    )
  })

  it('never mutates its input', () => {
    const original = items.slice()
    shuffle(items, createRng('mutation'))
    expect(items).toEqual(original)
  })

  it('is a permutation — nothing gained, nothing lost', () => {
    const shuffled = shuffle(items, createRng('permutation'))
    expect(shuffled).toHaveLength(items.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items)
  })

  it('actually reorders', () => {
    expect(shuffle(items, createRng('order'))).not.toEqual(items)
  })

  it('handles empty and single-item inputs', () => {
    expect(shuffle([], createRng('empty'))).toEqual([])
    expect(shuffle(['only'], createRng('single'))).toEqual(['only'])
  })
})
