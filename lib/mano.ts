/**
 * Arranging the cards in your hand.
 *
 * Ordering is a comfort, never a rule: nothing here changes what is legal, and
 * the engine neither knows nor cares what order a hand is held in. It exists
 * because thirteen cards in an arbitrary order are hard to read, and because
 * how you like to hold them is your business.
 */

import {
  RANKS,
  SUITS,
  type Card,
  type Suit,
  isComodin,
  rankIndex,
} from '@/lib/engine'

export type Acomodo = 'pintas' | 'numeros'

/**
 * Apply a remembered order to a hand.
 *
 * Cards the order does not know about — the one just drawn, the ones dealt in a
 * new ronda — go on the end, where they are easy to notice. Cards that left the
 * hand fall out.
 */
export function aplicarOrden(
  hand: readonly Card[],
  orden: readonly string[],
): Card[] {
  const porId = new Map(hand.map((card) => [card.id, card]))
  const yaPuestas = new Set<string>()
  const conocidas: Card[] = []

  for (const id of orden) {
    // A repeated id would otherwise draw the same card twice. The order is just
    // a preference, so it is treated as advice and never trusted to be sound.
    if (yaPuestas.has(id)) continue
    const card = porId.get(id)
    if (!card) continue
    yaPuestas.add(id)
    conocidas.push(card)
  }

  const nuevas = hand.filter((card) => !yaPuestas.has(card.id))

  return [...conocidas, ...nuevas]
}

/**
 * By suit, each suit in ascending rank order — the arrangement that makes an
 * escala jump out.
 *
 * A run that wraps the ring, like `K A 2 3`, will not sit together: the ace
 * lands at one end. That is the cost of a straight line, and the cyclic case is
 * rare enough that the trade is worth it.
 */
function porPintas(hand: readonly Card[]): Card[] {
  const comodines = hand.filter(isComodin)
  const reales = hand.filter((card) => !isComodin(card))

  const ordenDePalo = (suit: Suit) => SUITS.indexOf(suit)

  const ordenadas = [...reales].sort((a, b) => {
    if (isComodin(a) || isComodin(b)) return 0
    const palo = ordenDePalo(a.suit) - ordenDePalo(b.suit)
    return palo !== 0 ? palo : rankIndex(a.rank) - rankIndex(b.rank)
  })

  // Comodines go last: they belong to whatever you decide, so they should not
  // break up a run you are reading.
  return [...ordenadas, ...comodines]
}

/**
 * By rango, keeping cards of the same value together and putting the biggest
 * groups first — so two fives sit side by side and three eights announce
 * themselves.
 */
function porNumeros(hand: readonly Card[]): Card[] {
  const comodines = hand.filter(isComodin)
  const reales = hand.filter((card) => !isComodin(card))

  const grupos = new Map<string, Card[]>()
  for (const card of reales) {
    if (isComodin(card)) continue
    const existentes = grupos.get(card.rank)
    if (existentes) existentes.push(card)
    else grupos.set(card.rank, [card])
  }

  const ordenados = [...grupos.entries()].sort(([rangoA, a], [rangoB, b]) => {
    const tamano = b.length - a.length
    if (tamano !== 0) return tamano
    return (
      rankIndex(rangoA as (typeof RANKS)[number]) -
      rankIndex(rangoB as (typeof RANKS)[number])
    )
  })

  return [...ordenados.flatMap(([, cards]) => cards), ...comodines]
}

export function acomodar(hand: readonly Card[], como: Acomodo): Card[] {
  return como === 'pintas' ? porPintas(hand) : porNumeros(hand)
}

/** Move one card one place left or right, leaving everything else alone. */
export function mover(
  orden: readonly string[],
  cardId: string,
  hacia: 'izquierda' | 'derecha',
): string[] {
  const actual = orden.indexOf(cardId)
  if (actual === -1) return [...orden]

  const destino = hacia === 'izquierda' ? actual - 1 : actual + 1
  if (destino < 0 || destino >= orden.length) return [...orden]

  const resultado = [...orden]
  ;[resultado[actual], resultado[destino]] = [resultado[destino], resultado[actual]]
  return resultado
}
