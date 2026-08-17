/**
 * Everything you can do to a lobby (Phase 33).
 *
 * One endpoint rather than six: every action carries the same secreto and
 * returns the same fresh view, so the client has one function and the server
 * has one place where "who is allowed to do this" is decided. The host checks
 * live in `lib/server/partidas.ts`, not here — this file is transport.
 */

import type { NextRequest } from 'next/server'
import type { Accion, ErrorDeLobby, RespuestaDeLobby } from '@/lib/lobby'
import {
  actualizarAjustes,
  agregarBot,
  asientoDe,
  cargarPorCodigo,
  empezar,
  quitarAsiento,
  renombrarAsiento,
  unirse,
} from '@/lib/server/partidas'

type Cuerpo = { secreto?: string; accion?: Accion }

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/accion'>,
) {
  const { codigo } = await ctx.params
  const { secreto, accion } = (await request.json()) as Cuerpo

  if (!secreto || !accion) {
    return Response.json({ error: 'falta la identidad' }, { status: 400 })
  }

  const resultado = await ejecutar(codigo, secreto, accion)
  if (!resultado.ok) {
    return Response.json(resultado satisfies RespuestaDeLobby, { status: 409 })
  }

  const partida = await cargarPorCodigo(codigo)
  if (!partida) {
    return Response.json(
      { ok: false, code: 'NO_EXISTE' } satisfies RespuestaDeLobby,
      { status: 404 },
    )
  }

  return Response.json({
    ok: true,
    vista: { partida, asiento: await asientoDe(partida.id, secreto) },
  } satisfies RespuestaDeLobby)
}

type Veredicto = { ok: true } | { ok: false; code: ErrorDeLobby }

/** Each action's own refusal, normalized — the shapes differ, the answer does not. */
async function ejecutar(
  codigo: string,
  secreto: string,
  accion: Accion,
): Promise<Veredicto> {
  const normalizar = (resultado: { ok: boolean; code?: ErrorDeLobby }): Veredicto =>
    resultado.ok ? { ok: true } : { ok: false, code: resultado.code! }

  switch (accion.tipo) {
    case 'unirse':
      return normalizar(await unirse({ codigo, secreto, alias: accion.alias }))
    case 'bot':
      return normalizar(await agregarBot({ codigo, secreto }))
    case 'quitar':
      return normalizar(
        await quitarAsiento({ codigo, secreto, indice: accion.indice }),
      )
    case 'ajustes':
      return normalizar(
        await actualizarAjustes({
          codigo,
          secreto,
          config: accion.config,
          segundosPorTurno: accion.segundosPorTurno,
          segundosBot: accion.segundosBot,
          verDescarte: accion.verDescarte,
          verHistorial: accion.verHistorial,
        }),
      )
    case 'renombrar':
      return normalizar(await renombrarAsiento({ codigo, secreto, alias: accion.alias }))
    case 'empezar':
      return normalizar(await empezar({ codigo, secreto, seed: accion.seed }))
  }
}
