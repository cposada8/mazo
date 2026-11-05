/**
 * The Carioca engine, built on the shared half (`../comun`).
 *
 * Pure TypeScript: no React, no database, no network, and no imports from
 * anywhere else in this project. Bots, the local UI and the online server are
 * all clients of what is exported here.
 */

export * from './contratos'
export * from './deck'
export * from './escalera'
export * from './escenario'
export * from './grupos'
export * from './mesa'
export * from './partida'
export * from './puntaje'
export * from './ronda'
export * from './tiempo'
export * from './vista'
