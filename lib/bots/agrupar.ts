/**
 * Finding the grupos hidden in a hand.
 *
 * The engine validates a grouping but never produces one — that decision
 * belongs to the player. So anything that plays on its own, bot or hint button,
 * needs this: given a hand and a contrato, find a set of grupos that satisfies
 * it without using the same card twice.
 *
 * The search generates minimum-size candidates only — trios of three, escalas
 * of four. Extra cards are better unloaded afterwards with `agregar`, which is
 * allowed on your own grupos the same turn, and keeps the search small.
 */

import {
  RANKS,
  SUITS,
  type Card,
  type Rank,
  isComodin,
  rankAfter,
} from '@/lib/engine'
import {
  ESCALA_MIN_SIZE,
  TRIO_MIN_SIZE,
  type Contrato,
  type Grupo,
  type Phase,
  type Propuesta,
  validateGrupo,
} from '@/lib/engine'

/** Cap on how many ways a single escala window is explored. */
const MAX_COMBINACIONES_POR_VENTANA = 8

type Candidato = {
  readonly propuesta: Propuesta
  readonly ids: ReadonlySet<string>
}

/**
 * A grouping that satisfies the contrato, or null if the hand cannot make one.
 *
 * The result is ready to hand to the engine as a `bajarse` move; it is
 * re-validated there, because the engine is the referee and this is only a
 * suggestion.
 */
export function buscarAgrupacion(
  hand: readonly Card[],
  contrato: Contrato,
): Propuesta[] | null {
  const trios = candidatosTrio(hand)
  const escalas = candidatosEscala(hand)

  if (trios.length < contrato.trios || escalas.length < contrato.escalas) return null

  const elegidas: Candidato[] = []
  const usadas = new Set<string>()

  const elegir = (restanTrios: number, restanEscalas: number, desde: number): boolean => {
    if (restanTrios === 0 && restanEscalas === 0) return true

    const pool = restanTrios > 0 ? trios : escalas
    const inicio = restanTrios > 0 ? desde : 0

    for (let i = inicio; i < pool.length; i++) {
      const candidato = pool[i]
      if (chocaCon(candidato, usadas)) continue

      elegidas.push(candidato)
      for (const id of candidato.ids) usadas.add(id)

      const siguiente =
        restanTrios > 0
          ? elegir(restanTrios - 1, restanEscalas, i + 1)
          : elegir(0, restanEscalas - 1, 0)
      if (siguiente) return true

      elegidas.pop()
      for (const id of candidato.ids) usadas.delete(id)
    }

    return false
  }

  if (!elegir(contrato.trios, contrato.escalas, 0)) return null

  // A turn always ends in a discard, so a grouping that uses the whole hand is
  // useless: there would be nothing left to throw.
  const cartasUsadas = elegidas.reduce((total, c) => total + c.ids.size, 0)
  if (cartasUsadas >= hand.length) return null

  return elegidas.map((candidato) => candidato.propuesta)
}

export function puedeBajarse(hand: readonly Card[], contrato: Contrato): boolean {
  return buscarAgrupacion(hand, contrato) !== null
}

/**
 * Read a selection of cards as one grupo, if it can be read as one.
 *
 * This is for the interface: the player picks the cards, and this works out
 * whether they mean a trío or an escala — including where a comodín has to sit
 * for the escala to hold. It is *not* the engine deciding how to group a hand:
 * the player chose these exact cards, and the result is still handed to the
 * engine to accept or refuse.
 *
 * Returns null when the selection is not a grupo at all.
 */
export function armarGrupo(
  cards: readonly Card[],
  phase: Phase = 'layDown',
): Propuesta | null {
  const reales = cards.filter((card) => !isComodin(card))
  const comodines = cards.filter(isComodin)
  if (reales.length === 0) return null

  const primero = reales[0] as Exclude<Card, { kind: 'comodin' }>

  // A trío: every real card of the same rango.
  if (cards.length >= TRIO_MIN_SIZE) {
    const mismoRango = reales.every(
      (card) => !isComodin(card) && card.rank === primero.rank,
    )
    if (mismoRango) {
      const propuesta: Propuesta = {
        kind: 'trio',
        rank: primero.rank,
        cardIds: cards.map((card) => card.id),
      }
      if (validaComo(propuesta, cards, phase)) return propuesta
    }
  }

  // An escala: one suit, and some rotation of the ring that every card fits,
  // with the comodines taking the positions nothing else covers.
  if (cards.length >= ESCALA_MIN_SIZE) {
    const mismoPalo = reales.every(
      (card) => !isComodin(card) && card.suit === primero.suit,
    )
    if (!mismoPalo) return null

    for (const start of RANKS) {
      const ordenadas = ordenarComoEscala(cards, start, comodines)
      if (!ordenadas) continue

      const propuesta: Propuesta = {
        kind: 'escala',
        suit: primero.suit,
        start,
        cardIds: ordenadas.map((card) => card.id),
      }
      if (validaComo(propuesta, cards, phase)) return propuesta
    }
  }

  return null
}

