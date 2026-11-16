/**
 * The games on Mazo (Phase 78), and what the platform needs to know about
 * each one: its name, how many seats it takes, and which bots it can seat.
 *
 * The rules themselves are each game's engine. This is only what the door,
 * the lobby and the server ask before a partida is dealt — and it is light on
 * purpose: the door imports it, and must not pull every bot in with it.
 * Which bots each game seats is `lib/bots-de-juego.ts`.
 */

import { MAX_PLAYERS, MIN_PLAYERS } from '@/lib/engine'
import { MAX_JUGADORES, MIN_JUGADORES } from '@/lib/engine/mentiroso'
// By its own path: Palabras' engine holds the answers, and the door must not.
import * as palabras from '@/lib/engine/palabras/opciones'

const ASIENTOS_PALABRAS = { min: palabras.MIN_JUGADORES, max: palabras.MAX_JUGADORES }

export const JUEGOS = ['carioca', 'mentiroso', 'palabras'] as const
export type Juego = (typeof JUEGOS)[number]

/** Anything that is not a known game is Carioca: every old row, every old client. */
export function juegoDe(valor: unknown): Juego {
  return JUEGOS.includes(valor as Juego) ? (valor as Juego) : 'carioca'
}

export const NOMBRE_DE_JUEGO: Record<Juego, string> = {
  carioca: 'Carioca',
  mentiroso: 'Mentiroso',
  palabras: 'Palabras',
}

/** One line for the door, said as a player would say it. */
export const DESCRIPCION_DE_JUEGO: Record<Juego, string> = {
  carioca: 'Bajar los contratos, ronda tras ronda.',
  mentiroso: 'Botar cartas boca abajo y que no te pillen.',
  palabras: 'Adivinar las mismas palabras que los demás, antes que ellos.',
}

export const ASIENTOS: Record<Juego, { min: number; max: number }> = {
  carioca: { min: MIN_PLAYERS, max: MAX_PLAYERS },
  mentiroso: { min: MIN_JUGADORES, max: MAX_JUGADORES },
  palabras: ASIENTOS_PALABRAS,
}

/** A game with bots to seat. Palabras has none (`palabras-rules.md`). */
export function tieneBots(juego: Juego): boolean {
  return juego !== 'palabras'
}
