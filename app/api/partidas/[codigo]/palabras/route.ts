/**
 * The Palabras race, on the server (Phase 86).
 *
 * GET reads this seat's board and the rivals' colours. POST sends one try, or
 * — for the host — closes the race. The seat is never read from the body.
 */

import type { NextRequest } from 'next/server'
import { cerrarCarrera, intentarEnCarrera, leerCarrera } from '@/lib/server/palabras'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/palabras'>,
) {
  const { codigo } = await ctx.params
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''
  const resultado = await leerCarrera(codigo, secreto)
  return Response.json(resultado, { status: resultado.ok ? 200 : 404 })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/partidas/[codigo]/palabras'>,
) {
  const { codigo } = await ctx.params
  const cuerpo = (await request.json()) as {
    secreto?: string
    palabra?: string
    cerrar?: boolean
  }
  if (!cuerpo.secreto || (!cuerpo.cerrar && typeof cuerpo.palabra !== 'string')) {
    return Response.json({ error: 'falta la identidad o la palabra' }, { status: 400 })
  }
  const resultado = cuerpo.cerrar
    ? await cerrarCarrera(codigo, cuerpo.secreto)
    : await intentarEnCarrera(codigo, cuerpo.secreto, cuerpo.palabra!.slice(0, 16))
  return Response.json(resultado, { status: resultado.ok ? 200 : 409 })
}
