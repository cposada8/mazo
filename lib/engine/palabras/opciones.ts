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
/** Any number of words may be typed instead (Phase 87): one to a hundred. */
export const MIN_PALABRAS = 1
export const MAX_PALABRAS = 100

/**
 * What a missed word adds in «Palabras límite» (Phase 94): the host's to
 * choose, in whole minutes. 2 is the default (the owner); 0 is «sin castigo».
 */
export const OPCIONES_DE_CASTIGO = [0, 1, 2, 3, 5] as const
export const CASTIGO_POR_DEFECTO = 2
export const MIN_CASTIGO = 0
export const MAX_CASTIGO = 10
export function esMinutosDeCastigo(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= MIN_CASTIGO && (valor as number) <= MAX_CASTIGO
}

/**
 * How long «Palabras límite» waits for the rest after the first finish
 * (Phase 95), in minutes: 0 is «sin límite», the default (the owner) — the
 * race waits for everyone. Shortcuts, and 1–120 typed.
 */
export const OPCIONES_DE_ESPERA = [0, 5, 10, 15, 30, 60] as const
export const ESPERA_POR_DEFECTO = 0
export const MAX_ESPERA = 120
export function esMinutosDeEspera(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= 0 && (valor as number) <= MAX_ESPERA
}

/** Two ways to race (Phase 89): n words against the clock, or x minutes for the most words. */
export const MODOS = ['palabras', 'tiempo'] as const
export type Modo = (typeof MODOS)[number]
export function modoValido(valor: unknown): Modo {
  return valor === 'tiempo' ? 'tiempo' : 'palabras'
}

/** The time mode's minutes: shortcuts, the default, and what may be typed. */
export const OPCIONES_DE_MINUTOS = [3, 5, 10, 15] as const
export const MINUTOS_POR_DEFECTO = 5
export const MIN_MINUTOS = 1
export const MAX_MINUTOS = 60
export function esNumeroDeMinutos(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= MIN_MINUTOS && (valor as number) <= MAX_MINUTOS
}

/**
 * Lives in the time mode (Phase 90): a missed word costs one. The host picks
 * 1 to 5, or 0 for «sin vidas».
 */
export const OPCIONES_DE_VIDAS = [1, 2, 3, 4, 5, 0] as const
export const VIDAS_POR_DEFECTO = 3
export function esNumeroDeVidas(valor: unknown): valor is number {
  return (OPCIONES_DE_VIDAS as readonly unknown[]).includes(valor)
}

/** A number of words the lobby accepts: a whole number from 1 to 100. */
export function esNumeroDePalabras(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= MIN_PALABRAS && (valor as number) <= MAX_PALABRAS
}
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
