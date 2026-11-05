/**
 * What a Mentiroso bot is (Phase 77).
 *
 * The lobby needs the same three things as for Carioca — an id, a name, a
 * line — and the game asks two questions, one per phase of a turn: what to
 * put on the pile when it is this seat's turn, and whether to call the play
 * in the window. Both are answered from the seat's view and nothing else, so
 * a bot plays the same in the browser and on the server, and never knows
 * more than the person in its seat would.
 */

import type { VistaMentiroso } from '@/lib/engine/mentiroso'

export type BotMentiroso = {
  /** Stable across releases: it is stored with the partida. */
  readonly id: string
  readonly nombre: string
  /** One line, shown where the host seats it. Said as a player would say it. */
  readonly descripcion: string
  /** The ids of 1–4 cards from the hand, when it is this seat's turn to play. */
  jugar(vista: VistaMentiroso): readonly string[]
  /** «¡Mentiroso!» on the play in the window? Never asked about its own. */
  acusar(vista: VistaMentiroso): boolean
}
