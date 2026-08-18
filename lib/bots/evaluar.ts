/**
 * The vocabulary every bot decides with.
 *
 * A bot answers the same three questions every turn — take the face-up card or
 * draw blind, lay down now or wait, throw which card — and the machinery for
 * asking them lives here, so that personalities differ in what they *value* and
 * never in what they can *see*. A bot that loses should be losing on judgement,
 * not because it never learned a move existed.
 *
 * Everything here is derived from a `VistaDeAsiento` and nothing else: no
 * memory between turns, because on the server a bot is a fresh function call
 * every time (Phase 34), and no input the seat is not entitled to (Phase 30).
 * The stronger idea — a running model of what each opponent holds, fed by the
 * relatos — is written up in the roadmap and deliberately not built yet.
 */

import {
  COMODINES_PER_COPY,
  DECK_COPIES,
  RANKS,
  SUITS,
  type Card,
  type Escala,
  type Move,
  type MoveDeMesa,
  type Rank,
  type Suit,
  type VistaDeAsiento,
  cyclicDistance,
  isComodin,
  rankAfter,
  probarEnMesa,
  puntosDeCarta,
} from '@/lib/engine'
import { utilidadDeCarta } from './agrupar'

// ------------------------------------------------------------- the mesa

/**
 * Every way a single card can enter one grupo, in the order worth trying.
 *
 * Extending comes first: it leaves both ends of an escala free, while freeing a
 * comodín parks it on an end. But `agregar` cannot reach the slot a comodín is
 * standing in — `moverComodin` is the only move that fills it, paying with the
 * exact card the comodín stands for. Offering only the first door is how a bot
 * lets the 6♥ it needed go past while a comodín sits on the mesa pretending to
 * be it.
 */
export function puertasDelGrupo(
  card: Card,
  seat: number,
  grupoIndex: number,
): MoveDeMesa[] {
  const extender = (['tail', 'head'] as const).map(
    (end) =>
      ({ type: 'agregar', seat, grupoIndex, cardIds: [card.id], end }) satisfies MoveDeMesa,
  )

  // A comodín cannot be the card that frees another comodín, so for one there
  // is only the one door.
  if (isComodin(card)) return extender

  return [
    ...extender,
    ...(['tail', 'head'] as const).map(
      (to) =>
        ({ type: 'moverComodin', seat, grupoIndex, cardId: card.id, to }) satisfies MoveDeMesa,
    ),
  ]
}

/**
 * The first grupo on the mesa that the referee lets this card join.
 *
 * Proposing and letting the referee answer avoids re-implementing the rules
 * about who may touch what and when — `probarEnMesa` runs the real `apply` over
 * the view, so the trial and the real move cannot disagree.
 */
export function ligaEnAlgunGrupo(
  vista: VistaDeAsiento,
  card: Card,
  asientos: readonly number[] = vista.jugadores.map((_, seat) => seat),
): MoveDeMesa | null {
  for (const seat of asientos) {
    const grupos = vista.jugadores[seat].grupos
    for (let grupoIndex = 0; grupoIndex < grupos.length; grupoIndex++) {
      for (const move of puertasDelGrupo(card, seat, grupoIndex)) {
        if (probarEnMesa(vista, move).ok) return move
      }
    }
  }
  return null
}

/**
 * Something in hand that the mesa will take, or null.
 *
 * Shared by every bot on purpose: unloading is not character, it is arithmetic.
 * A card on the mesa is worth nothing against you and a card in hand is worth
 * its points, so there is no personality for which holding a placeable card is
 * the better play.
 */
export function buscarDescarga(vista: VistaDeAsiento): Move | null {
  // Never unload the last card this way — the turn still has to end in a
  // discard, and the hand does not change while this loop runs.
  if (vista.mano.length <= 1) return null

  // Own grupos first, simply as a preference: on the turn it bajó the engine
  // refuses every one of these, and the bot falls through to a discard.
  const asientos = [
    vista.asiento,
    ...vista.jugadores.map((_, seat) => seat).filter((seat) => seat !== vista.asiento),
  ]

  for (const card of vista.mano) {
    const move = ligaEnAlgunGrupo(vista, card, asientos)
    if (move) return move
  }

  return null
}

