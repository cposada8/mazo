/**
 * El Codicioso — the simplest bot that can finish a game.
 *
 * It plays legally and to the end, and no better than that. It lays down the
 * moment it can, unloads anything that fits, and throws the card that is
 * furthest from being useful. There is no memory of what has been discarded, no
 * reading of opponents, and no waiting for a better hand — those belong to the
 * bots with personalities, later.
 *
 * What it does know is that **a card is worth what its context makes it worth**,
 * and that the mesa has two doors, not one:
 *
 * - Before bajarse a card is worth how far it carries the contrato; after
 *   bajarse the contrato is already on the mesa and that measure means nothing.
 *   What counts then is whether some grupo out there can grow to take it.
 * - A card can join a grupo by `agregar`, or by taking the slot a comodín is
 *   standing in for — `moverComodin`, which is the *only* way into that slot.
 *   A bot that knows one door and not the other watches its own card go by.
 *
 * It cannot peek at another hand, because it never receives one: a bot decides
 * from a `VistaDeAsiento` — what its seat can legitimately see — and the view
 * has no field that could carry anyone else's cards (Phase 30).
 */

import {
  RANKS,
  type Card,
  type Escala,
  type Move,
  type MoveDeMesa,
  type Rank,
  type VistaDeAsiento,
  cyclicDistance,
  isComodin,
  probarEnMesa,
  puntosDeCarta,
} from '@/lib/engine'
import { buscarAgrupacion, utilidadDeCarta } from './agrupar'

export type Bot = {
  readonly nombre: string
  /** One legal move for the seat whose turn it is, decided from its view. */
  decidir(vista: VistaDeAsiento): Move
}

export const codicioso: Bot = {
  nombre: 'El Codicioso',
  decidir: decidirCodicioso,
}

export function decidirCodicioso(vista: VistaDeAsiento): Move {
  if (vista.fase === 'draw') return decidirRobo(vista)

  // Lay down at the first opportunity. A patient bot would sometimes wait; this
  // one never does, which is exactly what makes it a baseline.
  if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
    const agrupacion = buscarAgrupacion(vista.mano, vista.contrato)
    if (agrupacion) return { type: 'bajarse', propuestas: agrupacion }
  } else {
    const descarga = buscarDescarga(vista)
    if (descarga) return descarga
  }

  return { type: 'descartar', cardId: peorCarta(vista).id }
}

/**
 * Only take the face-up card if it puts this hand at least halfway to a grupo
 * the **contrato** is asking for. Otherwise draw blind.
 *
 * This threshold matters more than it looks. A looser rule — take anything with
 * a partner — measurably stops rondas from ending: the hand fills with pairs and
 * chains that pair up nicely and serve no contrato, and there is never room to
 * collect what is actually needed.
 */
const MITAD_DEL_CAMINO = 0.5

function decidirRobo(vista: VistaDeAsiento): Move {
  const arriba = vista.descarte.at(-1)

  if (arriba) {
    if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
      const conLaCarta = utilidadDeCarta(arriba, [...vista.mano, arriba], vista.contrato)
      if (conLaCarta >= MITAD_DEL_CAMINO) return { type: 'robar', de: 'descarte' }
    } else if (ligaDeInmediato(vista, arriba)) {
      // Once bajado, "useful for the contract" means nothing — the contract is
      // already on the mesa. The face-up card is only worth taking if it can
      // be unloaded right now. Anything looser loops: two bajado bots passing
      // each other's "useful" discards forever is how the one soak stall that
      // survived the tablas rule actually happened (seed soak-204).
      return { type: 'robar', de: 'descarte' }
    }
  }

  return vista.stock > 0 || vista.descarte.length > 1
    ? { type: 'robar', de: 'stock' }
    : { type: 'robar', de: 'descarte' }
}

/** Whether the descarte's top card could be ligada this very turn. */
function ligaDeInmediato(vista: VistaDeAsiento, arriba: Card): boolean {
  const trasTomarla: VistaDeAsiento = {
    ...vista,
    fase: 'act',
    mano: [...vista.mano, arriba],
    descarte: vista.descarte.slice(0, -1),
  }
  return ligaEnAlgunGrupo(trasTomarla, arriba) !== null
}

