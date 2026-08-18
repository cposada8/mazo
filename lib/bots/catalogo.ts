/**
 * The bots a host can seat, in the order they are offered.
 *
 * One list, read by the lobby to show the choices and by the server to turn a
 * stored id back into a player. Adding a bot is adding its file and one line
 * here; nothing in the engine knows this list exists.
 */

import { type Bot } from './bot'
import { codicioso } from './codicioso'
import { memorioso } from './memorioso'
import { paciente } from './paciente'

export const BOTS: readonly Bot[] = [codicioso, paciente, memorioso]

/** What sits down when nobody chose: the one every other bot is measured against. */
export const BOT_POR_DEFECTO = codicioso

/**
 * The bot a partida stored, or the default.
 *
 * Never null: a partida saved with a bot that has since been renamed away must
 * still be playable, and a table that quietly gets El Codicioso is a far better
 * outcome than a seat that cannot take its turn.
 */
export function botPorId(id: string | null | undefined): Bot {
  return BOTS.find((bot) => bot.id === id) ?? BOT_POR_DEFECTO
}
