/**
 * Building the deck and dealing a ronda.
 *
 * Rules implemented here come from specs/carioca-rules.md: two 52-card decks
 * plus their four comodines, twelve cards per player, and one card turned face
 * up to start the descarte.
 */

import { RANKS, SUITS, type Card } from './cards'
import { shuffle, type Rng } from './random'

/** Copies of a standard deck in play. Fixed — it does not scale with players. */
export const DECK_COPIES = 2
/** Comodines contributed by each copy. */
export const COMODINES_PER_COPY = 2

export const CARDS_PER_HAND = 12
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/**
 * Every card in play, in a fixed order. Callers shuffle it — `buildDeck` is
 * deterministic on purpose so tests can assert composition without a seed.
 */
export function buildDeck({ comodines }: { comodines: boolean }): Card[] {
  const cards: Card[] = []

  for (let copy = 0; copy < DECK_COPIES; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}-${suit}#${copy}`, kind: 'normal', rank, suit })
      }
    }
  }

  if (comodines) {
    for (let copy = 0; copy < DECK_COPIES; copy++) {
      for (let n = 0; n < COMODINES_PER_COPY; n++) {
        cards.push({ id: `comodin#${copy}-${n}`, kind: 'comodin' })
      }
    }
  }

  return cards
}

export type Deal = {
  /** One hand per player, in seat order. Twelve cards each. */
  hands: Card[][]
  /** The face-down draw pile. */
  stock: Card[]
  /** The face-up pile. Starts with exactly one card, the last is the top. */
  discard: Card[]
}

/**
 * Shuffle and deal a ronda.
 *
 * Cards go out one at a time around the table, the way they are dealt in
 * person, then one card is turned face up to start the descarte. That last step
 * is what keeps the first turn from being a special case: the opening player
 * chooses between stock and descarte exactly like everyone after them.
 */
export function deal(
  deck: readonly Card[],
  players: number,
  rng: Rng,
): Deal {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new Error(
      `A partida takes ${MIN_PLAYERS} to ${MAX_PLAYERS} players, got ${players}`,
    )
  }

  const needed = players * CARDS_PER_HAND + 1
  if (deck.length < needed) {
    throw new Error(
      `Dealing ${players} players needs ${needed} cards, deck has ${deck.length}`,
    )
  }

  const stock = shuffle(deck, rng)
  const hands: Card[][] = Array.from({ length: players }, () => [])

  for (let round = 0; round < CARDS_PER_HAND; round++) {
    for (let seat = 0; seat < players; seat++) {
      hands[seat].push(stock.pop()!)
    }
  }

  const discard = [stock.pop()!]

  return { hands, stock, discard }
}
