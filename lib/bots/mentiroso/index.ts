/**
 * Bots for el Mentiroso (Phase 77). Imported as `@/lib/bots/mentiroso`, apart
 * from Carioca's, like the engine they play.
 */

export * from './bot'
export * from './embustero'
export * from './mesa'

import { EL_EMBUSTERO } from './embustero'
import type { BotMentiroso } from './bot'

/** Every Mentiroso bot the lobby can seat, by id. */
export const BOTS_MENTIROSO: readonly BotMentiroso[] = [EL_EMBUSTERO]
