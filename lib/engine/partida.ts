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
import type { Grupo } from './grupos'
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
  /** The seat that went out, or `'nadie'` for a ronda closed en tablas. */
  readonly ganador: number | 'nadie'
  /**
   * The mesa as it stood when the ronda closed, by seat (Phase 42).
   *
   * Kept rather than caught: closing a ronda deals the next one in the same
   * move, so by the time anybody hears about the end, the table they would
   * want to look at has already been swept. Optional because a partida saved
   * before this existed has a historial without it, and an old partida must
   * still open.
   */
  readonly mesa?: readonly (readonly Grupo[])[]
  /**
   * What the closing move put on the mesa — the cards it was won with. Empty
   * when the winner went out by discarding, which leaves the mesa untouched.
   */
  readonly cierre?: readonly string[]
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

  const anterior = state.ronda
  const result = apply(state.ronda, move)
  if (!result.ok) return result

  const next: PartidaState = { ...state, ronda: result.state }
  return {
    ok: true,
    state:
      result.state.ganador === null ? next : cerrarRonda(next, anterior),
  }
}

/**
 * Score a finished ronda, add it to the totals, and either deal the next
 * contract or declare the winners.
 *
 * Whoever went out opens the next ronda — one more reason to close a ronda
 * rather than merely unload cards. A ronda closed en tablas has no winner:
 * everybody scores their hand, nobody takes the bonus, and the seat whose
 * draw closed it opens the next one (Phase 31).
 */
export function cerrarRonda(
  state: PartidaState,
  /**
   * The ronda as it stood before the move that closed it, when the caller has
   * it. It is the only way to say *what it was won with*: the difference
   * between the two mesas is exactly what the closing move put there.
   */
  antes?: RondaState,
): PartidaState {
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
    ganador !== 'nadie' && seat === ganador
      ? puntosDelGanador
      : puntosDeMano(jugador.hand),
  )

  const totales = state.totales.map((total, seat) => total + puntos[seat])
  const mesa = ronda.jugadores.map((jugador) => jugador.grupos)
  const habia = new Set(
    (antes?.jugadores ?? []).flatMap((jugador) =>
      jugador.grupos.flatMap((grupo) => grupo.cards.map((card) => card.id)),
    ),
  )
  const cierre = antes
    ? mesa
        .flat()
        .flatMap((grupo) => grupo.cards)
        .filter((card) => !habia.has(card.id))
        .map((card) => card.id)
    : []

  const historial = [
    ...state.historial,
    { contrato: ronda.contrato, puntos, ganador, mesa, cierre } satisfies Marcador,
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
      empieza: ganador === 'nadie' ? ronda.turno : ganador,
      // Whoever left stays left: no cards, no turn, for the rest of the
      // partida (Phase 37). The ronda that just closed is where that is
      // recorded, so it is read from there rather than tracked twice.
      retirados: ronda.jugadores.flatMap((jugador, seat) =>
        jugador.retirado ? [seat] : [],
      ),
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