/** Lay the cards out from `start`, letting comodines cover the empty slots. */
function ordenarComoEscala(
  cards: readonly Card[],
  start: Rank,
  comodines: readonly Card[],
): Card[] | null {
  const disponibles = new Map<Rank, Card[]>()
  for (const card of cards) {
    if (isComodin(card)) continue
    const existentes = disponibles.get(card.rank)
    if (existentes) existentes.push(card)
    else disponibles.set(card.rank, [card])
  }

  const libres = [...comodines]
  const ordenadas: Card[] = []

  for (let i = 0; i < cards.length; i++) {
    const rank = rankAfter(start, i)
    const real = disponibles.get(rank)?.pop()
    if (real) {
      ordenadas.push(real)
      continue
    }
    const comodin = libres.pop()
    if (!comodin) return null
    ordenadas.push(comodin)
  }

  // Every real card has to have found a slot, or this rotation is wrong.
  for (const restantes of disponibles.values()) {
    if (restantes.length > 0) return null
  }

  return ordenadas
}

function validaComo(
  propuesta: Propuesta,
  cards: readonly Card[],
  phase: Phase,
): boolean {
  const porId = new Map(cards.map((card) => [card.id, card]))
  const ordenadas = propuesta.cardIds.map((id) => porId.get(id)!)

  const grupo: Grupo =
    propuesta.kind === 'trio'
      ? { kind: 'trio', rank: propuesta.rank, cards: ordenadas }
      : {
          kind: 'escala',
          suit: propuesta.suit,
          start: propuesta.start,
          cards: ordenadas,
        }

  return validateGrupo(grupo, phase).ok
}

// ------------------------------------------------------------- candidates

function candidatosTrio(hand: readonly Card[]): Candidato[] {
  const comodines = hand.filter(isComodin)
  const candidatos: Candidato[] = []

  for (const rank of RANKS) {
    const iguales = hand.filter((card) => !isComodin(card) && card.rank === rank)

    for (const combinacion of combinaciones(iguales, TRIO_MIN_SIZE)) {
      candidatos.push(comoCandidato({ kind: 'trio', rank, cardIds: ids(combinacion) }))
    }

    // Two real cards plus a comodín is still a trío — but only one comodín is
    // allowed while laying down.
    if (iguales.length >= 2 && comodines.length > 0) {
      for (const par of combinaciones(iguales, 2)) {
        candidatos.push(
          comoCandidato({
            kind: 'trio',
            rank,
            cardIds: [...ids(par), comodines[0].id],
          }),
        )
      }
    }
  }

  return candidatos
}

function candidatosEscala(hand: readonly Card[]): Candidato[] {
  const comodines = hand.filter(isComodin)
  const candidatos: Candidato[] = []

  for (const suit of SUITS) {
    const delPalo = hand.filter((card) => !isComodin(card) && card.suit === suit)
    if (delPalo.length + Math.min(comodines.length, 1) < ESCALA_MIN_SIZE) continue

    const porRango = new Map<Rank, Card[]>()
    for (const card of delPalo) {
      if (isComodin(card)) continue
      const existentes = porRango.get(card.rank)
      if (existentes) existentes.push(card)
      else porRango.set(card.rank, [card])
    }

    for (const start of RANKS) {
      const ventana = Array.from({ length: ESCALA_MIN_SIZE }, (_, i) =>
        rankAfter(start, i),
      )

      for (const combinacion of combinacionesDeVentana(ventana, porRango, comodines)) {
        candidatos.push(
          comoCandidato({ kind: 'escala', suit, start, cardIds: ids(combinacion) }),
        )
      }
    }
  }

  return candidatos
}

/**
 * Every way to fill one window of consecutive ranks: a real card at each
 * position, or a comodín standing in for a missing one — at most a single
 * comodín, because that is the lay-down rule.
 */
