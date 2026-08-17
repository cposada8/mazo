/**
 * The table, on the server (Phase 34).
 *
 * GET reads it — and reading is also what advances an overdue bot, since a
 * serverless function has no clock of its own. POST submits one move for the
 * seat the secreto owns.
 *
 * What comes back is `vistaDePartida` and the public log, and nothing else:
 * no payload from here can carry a card another player is holding.
 */

import type { NextRequest } from 'next/server'
import type { Move } from '@/lib/engine'
import { jugarEnMesa, leerMesa } from '@/lib/server/juego'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/mesa'>,
) {
  const { codigo } = await ctx.params
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''

  const resultado = await leerMesa(codigo, secreto)
  return Response.json(resultado, { status: resultado.ok ? 200 : 404 })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/mesa'>,
) {
  const { codigo } = await ctx.params
  const { secreto, move } = (await request.json()) as {
    secreto?: string
    move?: Move
  }

  if (!secreto || !move) {
    return Response.json({ error: 'falta la identidad o la jugada' }, { status: 400 })
  }

  const resultado = await jugarEnMesa(codigo, secreto, move)
  return Response.json(resultado, { status: resultado.ok ? 200 : 409 })
}
