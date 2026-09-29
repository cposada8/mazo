/**
 * What a bot is.
 *
 * Three things the lobby needs — an id it is seated by, a name, and a line
 * describing how it plays — and one thing the game needs: a legal move for
 * the seat in turn, decided from that seat's view and nothing else.
 *
 * The type lives on its own so that a bot file imports it without importing
 * another bot.
 */

import { type Move, type VistaDeAsiento } from '@/lib/engine'
import type { Relato } from '@/lib/relato'

/**
 * How strong a bot plays (Phase 57). The owner's decision: the first three
 * bots stay as they were, as *Fácil*; stronger play comes as new bots.
 */
export type Nivel = 'facil' | 'normal' | 'dificil'

export const NOMBRE_DE_NIVEL: Record<Nivel, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

export type Bot = {
  /** Stable across releases: it is stored with the partida. */
  readonly id: string
  readonly nombre: string
  readonly nivel: Nivel
  /** One line, shown where the host seats it. Said as a player would say it. */
  readonly descripcion: string
  /**
   * One legal move for the seat whose turn it is, decided from its view — and,
   * for a bot that remembers (Phase 55), the ronda's relatos: what everybody
   * at the table watched happen. A bot that ignores them plays as before.
   */
  decidir(vista: VistaDeAsiento, relatos?: readonly Relato[]): Move
}
