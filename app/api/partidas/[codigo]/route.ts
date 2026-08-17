/**
 * Reading a lobby (Phase 33). Polled by everyone sitting at it.
 *
 * The secreto travels in the query so the answer can say *which seat is
 * yours*; it is never echoed back. Somebody who opens a code without sitting
 * down is an onlooker — they see the table, and `asiento` is null.
 */

import type { NextRequest } from 'next/server'
import type { RespuestaDeLobby } from '@/lib/lobby'
import { asientoDe, cargarPorCodigo } from '@/lib/server/partidas'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]'>,
) {
  const { codigo } = await ctx.params
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''

  const partida = await cargarPorCodigo(codigo)
  if (!partida) {
    return Response.json(
      { ok: false, code: 'NO_EXISTE' } satisfies RespuestaDeLobby,
      { status: 404 },
    )
  }

  const asiento = secreto ? await asientoDe(partida.id, secreto) : null
  return Response.json({
    ok: true,
    vista: { partida, asiento },
  } satisfies RespuestaDeLobby)
}
