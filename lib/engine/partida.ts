/**
 * A partida: the enabled contracts, played in order, until somebody has the
 * lowest total.
 *
 * The contracts are configuration, so this file never mentions "hand 3" or
 * "seven rondas" — it plays whatever list it is handed.
 */

import { CATALOGO, type Contrato } from './contratos'
import { MAX_PLAYERS, MIN_PLAYERS } from './deck'
import { puntosDeMano } from './puntaje'
import { createRng } from './random'
import {
  type Move,
  type MoveErrorCode,
  type RondaState,
  apply,
  startRonda,
} from './ronda'

export type PartidaConfig = {
  /** Enabled contracts, in order. Never empty. */
  readonly contratos: readonly Contrato[]
  readonly comodines: boolean
  /** Subtracted from the ronda winner's score. 0 means they simply score none. */
  readonly bonusGanadorRonda: number
  /**
   * Who opens the **first** ronda: a seat chosen by whoever set up the partida,
   * or `'aleatorio'` to draw one. Every ronda after that is opened by whoever
   * won the previous one.
   */
  readonly empiezaPrimeraRonda: number | 'aleatorio'
}

export const CONFIG_POR_DEFECTO: PartidaConfig = {
  contratos: CATALOGO.slice(0, 7),
  comodines: true,
  bonusGanadorRonda: 0,
  empiezaPrimeraRonda: 'aleatorio',
}

/** What one finished ronda contributed. */
export type Marcador = {
  readonly contrato: Contrato
  /** Points scored this ronda, by seat. The winner's may be negative. */
  readonly puntos: readonly number[]
  readonly ganador: number
}

export type PartidaState = {
  readonly config: PartidaConfig
  readonly players: number
  readonly seed: string
  /** Index into `config.contratos`. Equals the length once the partida is over. */
  readonly indiceContrato: number
  /** The ronda being played, or null once every contract has been played. */
  readonly ronda: RondaState | null
  readonly historial: readonly Marcador[]
  readonly totales: readonly number[]
  /** Every seat on the lowest total. Null while the partida is still running. */
  readonly ganadores: readonly number[] | null
}

export type PartidaResult =
  | { readonly ok: true; readonly state: PartidaState }
  | {
      readonly ok: false
      readonly code: MoveErrorCode | 'PARTIDA_TERMINADA'
      readonly detail: string
    }

export function startPartida(options: {
  players: number
  seed: string
  config?: PartidaConfig
}): PartidaState {
  const { players, seed, config = CONFIG_POR_DEFECTO } = options

  if (config.contratos.length === 0) {
    throw new Error('a partida needs at least one contract enabled')
  }
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new Error(
      `a partida takes ${MIN_PLAYERS} to ${MAX_PLAYERS} players, got ${players}`,
    )
  }

  return {
    config,
    players,
    seed,
    indiceContrato: 0,
    ronda: startRonda({
      contrato: config.contratos[0],
      players,
      comodines: config.comodines,
      seed: seedDeRonda(seed, 0),
      empieza: quienAbrePrimero(config.empiezaPrimeraRonda, players, seed),
    }),
    historial: [],
    totales: Array.from({ length: players }, () => 0),
    ganadores: null,
  }
}

/**
 * Play a move in the current ronda, and close the ronda automatically when it
 * ends. Callers never have to notice the boundary between one ronda and the
 * next.
 */
export function aplicarEnPartida(state: PartidaState, move: Move): PartidaResult {
  if (!state.ronda) {
    return { ok: false, code: 'PARTIDA_TERMINADA', detail: 'every contract has been played' }
  }

  const result = apply(state.ronda, move)
  if (!result.ok) return result

  const next: PartidaState = { ...state, ronda: result.state }
  return {
    ok: true,
    state: result.state.ganador === null ? next : cerrarRonda(next),
  }
}

/**
 * Score a finished ronda, add it to the totals, and either deal the next
 * contract or declare the winners.
 *
 * Whoever went out opens the next ronda — one more reason to close a ronda
 * rather than merely unload cards.
 */
export function cerrarRonda(state: PartidaState): PartidaState {
  const ronda = state.ronda
  if (!ronda || ronda.ganador === null) {
    throw new Error('cerrarRonda needs a ronda that somebody has gone out of')
  }

  const ganador = ronda.ganador
  const { bonusGanadorRonda } = state.config
  // Negated only when there is a bonus: `-0` is a real value in JavaScript and
  // would reach a scoreboard as "-0".
  const puntosDelGanador = bonusGanadorRonda === 0 ? 0 : -bonusGanadorRonda

  const puntos = ronda.jugadores.map((jugador, seat) =>
    seat === ganador ? puntosDelGanador : puntosDeMano(jugador.hand),
  )

  const totales = state.totales.map((total, seat) => total + puntos[seat])
  const historial = [
    ...state.historial,
    { contrato: ronda.contrato, puntos, ganador } satisfies Marcador,
  ]
  const indiceContrato = state.indiceContrato + 1

  if (indiceContrato >= state.config.contratos.length) {
    return {
      ...state,
      ronda: null,
      historial,
      totales,
      indiceContrato,
      ganadores: seatsConMenosPuntos(totales),
    }
  }

  return {
    ...state,
    indiceContrato,
    historial,
    totales,
    ronda: startRonda({
      contrato: state.config.contratos[indiceContrato],
      players: state.players,
      comodines: state.config.comodines,
      seed: seedDeRonda(state.seed, indiceContrato),
      empieza: ganador,
    }),
  }
}

/**
 * The opening seat for the first ronda. A drawn seat is still derived from the
 * partida's seed, so an entire partida stays reproducible.
 */
function quienAbrePrimero(
  eleccion: number | 'aleatorio',
  players: number,
  seed: string,
): number {
  if (eleccion === 'aleatorio') {
    return createRng(`${seed}#empieza`).nextInt(players)
  }
  if (!Number.isInteger(eleccion) || eleccion < 0 || eleccion >= players) {
    throw new Error(`seat ${eleccion} cannot open a partida of ${players} players`)
  }
  return eleccion
}

export function contratoActual(state: PartidaState): Contrato | null {
  return state.config.contratos[state.indiceContrato] ?? null
}

/** A tie is a shared win: everyone on the lowest total, with no tie-breaker. */
export function seatsConMenosPuntos(totales: readonly number[]): number[] {
  const menor = Math.min(...totales)
  return totales.flatMap((total, seat) => (total === menor ? [seat] : []))
}

/** Each ronda gets its own stream, derived so the whole partida stays replayable. */
function seedDeRonda(seed: string, indice: number): string {
  return `${seed}#r${indice}`
}
