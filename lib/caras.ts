/**
 * Which face each comodín wears this ronda.
 *
 * Paint, not a rule: the engine neither knows nor cares what a comodín looks
 * like, so this lives beside the UI. The faces still come from the partida's
 * seed — like the deal, like the drawn opening seat — so replaying a seed
 * replays its comodines, and two people looking at the same ronda see the
 * same cards.
 *
 * Each ronda shuffles the gallery and deals one face per comodín, so the four
 * differ from each other whenever there are four images to go around, and the
 * next ronda deals different ones. The gallery itself is whatever the server
 * found in `public/candidatos/comodines` at build time — pruning that folder
 * is curation, not a code change.
 */

import { buildDeck, createRng, isComodin, shuffle } from '@/lib/engine'

/** The four comodines have fixed ids — the deck is deterministic on purpose. */
const IDS_DE_COMODINES = buildDeck({ comodines: true })
  .filter(isComodin)
  .map((card) => card.id)

/**
 * The face for each comodín id, for one ronda. Empty when there is no gallery,
 * and the card falls back to its drawn ★ design.
 */
export function carasDeRonda(options: {
  imagenes: readonly string[]
  seed: string
  /** Index of the ronda in the partida, so each one deals new faces. */
  ronda: number
}): ReadonlyMap<string, string> {
  const { imagenes, seed, ronda } = options
  if (imagenes.length === 0) return new Map()

  const rng = createRng(`${seed}#caras#${ronda}`)
  const barajadas = shuffle(imagenes, rng)

  return new Map(
    IDS_DE_COMODINES.map((id, i) => [id, barajadas[i % barajadas.length]]),
  )
}
