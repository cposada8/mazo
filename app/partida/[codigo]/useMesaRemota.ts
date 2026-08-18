'use client'

/**
 * The remote home: a partida the server referees (Phase 34).
 *
 * The other transport for `useMesa`. It polls for the seat's view and posts
 * moves; the server holds the truth and answers with the same shapes the
 * local home builds for itself, so the table cannot tell them apart.
 *
 * Two things make it feel like a local game anyway:
 *
 * - **Your own move lands at once.** The client holds the same engine, and a
 *   move out of your own hand depends only on what your view already holds,
 *   so `aplicarEnVista` shows the result immediately and the server's answer
 *   can only agree. The exception is drawing from the stock, which is
 *   genuinely unknowable until the server says — so that one waits, honestly.
 * - **Polling doubles as everyone's clock.** A bot moves because time passed
 *   and somebody asked, so watching the table is what makes it advance.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { mensajeDeError } from '@/app/jugar/usePartida'
import { useMesa } from '@/app/jugar/useMesa'
import { type Move, type VistaDePartida, aplicarEnVista } from '@/lib/engine'
import type { Relato } from '@/lib/relato'

/**
 * How often the table asks the server whether anything happened — which
 * depends on what it is waiting for (Phase 41).
 *
 * Phase 38 measured one interval for everything and kept it, and watching an
 * opponent play is what reopened the question: a second and a bit is invisible
 * on your own turn and is exactly the wrong grain for following somebody
 * else's, where a bot's turn now lands in three pieces spread across two
 * seconds. So the rate follows the wait. It is not more polling on balance —
 * only one seat is in turn at a time, and that seat is the one that slows
 * down — and it is a great deal less than a transport rewrite.
 */
const MS_MIRANDO = 500
/** Your own turn: nothing on the table moves until you move it. */
const MS_EN_TU_TURNO = 1500
/** Before the first answer, and once the partida is over. */
const MS_SIN_SABER = 1200

export type MesaRemota = {
  vista: VistaDePartida
  relatos: readonly Relato[]
  turnoDesde: number | null
  segundosBot: number
  segundosPorTurno: number
  verDescarte: boolean
  verHistorial: boolean
  asientos: readonly { indice: number; alias: string; esBot: boolean }[]
}

type Respuesta =
  | { ok: true; mesa: MesaRemota }
  | { ok: false; code: string; detail?: string }

export function useMesaRemota(options: { codigo: string; secreto: string }) {
  const { codigo, secreto } = options
  const cliente = useQueryClient()
  const clave = useMemo(() => ['mesa', codigo, secreto], [codigo, secreto])
  const [aviso, setAviso] = useState<string | null>(null)

  /**
   * Your own move, shown before the server has answered. Cleared the moment
   * a real answer arrives — the server's version always wins, because it is
   * the one everybody else is looking at.
   */
  const [optimista, setOptimista] = useState<VistaDePartida | null>(null)

  const consulta = useQuery({
    queryKey: clave,
    // No identity yet means no seat to ask about; the provider deals one on
    // the first client frame, and the query starts then.
    enabled: secreto.length > 0,
    refetchInterval: (consulta) => ritmo(consulta.state.data),
    // A backgrounded tab must keep asking: polling is everybody's clock, so a
    // table that stops asking is a table where the bots stop thinking.
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Respuesta> => {
      const respuesta = await fetch(
        `/api/partidas/${encodeURIComponent(codigo)}/mesa?secreto=${encodeURIComponent(secreto)}`,
        { cache: 'no-store' },
      )
      return (await respuesta.json()) as Respuesta
    },
  })

  const mutacion = useMutation({
    mutationFn: async (move: Move): Promise<Respuesta> => {
      const respuesta = await fetch(
        `/api/partidas/${encodeURIComponent(codigo)}/mesa`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secreto, move }),
        },
      )
      return (await respuesta.json()) as Respuesta
    },
    onSettled: (respuesta) => {
      setOptimista(null)
      if (!respuesta) return
      if (respuesta.ok) {
        setAviso(null)
        cliente.setQueryData(clave, respuesta)
      } else {
        setAviso(mensajeDeError(respuesta.code, respuesta.detail ?? ''))
      }
    },
  })

  const servidor = consulta.data?.ok ? consulta.data.mesa : null

  /**
   * While a move of ours is in flight the polled answer is behind by
   * definition, so the optimistic view stands. Everything else — the log, the
   * clocks — still comes from the server.
   */
  const vista = optimista ?? servidor?.vista ?? null

  const jugar = useCallback(
    (move: Move) => {
      const actual = servidor?.vista
      if (actual?.ronda) {
        const adelanto = aplicarEnVista(actual.ronda, move)
        if (adelanto.ok) {
          setOptimista({ ...actual, ronda: adelanto.vista })
        } else if (adelanto.code !== 'SECRETO') {
          // Refused by the real referee against our own view: no point
          // sending it, and the answer would be the same.
          setAviso(mensajeDeError(adelanto.code, ''))
          return
        }
      }
      mutacion.mutate(move)
    },
    [servidor, mutacion],
  )

  const mesa = useMesa({
    vista,
    relatos: servidor?.relatos ?? [],
    // Bots and people get their own clock; the ring drains for whoever is up.
    segundosDelTurno: esTurnoDeBot(servidor)
      ? (servidor?.segundosBot ?? 2)
      : (servidor?.segundosPorTurno ?? 45),
    // The turn started when the server says it did, not when this phone
    // happened to hear about it — so every ring shows the same time left.
    transcurrido: transcurridoDelTurno(servidor),
    // The server enforces the human clock, so your own turn drains too.
    relojPropio: true,
    aviso,
    limpiarAviso: useCallback(() => setAviso(null), []),
    jugar,
  })

  return {
    ...mesa,
    cargando: consulta.isPending,
    error: consulta.data && !consulta.data.ok ? consulta.data.code : null,
    verDescarte: servidor?.verDescarte ?? true,
    verHistorial: servidor?.verHistorial ?? true,
    nombresDeAsientos: servidor?.asientos.map((asiento) => asiento.alias) ?? [],
  }
}

/**
 * How long to wait before asking again. Watching is the case worth spending
 * requests on: it is the only one in which the answer can change without you.
 */
export function ritmo(respuesta: Respuesta | undefined): number {
  if (!respuesta?.ok) return MS_SIN_SABER
  const { vista } = respuesta.mesa
  if (!vista.ronda || vista.ronda.ganador !== null) return MS_SIN_SABER
  return vista.ronda.turno === vista.asiento ? MS_EN_TU_TURNO : MS_MIRANDO
}

/** How much of the turn in play is already gone, in seconds. */
function transcurridoDelTurno(mesa: MesaRemota | null): number {
  if (!mesa?.turnoDesde) return 0
  return Math.max(0, (Date.now() - mesa.turnoDesde) / 1000)
}

function esTurnoDeBot(mesa: MesaRemota | null): boolean {
  const turno = mesa?.vista.ronda?.turno
  if (turno === undefined) return false
  return Boolean(mesa?.asientos.find((asiento) => asiento.indice === turno)?.esBot)
}
