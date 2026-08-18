/**
 * Running a partida with bots in the seats.
 *
 * Nothing here decides anything about the game: it asks a bot for a move,
 * hands it to the engine, and stops when the partida is over — or when a cap is
 * hit, which it reports instead of hanging.
 *
 * The caps matter. Carioca has no stalemate rule: if nobody ever completes the
 * contrato, the ronda genuinely never ends. A stalled ronda is a fact about the
 * game, not a bug in this loop, so it is returned as data.
 */

import {
  type Move,
  type PartidaConfig,
  type PartidaState,
  aplicarEnPartida,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import type { Bot } from './bot'

export const TOPE_DE_TURNOS_POR_RONDA = 300
/** Draw, act, act, …, discard. Far above any real turn. */
export const TOPE_DE_MOVIMIENTOS_POR_TURNO = 40

export type MotivoDeParada =
  | 'TERMINADA'
  | 'TOPE_DE_TURNOS'
  | 'TOPE_DE_MOVIMIENTOS'
  | 'MOVIMIENTO_RECHAZADO'

export type ResultadoDePartida = {
  readonly partida: PartidaState
  readonly motivo: MotivoDeParada
  /** Turns played across every ronda. */
  readonly turnos: number
  /** Set when a bot proposed something the engine refused. Always a bug. */
  readonly rechazo?: { readonly move: Move; readonly code: string; readonly detail: string }
}

export function jugarPartida(options: {
  bots: readonly Bot[]
  seed: string
  config?: PartidaConfig
  topeDeTurnos?: number
}): ResultadoDePartida {
  const {
    bots,
    seed,
    config,
    topeDeTurnos = TOPE_DE_TURNOS_POR_RONDA,
  } = options

  let partida = startPartida({ players: bots.length, seed, config })
  let turnos = 0

  while (partida.ronda) {
    const ronda = partida.ronda
    const bot = bots[ronda.turno]

    let movimientosEnElTurno = 0
    const turnoInicial = ronda.numeroDeTurno
    const contratoInicial = partida.indiceContrato

    // Play one whole turn: the bot keeps deciding until the turn passes, the
    // ronda ends, or it stops making progress.
    while (
      partida.ronda &&
      partida.indiceContrato === contratoInicial &&
      partida.ronda.numeroDeTurno === turnoInicial &&
      partida.ronda.ganador === null
    ) {
      if (movimientosEnElTurno >= TOPE_DE_MOVIMIENTOS_POR_TURNO) {
        return { partida, motivo: 'TOPE_DE_MOVIMIENTOS', turnos }
      }

      // The runner holds the full state; a bot only ever sees its view.
      const move = bot.decidir(vistaDeAsiento(partida.ronda, partida.ronda.turno))
      const result = aplicarEnPartida(partida, move)

      if (!result.ok) {
        return {
          partida,
          motivo: 'MOVIMIENTO_RECHAZADO',
          turnos,
          rechazo: { move, code: result.code, detail: result.detail },
        }
      }

      partida = result.state
      movimientosEnElTurno++
    }

    turnos++

    if (partida.ronda && partida.ronda.numeroDeTurno > topeDeTurnos) {
      return { partida, motivo: 'TOPE_DE_TURNOS', turnos }
    }
  }

  return { partida, motivo: 'TERMINADA', turnos }
}
