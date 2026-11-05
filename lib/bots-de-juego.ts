/**
 * Which bots each game seats (Phase 78) — apart from `lib/juegos.ts` so that
 * the door, which only names the games, does not download every bot.
 */

import { BOTS, BOT_POR_DEFECTO, botPorId } from '@/lib/bots'
import { BOTS_MENTIROSO, EL_EMBUSTERO } from '@/lib/bots/mentiroso'
import type { Juego } from '@/lib/juegos'

/** What the lobby shows of a bot it can seat. */
export type BotDeJuego = {
  readonly id: string
  readonly nombre: string
  readonly descripcion: string
  /** Carioca's bots have a level (Phase 57); el Mentiroso has one bot so far. */
  readonly nivel?: string
}

export function botsDeJuego(juego: Juego): readonly BotDeJuego[] {
  return juego === 'mentiroso' ? BOTS_MENTIROSO : BOTS
}

/** The bot a seat gets when nobody chose: each game's default. */
export function botPorDefecto(juego: Juego): BotDeJuego {
  return juego === 'mentiroso' ? EL_EMBUSTERO : BOT_POR_DEFECTO
}

/** A stored or requested id, as a bot of this game; unknown means the default. */
export function botDeJuego(juego: Juego, id: string | null | undefined): BotDeJuego {
  if (juego === 'mentiroso') {
    return BOTS_MENTIROSO.find((bot) => bot.id === id) ?? EL_EMBUSTERO
  }
  return botPorId(id)
}
