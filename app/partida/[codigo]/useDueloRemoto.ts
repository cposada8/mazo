'use client'

/**
 * A Punto y Fama duel's home (Phase 104): the server, which holds both
 * numbers. Asks every second — the other's guesses arriving is the duel.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { MesaDuelo, ResultadoDuelo } from '@/lib/server/puntoyfama'
import { mensajeDeCarrera } from './useCarreraRemota'

const MS_ENTRE_CONSULTAS = 1000

export function useDueloRemoto(opciones: { codigo: string; secreto: string }) {
  const { codigo, secreto } = opciones
  const cliente = useQueryClient()
  const clave = useMemo(() => ['duelo', codigo, secreto], [codigo, secreto])
  const ruta = `/api/partidas/${encodeURIComponent(codigo)}/puntoyfama`
  const [error, setError] = useState<{ texto: string; code: string; vez: number } | null>(null)
  const desfase = useRef(0)

  const recibir = useCallback((respuesta: ResultadoDuelo, enviadoEn: number) => {
    if (respuesta.ok) desfase.current = respuesta.mesa.ahora - (enviadoEn + Date.now()) / 2
    return respuesta
  }, [])

  const consulta = useQuery({
    queryKey: clave,
    enabled: secreto.length > 0,
    refetchInterval: MS_ENTRE_CONSULTAS,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<ResultadoDuelo> => {
      const enviadoEn = Date.now()
      const r = await fetch(`${ruta}?secreto=${encodeURIComponent(secreto)}`, { cache: 'no-store' })
      return recibir((await r.json()) as ResultadoDuelo, enviadoEn)
    },
  })

  const mutacion = useMutation({
    mutationFn: async (cuerpo: { numero: string; poner?: boolean }): Promise<ResultadoDuelo> => {
      await cliente.cancelQueries({ queryKey: clave })
      const enviadoEn = Date.now()
      const r = await fetch(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secreto, ...cuerpo }),
      })
      return recibir((await r.json()) as ResultadoDuelo, enviadoEn)
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

  const mesa: MesaDuelo | null = consulta.data?.ok ? consulta.data.mesa : null
  return {
    mesa,
    perdida: consulta.data !== undefined && !consulta.data.ok,
    enviando: mutacion.isPending,
    error,
    poner: useCallback((numero: string) => mutacion.mutateAsync({ numero, poner: true }), [mutacion]),
    intentar: useCallback((numero: string) => mutacion.mutateAsync({ numero }), [mutacion]),
    ahora: useCallback(() => Date.now() + desfase.current, []),
  }
}
