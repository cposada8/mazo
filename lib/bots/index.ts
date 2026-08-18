/**
 * Bots.
 *
 * Everything here is a *client* of the engine: it reads a state and proposes a
 * move. The engine still decides what is legal, so a bug in a bot can produce a
 * refused move but never an illegal game.
 *
 * A bot is one file: a `Perfil` answering the three questions that are
 * character, and a `Bot` naming it for the lobby. The turn around those answers
 * and the vocabulary they are answered in are shared, so that personalities
 * differ in judgement and never in what they can see.
 */

export * from './agrupar'
export * from './bot'
export * from './catalogo'
export * from './codicioso'
export * from './evaluar'
export * from './memorioso'
export * from './mesa'
export * from './paciente'
export * from './perfil'
export * from './turno'
