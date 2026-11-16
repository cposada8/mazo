/**
 * The Palabras engine (Phase 83): Wordle in Spanish, as a race.
 *
 * Imported by its own path, `@/lib/engine/palabras`, never through
 * `@/lib/engine`. It holds the answers, so **only the server imports it**;
 * the board imports types from here with `import type`, which ships nothing.
 * The rules it enforces are `specs/palabras-rules.md`.
 */

export * from './partida'
export * from './vista'
