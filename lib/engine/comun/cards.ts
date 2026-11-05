/**
 * Card primitives.
 *
 * Shared by every game on Mazo (Phase 75). Naming is English where English
 * is precise (rank, suit, hand) and Spanish where the table says it in
 * Spanish (comodín).
 */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const
export type Suit = (typeof SUITS)[number]

/**
 * Ranks in order. This array is a *ring*: after K comes A again. Nothing in the
 * engine may assume A is the lowest or K the highest — see `cyclicDistance`.
 */
export const RANKS = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
] as const
export type Rank = (typeof RANKS)[number]

export const RANK_COUNT = RANKS.length // 13

export type NormalCard = {
  readonly id: string
  readonly kind: 'normal'
  readonly rank: Rank
  readonly suit: Suit
}

export type Comodin = {
  readonly id: string
  readonly kind: 'comodin'
}

/**
 * A physical card. A game may play with more than one copy of the deck, so
 * `rank` + `suit` does NOT identify a card. `id` is what identifies it, and
 * it is unique across the whole deck.
 */
export type Card = NormalCard | Comodin

export function isComodin(card: Card): card is Comodin {
  return card.kind === 'comodin'
}

export function isNormal(card: Card): card is NormalCard {
  return card.kind === 'normal'
}

const RANK_INDEX: ReadonlyMap<Rank, number> = new Map(
  RANKS.map((rank, index) => [rank, index]),
)

export function rankIndex(rank: Rank): number {
  return RANK_INDEX.get(rank)!
}

/** The rank `steps` positions after `rank`, wrapping around the ring. */
export function rankAfter(rank: Rank, steps = 1): Rank {
  const index = (rankIndex(rank) + steps) % RANK_COUNT
  return RANKS[(index + RANK_COUNT) % RANK_COUNT]
}

/**
 * Steps forward from `from` to `to` around the ring, always in [0, 12].
 *
 * `cyclicDistance('K', '2')` is 2 — K to A to 2. A game whose sequences wrap
 * around the ring (Carioca's escalas, el Mentiroso's ranks in turn) needs no
 * special case for the ace.
 */
export function cyclicDistance(from: Rank, to: Rank): number {
  return (rankIndex(to) - rankIndex(from) + RANK_COUNT) % RANK_COUNT
}

/** True when `b` comes immediately after `a` on the ring. */
export function isConsecutive(a: Rank, b: Rank): boolean {
  return cyclicDistance(a, b) === 1
}

/** Compact readable form, used in test failures and debugging. */
export function describeCard(card: Card): string {
  return isComodin(card) ? 'comodin' : `${card.rank}${SUIT_SYMBOL[card.suit]}`
}

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}