/** Whether the descarte's top card could be placed on the mesa this very turn. */
export function ligaDeInmediato(vista: VistaDeAsiento, arriba: Card): boolean {
  const trasTomarla: VistaDeAsiento = {
    ...vista,
    fase: 'act',
    mano: [...vista.mano, arriba],
    descarte: vista.descarte.slice(0, -1),
  }
  return ligaEnAlgunGrupo(trasTomarla, arriba) !== null
}

/**
 * How near this card is to a home on the mesa, as a fraction: 1 for a card one
 * step from an open end, less the further out it sits, 0 for nowhere to go.
 *
 * This is what a card is worth once its holder has bajado, when progress toward
 * a grupo *in hand* has stopped meaning anything — there is nothing left to lay
 * down. Whether it ligadoes *right now* is not asked and does not need to be:
 * a discard is only ever chosen after `buscarDescarga` has already placed
 * everything the referee would take.
 */
export function alcanceEnMesa(card: Card, vista: VistaDeAsiento): number {
  // Still the most useful card in the game and still the most expensive one to
  // be caught with. Throwing it stays out of the question.
  if (isComodin(card)) return Number.MAX_SAFE_INTEGER

  let mejor = 0

  for (const jugador of vista.jugadores) {
    for (const grupo of jugador.grupos) {
      // A trío takes any card of its rango and nothing else, ever. If this card
      // is not it, no amount of waiting will change that — and if it is, it was
      // unloaded before the discard was ever considered.
      if (grupo.kind !== 'escala') continue
      if (grupo.suit !== card.suit) continue

      const camino = caminoHastaLaEscala(grupo, card.rank)
      if (camino) mejor = Math.max(mejor, 1 / (camino.length + 1))
    }
  }

  return mejor
}

/**
 * The ranks that would have to appear between this card and the nearer end of
 * the escala before it could join — empty for the card that extends it right
 * now — or null when the escala cannot reach it at all: the slot is already
 * occupied, or the escala has grown the whole way round the ring and has no
 * ends left.
 *
 * The path and not just its length, because how far away a card is and whether
 * the ground between is still walkable are two different questions, and a bot
 * that counts cards wants to ask the second one.
 */
export function caminoHastaLaEscala(escala: Escala, rank: Rank): Rank[] | null {
  const largo = escala.cards.length
  if (largo >= RANKS.length) return null

  const posicion = cyclicDistance(escala.start, rank)
  if (posicion < largo) return null

  const porLaCola = posicion - largo + 1
  const porLaCabeza = RANKS.length - posicion

  return porLaCola <= porLaCabeza
    ? Array.from({ length: porLaCola - 1 }, (_, i) => rankAfter(escala.start, largo + i))
    : Array.from({ length: porLaCabeza - 1 }, (_, i) => rankAfter(escala.start, -1 - i))
}

/**
 * What a card is worth in hand before anybody has coloured that in — the floor
 * under every personality.
 *
 * Which question gets asked depends on which half of the ronda this seat is in.
 * Before bajarse, worth is progress toward the contrato. After bajarse the
 * contrato is on the mesa and can never be added to, so progress toward a grupo
 * *in hand* measures nothing at all: that is how a bajado bot came to protect a
 * useless pair of fours and throw the king that belonged on somebody's escala.
 */
export function valorBase(card: Card, vista: VistaDeAsiento): number {
  return vista.jugadores[vista.asiento].bajadoEnTurno === null
    ? utilidadDeCarta(card, vista.mano, vista.contrato)
    : alcanceEnMesa(card, vista)
}

// --------------------------------------------------------- what is left

