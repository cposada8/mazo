/**
 * Bots.
 *
 * Everything here is a *client* of the engine: it reads a state and proposes a
 * move. The engine still decides what is legal, so a bug in a bot can produce a
 * refused move but never an illegal game.
 */

export * from './agrupar'
export * from './codicioso'
export * from './mesa'
export * from './turno'
