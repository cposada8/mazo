'use client'

/**
 * The local home of a Mentiroso partida (Phase 79): one person at seat 0 and
 * bots in the rest, the whole game in this browser — Carioca's `usePartida`,
 * for the second game.
 *
 * It keeps time, which the engine does not. A bot's turn takes `segundosBot`,
 * and since the owner's rule of 2026-11-05 **the next play closes a play's
 * window**: there is no window of its own length any more. While a play is
 * open, a bot that wants to call does so a seeded moment in — earlier than a
 * bot in turn would play over it, so a call is never lost to the next play,
 * and late enough that a person who sees it first can beat it. Whoever's call
 * is applied first wins; the engine refuses the second.
 *
 * You are not timed here: alone with bots, nobody is waiting on you.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRng } from '@/lib/engine'
import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  debeAceptarOAcusar,
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
  /** When the seat in turn's time began, epoch ms. */
  readonly desde: number
  readonly error: string | null
}

export function useMentirosoLocal(opciones: {
  seed: string
  jugadores: number
  segundosBot?: number
  /** The bot in each seat; seat 0 is the person and is ignored. */
  bots?: readonly BotMentiroso[]
}) {
  const { seed, jugadores, segundosBot = 2, bots } = opciones
  const sentados = useMemo(
    () => Array.from({ length: jugadores }, (_, i) => bots?.[i] ?? EL_EMBUSTERO),
    [bots, jugadores],
  )

  const [mesa, setMesa] = useState<Mesa>(() => ({
    estado: empezarMentiroso({ jugadores, seed }),
    eventos: [],
    desde: 0,
    error: null,
  }))

  const aplicar = useCallback((move: MoveMentiroso, ahora: number) => {
    setMesa((actual) => {
      const resultado = aplicarMentiroso(actual.estado, move)
      if (!resultado.ok) {
        // A second call, or one after the next play: too late, not an error
        // worth telling a bot about. Only the person's own refusals show.
        const propio =
          (move.type === 'jugar' || move.type === 'mentiroso') && move.asiento === TU_ASIENTO
        return propio ? { ...actual, error: mensajeDeRechazo(resultado.code) } : actual
      }
      const estado = resultado.estado
      return {
        estado,
        eventos: [...actual.eventos, ...relatarMentiroso(move, actual.estado, estado)],
        desde: ahora,
        error: null,
      }
    })
  }, [])

  const { estado, eventos } = mesa
  const terminada = estado.ganador !== null

  // The bot in turn: after its thinking, it plays over the open window — or
  // accepts a play that emptied a hand. (A call, if it wants one, comes from
  // the effect below, earlier.)
  useEffect(() => {
    if (terminada || estado.turno === TU_ASIENTO) return
    const asiento = estado.turno
    const recienAcusado = eventos.at(-1)?.tipo === 'acusacion'
    const espera = segundosBot * 1000 + (recienAcusado ? PAUSA_TRAS_ACUSACION_MS : 0)
    const temporizador = setTimeout(() => {
      if (debeAceptarOAcusar(estado)) {
        aplicar({ type: 'cerrarVentana' }, Date.now())
        return
      }
      const cartaIds = sentados[asiento].jugar(vistaMentiroso(estado, asiento))
      aplicar({ type: 'jugar', asiento, cartaIds }, Date.now())
    }, espera)
    return () => clearTimeout(temporizador)
  }, [estado, eventos, terminada, sentados, segundosBot, aplicar])

  // An open play: bots that want to call it.
  useEffect(() => {
    if (terminada || estado.fase !== 'ventana') return
    const jugo = estado.ultimaJugada!.asiento
    const temporizadores: ReturnType<typeof setTimeout>[] = []
    for (let paso = 1; paso < estado.jugadores; paso++) {
      const asiento = (jugo + paso) % estado.jugadores
      if (asiento === TU_ASIENTO) continue
      if (!sentados[asiento].acusar(vistaMentiroso(estado, asiento))) continue
      // A third to four fifths of a bot's thinking time in: before a bot in
      // turn plays over it, late enough that a person can be first.
      const azar = createRng(`${estado.seed}#grito#${estado.numeroDeJugada}#${asiento}`).next()
      const cuando = (0.35 + 0.45 * azar) * segundosBot * 1000
      temporizadores.push(
        setTimeout(() => aplicar({ type: 'mentiroso', asiento }, Date.now()), cuando),
      )
    }
    return () => temporizadores.forEach(clearTimeout)
  }, [estado, terminada, sentados, segundosBot, aplicar])

  const onJugar = useCallback(
    (cartaIds: readonly string[]) =>
      aplicar({ type: 'jugar', asiento: TU_ASIENTO, cartaIds }, Date.now()),
    [aplicar],
  )
  const onMentiroso = useCallback(
    () => aplicar({ type: 'mentiroso', asiento: TU_ASIENTO }, Date.now()),
    [aplicar],
  )
  const onCreer = useCallback(() => aplicar({ type: 'cerrarVentana' }, Date.now()), [aplicar])

  const vista = useMemo(() => vistaMentiroso(estado, TU_ASIENTO), [estado])
  // A bot's thinking is the only clock here; nobody times you.
  const plazoHasta = !terminada && estado.turno !== TU_ASIENTO && mesa.desde > 0
    ? mesa.desde + segundosBot * 1000
    : null

  return { vista, eventos, plazoHasta, error: mesa.error, onJugar, onMentiroso, onCreer }
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
    case 'ultima-jugada-pendiente':
      return 'Se quedó sin cartas: acúsalo o dile que le crees.'
    case 'jugada-propia':
      return 'No puedes acusar tu propia jugada.'
    case 'partida-terminada':
      return 'La partida ya terminó.'
    default:
      return 'Esa jugada no vale.'
  }
}
