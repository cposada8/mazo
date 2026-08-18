/**
 * A bot's whole turn, decided up front.
 *
 * The clock (Phase 21) times the **turn**, not each move: a bot draws, unloads
 * and discards inside its allotted seconds, however many moves that takes.
 * To spread the moves across that time they have to be known before the first
 * one lands — which the engine makes cheap, because deciding and applying are
 * pure. The simulation here and the real applications later walk the exact
 * same states, so what was planned is what happens.
 */

import {
  type Move,
  type PartidaState,
  aplicarEnPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { botPorId } from './catalogo'

/** More moves than any legal turn can hold; a stop against a looping bot. */
const MAX_MOVES_POR_TURNO = 40

/**
 * Every move the bot at the current turn will make, in order, ending with the
 * discard that passes the turn (or the move that ends the ronda).
 *
 * `botsPorAsiento` says who is sitting where, by id (Phase 39). A seat with no
 * id — a person's, or a bot seated before there was anything to choose — reads
 * as El Codicioso, so a partida saved before this existed still plays.
 */
export function movesDelTurno(
  partida: PartidaState,
  botsPorAsiento?: readonly (string | null | undefined)[],
): Move[] {
  const ronda = partida.ronda
  if (!ronda || ronda.ganador !== null) return []

  const seat = ronda.turno
  const bot = botPorId(botsPorAsiento?.[seat])
  const moves: Move[] = []
  let estado = partida

  for (let i = 0; i < MAX_MOVES_POR_TURNO; i++) {
    const actual = estado.ronda
    if (!actual || actual.turno !== seat) break
    // A closed ronda deals the next one immediately; the same seat holding the
    // opening turn there is a new turn, not a continuation of this one.
    if (estado.historial.length !== partida.historial.length) break

    // The runner holds the full state; the bot only ever sees its view.
    const move = bot.decidir(vistaDeAsiento(actual, seat))
    const result = aplicarEnPartida(estado, move)
    if (!result.ok) break

    moves.push(move)
    estado = result.state
  }

  return moves
}

/**
 * When each of `cantidad` moves should land, spread over `totalMs`.
 *
 * The last move lands at the end of the allotment — the turn takes as long as
 * the setup screen says — and the first waits its share rather than firing
 * instantly, so a turn reads as thinking, then acting.
 */
export function tiemposDeMoves(cantidad: number, totalMs: number): number[] {
  return Array.from({ length: cantidad }, (_, i) =>
    Math.round((totalMs * (i + 1)) / Math.max(cantidad, 1)),
  )
}
