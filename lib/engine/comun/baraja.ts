/**
 * Building a deck: some copies of the 52 cards, and their comodines.
 *
 * Every game on Mazo deals from this; how many copies and comodines is the
 * game's to say (Carioca: two and two each; el Mentiroso: one and none).
 * The order is fixed — callers shuffle — and so are the ids, which name a
 * card in *the deck*, not in a hand: `7-spades#0` is the first copy's seven
 * of spades in every game and every deal. Saved partidas hold these ids, so
 * their shape must never change.
 */

import { RANKS, SUITS, type Card } from './cards'

export function construirBaraja(opciones: {
  /** Copies of the standard 52-card deck. */
  copias: number
  /** Comodines each copy brings. */
  comodinesPorCopia: number
}): Card[] {
  const { copias, comodinesPorCopia } = opciones
  const cards: Card[] = []

  for (let copy = 0; copy < copias; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}-${suit}#${copy}`, kind: 'normal', rank, suit })
      }
    }
  }

  for (let copy = 0; copy < copias; copy++) {
    for (let n = 0; n < comodinesPorCopia; n++) {
      cards.push({ id: `comodin#${copy}-${n}`, kind: 'comodin' })
    }
  }

  return cards
}
