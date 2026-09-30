'use client'

/**
 * The local home: a partida that lives in this browser (Phase 34).
 *
 * A table whose only human is you needs no server once it is dealt — the
 * engine is right here, and so are the bots. This is the transport half of
 * that: it holds the state, schedules the bots, and hands `useMesa` the same
 * view and the same public log a server table receives off the wire.
 *
 * Under the two-homes rule this is not a stopgap. It is why a bots-only
 * partida keeps playing with the signal gone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tiemposDeMoves } from '@/lib/bots'
import {
  type Move,
  type PartidaConfig,
  type PartidaState,
  aplicarEnPartida,
  startPartida,
  vistaDePartida,
} from '@/lib/engine'
import { type Relato, relatar } from '@/lib/relato'
import { planearTurno } from './planificador'
import { useMesa } from './useMesa'

/** How long a bot's whole turn takes if the setup screen said nothing. */
const SEGUNDOS_DEL_BOT = 2

export const TU_ASIENTO = 0

export function usePartida(options: {
  jugadores: number
  seed: string
  config?: PartidaConfig
  /** Seconds a bot spends on its whole turn — draw, unload and discard. */
  segundosBot?: number
  /**
   * Which bot sits in each seat, by id (Phase 39). Seats left out — yours,
   * and any bot seated before there was a choice — play as El Codicioso.
   */
  bots?: readonly (string | null)[]
  /**
   * Which partida this is — its código. Given one, the game is kept in this
   * browser and resumed on reload; without one it lives only as long as the
   * page does. Deliberately not the seed: a seed names a *deal*, and replaying
   * one should start it over rather than resume something else.
   */
  id?: string
}) {
  const { jugadores, seed, config, segundosBot = SEGUNDOS_DEL_BOT, bots, id } = options

  /**
   * The partida, its log and the last refusal, as one state — so applying a
   * move is one pure update. They used to be three, and the log was appended
   * from inside the partida's updater, which React runs twice in development:
   * every line was told twice (found in Phase 59).
   */
  const [juego, setJuego] = useState<Juego>(() => {
    const guardada = recordada(id)
    return {
      partida: guardada?.partida ?? startPartida({ players: jugadores, seed, config }),
      relatos: guardada?.relatos ?? [],
      aviso: null,
    }
  })
  const { partida, relatos, aviso } = juego

  /**
   * A local partida is kept in the browser that is playing it, so closing the
   * tab — or losing the signal, which is the point — does not lose the game.
   * The state is the engine's own JSON, exactly as the server stores it.
   */
  useEffect(() => {
    if (id) guardar(id, partida, relatos)
  }, [id, partida, relatos])

  /** The log belongs to the ronda it narrated, so a new reparto clears it. */
  const [repartoVisto, setRepartoVisto] = useState(partida.indiceContrato)
  if (repartoVisto !== partida.indiceContrato) {
    setRepartoVisto(partida.indiceContrato)
    if (relatos.length > 0) setJuego((actual) => ({ ...actual, relatos: [] }))
  }

  const vista = useMemo(
    () => vistaDePartida(partida, TU_ASIENTO),
    [partida],
  )

  /**
   * Apply a move and narrate it. One place, so no path can play a move that
   * the log does not know about — the mistake Phase 26 found the hard way.
   */
  const aplicar = useCallback((estado: Juego, move: Move): Juego => {
    const ronda = estado.partida.ronda
    if (!ronda) return estado

    const cuento = relatar(move, ronda)
    const result = aplicarEnPartida(estado.partida, move)
    if (!result.ok) {
      return { ...estado, aviso: mensajeDeError(result.code, result.detail) }
    }

    return {
      partida: result.state,
      relatos: cuento ? [...estado.relatos, cuento] : estado.relatos,
      aviso: null,
    }
  }, [])

  const jugar = useCallback(
    (move: Move) => setJuego((actual) => aplicar(actual, move)),
    [aplicar],
  )

  /**
   * One string that changes exactly when a new turn starts — and not while a
   * turn is being played out. It keys the bot scheduler below, so the moves
   * it applies cannot reschedule it.
   */
  const ronda = partida.ronda
  const claveDeTurno =
    ronda && ronda.ganador === null
      ? `${partida.indiceContrato}:${ronda.numeroDeTurno}:${ronda.turno}`
      : 'nada'

  /**
   * Bots play their whole turn inside their allotted seconds (Phase 21).
   *
   * The moves are planned up front — deciding is pure, so the plan and the
   * play walk identical states — and spread across the clock, the last one
   * landing when the time runs out.
   */
  // Held in a ref, not in the effect's dependencies: the seating comes from
  // the lobby as a fresh array on every render, and depending on it would
  // cancel and reschedule the bot's turn faster than the bot can take it.
  const botsRef = useRef(bots)
  useEffect(() => {
    botsRef.current = bots
  }, [bots])

  const partidaRef = useRef(partida)
  useEffect(() => {
    partidaRef.current = partida
  }, [partida])

  // The bots' memory of the ronda (Phase 55), read when a turn starts.
  const relatosRef = useRef(relatos)
  useEffect(() => {
    relatosRef.current = relatos
  }, [relatos])

  const mesa = useMesa({
    vista,
    relatos,
    segundosDelTurno: segundosBot,
    aviso,
    limpiarAviso: useCallback(
      () => setJuego((actual) => (actual.aviso === null ? actual : { ...actual, aviso: null })),
      [],
    ),
    jugar,
  })

  const { resumen } = mesa

  useEffect(() => {
    const estado = partidaRef.current
    const actual = estado.ronda
    if (!actual || actual.ganador !== null) return
    if (actual.turno === TU_ASIENTO) return
    // A ronda waiting to be acknowledged is not a ronda in progress: the next
    // one is already dealt, and a bot playing behind the summary would mean
    // coming back to a table that had moved on without you.
    if (resumen) return

    // Planned off the page when the browser can (Phase 56): El Tahúr thinks
    // for a noticeable moment, and the table should not freeze while it does.
    // The thinking is part of the turn: what it took comes off the seconds
    // the moves are spread over, so a turn still lasts what the lobby said.
    let ids: ReturnType<typeof setTimeout>[] = []
    const empezo = Date.now()
    const cancelar = planearTurno(estado, botsRef.current, relatosRef.current, (moves) => {
      const restante = Math.max(segundosBot * 1000 - (Date.now() - empezo), 0)
      const tiempos = tiemposDeMoves(moves.length, restante)
      ids = moves.map((move, i) =>
        setTimeout(() => setJuego((antes) => aplicar(antes, move)), tiempos[i]),
      )
    })

    return () => {
      cancelar()
      ids.forEach(clearTimeout)
    }
  }, [claveDeTurno, resumen, segundosBot, aplicar])

  return {
    ...mesa,
    /**
     * The whole state, which only this home has. Nothing on screen uses it —
     * the table draws from `mesa.partida`, the view — but a test that wants
     * to check what the engine actually did needs somewhere to look.
     */
    estado: partida,
  }
}

