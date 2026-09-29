/**
 * Where everyone sits around the table.
 *
 * Pure geometry, no React: given how many are playing and which seat is yours,
 * this says where each one goes as a percentage of the **table zone** — all
 * of the screen above your own hand. The component places them; this decides
 * where. The seats keep to the table's rim — the far edge and, from four
 * players up, the two sides — and the mesa is measured to fit inside them, so
 * a seat and a grupo never land on the same pixels.
 *
 * You are always at the bottom, because your hand is there and a player's own
 * cards are the one fixed point on the screen. Everyone else is spread along
 * the band **in turn order, starting on your right** — Carioca goes
 * anticlockwise, so the player who goes after you sits to your right, exactly
 * as at a real table. (See "The deal and the turn" in carioca-rules.md; the
 * first version of this file had it backwards, which is why the direction is
 * now written down there.)
 */

/**
 * Where the rivals go, right to left, by how many there are (Phase 46).
 *
 * A single row across the top was fine for three and broke at five: the
 * names ran into each other and the seats became a toolbar. So the table is
 * sat the way a real one is — the two players beside you at its sides, the
 * rest along the far edge — and the sides are only used once the far edge
 * would be crowded. Each entry is a side and, for the far edge, a position
 * across it.
 */
const DISPOSICION: Record<number, readonly (Lado | number)[]> = {
  1: [50],
  2: [67, 33],
  3: ['derecha', 50, 'izquierda'],
  4: ['derecha', 64, 36, 'izquierda'],
  5: ['derecha', 72, 50, 28, 'izquierda'],
}

/** A side seat's centre: in from the edge, halfway down the table zone. */
const X_LATERAL = 6
const Y_LATERAL = 50

/** How far the ends of the far edge drop, so the row still reads as an arc. */
const ARCO = 5

export type Lado = 'izquierda' | 'arriba' | 'derecha'

export type Asiento = {
  readonly seat: number
  /**
   * Percent of the table zone — everything above your own hand. `x` is the
   * seat's centre, `y` the top of its ficha.
   */
  readonly x: number
  readonly y: number
  /** Which edge of the table the seat is on. */
  readonly lado: Lado
  /** Turns until this player plays after you. 0 is you. */
  readonly vuelta: number
}

/**
 * Every seat but yours, in turn order: right to left around the table,
 * because play runs anticlockwise and the next player sits on your right.
 *
 * With one opponent there is nothing to spread: they go straight across from
 * you, which is what two people at a table actually do.
 */
export function asientosRivales(jugadores: number, tuyo: number): Asiento[] {
  if (!Number.isInteger(jugadores) || jugadores < 2) {
    throw new Error(`a table seats at least 2, got ${jugadores}`)
  }

  const rivales = jugadores - 1
  const disposicion = DISPOSICION[Math.min(rivales, 5)]

  return Array.from({ length: rivales }, (_, i) => {
    const lugar = disposicion[i]
    const base = { seat: (tuyo + 1 + i) % jugadores, vuelta: i + 1 }

    if (lugar === 'derecha' || lugar === 'izquierda') {
      return {
        ...base,
        lado: lugar,
        x: lugar === 'derecha' ? 100 - X_LATERAL : X_LATERAL,
        y: Y_LATERAL,
      }
    }

    return {
      ...base,
      lado: 'arriba' as const,
      x: lugar as number,
      y: redondear(ARCO * ((Number(lugar) - 50) / 22) ** 2),
    }
  })
}

/** Whether anyone sits at the table's sides, which narrows the mesa. */
export function hayLados(jugadores: number): boolean {
  return jugadores - 1 >= 3
}

/** Two decimals is far past what a percentage on screen can show. */
const redondear = (n: number): number => Math.round(n * 100) / 100
