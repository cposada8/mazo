/**
 * Las escaleras (Phase 48): the thirteen rangos, 2 through A, laid down whole.
 *
 * An escalera is not a bigger escala. It is every rango exactly once, read in
 * the fixed order 2 → A (not around the ring an escala uses), and laying one
 * down takes the whole hand — so it wins the ronda in the same move. The four
 * levels differ only in what colour or pinta each card must be:
 *
 * | Tipo | Besides one of every rango |
 * | --- | --- |
 * | sucia | nothing |
 * | pintada | colours alternate along 2 → A; either colour may start |
 * | color | all red (♥ ♦) or all black (♠ ♣) |
 * | real | all one pinta |
 *
 * At most one comodín, as in every bajada (carioca-rules.md). It stands for
 * the one rango missing, and takes whatever colour or pinta its place calls
 * for — so it never breaks an alternation or a colour, it only fills a gap.
 */

import { type Card, type NormalCard, type Rank, type Suit, isComodin } from './cards'

export type TipoDeEscalera = 'sucia' | 'pintada' | 'color' | 'real'

/** The order an escalera is read in: 2 first, A last. Not the escala's ring. */
export const ORDEN_DE_ESCALERA: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
]

export const LARGO_DE_ESCALERA = ORDEN_DE_ESCALERA.length // 13

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
  | 'COMODINES'
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
 * so the cards are placed by rango, and the one comodín, if any, goes where
 * the missing rango would.
 */
export function ordenarEscalera(
  cards: readonly Card[],
  tipo: TipoDeEscalera,
): EscaleraCheck {
  if (cards.length !== LARGO_DE_ESCALERA) {
    return fail('LARGO', `an escalera is ${LARGO_DE_ESCALERA} cards, got ${cards.length}`)
  }

  const comodines = cards.filter(isComodin)
  if (comodines.length > 1) {
    return fail('COMODINES', `at most one comodín at lay-down, got ${comodines.length}`)
  }

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

  const ordenadas: Card[] = ORDEN_DE_ESCALERA.map(
    (rank) => porRango.get(rank) ?? comodines[0],
  )

  const reales = ordenadas
    .map((card, posicion) => ({ card, posicion }))
    .filter((entrada): entrada is { card: NormalCard; posicion: number } =>
      !isComodin(entrada.card),
    )

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
export function rangoDeEscaleraEn(posicion: number): Rank {
  return ORDEN_DE_ESCALERA[posicion]
}

/**
 * How many of the thirteen places a hand already covers, for the best
 * escalera of this tipo it could still become — the measure a player (or a
 * bot) is trying to push to 13. A comodín covers one place.
 *
 * For the tipos with a colour rule, every way the escalera could turn out is
 * tried — each pinta for the real, each colour for the color, each starting
 * colour for the pintada — and the best one is the hand's.
 */
export function cubiertasDeEscalera(
  cards: readonly Card[],
  tipo: TipoDeEscalera,
): number {
  const comodin = cards.some(isComodin) ? 1 : 0
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
        ...(['rojo', 'negro'] as const).map((base) =>
          cubre((card) => {
            const posicion = ORDEN_DE_ESCALERA.indexOf(card.rank)
            return colorDe(card.suit) === (posicion % 2 === 0 ? base : otro(base))
          }),
        ),
      )
  }
}
