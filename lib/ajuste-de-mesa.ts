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
