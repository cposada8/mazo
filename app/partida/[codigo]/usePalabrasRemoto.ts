'use client'

/**
 * Palabras' only home (Phase 86): the server, always — even for one player.
 * The answers live there and nowhere else, so there is no local table to
 * fall back to.
 *
 * The board asks every second: nothing comes due on the server, but the
 * rivals move, and seeing them move is the race.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { MesaPalabras, ResultadoCarrera } from '@/lib/server/palabras'

const MS_ENTRE_CONSULTAS = 1000

export function mensajeDeCarrera(code: string): string {
  switch (code) {
    case 'NO_ES_PALABRA':
      return 'No está en la lista de palabras.'
    case 'LARGO':
      return 'Faltan letras.'
    case 'NO_EMPEZO':
      return 'Todavía no empieza.'
    case 'YA_TERMINASTE':
      return 'Ya terminaste.'
    case 'CERRADA':
      return 'La carrera ya se cerró.'
    case 'OCUPADA':
      return 'Hubo un choque: inténtalo otra vez.'
    case 'NO_ERES_EL_HOST':
      return 'Solo el host puede cerrar la carrera.'
    default:
      return 'No se pudo enviar.'
  }
}

export function usePalabrasRemoto(opciones: { codigo: string; secreto: string }) {
  const { codigo, secreto } = opciones
  const cliente = useQueryClient()
  const clave = useMemo(() => ['palabras', codigo, secreto], [codigo, secreto])
  const ruta = `/api/partidas/${encodeURIComponent(codigo)}/palabras`
  const [error, setError] = useState<{ texto: string; code: string; vez: number } | null>(null)
  /** Server clock minus this one, so every phone's clock reads the server's. */
  const desfase = useRef(0)

  const recibir = useCallback((respuesta: ResultadoCarrera, enviadoEn: number) => {
    if (respuesta.ok) {
      // Halfway through the round trip is the best guess at "when it was read".
      desfase.current = respuesta.mesa.ahora - (enviadoEn + Date.now()) / 2
    }
    return respuesta
  }, [])

  const consulta = useQuery({
    queryKey: clave,
    enabled: secreto.length > 0,
    refetchInterval: MS_ENTRE_CONSULTAS,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<ResultadoCarrera> => {
      const enviadoEn = Date.now()
      const r = await fetch(`${ruta}?secreto=${encodeURIComponent(secreto)}`, { cache: 'no-store' })
      return recibir((await r.json()) as ResultadoCarrera, enviadoEn)
    },
  })

  const mutacion = useMutation({
    mutationFn: async (cuerpo: { palabra: string } | { cerrar: true }): Promise<ResultadoCarrera> => {
      await cliente.cancelQueries({ queryKey: clave })
      const enviadoEn = Date.now()
      const r = await fetch(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secreto, ...cuerpo }),
      })
      return recibir((await r.json()) as ResultadoCarrera, enviadoEn)
    },
    onSuccess: (respuesta) => {
      if (respuesta.ok) {
        setError(null)
        cliente.setQueryData(clave, respuesta)
      } else {
        setError({ texto: mensajeDeCarrera(respuesta.code), code: respuesta.code, vez: Date.now() })
      }
    },
    onError: () => setError({ texto: 'Sin conexión: inténtalo otra vez.', code: 'RED', vez: Date.now() }),
  })

  const mesa: MesaPalabras | null = consulta.data?.ok ? consulta.data.mesa : null
  const enviar = useCallback(
    (palabra: string) => mutacion.mutateAsync({ palabra }),
    [mutacion],
  )
  const cerrar = useCallback(() => mutacion.mutate({ cerrar: true }), [mutacion])
  const ahora = useCallback(() => Date.now() + desfase.current, [])

  return {
    mesa,
    perdida: consulta.data !== undefined && !consulta.data.ok,
    enviando: mutacion.isPending,
    error,
    enviar,
    cerrar,
    /** The server's clock, as best this phone can tell. */
    ahora,
  }
}
