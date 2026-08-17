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
  type Rank,
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
 * Where a rango sits when a hand is read low to high.
 *
 * Not the ring index. On the ring the ace is position zero, because an escala
 * can wrap through it; to a person sorting a hand the ace is simply the highest
 * card, so it goes last.
 */
function ordenDeLectura(rank: Rank): number {
  const indice = rankIndex(rank)
  return indice === 0 ? RANKS.length : indice
}

/**
 * By rango, low to high with the ace highest — so cards of the same value end up
 * side by side and the whole hand reads in order.
 */
function porNumeros(hand: readonly Card[]): Card[] {
  const comodines = hand.filter(isComodin)
  const reales = hand.filter((card) => !isComodin(card))

  const ordenadas = [...reales].sort((a, b) => {
    if (isComodin(a) || isComodin(b)) return 0
    const rango = ordenDeLectura(a.rank) - ordenDeLectura(b.rank)
    return rango !== 0 ? rango : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })

  return [...ordenadas, ...comodines]
}

export function acomodar(hand: readonly Card[], como: Acomodo): Card[] {
  return como === 'pintas' ? porPintas(hand) : porNumeros(hand)
}

/**
 * Move the selected cards one place left or right, gathering them as they go.
 *
 * Cards picked out of scattered positions come together into one block. The
 * block lands beside where the **leftmost** selected card was, which is what
 * makes repeated taps feel like sliding a group rather than shuffling a pile:
 *
 *     c c [s] c [s] [s]   →  left →   c [s] [s] [s] c c
 *
 * Selecting one card is just this with a block of one, so there is no separate
 * rule for the simple case.
 */
export function moverSeleccion(
  orden: readonly string[],
  seleccionadas: readonly string[],
  hacia: 'izquierda' | 'derecha',
): string[] {
  const elegidas = new Set(seleccionadas)
  const bloque = orden.filter((id) => elegidas.has(id))
  if (bloque.length === 0 || bloque.length === orden.length) return [...orden]

  const resto = orden.filter((id) => !elegidas.has(id))
  const ancla = orden.findIndex((id) => elegidas.has(id))

  const destino = Math.min(
    Math.max(ancla + (hacia === 'izquierda' ? -1 : 1), 0),
    resto.length,
  )

  return [...resto.slice(0, destino), ...bloque, ...resto.slice(destino)]
}
