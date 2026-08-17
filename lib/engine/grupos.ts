/**
 * Grupos: trios and escalas, and whether a proposed one is legal.
 *
 * The rules are in specs/carioca-rules.md. Two of them shape this file:
 *
 * 1. Validation is *phase-dependent*. `7 7 comodin comodin` is illegal while
 *    laying down and legal once the grupo is on the mesa, so every check takes
 *    the phase as an argument.
 * 2. A comodin in an escala stands for a concrete card. Here that binding is
 *    positional: an escala knows the rank it starts on, so slot `i` stands for
 *    `rankAfter(start, i)` whether it holds a real card or a comodin. Nothing
 *    can drift out of sync because there is only one source of truth.
 */

import {
  RANK_COUNT,
  type Card,
  type Rank,
  type Suit,
  isComodin,
  rankAfter,
} from './cards'

export const TRIO_MIN_SIZE = 3
export const ESCALA_MIN_SIZE = 4
/** An escala is consecutive ranks of one suit, so it cannot outgrow the ring. */
export const ESCALA_MAX_SIZE = RANK_COUNT

/**
 * When a grupo is being validated.
 *
 * - `layDown` — the player is bajándose. At most one comodin per grupo.
 * - `mesa` — the grupo is already on the table and is being extended.
 */
export type Phase = 'layDown' | 'mesa'

export type Trio = {
  readonly kind: 'trio'
  /** Every real card in the grupo has this rank; comodines stand for it. */
  readonly rank: Rank
  readonly cards: readonly Card[]
}

export type Escala = {
  readonly kind: 'escala'
  readonly suit: Suit
  /** Rank of the first slot. Later slots follow it around the rank ring. */
  readonly start: Rank
  /** In order. Slot `i` stands for `rankAfter(start, i)`. */
  readonly cards: readonly Card[]
}

export type Grupo = Trio | Escala

export type GrupoErrorCode =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'NO_REAL_CARDS'
  | 'DUPLICATE_CARD'
  | 'RANK_MISMATCH'
  | 'SUIT_MISMATCH'
  | 'TOO_MANY_COMODINES'
  | 'ADJACENT_COMODINES'

export type GrupoCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: GrupoErrorCode; readonly detail: string }

const ok: GrupoCheck = { ok: true }
const fail = (code: GrupoErrorCode, detail: string): GrupoCheck => ({
  ok: false,
  code,
  detail,
})

export function comodinesIn(grupo: Grupo): number {
  return grupo.cards.filter(isComodin).length
}

/** The rank slot `index` stands for, real card or comodin alike. */
export function escalaRankAt(escala: Escala, index: number): Rank {
  return rankAfter(escala.start, index)
}

export function validateGrupo(grupo: Grupo, phase: Phase): GrupoCheck {
  return grupo.kind === 'trio'
    ? validateTrio(grupo, phase)
    : validateEscala(grupo, phase)
}

export function validateTrio(trio: Trio, phase: Phase): GrupoCheck {
  const { cards, rank } = trio

  if (cards.length < TRIO_MIN_SIZE) {
    return fail('TOO_SHORT', `a trio needs ${TRIO_MIN_SIZE} cards, got ${cards.length}`)
  }

  const duplicate = findDuplicateId(cards)
  if (duplicate) return fail('DUPLICATE_CARD', `card ${duplicate} appears twice`)

  for (const card of cards) {
    if (isComodin(card)) continue
    if (card.rank !== rank) {
      return fail('RANK_MISMATCH', `${card.rank} in a trio of ${rank}`)
    }
  }

  // Unreachable through legal play — lay-down allows one comodin, so a trio
  // always keeps at least two real cards. Rejected anyway so the type cannot
  // describe a grupo that never existed.
  if (cards.every(isComodin)) {
    return fail('NO_REAL_CARDS', 'a trio cannot be comodines only')
  }

  return checkComodinCount(trio, phase)
}

export function validateEscala(escala: Escala, phase: Phase): GrupoCheck {
  const { cards, suit } = escala

  if (cards.length < ESCALA_MIN_SIZE) {
    return fail(
      'TOO_SHORT',
      `an escala needs ${ESCALA_MIN_SIZE} cards, got ${cards.length}`,
    )
  }
  if (cards.length > ESCALA_MAX_SIZE) {
    return fail(
      'TOO_LONG',
      `an escala cannot exceed ${ESCALA_MAX_SIZE} cards, got ${cards.length}`,
    )
  }

  const duplicate = findDuplicateId(cards)
  if (duplicate) return fail('DUPLICATE_CARD', `card ${duplicate} appears twice`)

  for (const [index, card] of cards.entries()) {
    if (isComodin(card)) continue
    if (card.suit !== suit) {
      return fail('SUIT_MISMATCH', `${card.suit} card in an escala of ${suit}`)
    }
    const expected = escalaRankAt(escala, index)
    if (card.rank !== expected) {
      return fail(
        'RANK_MISMATCH',
        `${card.rank} at position ${index}, which stands for ${expected}`,
      )
    }
  }

  if (cards.every(isComodin)) {
    return fail('NO_REAL_CARDS', 'an escala cannot be comodines only')
  }

  const countCheck = checkComodinCount(escala, phase)
  if (!countCheck.ok) return countCheck

  // Only escalas have an order, so only escalas can have adjacent comodines.
  for (let i = 1; i < cards.length; i++) {
    if (isComodin(cards[i]) && isComodin(cards[i - 1])) {
      return fail(
        'ADJACENT_COMODINES',
        `comodines at positions ${i - 1} and ${i} are consecutive`,
      )
    }
  }

  return ok
}

/**
 * At lay-down a grupo may hold one comodin. Afterwards there is no cap — a trio
 * can take any number, and an escala is limited only by the adjacency rule.
 */
function checkComodinCount(grupo: Grupo, phase: Phase): GrupoCheck {
  if (phase !== 'layDown') return ok
  const count = comodinesIn(grupo)
  return count <= 1
    ? ok
    : fail('TOO_MANY_COMODINES', `${count} comodines, only one allowed at lay-down`)
}

function findDuplicateId(cards: readonly Card[]): string | undefined {
  const seen = new Set<string>()
  for (const card of cards) {
    if (seen.has(card.id)) return card.id
    seen.add(card.id)
  }
  return undefined
}
