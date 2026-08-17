/**
 * Where everyone sits around the table.
 *
 * Pure geometry, no React: given how many are playing and which seat is yours,
 * this says where each one goes as a percentage of the table box. The component
 * places them; this decides where.
 *
 * You are always at the bottom, because your hand is there and a player's own
 * cards are the one fixed point on the screen. Everyone else is spread along
 * the arc above, **in turn order, starting on your left** — the player who goes
 * after you is the one on your left, exactly as at a real table.
 */

/** The arc the opponents occupy, in degrees. 180 is due left, 270 straight up. */
const DESDE = 200
const HASTA = 340

/** Half-width and half-height of the ellipse the seats sit on, in percent. */
const RADIO_X = 44
const RADIO_Y = 27
/**
 * Centre of that ellipse. Above the middle, because the bottom belongs to your
 * hand — and not so high that the seat at the top has its cards cropped off.
 */
const CENTRO_X = 50
const CENTRO_Y = 45

export type Asiento = {
  readonly seat: number
  /** Percent of the table box, for `left` and `top`. */
  readonly x: number
  readonly y: number
  /** Turns until this player plays after you. 0 is you. */
  readonly vuelta: number
}

/**
 * Every seat but yours, left to right, in turn order.
 *
 * With one opponent there is no arc to spread: they go straight across from
 * you, which is what two people at a table actually do.
 */
export function asientosRivales(jugadores: number, tuyo: number): Asiento[] {
  if (!Number.isInteger(jugadores) || jugadores < 2) {
    throw new Error(`a table seats at least 2, got ${jugadores}`)
  }

  const rivales = jugadores - 1
  const paso = rivales > 1 ? (HASTA - DESDE) / (rivales - 1) : 0

  return Array.from({ length: rivales }, (_, i) => {
    const grados = rivales > 1 ? DESDE + i * paso : (DESDE + HASTA) / 2
    const radianes = (grados * Math.PI) / 180

    return {
      seat: (tuyo + 1 + i) % jugadores,
      x: redondear(CENTRO_X + RADIO_X * Math.cos(radianes)),
      y: redondear(CENTRO_Y + RADIO_Y * Math.sin(radianes)),
      vuelta: i + 1,
    }
  })
}

/** Two decimals is far past what a percentage on screen can show. */
const redondear = (n: number): number => Math.round(n * 100) / 100
