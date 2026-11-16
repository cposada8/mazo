/**
 * Punto y Fama's numbers, apart from its engine (Phase 100): what the lobby
 * offers and what the board needs. Light, like Palabras' `opciones.ts`, so
 * the door and the lobby can import it by its own path.
 */

/** Digits per number on offer (Mazo's call, as the owner's app: 3 to 6). */
export const DIGITOS = [3, 4, 5, 6] as const
export type Digitos = (typeof DIGITOS)[number]
export const DIGITOS_POR_DEFECTO: Digitos = 4
export function sonDigitos(valor: unknown): valor is Digitos {
  return (DIGITOS as readonly unknown[]).includes(valor)
}

/** How many numbers in «Números límite»: shortcuts, the default, and what may be typed. */
export const OPCIONES_DE_NUMEROS = [3, 5, 10] as const
export const NUMEROS_POR_DEFECTO = 5
export const MIN_NUMEROS = 1
export const MAX_NUMEROS = 50
export function esNumeroDeNumeros(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= MIN_NUMEROS && (valor as number) <= MAX_NUMEROS
}

/**
 * The three ways to play. The two races are stored as the shared race's own
 * modes ('palabras' is the n-secrets race, named before there was a second
 * game); the duel is its own.
 */
export const MODOS_PF = ['palabras', 'tiempo', 'duelo'] as const
export type ModoPF = (typeof MODOS_PF)[number]
export function modoPFValido(valor: unknown): ModoPF {
  return valor === 'tiempo' || valor === 'duelo' ? valor : 'palabras'
}
export const NOMBRE_DE_MODO_PF: Record<ModoPF, string> = {
  palabras: 'Números límite',
  tiempo: 'Tiempo límite',
  duelo: 'Duelo',
}

export const MIN_JUGADORES = 1
export const MAX_JUGADORES = 8
/** A duel is exactly two. */
export const JUGADORES_DE_DUELO = 2
