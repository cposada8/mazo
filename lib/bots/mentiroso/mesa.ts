/**
 * A whole Mentiroso partida played by bots, start to winner (Phase 77) — for
 * the soak, and the shape a bots-only table will run in the browser.
 *
 * A play is resolved the way a table resolves a shout: every other seat is
 * asked, in turn order from the next one, and the first that wants to call
 * calls. Nobody wanting to, the next seat plays, and that closes the window.
 * The order is a stand-in for "who shouted first"; online, the server decides.
 */

import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  debeAceptarOAcusar,
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
  // An open play: anyone who wants to call does, the next seat first.
  if (estado.fase === 'ventana') {
    const jugo = estado.ultimaJugada!.asiento
    for (let paso = 1; paso < estado.jugadores; paso++) {
      const asiento = (jugo + paso) % estado.jugadores
      if (!estaEnJuego(estado, asiento)) continue
      if (bots[asiento].acusar(vistaMentiroso(estado, asiento))) {
        return { type: 'mentiroso', asiento }
      }
    }
    // Nobody calls a play that emptied a hand: the next seat accepts it.
    if (debeAceptarOAcusar(estado)) return { type: 'cerrarVentana' }
  }
  // The next seat plays — which closes the window on the play before.
  const asiento = estado.turno
  return {
    type: 'jugar',
    asiento,
    cartaIds: bots[asiento].jugar(vistaMentiroso(estado, asiento)),
  }
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
