/**
 * Las escaleras (Phase 48): the thirteen rangos, 2 through A, laid down whole.
 *
 * An escalera is not a bigger escala. It is every rango exactly once, read in
 * the fixed order 2 → A (not around the ring an escala uses), and laying one
 * down takes the whole hand — so it wins the ronda in the same move. The A
 * may sit at either end: after the K (2 → A) or before the 2 (A → K). The four
 * levels differ only in what colour or pinta each card must be:
 *
 * | Tipo | Besides one of every rango |
 * | --- | --- |
 * | sucia | nothing |
 * | pintada | colours alternate along the line; either colour may start |
 * | color | all red (♥ ♦) or all black (♠ ♣) |
 * | real | all one pinta |
 *
 * Any number of comodines — the exception to the one-per-grupo rule of every
 * other bajada, settled with the owner. Each stands for one missing rango and
 * takes whatever colour or pinta its place calls for — so a comodín never
 * breaks an alternation or a colour, it only fills a gap.
 *
 * Which end the A takes only matters to the pintada: thirteen is odd, so the
 * A matches the 2's colour when it goes last and the K's when it goes first —
 * which is to say the A of a pintada may be either colour.
 */

import { type Card, type NormalCard, type Rank, type Suit, isComodin } from './cards'

export type TipoDeEscalera = 'sucia' | 'pintada' | 'color' | 'real'

/** The order an escalera is read in: 2 first, A last. Not the escala's ring. */
export const ORDEN_DE_ESCALERA: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
]

export const LARGO_DE_ESCALERA = ORDEN_DE_ESCALERA.length // 13

/** The same thirteen with the A before the 2: A, 2, 3 … K. */
export const ORDEN_CON_AS_PRIMERO: readonly Rank[] = [
  'A', ...ORDEN_DE_ESCALERA.slice(0, -1),
]

/** The two lines an escalera can be read along; the A-last one is preferred. */
const ORDENES: readonly (readonly Rank[])[] = [ORDEN_DE_ESCALERA, ORDEN_CON_AS_PRIMERO]

export const NOMBRE_DE_ESCALERA: Record<TipoDeEscalera, string> = {
  sucia: 'Escalera sucia',
  pintada: 'Escalera pintada',
  color: 'Escalera color',
  real: 'Escalera real',
}

export type Color = 'rojo' | 'negro'

export function colorDe(suit: Suit): Color {
  return suit === 'hearts' || suit === 'diamonds' ? 'rojo' : 'negro'
}

const otro = (color: Color): Color => (color === 'rojo' ? 'negro' : 'rojo')

export type EscaleraErrorCode =
  | 'LARGO'
  | 'RANGO_REPETIDO'
  | 'FALTA_RANGO'
  | 'NO_INTERCALA'
  | 'COLOR_MEZCLADO'
  | 'PINTA_MEZCLADA'

export type EscaleraCheck =
  | {
      readonly ok: true
      /** The cards in escalera order, the comodín in the place it fills. */
      readonly cards: readonly Card[]
      /** Read A → K rather than 2 → A: only a pintada ever needs it. */
      readonly asPrimero?: true
    }
  | { readonly ok: false; readonly code: EscaleraErrorCode; readonly detail: string }

const fail = (code: EscaleraErrorCode, detail: string): EscaleraCheck => ({
  ok: false,
  code,
  detail,
})

/**
 * Whether these cards are an escalera of this tipo, and if so, in order.
 *
 * Order in is irrelevant — a hand is whatever order the player arranged it —
 * so the cards are placed by rango, and the comodines go where the missing
 * rangos would. The A goes last (2 → A) unless only first (A → K) works.
 */
export function ordenarEscalera(
  cards: readonly Card[],
  tipo: TipoDeEscalera,
): EscaleraCheck {
  if (cards.length !== LARGO_DE_ESCALERA) {
    return fail('LARGO', `an escalera is ${LARGO_DE_ESCALERA} cards, got ${cards.length}`)
  }

  const comodines = cards.filter(isComodin)

  const porRango = new Map<Rank, NormalCard>()
  for (const card of cards) {
    if (isComodin(card)) continue
    if (porRango.has(card.rank)) {
      return fail('RANGO_REPETIDO', `${card.rank} appears twice`)
    }
    porRango.set(card.rank, card)
  }

  const faltan = ORDEN_DE_ESCALERA.filter((rank) => !porRango.has(rank))
  if (faltan.length > comodines.length) {
    return fail('FALTA_RANGO', `missing ${faltan.join(', ')}`)
  }

  let primerFallo: EscaleraCheck | undefined
  for (const orden of ORDENES) {
    const check = revisarEnOrden(porRango, comodines, orden, tipo)
    if (check.ok) {
      return orden === ORDEN_DE_ESCALERA ? check : { ...check, asPrimero: true }
    }
    primerFallo ??= check
  }
  return primerFallo!
}

