/**
 * What every card game on Mazo shares (Phase 75): cards and the rank ring,
 * the seeded random stream, card notation, and building a deck.
 *
 * Pure TypeScript, like the games built on it, and it imports nothing from
 * any of them: a game depends on this, never the other way round.
 */

export * from './baraja'
export * from './cards'
export * from './notacion'
export * from './random'
