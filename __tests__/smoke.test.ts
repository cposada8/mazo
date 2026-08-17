import { describe, expect, it } from 'vitest'

/**
 * Phase 1 only needs to prove the test runner works. This is a placeholder that
 * asserts a fact from specs/carioca-rules.md so it fails loudly if the rule ever
 * changes: the deck is 108 cards with comodines, 104 without.
 */
describe('setup', () => {
  it('runs tests', () => {
    const conComodines = 2 * 52 + 2 * 2
    expect(conComodines).toBe(108)
    expect(conComodines - 4).toBe(104)
  })
})