/** The cards laid along one reading of the escalera, and whether it holds. */
function revisarEnOrden(
  porRango: ReadonlyMap<Rank, NormalCard>,
  comodines: readonly Card[],
  orden: readonly Rank[],
  tipo: TipoDeEscalera,
): EscaleraCheck {
  // Thirteen cards with no rango repeated means exactly one comodín per gap;
  // they are handed out to the gaps in order.
  let siguiente = 0
  const ordenadas: Card[] = orden.map(
    (rank) => porRango.get(rank) ?? comodines[siguiente++],
  )

  const reales = ordenadas
    .map((card, posicion) => ({ card, posicion }))
    .filter((entrada): entrada is { card: NormalCard; posicion: number } =>
      !isComodin(entrada.card),
    )

  // Nothing real to hold a colour against: every tipo is satisfied.
  if (reales.length === 0) return { ok: true, cards: ordenadas }

  switch (tipo) {
    case 'sucia':
      break

    case 'pintada': {
      // Whatever colour the first real card has fixes the pattern: position
      // p must be that colour when p shares its parity, the other one when
      // it does not. Both starts are valid, and a comodín fits either.
      const [primera] = reales
      const base =
        primera.posicion % 2 === 0 ? colorDe(primera.card.suit) : otro(colorDe(primera.card.suit))
      const rota = reales.find(
        ({ card, posicion }) =>
          colorDe(card.suit) !== (posicion % 2 === 0 ? base : otro(base)),
      )
      if (rota) {
        return fail(
          'NO_INTERCALA',
          `${rota.card.rank} breaks the red/black alternation`,
        )
      }
      break
    }

    case 'color': {
      const color = colorDe(reales[0].card.suit)
      if (reales.some(({ card }) => colorDe(card.suit) !== color)) {
        return fail('COLOR_MEZCLADO', 'an escalera color is all red or all black')
      }
      break
    }

    case 'real': {
      const suit = reales[0].card.suit
      if (reales.some(({ card }) => card.suit !== suit)) {
        return fail('PINTA_MEZCLADA', 'an escalera real is all one pinta')
      }
      break
    }
  }

  return { ok: true, cards: ordenadas }
}

/** The rango the card at `posicion` of a laid-down escalera stands for. */
export function rangoDeEscaleraEn(
  escalera: { readonly asPrimero?: boolean },
  posicion: number,
): Rank {
  return (escalera.asPrimero ? ORDEN_CON_AS_PRIMERO : ORDEN_DE_ESCALERA)[posicion]
}

/**
 * How many of the thirteen places a hand already covers, for the best
 * escalera of this tipo it could still become — the measure a player (or a
 * bot) is trying to push to 13. Each comodín covers one place.
 *
 * For the tipos with a colour rule, every way the escalera could turn out is
 * tried — each pinta for the real, each colour for the color, each starting
 * colour and each end for the A for the pintada — and the best one is the
 * hand's.
 */
export function cubiertasDeEscalera(
  cards: readonly Card[],
  tipo: TipoDeEscalera,
): number {
  const comodin = cards.filter(isComodin).length
  const reales = cards.filter((card): card is NormalCard => !isComodin(card))

  const cubre = (sirve: (card: NormalCard) => boolean) => {
    const rangos = new Set(reales.filter(sirve).map((card) => card.rank))
    return Math.min(LARGO_DE_ESCALERA, rangos.size + comodin)
  }

  switch (tipo) {
    case 'sucia':
      return cubre(() => true)
    case 'real':
      return Math.max(
        ...(['spades', 'hearts', 'diamonds', 'clubs'] as const).map((suit) =>
          cubre((card) => card.suit === suit),
        ),
      )
    case 'color':
      return Math.max(
        ...(['rojo', 'negro'] as const).map((color) =>
          cubre((card) => colorDe(card.suit) === color),
        ),
      )
    case 'pintada':
      return Math.max(
        ...ORDENES.flatMap((orden) =>
          (['rojo', 'negro'] as const).map((base) =>
            cubre((card) => {
              const posicion = orden.indexOf(card.rank)
              return colorDe(card.suit) === (posicion % 2 === 0 ? base : otro(base))
            }),
          ),
        ),
      )
  }
}
