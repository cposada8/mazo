/**
 * Palabras' numbers, apart from its words (Phase 84): what the lobby offers
 * and what the board needs to draw a clock. Light on purpose — the lobby and
 * the board import this file by its own path, and must never download the
 * answers that `listas.ts` holds.
 */

/** Letters per word on offer (the owner, 2026-11-15: 5, 6, 7 and 8). */
export const LARGOS = [5, 6, 7, 8] as const
export type Largo = (typeof LARGOS)[number]
export const LARGO_POR_DEFECTO: Largo = 5

export const INTENTOS_POR_PALABRA = 6
/** Words in the bag on offer, and the default (`palabras-rules.md`, «The words»). */
export const OPCIONES_DE_PALABRAS = [3, 5, 10, 15, 20] as const
export const PALABRAS_POR_DEFECTO = 10
export const MIN_JUGADORES = 1
export const MAX_JUGADORES = 8
/** A missed word costs this much on the player's clock (Mazo's call). */
export const MS_CASTIGO = 2 * 60_000
/** The 3, 2, 1 before the first word opens for everybody. */
export const MS_CUENTA_ATRAS = 3_000
/** After the first player finishes, the race waits this long for the rest. */
export const MS_HASTA_CERRAR = 30 * 60_000

export function esLargo(valor: unknown): valor is Largo {
  return (LARGOS as readonly unknown[]).includes(valor)
}
