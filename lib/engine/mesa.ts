/**
 * Changing grupos that are already on the mesa.
 *
 * These functions only know how to reshape a grupo. *Whether* a player is
 * allowed to touch it — bajado or not, own grupo or someone else's, same turn
 * or a later one — is decided in ronda.ts. Keeping the two apart means the
 * reshaping can be tested without a whole ronda around it.
 */

import {
  type Card,
  type NormalCard,
  cyclicDistance,
  isComodin,
  rankAfter,
} from './cards'
import {
  type Escala,
  type Grupo,
  type GrupoCheck,
  type Trio,
  validateGrupo,
} from './grupos'

export type MesaEdit =
  | { readonly ok: true; readonly grupo: Grupo }
  | { readonly ok: false; readonly code: MesaErrorCode; readonly detail: string }

export type MesaErrorCode =
  | 'WRONG_SUIT'
  | 'NOT_A_COMODIN_POSITION'
  | 'INVALID_RESULT'

const invalid = (check: Extract<GrupoCheck, { ok: false }>): MesaEdit => ({
  ok: false,
  code: 'INVALID_RESULT',
  detail: `${check.code}: ${check.detail}`,
})

/** Cards go on the end; a trio has no order, so there is nowhere else. */
export function addToTrio(trio: Trio, cards: readonly Card[]): MesaEdit {
  const grupo: Trio = { ...trio, cards: [...trio.cards, ...cards] }
  const check = validateGrupo(grupo, 'mesa')
  return check.ok ? { ok: true, grupo } : invalid(check)
}

/**
 * Extend an escala at either end. Extending the head moves `start` back, since
 * the first slot is now an earlier rank.
 *
 * Cards must be given in ascending order. Anything else fails validation, which
 * is where order is checked already.
 */
export function extendEscala(
  escala: Escala,
  cards: readonly Card[],
  end: 'head' | 'tail',
): MesaEdit {
  const grupo: Escala =
    end === 'tail'
      ? { ...escala, cards: [...escala.cards, ...cards] }
      : {
          ...escala,
          start: rankAfter(escala.start, -cards.length),
          cards: [...cards, ...escala.cards],
        }

  const check = validateGrupo(grupo, 'mesa')
  return check.ok ? { ok: true, grupo } : invalid(check)
}

/**
 * Swap a real card in for the comodín standing in its place, and put the freed
 * comodín back into the same grupo at one end.
 *
 * A comodín never leaves the grupo it was laid in, and it is never taken into a
 * hand: this is a reassignment on the table, paid for with the card it was
 * standing for. Which comodín moves is not chosen — it is the one sitting on the
 * replacement card's rank.
 */
export function repositionComodin(
  escala: Escala,
  replacement: NormalCard,
  to: 'head' | 'tail',
): MesaEdit {
  if (replacement.suit !== escala.suit) {
    return {
      ok: false,
      code: 'WRONG_SUIT',
      detail: `${replacement.suit} card offered to an escala of ${escala.suit}`,
    }
  }

  const index = cyclicDistance(escala.start, replacement.rank)
  const occupant = index < escala.cards.length ? escala.cards[index] : undefined

  if (!occupant || !isComodin(occupant)) {
    return {
      ok: false,
      code: 'NOT_A_COMODIN_POSITION',
      detail: `no comodín stands for ${replacement.rank} in this escala`,
    }
  }

  const filled = escala.cards.map((card, i) => (i === index ? replacement : card))

  const grupo: Escala =
    to === 'tail'
      ? { ...escala, cards: [...filled, occupant] }
      : {
          ...escala,
          start: rankAfter(escala.start, -1),
          cards: [occupant, ...filled],
        }

  const check = validateGrupo(grupo, 'mesa')
  return check.ok ? { ok: true, grupo } : invalid(check)
}
