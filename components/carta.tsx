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
  xs: 'h-[var(--carta-xs,2.75rem)] text-[calc(var(--carta-xs,2.75rem)*0.22)] p-[0.2em]',
  sm: 'h-[var(--carta-sm,3.5rem)] text-[calc(var(--carta-sm,3.5rem)*0.21)] p-[0.3em]',
  md: 'h-[var(--carta-md,5rem)] text-[calc(var(--carta-md,5rem)*0.175)] p-[0.4em]',
}

const SIMBOLO: Record<TamanoDeCarta, string> = {
  xs: 'text-[1.1em]',
  sm: 'text-[1.15em]',
  md: 'text-[1.4em]',
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

export function Carta({ card, represents, size = 'md', className }: CartaProps) {
  const base = `flex ${TAMANOS[size]} aspect-[8/11] shrink-0 flex-col justify-between rounded-md border leading-none shadow-sm select-none`

  if (isComodin(card)) {
    return (
      <div
        className={cn(
          base,
          'border-dashed bg-linear-to-br from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-300',
          className,
        )}
        title={represents ? `Comodín valiendo ${represents}` : 'Comodín'}
      >
        <span className="font-semibold">★</span>
        <span className={cn('self-center', SIMBOLO[size])}>☺</span>
        <span className="self-end text-[0.9em] font-medium tabular-nums">
          {represents ?? ''}
        </span>
      </div>
    )
  }

  const red = RED_SUITS.has(card.suit)
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      className={cn(
        base,
        'bg-card',
        red ? 'text-red-600 dark:text-red-400' : 'text-foreground',
        className,
      )}
      title={`${card.rank}${symbol}`}
    >
      <span className="font-semibold tabular-nums">{card.rank}</span>
      <span className={cn('self-center', SIMBOLO[size])}>{symbol}</span>
      <span className="rotate-180 self-end font-semibold tabular-nums">
        {card.rank}
      </span>
    </div>
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
        'aspect-[8/11] shrink-0 rounded-md border bg-linear-to-br from-slate-600 to-slate-800 shadow-sm',
        className,
      )}
      aria-label="Carta boca abajo"
    />
  )
}
