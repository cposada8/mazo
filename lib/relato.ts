/**
 * What just happened, said out loud — under one rule: **the line may only say
 * what everybody can see.**
 *
 * A card taken off the descarte was face up, so it is named. A card off the
 * mazo is secret, and the line says only that somebody drew — the `mazo`
 * relato *cannot carry a card* by construction, which is the point: this is a
 * public view of the ronda, the same discipline Phase 25 makes structural
 * when a bot is handed only the state it is entitled to see.
 *
 * Cards named by the other relatos are public the moment the move lands:
 * a discard is face up, and anything placed on the mesa is on the mesa.
 */

import {
  type Card,
  type Move,
  type RondaState,
  describeCard,
} from '@/lib/engine'

export type Relato =
  | { readonly tipo: 'mazo'; readonly seat: number }
  | { readonly tipo: 'descarte'; readonly seat: number; readonly carta: string }
  | { readonly tipo: 'bajada'; readonly seat: number; readonly grupos: number }
  | {
      readonly tipo: 'agrega'
      readonly seat: number
      readonly cartas: readonly string[]
      /** Whose grupo received them. */
      readonly dueno: number
    }
  | { readonly tipo: 'comodin'; readonly seat: number; readonly carta: string }
  | { readonly tipo: 'bota'; readonly seat: number; readonly carta: string }

/** A card on its way across the table, for the travel animation. */
export type Viaje = {
  /** Monotonic, so each journey is its own element and its own animation. */
  readonly clave: number
  readonly de: 'stock' | 'descarte'
  /** The seat whose hand the card travels to. */
  readonly seat: number
  /** The face to show, only when everybody saw it. Null travels face down. */
  readonly carta: Card | null
}

/**
 * The public account of a move, from the state it was played *into*.
 * Null when there is nothing public worth saying.
 */
export function relatar(move: Move, antes: RondaState): Relato | null {
  const seat = antes.turno
  const mano = antes.jugadores[seat].hand

  switch (move.type) {
    case 'robar': {
      if (move.de === 'stock') return { tipo: 'mazo', seat }
      const arriba = antes.discard.at(-1)
      return arriba
        ? { tipo: 'descarte', seat, carta: describeCard(arriba) }
        : null
    }
    case 'bajarse':
      return { tipo: 'bajada', seat, grupos: move.propuestas.length }
    case 'agregar': {
      const cartas = move.cardIds
        .map((id) => mano.find((card) => card.id === id))
        .filter((card): card is Card => Boolean(card))
        .map(describeCard)
      return cartas.length > 0
        ? { tipo: 'agrega', seat, cartas, dueno: move.seat }
        : null
    }
    case 'moverComodin': {
      const carta = mano.find((card) => card.id === move.cardId)
      return carta
        ? { tipo: 'comodin', seat, carta: describeCard(carta) }
        : null
    }
    case 'descartar': {
      const carta = mano.find((card) => card.id === move.cardId)
      return carta ? { tipo: 'bota', seat, carta: describeCard(carta) } : null
    }
  }
}

/**
 * The relato in words, for the line under the piles.
 *
 * `tu` is the seat reading the line: their own moves come back in second
 * person — "Robaste del mazo" — because "Tú robó" is nobody's Spanish.
 */
export function contarRelato(
  relato: Relato,
  nombres: readonly string[],
  tu?: number,
): string {
  const esTuyo = relato.seat === tu
  const quien = nombres[relato.seat] ?? `Jugador ${relato.seat + 1}`
  const dueno = (seat: number) =>
    seat === tu
      ? 'un grupo tuyo'
      : seat === relato.seat
        ? 'un grupo suyo'
        : `un grupo de ${nombres[seat] ?? `Jugador ${seat + 1}`}`

  switch (relato.tipo) {
    case 'mazo':
      return esTuyo ? 'Robaste del mazo' : `${quien} robó del mazo`
    case 'descarte':
      return esTuyo
        ? `Tomaste ${relato.carta} del descarte`
        : `${quien} tomó ${relato.carta} del descarte`
    case 'bajada': {
      const cuantos = `${relato.grupos} grupo${relato.grupos === 1 ? '' : 's'}`
      return esTuyo
        ? `Te bajaste con ${cuantos}`
        : `${quien} se bajó con ${cuantos}`
    }
    case 'agrega': {
      const cartas = relato.cartas.join(' ')
      return esTuyo
        ? `Pusiste ${cartas} en ${dueno(relato.dueno)}`
        : `${quien} puso ${cartas} en ${dueno(relato.dueno)}`
    }
    case 'comodin':
      return esTuyo
        ? `Liberaste un comodín con ${relato.carta}`
        : `${quien} liberó un comodín con ${relato.carta}`
    case 'bota':
      return esTuyo
        ? `Botaste ${relato.carta}`
        : `${quien} botó ${relato.carta}`
  }
}
