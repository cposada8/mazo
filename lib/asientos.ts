/**
 * Where everyone sits around the table.
 *
 * Pure geometry, no React: given how many are playing and which seat is yours,
 * this says where each one goes as a percentage of the **seat band** — the
 * strip of screen that belongs to the opponents and to nobody else. The
 * component places them; this decides where.
 *
 * The band exists so that lanes cannot collide: seats own this strip, the mesa
 * owns the one below it, your hand owns the bottom, and no lane may borrow
 * from its neighbour. Inside the band the seats still sit on an arc — edge
 * seats a little lower, the far seat at the top — which is what keeps the row
 * reading as a table rather than as a toolbar.
 *
 * You are always at the bottom, because your hand is there and a player's own
 * cards are the one fixed point on the screen. Everyone else is spread along
 * the band **in turn order, starting on your left** — the player who goes
 * after you is the one on your left, exactly as at a real table.
 */

/**
 * Horizontal margin before the first seat, by how many rivals share the band.
 * Fewer rivals sit closer to the centre, the way people actually spread out.
 */
const MARGEN = [0, 50, 28, 18, 13, 10] as const

/**
 * How far below the band's top an edge seat sits, in percent of the band.
 * Kept shallow on purpose: a seat is nearly as tall as the band it lives in,
 * so a deep arc would hang the edge seats out of their lane and into the
 * mesa's — the exact collision the lanes exist to prevent.
 */
const ARCO = 14

export type Asiento = {
  readonly seat: number
  /** Percent of the seat band, for `left` (centre) and `top` (anchor). */
  readonly x: number
  readonly y: number
  /** Turns until this player plays after you. 0 is you. */
  readonly vuelta: number
}

/**
 * Every seat but yours, left to right, in turn order.
 *
 * With one opponent there is no row to spread: they go straight across from
 * you, which is what two people at a table actually do.
 */
export function asientosRivales(jugadores: number, tuyo: number): Asiento[] {
  if (!Number.isInteger(jugadores) || jugadores < 2) {
    throw new Error(`a table seats at least 2, got ${jugadores}`)
  }

  const rivales = jugadores - 1
  const margen = MARGEN[Math.min(rivales, MARGEN.length - 1)]
  const paso = rivales > 1 ? (100 - 2 * margen) / (rivales - 1) : 0

  return Array.from({ length: rivales }, (_, i) => {
    const x = margen + i * paso

    return {
      seat: (tuyo + 1 + i) % jugadores,
      x: redondear(x),
      // A parabola on the distance from centre: the far seat at the top of the
      // band, edge seats dropping toward the table's rim.
      y: redondear(ARCO * ((x - 50) / 40) ** 2),
      vuelta: i + 1,
    }
  })
}

/** Two decimals is far past what a percentage on screen can show. */
const redondear = (n: number): number => Math.round(n * 100) / 100
