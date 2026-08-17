/**
 * Creating a partida (Phase 33).
 *
 * The door's left-hand button lands here: a code is dealt, the caller is
 * seated as host, and three bots sit down with them — a table of four by
 * default, prunable in the lobby.
 */

import type { NextRequest } from 'next/server'
import { CONFIG_POR_DEFECTO, type PartidaConfig } from '@/lib/engine'
import type { VistaDeLobby } from '@/lib/lobby'
import { crearPartida } from '@/lib/server/partidas'

type Cuerpo = {
  secreto?: string
  alias?: string
  config?: PartidaConfig
  segundosPorTurno?: number
  segundosBot?: number
}

export async function POST(request: NextRequest) {
  const cuerpo = (await request.json()) as Cuerpo
  if (!cuerpo.secreto || !cuerpo.alias) {
    return Response.json({ error: 'falta la identidad' }, { status: 400 })
  }

  const partida = await crearPartida({
    secreto: cuerpo.secreto,
    alias: cuerpo.alias,
    config: cuerpo.config ?? CONFIG_POR_DEFECTO,
    segundosPorTurno: cuerpo.segundosPorTurno,
    segundosBot: cuerpo.segundosBot,
  })

  return Response.json({ partida, asiento: 0 } satisfies VistaDeLobby)
}
