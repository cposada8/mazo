import { type Card, type Rank, type Suit, isComodin } from '@/lib/engine'
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
 * table's light, and it stays the most legible thing on the screen — white,
 * in a dark room, in either theme.
 */
export function Carta({ card, represents, size = 'md', className }: CartaProps) {
  const base = `relative ${TAMANOS[size]} aspect-[8/11] shrink-0 rounded-md border border-stone-300/80 bg-stone-50 leading-none shadow-sm select-none`

  if (isComodin(card)) {
    return (
      <div
        className={cn(
          base,
          'border-dashed border-violet-400/60 bg-linear-to-br from-violet-500/15 to-fuchsia-500/15 text-violet-700',
          className,
        )}
        title={represents ? `Comodín valiendo ${represents}` : 'Comodín'}
      >
        <Esquina arriba="★" abajo={represents} />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[1.5em]"
        >
          ☺
        </span>
        <Esquina arriba="★" abajo={represents} rotada />
      </div>
    )
  }

  const red = RED_SUITS.has(card.suit)
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      className={cn(base, red ? 'text-red-600' : 'text-stone-900', className)}
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

/**
 * A corner index: rank on top, pinta right under it, the way a real card is
 * printed. The mirrored copy sits in the far corner so the card reads from
 * either way up.
 */
function Esquina({
  arriba,
  abajo,
  rotada,
}: {
  arriba: string
  abajo?: string
  rotada?: boolean
}) {
  return (
    <span
      className={cn(
        'absolute flex flex-col items-center gap-[0.08em] font-semibold tabular-nums',
        rotada
          ? 'right-[0.2em] bottom-[0.22em] rotate-180'
          : 'top-[0.22em] left-[0.2em]',
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
