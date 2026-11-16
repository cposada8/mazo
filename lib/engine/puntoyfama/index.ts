/**
 * The Punto y Fama engine (Phase 100): numbers of n digits, puntos and
 * famas, the two races on the shared one, the duel, and the bot that
 * guesses your number. Imported by its own path, `@/lib/engine/puntoyfama`;
 * the board imports types from here and the lobby imports `./opciones`.
 * The rules are `specs/punto-y-fama-rules.md`.
 */

export * from './bot'
export * from './duelo'
export * from './numeros'
export * from './opciones'
export * from './partida'
export * from './vista'
