/**
 * Scoring.
 *
 * Points are penalties: only the cards left in a hand count, and low is good.
 * Cards on the mesa are worth nothing, which is the whole incentive to unload.
 */

import { type Card, type Rank, isComodin } from './cards'

export const PUNTOS_COMODIN = 50
export const PUNTOS_AS = 20
export const PUNTOS_FIGURA = 10

const VALOR: Record<Rank, number> = {
  A: PUNTOS_AS,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: PUNTOS_FIGURA,
  Q: PUNTOS_FIGURA,
  K: PUNTOS_FIGURA,
}

export function puntosDeCarta(card: Card): number {
  return isComodin(card) ? PUNTOS_COMODIN : VALOR[card.rank]
}

export function puntosDeMano(hand: readonly Card[]): number {
  return hand.reduce((total, card) => total + puntosDeCarta(card), 0)
}
