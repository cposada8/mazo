/**
 * Builders for scripted ronda tests.
 *
 * Real deals are random by design, which is useless when a test needs a player
 * to be holding four sevens. These build a RondaState directly.
 */

import {
  CATALOGO,
  apply,
  type Card,
  type Comodin,
  type Contrato,
  type Grupo,
  type JugadorState,
  type Move,
  type NormalCard,
  type Rank,
  type RondaState,
  type Suit,
  type TurnPhase,
} from '@/lib/engine'

let seq = 0

/** A real card. Each call is a distinct physical card, as with two decks. */
export const n = (rank: Rank, suit: Suit): NormalCard => ({
  id: `${rank}-${suit}#${seq++}`,
  kind: 'normal',
  rank,
  suit,
})

export const c = (): Comodin => ({ id: `comodin#${seq++}`, kind: 'comodin' })

export const ids = (cards: readonly Card[]): string[] =>
  cards.map((card) => card.id)

type JugadorSpec = {
  hand: Card[]
  grupos?: Grupo[]
  bajadoEnTurno?: number | null
}

export function makeRonda(spec: {
  jugadores: JugadorSpec[]
  contrato?: Contrato
  /** Drawn from the end, so the last card here is the next one drawn. */
  stock?: Card[]
  discard?: Card[]
  turno?: number
  numeroDeTurno?: number
  fase?: TurnPhase
  rngState?: number
}): RondaState {
  const jugadores: JugadorState[] = spec.jugadores.map((jugador) => ({
    hand: jugador.hand,
    grupos: jugador.grupos ?? [],
    bajadoEnTurno: jugador.bajadoEnTurno ?? null,
  }))

  return {
    contrato: spec.contrato ?? CATALOGO[0],
    jugadores,
    stock: spec.stock ?? [n('2', 'clubs'), n('3', 'clubs')],
    discard: spec.discard ?? [n('9', 'diamonds')],
    turno: spec.turno ?? 0,
    numeroDeTurno: spec.numeroDeTurno ?? 1,
    fase: spec.fase ?? 'draw',
    rngState: spec.rngState ?? 1,
    ganador: null,
  }
}

/** Apply a sequence of moves, failing loudly on the first refusal. */
export function play(state: RondaState, moves: readonly Move[]): RondaState {
  let current = state
  for (const [index, move] of moves.entries()) {
    const result = apply(current, move)
    if (!result.ok) {
      throw new Error(
        `move ${index} (${move.type}) was refused: ${result.code} — ${result.detail}`,
      )
    }
    current = result.state
  }
  return current
}
