/**
 * Card notation, for writing scenarios and tests by hand.
 *
 * Both forms are accepted, on purpose: the symbol reads well in specs and in
 * conversation, the letter is faster to type.
 *
 *   7♠  7s  7S      the seven of spades
 *   10♥ 10h         the ten of hearts
 *   A♦  Ad          the ace of diamonds
 *   **  comodin     a comodín
 *
 * Suit letters follow the internal English names — s, h, d, c — because the
 * Spanish ones collide (corazones and clubs both start with c).
 */

import { RANKS, type Rank, type Suit, describeCard } from './cards'

export type CardSpec =
  | { readonly kind: 'comodin' }
  | { readonly kind: 'normal'; readonly rank: Rank; readonly suit: Suit }

const SUIT_BY_TOKEN: Record<string, Suit> = {
  '♠': 'spades',
  s: 'spades',
  '♥': 'hearts',
  h: 'hearts',
  '♦': 'diamonds',
  d: 'diamonds',
  '♣': 'clubs',
  c: 'clubs',
}

const RANK_BY_TOKEN: Record<string, Rank> = Object.fromEntries(
  RANKS.map((rank) => [rank.toLowerCase(), rank]),
)

export function parseCardSpec(input: string): CardSpec {
  const text = input.trim()

  if (text === '**' || text.toLowerCase() === 'comodin' || text.toLowerCase() === 'comodín') {
    return { kind: 'comodin' }
  }

  const rankToken = text.slice(0, -1).toLowerCase()
  const suitToken = text.slice(-1).toLowerCase()

  const rank = RANK_BY_TOKEN[rankToken]
  const suit = SUIT_BY_TOKEN[suitToken]

  if (!rank || !suit) {
    throw new Error(
      `"${input}" is not a card. Expected something like 7♠, 10h, Ad, or ** for a comodín.`,
    )
  }

  return { kind: 'normal', rank, suit }
}

export function parseCardSpecs(inputs: readonly string[]): CardSpec[] {
  return inputs.map(parseCardSpec)
}

/** The canonical written form of a spec, for error messages. */
export function describeSpec(spec: CardSpec): string {
  return spec.kind === 'comodin'
    ? 'comodín'
    : describeCard({ id: '', kind: 'normal', rank: spec.rank, suit: spec.suit })
}
