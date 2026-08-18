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

export type Bot = {
  /** Stable across releases: it is stored with the partida. */
  readonly id: string
  readonly nombre: string
  /** One line, shown where the host seats it. Said as a player would say it. */
  readonly descripcion: string
  /** One legal move for the seat whose turn it is, decided from its view. */
  decidir(vista: VistaDeAsiento): Move
}
