'use client'

/**
 * The bits of the retired setup screen that the table still needs (Phase 34).
 *
 * Choosing a partida's rules moved to the host's lobby, but the deck finish
 * never was a rule — it is paint, it is per-browser, and it is changed from
 * inside a partida. So it outlives the screen it was born on.
 */

/** Remembered across partidas: which deck you like holding rarely changes. */
const CLAVE_BARAJA = 'mazo:cartas-oscuras'

/** Remember the deck across partidas, from wherever it was switched. */
export function recordarBaraja(oscuras: boolean) {
  localStorage.setItem(CLAVE_BARAJA, oscuras ? 'si' : 'no')
}

/** Oscuras by default (Phase 27): only a first visit is being decided here. */
export function leerBaraja(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(CLAVE_BARAJA) !== 'no'
}

/** Whole-turn thinking times on offer. Two is the pace of a real table. */
export const SEGUNDOS = [1, 2, 3, 5] as const

export function BotonDeBaraja({
  nombre,
  activo,
  onClick,
  carta,
}: {
  nombre: string
  activo: boolean
  onClick: () => void
  /** The miniature's colours — a preview of the actual face. */
  carta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex items-center justify-center gap-2.5 rounded-md border py-2.5 text-sm transition-colors ${
        activo
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-card hover:bg-accent'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-5 flex-col items-start gap-px rounded-[3px] border pt-0.5 pl-0.5 text-[9px] leading-none font-semibold ${carta}`}
      >
        <span>A</span>
        <span>♠</span>
      </span>
      {nombre}
    </button>
  )
}
