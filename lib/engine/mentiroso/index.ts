/**
 * The Mentiroso engine (Phase 76), built on the shared half (`../comun`).
 *
 * Imported by its own path, `@/lib/engine/mentiroso` — never through
 * `@/lib/engine`, which is Carioca's — so two games' names cannot collide.
 * The rules it enforces are `specs/mentiroso-rules.md`.
 */

export * from './partida'
export * from './vista'
