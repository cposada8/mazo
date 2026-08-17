/**
 * Seeded randomness.
 *
 * A ronda can reshuffle more than once — the descarte becomes the new stock when
 * the stock runs out — so the engine carries a *stream* of random numbers, not a
 * single shuffle. Replaying a seed reproduces every draw from it, in order.
 */

export type Rng = {
  /** Next float in [0, 1). */
  next(): number
  /** Next integer in [0, max). */
  nextInt(max: number): number
  /**
   * The generator's whole state, as one number.
   *
   * Passing it back to `createRng` resumes the stream exactly where it left
   * off. That is what lets a ronda be stored, reloaded, and keep reshuffling
   * deterministically without replaying every draw since the deal.
   */
  state(): number
}

/** FNV-1a, to turn a human-readable seed into a 32-bit number. */
function hashSeed(seed: string): number {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

/**
 * Mulberry32. Small, fast, and good enough for shuffling cards — this is not a
 * cryptographic generator and must never be used to produce secrets.
 */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    nextInt(max: number): number {
      if (!Number.isInteger(max) || max <= 0) {
        throw new Error(`nextInt needs a positive integer, got ${max}`)
      }
      return Math.floor(next() * max)
    },
    state: () => state,
  }
}

/**
 * Fisher-Yates. Returns a new array; the input is never mutated, so a shuffled
 * deck and the deck it came from can both be inspected.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
