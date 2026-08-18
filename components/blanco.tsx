'use client'

/**
 * How bright the white is (Phase 43).
 *
 * The owner tuned it at night, over a run of commits, and the result is right
 * in the dark and too dim in daylight — turn it up and the lamp is back in
 * your face after sunset. That is not something a theme can decide: what
 * changes is the room, not the hour, and the phone is in a different room
 * every time. So it is a control, and the person holding the phone owns it.
 *
 * One number reaches every white: `--blanco` (globals.css) is the lightness
 * of the brightest ink, and text, card pips, buttons, borders and the marks
 * on the felt are all written as a distance from it.
 */

import { Sun } from 'lucide-react'
import { useCallback, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const CLAVE = 'mazo:blanco'

/** The value the owner settled on at night, and the default for a first visit. */
export const BLANCO_POR_DEFECTO = 0.79
/**
 * The ends of the slider. The bottom still clears the contrast the darkest
 * ink needs against a near-black ground; the top stops short of pure white on
 * the felt, which is the lamp the whole palette was tuned to avoid.
 */
export const BLANCO_MINIMO = 0.72
export const BLANCO_MAXIMO = 0.94
export const BLANCO_PASO = 0.02

/** Clamp anything that arrives — a hand-edited value, an old key, a typo. */
export function acotarBlanco(valor: number): number {
  if (!Number.isFinite(valor)) return BLANCO_POR_DEFECTO
  return Math.min(BLANCO_MAXIMO, Math.max(BLANCO_MINIMO, valor))
}

/**
 * The script that runs before the first paint, so a reload does not flash the
 * default white before the chosen one lands. Same discipline as the theme
 * class, and the same reason: this is paint, and paint arrives with the page.
 */
export const GUION_DEL_BLANCO = `try{var b=parseFloat(localStorage.getItem('${CLAVE}'));if(b>=${BLANCO_MINIMO}&&b<=${BLANCO_MAXIMO})document.documentElement.style.setProperty('--blanco',String(b))}catch(e){}`

function leer(): number {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo === null ? BLANCO_POR_DEFECTO : acotarBlanco(Number.parseFloat(crudo))
  } catch {
    return BLANCO_POR_DEFECTO
  }
}

/**
 * The document is the store: the value lives on `<html>`, where the CSS reads
 * it, and localStorage is only how it survives the tab. One module-level copy
 * so every control on screen agrees.
 */
let vigente: number | null = null
const oyentes = new Set<() => void>()

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

function ahora(): number {
  if (vigente === null) vigente = leer()
  return vigente
}

export function fijarBlanco(valor: number) {
  const acotado = acotarBlanco(valor)
  vigente = acotado
  document.documentElement.style.setProperty('--blanco', String(acotado))
  try {
    localStorage.setItem(CLAVE, String(acotado))
  } catch {
    // Storage refused: the choice still holds for this tab, which is where
    // the eyes complaining about it are.
  }
  for (const oyente of oyentes) oyente()
}

export function useBlanco(): [number, (valor: number) => void] {
  const valor = useSyncExternalStore(suscribir, ahora, () => BLANCO_POR_DEFECTO)
  return [valor, useCallback((nuevo: number) => fijarBlanco(nuevo), [])]
}

/**
 * The control itself: a slider, because the question it answers is "a bit
 * more" and not "which of these". Wherever it is drawn it moves the same
 * number, so the copy in the game's menu and the copy beside the theme
 * switcher cannot disagree.
 */
export function ControlDeBlanco({
  className,
  etiqueta = 'Brillo del blanco',
}: {
  className?: string
  etiqueta?: string
}) {
  const [blanco, cambiar] = useBlanco()

  return (
    <label
      className={cn('flex items-center gap-2', className)}
      title={etiqueta}
    >
      <Sun className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="sr-only">{etiqueta}</span>
      <input
        type="range"
        min={BLANCO_MINIMO}
        max={BLANCO_MAXIMO}
        step={BLANCO_PASO}
        value={blanco}
        aria-label={etiqueta}
        onChange={(evento) => cambiar(Number.parseFloat(evento.target.value))}
        className="accent-primary h-4 w-full min-w-16 cursor-pointer"
      />
    </label>
  )
}
