import { type Card, type Rank, type Suit, isComodin } from '@/lib/engine'
import { cn } from '@/lib/utils'

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['hearts', 'diamonds'])

type CartaProps = {
  card: Card
  /**
   * For a comodín inside an escala: the rank it stands for. Passing it renders
   * the binding on the card itself, so the positional rule is visible rather
   * than implied.
   */
  represents?: Rank
  className?: string
}

export function Carta({ card, represents, className }: CartaProps) {
  const base =
    'flex h-20 w-14 shrink-0 flex-col justify-between rounded-md border p-1.5 text-sm leading-none shadow-sm select-none'

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
        <span className="self-center text-lg">☺</span>
        <span className="self-end text-[10px] font-medium tabular-nums">
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
      <span className="self-center text-xl">{symbol}</span>
      <span className="rotate-180 self-end font-semibold tabular-nums">
        {card.rank}
      </span>
    </div>
  )
}

/** Face-down card, for the stock. */
export function CartaBocaAbajo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-20 w-14 shrink-0 rounded-md border bg-linear-to-br from-slate-600 to-slate-800 shadow-sm',
        className,
      )}
      aria-label="Carta boca abajo"
    />
  )
}
