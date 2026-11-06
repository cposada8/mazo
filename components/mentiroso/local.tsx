'use client'

/**
 * A Mentiroso partida in this browser: you at seat 0, El Embustero in the
 * other seats (Phase 79). The table fed by the local transport — what the
 * partida page renders for a bots-only Mentiroso table, and what Phase 80
 * swaps for the server's feed without touching the table.
 */

import { useMentirosoLocal } from '@/app/mentiroso/useMentirosoLocal'
import { MesaMentiroso } from './mesa'

export type PropsDeMesaMentirosoLocal = {
  seed: string
  jugadores: number
  /** One name per seat; seat 0 is you. */
  nombres: string[]
  /** How long a bot takes to play. Default 2. */
  segundosBot?: number
  /** Bullets each player starts with. Default 3. */
  balas?: number
  onSalir: () => void
  onOtra?: () => void
}

export function MesaMentirosoLocal({
  seed,
  jugadores,
  nombres,
  segundosBot = 2,
  balas,
  onSalir,
  onOtra,
}: PropsDeMesaMentirosoLocal) {
  const mesa = useMentirosoLocal({ seed, jugadores, segundosBot, balas })
  return (
    <MesaMentiroso
      vista={mesa.vista}
      eventos={mesa.eventos}
      nombres={nombres}
      plazoHasta={mesa.plazoHasta}
      segundosDelPlazo={segundosBot}
      error={mesa.error}
      onJugar={mesa.onJugar}
      onMentiroso={mesa.onMentiroso}
      onCreer={mesa.onCreer}
      onSalir={onSalir}
      onOtra={onOtra}
    />
  )
}
