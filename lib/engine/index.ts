/**
 * `@/lib/engine`: Carioca, and the shared half it is built on.
 *
 * Since Phase 75 the engine is two halves — `comun/`, what any card game on
 * Mazo shares, and one folder per game. This entry point stays what it always
 * was, the Carioca engine, so nothing that imports it had to change. Another
 * game is imported by its own folder (`@/lib/engine/mentiroso`), never from
 * here, so two games' names can never collide.
 */

export * from './comun'
export * from './carioca'
