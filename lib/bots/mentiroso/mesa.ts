/**
 * A whole Mentiroso partida played by bots, start to winner (Phase 77) — for
 * the soak, and the shape a bots-only table will run in the browser.
 *
 * The window is resolved the way a table resolves a shout: after each play
 * every other seat is asked, in turn order from the next one, and the first
 * that wants to call calls. Nobody wanting to, the window closes. That order
 * is a stand-in for "who shouted first"; online, the server's clock decides.
 */

import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  empezarMentiroso,
  estaEnJuego,
  vistaMentiroso,
} from '@/lib/engine/mentiroso'
import type { BotMentiroso } from './bot'

export type ResultadoDeMesa = {
  readonly estado: EstadoMentiroso
  readonly jugadas: number
  readonly acusaciones: number
  /** True when the cap was reached before anybody won. */
  readonly sinTerminar: boolean
}

/** The move the table makes next: a play, a call, or closing the window. */
export function siguienteMovimiento(
  estado: EstadoMentiroso,
  bots: readonly BotMentiroso[],
): MoveMentiroso {
  if (estado.fase === 'jugar') {
    const asiento = estado.turno
    return {
      type: 'jugar',
      asiento,
      cartaIds: bots[asiento].jugar(vistaMentiroso(estado, asiento)),
    }
  }
  const jugo = estado.ultimaJugada!.asiento
  for (let paso = 1; paso < estado.jugadores; paso++) {
    const asiento = (jugo + paso) % estado.jugadores
    if (!estaEnJuego(estado, asiento)) continue
    if (bots[asiento].acusar(vistaMentiroso(estado, asiento))) {
      return { type: 'mentiroso', asiento }
    }
  }
  return { type: 'cerrarVentana' }
}

export function jugarMentirosoConBots(opciones: {
  bots: readonly BotMentiroso[]
  seed: string
  /** Plays before giving up. Far above any real partida; a stall shows here. */
  maxJugadas?: number
}): ResultadoDeMesa {
  const { bots, seed, maxJugadas = 5_000 } = opciones
  let estado = empezarMentiroso({ jugadores: bots.length, seed })
  let acusaciones = 0

  while (estado.ganador === null && estado.numeroDeJugada < maxJugadas) {
    const move = siguienteMovimiento(estado, bots)
    const resultado = aplicarMentiroso(estado, move)
    if (!resultado.ok) {
      throw new Error(
        `seed ${seed}: ${move.type} refused — ${resultado.code}: ${resultado.detail}`,
      )
    }
    if (move.type === 'mentiroso') acusaciones++
    estado = resultado.estado
  }

  return {
    estado,
    jugadas: estado.numeroDeJugada,
    acusaciones,
    sinTerminar: estado.ganador === null,
  }
}
