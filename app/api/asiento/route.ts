/**
 * Where this browser is sitting (Phase 37).
 *
 * The way back after a page closes: the seat belongs to a per-browser secreto,
 * not to a connection, so coming back is not resurrecting a session — it is
 * asking which table is yours and walking to it.
 *
 * It is also where the tables nobody came back to get closed (Phase 44). The
 * door is the one place every visitor passes, and a quiet partida can only be
 * reached by somebody who is not at it.
 */

import type { NextRequest } from 'next/server'
import { barrer, dondeEstoy } from '@/lib/server/partidas'

export async function GET(request: NextRequest) {
  const secreto = request.nextUrl.searchParams.get('secreto') ?? ''

  // Before answering, and not after: the answer is *which table is yours*, and
  // a table that expired while you were away is not one of them. At most once
  // every ten minutes per instance — the door is opened far more often than
  // tables go stale.
  await barrer(Date.now(), false).catch(() => {
    // A sweep that fails is a sweep that happens next time. It must never be
    // the reason somebody cannot find their way back to a live game.
  })

  if (!secreto) return Response.json({ codigo: null })
  return Response.json({ codigo: await dondeEstoy(secreto) })
}
