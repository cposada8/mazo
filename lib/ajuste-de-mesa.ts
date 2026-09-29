/**
 * How big the mesa's cards can be and still show every grupo (Phase 46).
 *
 * Phase 45 shrank the cards in fixed steps by grupo count, which was a guess
 * about the space rather than a measurement of it: on a real phone, eighteen
 * grupos still overflowed the lane and the top row slid under the seats. So
 * the lane is measured, and this answers the one question that matters —
 * the largest card height at which every grupo fits, wrapped into rows —
 * with nothing dropped, paged or scrolled.
 *
 * Pure geometry, in pixels, so it is tested without a browser.
 */

/** A card is 8 wide by 11 tall (components/carta.tsx). */
export const PROPORCION_DE_CARTA = 8 / 11

/**
 * How much of each card a grupo shows past the one before it, as a fraction
 * of the card's height: the corner index — rank and pinta — and no more. A
 * «10» is the widest corner there is, and this is what it needs.
 */
export const ASOMA = 0.36

/** Space between grupos, and between rows, as a fraction of card height. */
export const HUECO = 0.14

/** How wide a grupo of `cartas` cards is, for cards `alto` pixels tall. */
export function anchoDeGrupo(cartas: number, alto: number): number {
  return alto * (PROPORCION_DE_CARTA + Math.max(0, cartas - 1) * ASOMA)
}

/**
 * Whether grupos of these sizes fit a `ancho` × `alto` box at card height
 * `carta`, filling rows left to right the way `flex-wrap` does.
 */
export function cabe(
  grupos: readonly number[],
  ancho: number,
  alto: number,
  carta: number,
): boolean {
  const hueco = carta * HUECO
  let filas = 1
  let usado = 0

  for (const cartas of grupos) {
    const w = anchoDeGrupo(cartas, carta)
    if (w > ancho) return false
    if (usado > 0 && usado + hueco + w > ancho) {
      filas++
      usado = w
    } else {
      usado += (usado > 0 ? hueco : 0) + w
    }
  }

  return filas * carta + (filas - 1) * hueco <= alto
}

/**
 * The largest card height, between `minimo` and `maximo`, at which every
 * grupo fits. Never below `minimo`: a card has to stay a card a person can
 * read, and past that point the lane scrolls rather than the cards vanishing.
 */
export function alturaDeCartaEnMesa({
  grupos,
  ancho,
  alto,
  minimo,
  maximo,
}: {
  /** How many cards each grupo holds, in the order they are drawn. */
  grupos: readonly number[]
  ancho: number
  alto: number
  minimo: number
  maximo: number
}): number {
  if (ancho <= 0 || alto <= 0) return maximo
  for (let carta = Math.floor(maximo); carta > minimo; carta--) {
    if (cabe(grupos, ancho, alto, carta)) return carta
  }
  return minimo
}

/**
 * How much each card in your hand hides of the one before it, in pixels, so
 * the whole hand fits the width it has (Phase 46).
 *
 * A hand used to overlap by a fixed amount and scroll when it ran out of
 * room, so thirteen cards on a phone lying down hid the last three off the
 * right edge. A card table fans tighter instead: the overlap grows until the
 * hand fits — but never past the point where a card's corner, its whole
 * identity in a fan, stops showing. Past that, the row scrolls again.
 */
export function solapeDeMano({
  cartas,
  bloques,
  ancho,
  alto,
  separacion,
}: {
  /** Cards in the hand, all bloques together. */
  cartas: number
  /** How many separate runs the hand is drawn in (pinned bloques + loose). */
  bloques: number
  /** The width the hand may use, in pixels. */
  ancho: number
  /** A hand card's height, in pixels. */
  alto: number
  /** The gap between bloques, in pixels. */
  separacion: number
}): number {
  const carta = alto * PROPORCION_DE_CARTA
  const holgado = alto * 0.34
  const apretado = carta - alto * 0.3
  const pasos = cartas - bloques
  if (ancho <= 0 || alto <= 0 || pasos <= 0) return holgado

  const visible = (ancho - bloques * carta - (bloques - 1) * separacion) / pasos
  return Math.min(apretado, Math.max(holgado, carta - visible))
}