/**
 * The first card that the referee will accept onto some grupo already on the
 * mesa. Proposing and letting the referee answer avoids re-implementing the
 * rules about who may touch what and when — `probarEnMesa` runs the real
 * `apply` over the view, so the trial and the real move cannot disagree.
 */
function buscarDescarga(vista: VistaDeAsiento): Move | null {
  // Own grupos first, simply as a preference: on the turn it bajó the engine
  // refuses every one of these, and the bot falls through to a discard.
  const asientos = [
    vista.asiento,
    ...vista.jugadores.map((_, seat) => seat).filter((seat) => seat !== vista.asiento),
  ]

  // Never unload the last card this way — the turn still has to end in a
  // discard, and the hand does not change while this loop runs.
  if (vista.mano.length <= 1) return null

  for (const card of vista.mano) {
    const move = ligaEnAlgunGrupo(vista, card, asientos)
    if (move) return move
  }

  return null
}

/** The first grupo on the mesa that the referee lets this card join. */
function ligaEnAlgunGrupo(
  vista: VistaDeAsiento,
  card: Card,
  asientos: readonly number[] = vista.jugadores.map((_, seat) => seat),
): Move | null {
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
 * Every way a single card can enter one grupo, in the order worth trying.
 *
 * Extending comes first: it leaves both ends of an escala free, while freeing a
 * comodín parks it on an end. But `agregar` cannot reach the slot a comodín is
 * standing in — `moverComodin` is the only move that fills it, paying with the
 * exact card the comodín stands for. Offering only the first door is how a bot
 * lets the 6♥ it needed go past while a comodín sits on the mesa pretending to
 * be it.
 */
function puertasDelGrupo(
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
 * The card to throw: least worth keeping first, and among equally worthless
 * ones the most expensive, since points are penalties.
 */
function peorCarta(vista: VistaDeAsiento): Card {
  const valores = new Map(
    vista.mano.map((card) => [card.id, valorDeConservar(card, vista)] as const),
  )
  const valor = (card: Card): number => valores.get(card.id)!

  return vista.mano.reduce((peor, card) => {
    if (valor(card) !== valor(peor)) return valor(card) < valor(peor) ? card : peor
    if (isComodin(card) || isComodin(peor)) return isComodin(peor) ? card : peor
    return puntosDeCarta(card) > puntosDeCarta(peor) ? card : peor
  })
}

/**
 * What this card is worth in hand — and the answer depends on which half of
 * the ronda this seat is in.
 *
 * Before bajarse, worth is progress toward the contrato. After bajarse the
 * contrato is on the mesa and can never be added to, so progress toward a
 * grupo *in hand* measures nothing at all: that is how a bajado bot came to
 * protect a useless pair of fours and throw the king that belonged on
 * somebody's escala.
 */
function valorDeConservar(card: Card, vista: VistaDeAsiento): number {
  return vista.jugadores[vista.asiento].bajadoEnTurno === null
    ? utilidadDeCarta(card, vista.mano, vista.contrato)
    : alcanceEnMesa(card, vista)
}

/**
 * How near this card is to a home on the mesa, as a fraction: 1 for a card one
 * step from an open end, less the further out it sits, 0 for nowhere to go.
 *
 * Whether it ligadoes *right now* is not asked, and does not need to be: the
 * discard is only reached after `buscarDescarga` has already unloaded
 * everything the referee would take. What is left is a question about the
 * future — which grupo could still grow this way — and it is answered by
 * reading the mesa, not by trying moves.
 */
function alcanceEnMesa(card: Card, vista: VistaDeAsiento): number {
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

      const pasos = pasosHastaUnaPunta(grupo, card.rank)
      if (pasos !== null) mejor = Math.max(mejor, 1 / pasos)
    }
  }

  return mejor
}

/**
 * Ranks between this card and the nearer end of the escala — 1 for the card
 * that extends it right now — or null when the escala cannot reach it at all:
 * the slot is already occupied, or the escala has grown all the way round the
 * ring and has no ends left.
 */
function pasosHastaUnaPunta(escala: Escala, rank: Rank): number | null {
  const largo = escala.cards.length
  if (largo >= RANKS.length) return null

  const posicion = cyclicDistance(escala.start, rank)
  if (posicion < largo) return null

  return Math.min(posicion - largo + 1, RANKS.length - posicion)
}
