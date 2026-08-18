'use client'

import Image from 'next/image'
import { type Card, type Rank, type Suit, isComodin } from '@/lib/engine'
import { useCaraDeComodin } from '@/components/caras'
import { cn } from '@/lib/utils'

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['hearts', 'diamonds'])

/**
 * `xs` for the grupos crowding the middle of the table, `sm` for the piles,
 * `md` for the ones in your own hand.
 *
 * Each size is a CSS variable with a fallback: inside the table the variables
 * are set from the height actually available (see `.cancha` in globals.css),
 * so the cards grow and shrink with the screen; anywhere else the fallback is
 * the old fixed size. Width follows from height — a card is a shape, not two
 * numbers — and the type scales with the card so nothing has to be re-tuned
 * per size.
 */
export type TamanoDeCarta = 'xs' | 'sm' | 'md'

const TAMANOS: Record<TamanoDeCarta, string> = {
  xs: 'h-[var(--carta-xs,2.75rem)] text-[calc(var(--carta-xs,2.75rem)*0.26)]',
  sm: 'h-[var(--carta-sm,3.5rem)] text-[calc(var(--carta-sm,3.5rem)*0.22)]',
  md: 'h-[var(--carta-md,5rem)] text-[calc(var(--carta-md,5rem)*0.19)]',
}

type CartaProps = {
  card: Card
  /**
   * For a comodín inside an escala: the rank it stands for. Passing it renders
   * the binding on the card itself, so the positional rule is visible rather
   * than implied.
   */
  represents?: Rank
  size?: TamanoDeCarta
  className?: string
}

/**
 * A card face is drawn like a real card's: the rank in the top-left corner
 * with its pinta directly underneath, mirrored in the opposite corner, and a
 * decorative pip in the middle. The corner is the point — a fanned hand only
 * shows each card's left edge, and that edge has to identify the card on its
 * own for the fan to be worth tightening.
 *
 * A card face does not follow the theme: it is a physical object under the
 * table's light. It does follow the *deck* — light faces by default, or the
 * dark deck via `.cartas-oscuras` — because which cards you like holding is a
 * preference about the object, chosen on the setup screen, not about the UI.
 */
export function Carta({ card, represents, size = 'md', className }: CartaProps) {
  // The face this comodín wears this ronda, when a provider dealt one.
  // Called before the branch because hooks are; null for every normal card.
  const cara = useCaraDeComodin(card.id)

  // Colours come from variables so the deck can be reskinned by an ancestor
  // class: `.cartas-oscuras` (globals.css) turns the faces near-black with
  // light pips, for the players who prefer the dark deck. The fallbacks are
  // the light deck.
  const base = `relative ${TAMANOS[size]} aspect-[8/11] shrink-0 rounded-md border border-[var(--carta-borde,#d6d3d1cc)] bg-[var(--carta-fondo,#cbc7c3)] leading-none shadow-sm select-none`

  if (isComodin(card)) {
    return (
      <div
        className={cn(
          base,
          'overflow-hidden border-dashed border-[var(--carta-comodin-borde,#a78bfa99)] bg-linear-to-br from-violet-500/15 to-fuchsia-500/15 text-[var(--carta-comodin,#6d28d9)]',
          className,
        )}
        title={represents ? `Comodín valiendo ${represents}` : 'Comodín'}
      >
        {cara && (
          // The photo is the whole face; the corners stay on top, on a scrim,
          // because a fanned comodín is still identified by its left edge.
          <Image
            src={cara}
            alt=""
            fill
            sizes="160px"
            className="object-cover"
            draggable={false}
          />
        )}
        <Esquina
          arriba="★"
          abajo={represents}
          className={cara ? ESQUINA_SOBRE_FOTO : undefined}
        />
        {!cara && (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-[1.5em]"
          >
            ☺
          </span>
        )}
        <Esquina
          arriba="★"
          abajo={represents}
          rotada
          className={cara ? ESQUINA_SOBRE_FOTO : undefined}
        />
      </div>
    )
  }

  const red = RED_SUITS.has(card.suit)
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      className={cn(
        base,
        red
          ? 'text-[var(--carta-roja,#dc2626)]'
          : 'text-[var(--carta-tinta,#1c1917)]',
        className,
      )}
      title={`${card.rank}${symbol}`}
    >
      <Esquina arriba={card.rank} abajo={symbol} />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-[1.5em]"
      >
        {symbol}
      </span>
      <Esquina arriba={card.rank} abajo={symbol} rotada />
    </div>
  )
}

/** Corner legibility over a photo: a small scrim, whatever the picture. */
const ESQUINA_SOBRE_FOTO =
  'rounded-[0.25em] bg-black/55 px-[0.14em] py-[0.08em] text-stone-200'

/**
 * A corner index: rank on top, pinta right under it, the way a real card is
 * printed. The mirrored copy sits in the far corner so the card reads from
 * either way up.
 */
function Esquina({
  arriba,
  abajo,
  rotada,
  className,
}: {
  arriba: string
  abajo?: string
  rotada?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'absolute flex flex-col items-center gap-[0.08em] font-semibold tabular-nums',
        rotada
          ? 'right-[0.2em] bottom-[0.22em] rotate-180'
          : 'top-[0.22em] left-[0.2em]',
        className,
      )}
    >
      <span>{arriba}</span>
      {abajo && <span className="text-[0.85em]">{abajo}</span>}
    </span>
  )
}

/** Face-down card, for the stock and for other players' hands. */
export function CartaBocaAbajo({
  size = 'md',
  className,
}: {
  size?: TamanoDeCarta
  className?: string
}) {
  return (
    <div
      className={cn(
        TAMANOS[size],
        'aspect-[8/11] shrink-0 rounded-md border border-red-950/80 bg-linear-to-br from-red-900 to-red-950 shadow-sm',
        className,
      )}
      aria-label="Carta boca abajo"
    />
  )
}
