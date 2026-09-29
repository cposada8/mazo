/**
 * The bench (Phase 53): how to tell that one bot is better than another.
 *
 * A tournament plays many seeded partidas with the contenders rotated through
 * the seats — seat order matters in carioca, so every bot sits everywhere —
 * and reports, per bot, what the owner would ask about: how often it wins,
 * how many points it carries, how early it lays down.
 *
 * It also audits. Some mistakes are not a matter of strength but of a bot
 * doing something no player would, and those were found by hand until now:
 * a move the referee refused, a ronda that never ends, a bajado bot taking a
 * card off the descarte and keeping it (Phase 52). Here they are counted on
 * every run, so a new bot that brings one back is caught by the numbers.
 *
 * Pure like everything under `lib/bots`: same options, same report.
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
import { TOPE_DE_MOVIMIENTOS_POR_TURNO, TOPE_DE_TURNOS_POR_RONDA } from './mesa'

export type OpcionesDeTorneo = {
  /** The contenders. The same bot twice is allowed, and counted as one. */
  readonly bots: readonly Bot[]
  readonly partidas: number
  /** Seats at every table; the contenders are rotated through them. */
  readonly asientos: number
  readonly semilla: string
  readonly config?: PartidaConfig
}

export type ResultadoDeBot = {
  readonly id: string
  readonly nombre: string
  /** Seats it held, across every partida. */
  readonly asientos: number
  /**
   * Partidas won, a tie split among the tied — so the column adds up to the
   * number of partidas that finished.
   */
  readonly victorias: number
  /** Victorias per seat held; a fair share at a table of n is 1/n. */
  readonly tasaDeVictoria: number
  /** Final points per seat held. Lower is better, as at the table. */
  readonly puntosPorAsiento: number
  /** Rondas it closed by going out. */
  readonly rondasGanadas: number
  /** Mean turn of the ronda on which it laid down, when it did. */
  readonly turnoDeBajada: number | null
}

/** Something a bot did that no player would. Every one is a bug to chase. */
export type Falta =
  | {
      readonly tipo: 'RECHAZO'
      readonly bot: string
      readonly semilla: string
      readonly code: string
      readonly move: Move
    }
  | { readonly tipo: 'ATASCO'; readonly semilla: string; readonly contrato: string }
  | {
      /** Bajado, took the face-up card, and it was still in hand or thrown back. */
      readonly tipo: 'DESCARTE_INUTIL'
      readonly bot: string
      readonly semilla: string
      readonly carta: string
    }

export type Reporte = {
  readonly partidas: number
  readonly terminadas: number
  readonly bots: readonly ResultadoDeBot[]
  readonly faltas: readonly Falta[]
}

type Acumulado = {
  bot: Bot
  asientos: number
  victorias: number
  puntos: number
  rondasGanadas: number
  bajadas: number
  sumaDeTurnosDeBajada: number
}

export function jugarTorneo(opciones: OpcionesDeTorneo): Reporte {
  const { bots, partidas, asientos, semilla, config } = opciones

  const porId = new Map<string, Acumulado>()
  for (const bot of bots) {
    if (!porId.has(bot.id)) {
      porId.set(bot.id, {
        bot,
        asientos: 0,
        victorias: 0,
        puntos: 0,
        rondasGanadas: 0,
        bajadas: 0,
        sumaDeTurnosDeBajada: 0,
      })
    }
  }

  const faltas: Falta[] = []
  let terminadas = 0

  for (let i = 0; i < partidas; i++) {
    // Rotating by the partida's index puts every contender in every seat.
    const mesa = Array.from({ length: asientos }, (_, seat) => bots[(i + seat) % bots.length])
    const semillaDePartida = `${semilla}-${i}`
    const { partida, terminada } = jugarUna(mesa, semillaDePartida, config, faltas, porId)

    mesa.forEach((bot) => porId.get(bot.id)!.asientos++)
    if (!terminada) continue
    terminadas++

    partida.totales.forEach((total, seat) => {
      porId.get(mesa[seat].id)!.puntos += total
    })
    const ganadores = partida.ganadores ?? []
    for (const seat of ganadores) {
      porId.get(mesa[seat].id)!.victorias += 1 / ganadores.length
    }
    for (const marcador of partida.historial) {
      if (typeof marcador.ganador === 'number') {
        porId.get(mesa[marcador.ganador].id)!.rondasGanadas++
      }
    }
  }

  return {
    partidas,
    terminadas,
    bots: [...porId.values()].map((a) => ({
      id: a.bot.id,
      nombre: a.bot.nombre,
      asientos: a.asientos,
      victorias: a.victorias,
      tasaDeVictoria: a.asientos ? a.victorias / a.asientos : 0,
      puntosPorAsiento: a.asientos ? a.puntos / a.asientos : 0,
      rondasGanadas: a.rondasGanadas,
      turnoDeBajada: a.bajadas ? a.sumaDeTurnosDeBajada / a.bajadas : null,
    })),
    faltas,
  }
}

