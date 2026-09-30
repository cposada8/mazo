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
 * A run of cards you have pinned together.
 *
 * Purely a way of holding your cards: a bloque commits to nothing, is not a
 * grupo, and does not have to be a legal anything. Its whole job is to survive
 * sorting — pin a trío and it stays a trío on screen no matter how many times
 * you rearrange the rest.
 */
export type Bloque = readonly string[]

export type Seccion = {
  /** Stable across renders, so React can keep the cards in place. */
  readonly id: string
  readonly cards: Card[]
  readonly bloqueada: boolean
}

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
 * Lay a hand out as pinned bloques first, then everything loose.
 *
 * Bloques keep their contents and their internal order; cards that have left
 * the hand fall out of them, and a bloque emptied that way disappears rather
 * than lingering as an empty frame.
 */
export function distribuir(
  hand: readonly Card[],
  orden: readonly string[],
  bloques: readonly Bloque[],
): Seccion[] {
  const porId = new Map(hand.map((card) => [card.id, card]))
  const yaUsadas = new Set<string>()

  const secciones: Seccion[] = []

  for (const [indice, bloque] of bloques.entries()) {
    const cards: Card[] = []
    for (const id of bloque) {
      const card = porId.get(id)
      if (!card || yaUsadas.has(id)) continue
      yaUsadas.add(id)
      cards.push(card)
    }
    if (cards.length > 0) {
      secciones.push({ id: `bloque-${indice}-${cards[0].id}`, cards, bloqueada: true })
    }
  }

  const sueltas = aplicarOrden(
    hand.filter((card) => !yaUsadas.has(card.id)),
    orden,
  )
  if (sueltas.length > 0) {
    secciones.push({ id: 'sueltas', cards: sueltas, bloqueada: false })
  }

  return secciones
}

/** Every card in a layout, left to right — what the hand looks like. */
export function aplanar(secciones: readonly Seccion[]): Card[] {
  return secciones.flatMap((seccion) => seccion.cards)
}

/**
 * Pin a set of cards together, taking them out of any bloque they were in.
 *
 * A bloque of one is allowed: sometimes a single card is the thing you want
 * kept where you put it.
 */
export function bloquear(
  bloques: readonly Bloque[],
  cardIds: readonly string[],
): Bloque[] {
  if (cardIds.length === 0) return bloques.map((bloque) => [...bloque])

  const nuevas = new Set(cardIds)
  const limpios = bloques
    .map((bloque) => bloque.filter((id) => !nuevas.has(id)))
    .filter((bloque) => bloque.length > 0)

  return [...limpios, [...cardIds]]
}

export function soltarBloque(bloques: readonly Bloque[], indice: number): Bloque[] {
  return bloques.filter((_, i) => i !== indice).map((bloque) => [...bloque])
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

/**
 * Where dragged cards land: the seam in front of a card, or the one after
 * it (Phase 63). Named by a card and not by a position, because a position
 * would be counted over the cards on screen, and a run also holds cards set
 * aside for a grupo, which are not. And since every card sits in exactly one
 * place — the loose run or one bloque — the card also says *which* run.
 */
export type Destino =
  | { readonly antesDe: string }
  | { readonly despuesDe: string }
  /**
   * A bloque of their own (Phase 66), placed in front of the bloque that
   * holds this card — or after every bloque, just before the loose run, for
   * null.
   */
  | { readonly nuevoBloqueAntesDe: string | null }

/**
 * Carry cards to a seam, gathered, by dragging (Phases 63 and 65).
 *
 * The cards leave wherever they were — loose or pinned — and land together
 * at `destino`, in the order `llevadas` gives them (the order they sat, not
 * the order they were tapped). Landing in a bloque pins them there; landing
 * in the loose run unpins them. A bloque left with nothing disappears.
 *
 * Or they land in a bloque of their own, pinned together, among the others
 * (Phase 66).
 *
 * A seam beside one of the carried cards means nothing, so it changes
 * nothing.
 */
export function llevar(
  orden: readonly string[],
  bloques: readonly Bloque[],
  llevadas: readonly string[],
  destino: Destino,
): { orden: string[]; bloques: Bloque[] } {
  const sinCambio = { orden: [...orden], bloques: bloques.map((bloque) => [...bloque]) }
  const elegidas = new Set(llevadas)

  // The loose run first, then each bloque: one list of places.
  const listas = [orden, ...bloques]
  const bloque = llevadas.filter((id) => listas.some((lista) => lista.includes(id)))
  if (bloque.length === 0) return sinCambio
  const limpias = listas.map((lista) => lista.filter((id) => !elegidas.has(id)))

  if ('nuevoBloqueAntesDe' in destino) {
    // Where it goes is read before anything moves: the bloque it is placed
    // in front of may be the very one the drag is emptying.
    const ancla = destino.nuevoBloqueAntesDe
    const k = ancla === null ? bloques.length : bloques.findIndex((b) => b.includes(ancla))
    if (k === -1) return sinCambio

    const [nuevoOrden, ...nuevosBloques] = limpias
    nuevosBloques.splice(k, 0, bloque)
    return { orden: nuevoOrden, bloques: nuevosBloques.filter((b) => b.length > 0) }
  }

  const ancla = 'antesDe' in destino ? destino.antesDe : destino.despuesDe
  if (elegidas.has(ancla)) return sinCambio
  const donde = listas.findIndex((lista) => lista.includes(ancla))
  if (donde === -1) return sinCambio

  const lista = limpias[donde]
  const i = lista.indexOf(ancla) + ('despuesDe' in destino ? 1 : 0)
  limpias[donde] = [...lista.slice(0, i), ...bloque, ...lista.slice(i)]

  const [nuevoOrden, ...nuevosBloques] = limpias
  return { orden: nuevoOrden, bloques: nuevosBloques.filter((b) => b.length > 0) }
}
