'use client'

/**
 * The local home of a Mentiroso partida (Phase 79): one person at seat 0 and
 * bots in the rest, the whole game in this browser — Carioca's `usePartida`,
 * for the second game.
 *
 * It keeps time, which the engine does not: a bot's turn takes `segundosBot`,
 * and every play opens a window of `segundosVentana` in which anyone may call.
 * A bot that wants to call waits a moment inside the window first — a seeded
 * moment, so a seed replays — which is what gives the person a real chance to
 * shout first. Whoever's call is applied first wins; the engine refuses the
 * second, because the window is already shut.
 *
 * What it hands the table is what a server will hand it in Phase 80: one
 * seat's view, the public log, and when the window closes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRng } from '@/lib/engine'
import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  empezarMentiroso,
  vistaMentiroso,
} from '@/lib/engine/mentiroso'
import { type BotMentiroso, EL_EMBUSTERO } from '@/lib/bots/mentiroso'
import { type EventoMentiroso, relatarMentiroso } from '@/lib/relato-mentiroso'

export const TU_ASIENTO = 0

/** After a call, the next play waits this much longer, so the reveal is read. */
const PAUSA_TRAS_ACUSACION_MS = 1500

type Mesa = {
  readonly estado: EstadoMentiroso
  readonly eventos: readonly EventoMentiroso[]
  /** Epoch ms when the open window closes; null with no window open. */
  readonly ventanaHasta: number | null
  readonly error: string | null
}

export function useMentirosoLocal(opciones: {
  seed: string
  jugadores: number
  segundosVentana?: number
  segundosBot?: number
  /** The bot in each seat; seat 0 is the person and is ignored. */
  bots?: readonly BotMentiroso[]
}) {
  const { seed, jugadores, segundosVentana = 3, segundosBot = 2, bots } = opciones
  const sentados = useMemo(
    () => Array.from({ length: jugadores }, (_, i) => bots?.[i] ?? EL_EMBUSTERO),
    [bots, jugadores],
  )

  const [mesa, setMesa] = useState<Mesa>(() => ({
    estado: empezarMentiroso({ jugadores, seed }),
    eventos: [],
    ventanaHasta: null,
    error: null,
  }))

  /**
   * One pure update per move. The window's deadline is the one impure part:
   * it is read off the clock when the play lands, and lives beside the state
   * so the table and the timers agree on it.
   */
  const aplicar = useCallback(
    (move: MoveMentiroso, ahora: number) => {
      setMesa((actual) => {
        const resultado = aplicarMentiroso(actual.estado, move)
        if (!resultado.ok) {
          // A second call, or a call after the window: too late, not an error
          // worth telling a bot about. Only the person's own refusals show.
          const propio =
            (move.type === 'jugar' || move.type === 'mentiroso') && move.asiento === TU_ASIENTO
          return propio ? { ...actual, error: mensajeDeRechazo(resultado.code) } : actual
        }
        const estado = resultado.estado
        return {
          estado,
          eventos: [...actual.eventos, ...relatarMentiroso(move, actual.estado, estado)],
          ventanaHasta:
            estado.fase === 'ventana' && estado.ganador === null
              ? ahora + segundosVentana * 1000
              : null,
          error: null,
        }
      })
    },
    [segundosVentana],
  )

  const { estado, ventanaHasta, eventos } = mesa

  // A bot's turn to play.
  useEffect(() => {
    if (estado.ganador !== null || estado.fase !== 'jugar' || estado.turno === TU_ASIENTO) return
    const asiento = estado.turno
    const recienAcusado = eventos.at(-1)?.tipo === 'acusacion'
    const espera = segundosBot * 1000 + (recienAcusado ? PAUSA_TRAS_ACUSACION_MS : 0)
    const temporizador = setTimeout(() => {
      const cartaIds = sentados[asiento].jugar(vistaMentiroso(estado, asiento))
      aplicar({ type: 'jugar', asiento, cartaIds }, Date.now())
    }, espera)
    return () => clearTimeout(temporizador)
  }, [estado, eventos, sentados, segundosBot, aplicar])

  // The window: bots that want to call, and the clock that closes it.
  useEffect(() => {
    if (estado.ganador !== null || estado.fase !== 'ventana' || ventanaHasta === null) return
    const jugo = estado.ultimaJugada!.asiento
    const restante = Math.max(0, ventanaHasta - Date.now())
    const temporizadores: ReturnType<typeof setTimeout>[] = []

    for (let paso = 1; paso < estado.jugadores; paso++) {
      const asiento = (jugo + paso) % estado.jugadores
      if (asiento === TU_ASIENTO) continue
      if (!sentados[asiento].acusar(vistaMentiroso(estado, asiento))) continue
      // Between a third and four fifths of the window in: late enough that a
      // person who saw it first can beat it, early enough to always land.
      const azar = createRng(`${estado.seed}#grito#${estado.numeroDeJugada}#${asiento}`).next()
      const cuando = Math.min(restante, (0.35 + 0.45 * azar) * segundosVentana * 1000)
      temporizadores.push(
        setTimeout(() => aplicar({ type: 'mentiroso', asiento }, Date.now()), cuando),
      )
    }
    temporizadores.push(setTimeout(() => aplicar({ type: 'cerrarVentana' }, Date.now()), restante))
    return () => temporizadores.forEach(clearTimeout)
  }, [estado, ventanaHasta, sentados, segundosVentana, aplicar])

  const onJugar = useCallback(
    (cartaIds: readonly string[]) =>
      aplicar({ type: 'jugar', asiento: TU_ASIENTO, cartaIds }, Date.now()),
    [aplicar],
  )
  const onMentiroso = useCallback(
    () => aplicar({ type: 'mentiroso', asiento: TU_ASIENTO }, Date.now()),
    [aplicar],
  )

  const vista = useMemo(() => vistaMentiroso(estado, TU_ASIENTO), [estado])

  return { vista, eventos, ventanaHasta, error: mesa.error, onJugar, onMentiroso }
}

/** A refusal of the person's own move, in words. */
export function mensajeDeRechazo(code: string): string {
  switch (code) {
    case 'no-es-tu-turno':
      return 'No es tu turno.'
    case 'cantidad-invalida':
      return 'Pon entre 1 y 4 cartas.'
    case 'fase-equivocada':
      return 'Llegaste tarde: ya no se puede.'
    case 'jugada-propia':
      return 'No puedes acusar tu propia jugada.'
    case 'partida-terminada':
      return 'La partida ya terminó.'
    default:
      return 'Esa jugada no vale.'
  }
}