/**
 * One partida, turn by turn, watching for faltas on the way. The loop is
 * `jugarPartida`'s with the audit threaded through it.
 */
function jugarUna(
  mesa: readonly Bot[],
  semilla: string,
  config: PartidaConfig | undefined,
  faltas: Falta[],
  porId: Map<string, Acumulado>,
): { partida: PartidaState; terminada: boolean } {
  let partida = startPartida({ players: mesa.length, seed: semilla, config })

  while (partida.ronda) {
    const ronda = partida.ronda
    const seat = ronda.turno
    const bot = mesa[seat]
    const turno = ronda.numeroDeTurno
    const contrato = partida.indiceContrato
    const yaBajado = ronda.jugadores[seat].bajadoEnTurno !== null
    let tomada: string | null = null
    let botada: string | null = null

    for (let movimientos = 0; ; movimientos++) {
      const actual = partida.ronda
      if (
        !actual ||
        partida.indiceContrato !== contrato ||
        actual.numeroDeTurno !== turno ||
        actual.ganador !== null
      ) {
        break
      }
      if (movimientos >= TOPE_DE_MOVIMIENTOS_POR_TURNO) {
        faltas.push({ tipo: 'ATASCO', semilla, contrato: actual.contrato.nombre })
        return { partida, terminada: false }
      }

      const vista = vistaDeAsiento(actual, seat)
      const move = bot.decidir(vista)
      if (yaBajado && move.type === 'robar' && move.de === 'descarte') {
        // Forced when the stock is gone and the descarte is all there is.
        const forzada = vista.stock === 0 && vista.descarte.length <= 1
        if (!forzada) tomada = vista.descarte.at(-1)?.id ?? null
      }
      if (move.type === 'descartar') botada = move.cardId
      if (move.type === 'bajarse' && !actual.contrato.escalera) {
        const acumulado = porId.get(bot.id)!
        acumulado.bajadas++
        acumulado.sumaDeTurnosDeBajada += turno
      }

      const result = aplicarEnPartida(partida, move)
      if (!result.ok) {
        faltas.push({ tipo: 'RECHAZO', bot: bot.id, semilla, code: result.code, move })
        return { partida, terminada: false }
      }
      partida = result.state
    }

    if (tomada) {
      const sigueEnMano =
        partida.indiceContrato === contrato &&
        partida.ronda?.jugadores[seat].hand.some((card) => card.id === tomada)
      if (sigueEnMano || botada === tomada) {
        faltas.push({ tipo: 'DESCARTE_INUTIL', bot: bot.id, semilla, carta: tomada })
      }
    }

    if (
      partida.ronda &&
      partida.indiceContrato === contrato &&
      partida.ronda.numeroDeTurno > TOPE_DE_TURNOS_POR_RONDA
    ) {
      faltas.push({ tipo: 'ATASCO', semilla, contrato: partida.ronda.contrato.nombre })
      return { partida, terminada: false }
    }
  }

  return { partida, terminada: true }
}
