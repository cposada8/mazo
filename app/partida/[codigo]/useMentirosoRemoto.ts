'use client'

/**
 * El Mentiroso's remote home (Phase 80): a partida the server referees.
 *
 * The other transport for `MesaMentiroso`, the same shape `useMentirosoLocal`
 * hands it — a seat's view, the public log, the window's deadline and two
 * callbacks — so the table cannot tell the two apart.
 *
 * Polling is everybody's clock, as in Carioca: a bot plays and a window
 * closes because time passed and somebody asked. A window is three seconds,
 * so the table asks often while one is open; a call is a race, and a slow
 * poll would make a person lose it to a bot that only wanted to call later.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { mensajeDeRechazo } from '@/app/mentiroso/useMentirosoLocal'
import type { VistaDeMesaMentiroso } from '@/lib/server/mentiroso'

/** While a play is open to a call: a window is a few seconds. */
const MS_EN_VENTANA = 250
/** Everything else: somebody is about to play. */
const MS_MIRANDO = 600

type Respuesta =
  | { ok: true; mesa: VistaDeMesaMentiroso }
  | { ok: false; code: string; detail?: string }

type Jugada = { type: 'jugar'; cartaIds: readonly string[] } | { type: 'mentiroso' }

export function useMentirosoRemoto(opciones: { codigo: string; secreto: string }) {
  const { codigo, secreto } = opciones
  const cliente = useQueryClient()
  const clave = useMemo(() => ['mentiroso', codigo, secreto], [codigo, secreto])
  const [error, setError] = useState<string | null>(null)
  const ruta = `/api/partidas/${encodeURIComponent(codigo)}/mentiroso`

  const consulta = useQuery({
    queryKey: clave,
    enabled: secreto.length > 0,
    refetchInterval: (q) =>
      q.state.data?.ok && q.state.data.mesa.vista.fase === 'ventana' ? MS_EN_VENTANA : MS_MIRANDO,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Respuesta> => {
      const respuesta = await fetch(`${ruta}?secreto=${encodeURIComponent(secreto)}`, {
        cache: 'no-store',
      })
      return (await respuesta.json()) as Respuesta
    },
  })

  const mutacion = useMutation({
    mutationFn: async (jugada: Jugada): Promise<Respuesta> => {
      const respuesta = await fetch(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secreto, jugada }),
      })
      return (await respuesta.json()) as Respuesta
    },
    onSettled: (respuesta) => {
      if (!respuesta) return
      if (respuesta.ok) {
        setError(null)
        cliente.setQueryData(clave, respuesta)
      } else {
        setError(respuesta.code === 'OCUPADA' ? 'La mesa se movió: inténtalo otra vez.' : mensajeDeRechazo(respuesta.code))
        void cliente.invalidateQueries({ queryKey: clave })
      }
    },
  })

  const mesa = consulta.data?.ok ? consulta.data.mesa : null

  const onJugar = useCallback(
    (cartaIds: readonly string[]) => mutacion.mutate({ type: 'jugar', cartaIds }),
    [mutacion],
  )
  const onMentiroso = useCallback(() => mutacion.mutate({ type: 'mentiroso' }), [mutacion])

  return {
    mesa,
    /** The server said this seat is not at this table, or the table is gone. */
    perdida: consulta.data !== undefined && !consulta.data.ok,
    error,
    onJugar,
    onMentiroso,
  }
}