/** Copies of any one card in play, and of any one rango across the suits. */
export const COPIAS_POR_CARTA = DECK_COPIES
export const COPIAS_POR_RANGO = DECK_COPIES * SUITS.length
export const COMODINES_EN_JUEGO = DECK_COPIES * COMODINES_PER_COPY

export type Conteo = {
  /** Copies of this exact card nobody at the table has seen yet. */
  deLaCarta(rank: Rank, suit: Suit): number
  /** Copies of this rango, in any suit, nobody has seen yet. */
  delRango(rank: Rank): number
  /** Comodines nobody has seen yet. */
  comodines(): number
}

const memoria = new WeakMap<VistaDeAsiento, Conteo>()

/**
 * What is still unaccounted for, counted from the view alone.
 *
 * A card has been *seen* if it is in this hand, in the descarte, or on the mesa
 * in anybody's grupo — all public, or this seat's own. Everything else is
 * unseen: it is in the stock or in somebody's hand, and this tells them apart
 * no better than the seat itself can. Two copies of every card are in play, so
 * a rango with zero unseen copies is a trío that will never happen, and a bot
 * that goes on holding a pair for it is waiting for a bus that already left.
 *
 * A rebarajada folds the descarte back into the stock, and with it everything
 * this had counted — the count then honestly says those cards are unseen again,
 * because from a seat's own memory-less view they are.
 *
 * Memoized per view: every bot at a table asks this about a dozen cards, and a
 * view is a fresh object per decision, so the entry dies with it.
 */
export function conteoDeCartas(vista: VistaDeAsiento): Conteo {
  const guardado = memoria.get(vista)
  if (guardado) return guardado

  const porCarta = new Map<string, number>()
  const porRango = new Map<Rank, number>()
  let comodinesVistos = 0

  const anotar = (card: Card) => {
    if (isComodin(card)) {
      comodinesVistos++
      return
    }
    const clave = `${card.rank}-${card.suit}`
    porCarta.set(clave, (porCarta.get(clave) ?? 0) + 1)
    porRango.set(card.rank, (porRango.get(card.rank) ?? 0) + 1)
  }

  for (const card of vista.mano) anotar(card)
  for (const card of vista.descarte) anotar(card)
  for (const jugador of vista.jugadores) {
    for (const grupo of jugador.grupos) {
      for (const card of grupo.cards) anotar(card)
    }
  }

  const conteo: Conteo = {
    deLaCarta: (rank, suit) =>
      Math.max(0, COPIAS_POR_CARTA - (porCarta.get(`${rank}-${suit}`) ?? 0)),
    delRango: (rank) => Math.max(0, COPIAS_POR_RANGO - (porRango.get(rank) ?? 0)),
    // A partida played sin comodines has none to find, and the view does not
    // say which kind of partida this is. The error is one card's worth of
    // optimism about a route, and it is not worth an engine change to remove.
    comodines: () => Math.max(0, COMODINES_EN_JUEGO - comodinesVistos),
  }

  memoria.set(vista, conteo)
  return conteo
}

// ------------------------------------------------------------ the throw

/**
 * The card to throw: least worth keeping first, and among equally worthless
 * ones the most expensive, since points are penalties.
 *
 * What "worth keeping" means is the personality's to say; how the throw is
 * chosen once it is said is not.
 */
export function peorCarta(
  vista: VistaDeAsiento,
  valor: (card: Card, vista: VistaDeAsiento) => number,
): Card {
  const valores = new Map(
    vista.mano.map((card) => [card.id, valor(card, vista)] as const),
  )
  const puntaje = (card: Card): number => valores.get(card.id)!

  return vista.mano.reduce((peor, card) => {
    if (puntaje(card) !== puntaje(peor)) return puntaje(card) < puntaje(peor) ? card : peor
    if (isComodin(card) || isComodin(peor)) return isComodin(peor) ? card : peor
    return puntosDeCarta(card) > puntosDeCarta(peor) ? card : peor
  })
}
