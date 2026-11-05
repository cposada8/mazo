/**
 * El Mentiroso's table, on the server (Phase 80).
 *
 * GET reads it — and reading is also what applies whatever came due: a bot's
 * play, a person's clock, a window running out. POST submits one play or one
 * call for the seat the secreto owns; the seat is never read from the body.
 *
 * What comes back is one seat's view and the public log, and nothing else.
 */

import type { NextRequest } from 'next/server'
import {
  type JugadaDePersona,
  jugarMentirosoEnMesa,
  leerMesaMentiroso,
} from '@/lib/server/mentiroso'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/mentiroso'>,
) {
  const { codigo } = await ctx.params
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''
  const resultado = await leerMesaMentiroso(codigo, secreto)
  return Response.json(resultado, { status: resultado.ok ? 200 : 404 })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/mentiroso'>,
) {
  const { codigo } = await ctx.params
  const { secreto, jugada } = (await request.json()) as {
    secreto?: string
    jugada?: JugadaDePersona
  }
  if (!secreto || !jugada || (jugada.type !== 'jugar' && jugada.type !== 'mentiroso')) {
    return Response.json({ error: 'falta la identidad o la jugada' }, { status: 400 })
  }
  const resultado = await jugarMentirosoEnMesa(codigo, secreto, jugada)
  return Response.json(resultado, { status: resultado.ok ? 200 : 409 })
}
