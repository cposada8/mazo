/**
 * What one seat may see of a Mentiroso partida (Phase 76).
 *
 * Everything public and nothing else, built the way Carioca's view is: the
 * only hand in it is the seat's own, and the pile is a count. The cards a
 * call turned over are public — everybody watched them turn — and so is
 * every play's size and announced rank. Bots and the server both take this,
 * so a bot can never know more than the person in its seat would.
 */

import { type Card, type Rank } from '../comun/cards'
import type { Acusacion, EstadoMentiroso, Jugada } from './partida'

export type VistaMentiroso = {
  readonly asiento: number
  readonly mano: readonly Card[]
  /** How many cards each seat holds, this one included. */
  readonly cartasPorAsiento: readonly number[]
  /** How many cards are face down on the pile. Their faces are secret. */
  readonly pila: number
  readonly ultimaJugada: Jugada | null
  readonly rangoEnTurno: Rank
  readonly turno: number
  readonly fase: 'jugar' | 'ventana'
  readonly ultimaAcusacion: Acusacion | null
  readonly numeroDeJugada: number
  readonly ganador: number | null
  /** Bullets per seat — public, like the hand sizes. Absent: no limit. */
  readonly balas?: readonly number[]
  /** Seats that left on purpose (Phase 80). Absent or empty: nobody. */
  readonly retirados?: readonly number[]
  /** Ended with nobody out (Phase 80). */
  readonly sinGanador?: boolean
}

export function vistaMentiroso(estado: EstadoMentiroso, asiento: number): VistaMentiroso {
  return {
    asiento,
    mano: estado.manos[asiento],
    cartasPorAsiento: estado.manos.map((mano) => mano.length),
    pila: estado.pila.length,
    ultimaJugada: estado.ultimaJugada,
    rangoEnTurno: estado.rangoEnTurno,
    turno: estado.turno,
    fase: estado.fase,
    ultimaAcusacion: estado.ultimaAcusacion,
    numeroDeJugada: estado.numeroDeJugada,
    ganador: estado.ganador,
    ...(estado.balas ? { balas: estado.balas } : {}),
    retirados: estado.retirados ?? [],
    sinGanador: estado.sinGanador ?? false,
  }
}