const CLAVE = 'mazo:partida-local'

type Recordada = { id: string; partida: PartidaState; relatos: readonly Relato[] }

type Juego = {
  readonly partida: PartidaState
  /** Everything public that has happened this ronda, in order. */
  readonly relatos: readonly Relato[]
  /** The referee's last refusal, in words; cleared by the next good move. */
  readonly aviso: string | null
}

/** The partida this browser was playing, if it is the one being asked for. */
function recordada(id: string | undefined): Recordada | null {
  if (!id || typeof window === 'undefined') return null
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const dato = JSON.parse(crudo) as Recordada
    return dato.id === id ? dato : null
  } catch {
    return null
  }
}

function guardar(id: string, partida: PartidaState, relatos: readonly Relato[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ id, partida, relatos }))
  } catch {
    // Storage refused: the partida still plays, it just will not survive.
  }
}

/** Engine codes are for programs. These are for the person playing. */
export function mensajeDeError(code: string, detail: string): string {
  switch (code) {
    case 'FASE_EQUIVOCADA':
      return 'Todavía no puedes hacer eso en este turno.'
    case 'CONTRATO_NO_COINCIDE':
      return 'Eso no es lo que pide el contrato de esta ronda.'
    case 'GRUPO_INVALIDO':
      return 'Alguno de esos grupos no es válido.'
    case 'NO_SE_HA_BAJADO':
      return 'No puedes tocar la mesa hasta que te bajes.'
    case 'MESA_BLOQUEADA_MISMO_TURNO':
      return 'En el turno que te bajas no puedes poner nada en la mesa, ni en tus propios grupos.'
    case 'YA_SE_BAJO':
      return 'Ya te bajaste en esta ronda.'
    case 'NO_ES_TU_TURNO':
      return 'No es tu turno.'
    case 'RONDA_TERMINADA':
      return 'Esta ronda ya terminó.'
    default:
      return detail
  }
}