function combinacionesDeVentana(
  ventana: readonly Rank[],
  porRango: ReadonlyMap<Rank, Card[]>,
  comodines: readonly Card[],
): Card[][] {
  let parciales: { cards: Card[]; comodinUsado: boolean }[] = [
    { cards: [], comodinUsado: false },
  ]

  for (const rank of ventana) {
    const siguientes: typeof parciales = []

    for (const parcial of parciales) {
      for (const card of porRango.get(rank) ?? []) {
        siguientes.push({ cards: [...parcial.cards, card], comodinUsado: parcial.comodinUsado })
      }
      if (!parcial.comodinUsado && comodines.length > 0) {
        siguientes.push({ cards: [...parcial.cards, comodines[0]], comodinUsado: true })
      }
    }

    if (siguientes.length === 0) return []
    parciales = siguientes.slice(0, MAX_COMBINACIONES_POR_VENTANA)
  }

  return parciales.map((parcial) => parcial.cards)
}

// ----------------------------------------------------------------- utils

function comoCandidato(propuesta: Propuesta): Candidato {
  return { propuesta, ids: new Set(propuesta.cardIds) }
}

function chocaCon(candidato: Candidato, usadas: ReadonlySet<string>): boolean {
  for (const id of candidato.ids) if (usadas.has(id)) return true
  return false
}

const ids = (cards: readonly Card[]): string[] => cards.map((card) => card.id)

function combinaciones<T>(items: readonly T[], tamano: number): T[][] {
  if (tamano > items.length) return []

  const resultado: T[][] = []
  const actual: T[] = []

  const recorrer = (desde: number) => {
    if (actual.length === tamano) {
      resultado.push([...actual])
      return
    }
    for (let i = desde; i < items.length; i++) {
      actual.push(items[i])
      recorrer(i + 1)
      actual.pop()
    }
  }

  recorrer(0)
  return resultado
}

/**
 * How far along a card is toward a grupo the contrato actually needs, as a
 * fraction of the way there. 1 means the grupo is already complete.
 *
 * Progress, not company. An earlier version counted any same-suit card within
 * three ranks as a neighbour, so `4♦` and `7♦` protected each other forever
 * without ever becoming an escala — and bots never finished a contrato with
 * escalas in it. What matters is the length of the *consecutive* chain a card
 * belongs to, not how many vaguely related cards sit beside it.
 */
export function utilidadDeCarta(
  card: Card,
  hand: readonly Card[],
  contrato: Contrato,
): number {
  // A comodín fits anywhere. Throwing one away is almost always a mistake, and
  // it is also the most expensive card to be caught holding.
  if (isComodin(card)) return Number.MAX_SAFE_INTEGER

  const mismoRango = hand.filter(
    (otra) => !isComodin(otra) && otra.rank === card.rank,
  ).length
  const cadena = largoDeLaCadena(card, hand)

  // Weighted by how much of the contrato is of each kind, so that "dos escalas
  // y un trío" values escala material above trio material rather than treating
  // them alike. A kind the contrato does not ask for is not worthless — the next
  // contrato may want it — just worth much less.
  const piezas = contrato.trios + contrato.escalas
  const pesoTrio = contrato.trios > 0 ? contrato.trios / piezas : 0.15
  const pesoEscala = contrato.escalas > 0 ? contrato.escalas / piezas : 0.15

  return Math.max(
    (mismoRango / TRIO_MIN_SIZE) * pesoTrio,
    (cadena / ESCALA_MIN_SIZE) * pesoEscala,
  )
}

/**
 * Whether a card already has something to build on in this hand: another of its
 * rango, or a neighbour in its suit.
 *
 * Deliberately not a threshold on `utilidadDeCarta` — that value is weighted by
 * the contrato, so a threshold would drift every time the weights are tuned.
 */
export function tieneCompania(card: Card, hand: readonly Card[]): boolean {
  if (isComodin(card)) return true

  const mismoRango = hand.filter(
    (otra) => !isComodin(otra) && otra.rank === card.rank,
  ).length

  return mismoRango >= 2 || largoDeLaCadena(card, hand) >= 2
}

/**
 * Length of the run of consecutive same-suit ranks this card belongs to,
 * counting distinct ranks and walking both ways around the ring.
 */
function largoDeLaCadena(card: Card, hand: readonly Card[]): number {
  if (isComodin(card)) return 0

  const presentes = new Set<Rank>()
  for (const otra of hand) {
    if (!isComodin(otra) && otra.suit === card.suit) presentes.add(otra.rank)
  }

  let largo = 1
  for (let paso = 1; paso < RANKS.length; paso++) {
    const siguiente = rankAfter(card.rank, paso)
    if (!presentes.has(siguiente)) break
    largo++
  }
  for (let paso = 1; paso < RANKS.length - largo; paso++) {
    const anterior = rankAfter(card.rank, -paso)
    if (!presentes.has(anterior)) break
    largo++
  }

  return Math.min(largo, RANKS.length)
}
