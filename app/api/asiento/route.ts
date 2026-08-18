/**
 * Where this browser is sitting (Phase 37).
 *
 * The way back after a page closes: the seat belongs to a per-browser secreto,
 * not to a connection, so coming back is not resurrecting a session — it is
 * asking which table is yours and walking to it.
 */

import type { NextRequest } from 'next/server'
import { dondeEstoy } from '@/lib/server/partidas'

export async function GET(request: NextRequest) {
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''
  if (!secreto) return Response.json({ codigo: null })
  return Response.json({ codigo: await dondeEstoy(secreto) })
}
