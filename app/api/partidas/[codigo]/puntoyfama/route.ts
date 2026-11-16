/**
 * Punto y Fama on the server (Phases 103–104).
 *
 * GET reads this seat's board — a race or a duel, the row knows which. POST
 * sends one guess; in a duel, `secreto` sets your number for the other
 * first; in a race the host may `cerrar` it. The seat is never read from
 * the body.
 */

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/server/db'
import { limpiarCodigo } from '@/lib/codigo'
import {
  cerrarCarreraPF,
  intentarEnCarreraPF,
  intentarEnDueloServidor,
  leerCarreraPF,
  leerDuelo,
  ponerSecretoEnDuelo,
} from '@/lib/server/puntoyfama'

async function esDuelo(codigo: string): Promise<boolean> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    select: { modo: true, juego: true },
  })
  return fila?.juego === 'puntoyfama' && fila.modo === 'duelo'
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/partidas/[codigo]/puntoyfama'>) {
  const { codigo } = await ctx.params
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''
  const resultado = (await esDuelo(codigo))
    ? { ...(await leerDuelo(codigo, secreto)), duelo: true }
    : { ...(await leerCarreraPF(codigo, secreto)), duelo: false }
  return Response.json(resultado, { status: resultado.ok ? 200 : 404 })
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/partidas/[codigo]/puntoyfama'>) {
  const { codigo } = await ctx.params
  const cuerpo = (await request.json()) as {
    secreto?: string
    numero?: string
    poner?: boolean
    cerrar?: boolean
  }
  if (!cuerpo.secreto || (!cuerpo.cerrar && typeof cuerpo.numero !== 'string')) {
    return Response.json({ error: 'falta la identidad o el número' }, { status: 400 })
  }
  const numero = (cuerpo.numero ?? '').slice(0, 12)
  const duelo = await esDuelo(codigo)
  const resultado = duelo
    ? cuerpo.poner
      ? await ponerSecretoEnDuelo(codigo, cuerpo.secreto, numero)
      : await intentarEnDueloServidor(codigo, cuerpo.secreto, numero)
    : cuerpo.cerrar
      ? await cerrarCarreraPF(codigo, cuerpo.secreto)
      : await intentarEnCarreraPF(codigo, cuerpo.secreto, numero)
  return Response.json({ ...resultado, duelo }, { status: resultado.ok ? 200 : 409 })
}
