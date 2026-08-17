'use client'

/**
 * Lobby, then table — one URL, because it is one partida (Phase 33).
 *
 * Where the partida *lives* is decided by who is sitting at it (the two-homes
 * rule): a table whose only human is the host plays in this browser, exactly
 * as the game always has, so it needs no connection once it is dealt. A table
 * with other people in it belongs to the server, and that is Phases 34–35.
 *
 * Either way the deal comes from the server, from the seed and config the
 * lobby settled — the engine is deterministic, so the local table reproduces
 * precisely the state the server stored.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Juego } from '@/app/jugar/juego'
import type { VistaDeLobby } from '@/lib/lobby'
import { Lobby } from './lobby'

export function PartidaCliente({
  codigo,
  galeriaDeComodines,
}: {
  codigo: string
  galeriaDeComodines: readonly string[]
}) {
  const router = useRouter()
  const [repartida, setRepartida] = useState<VistaDeLobby | null>(null)

  if (!repartida) {
    return <Lobby codigo={codigo} onEmpezar={setRepartida} />
  }

  const { partida } = repartida
  const estado = partida.estado
  if (!estado) return <Lobby codigo={codigo} onEmpezar={setRepartida} />

  return (
    <Juego
      key={estado.seed}
      jugadores={partida.asientos.length}
      seed={estado.seed}
      contratos={partida.config.contratos}
      comodines={partida.config.comodines}
      segundosBot={partida.segundosBot}
      verDescarte={partida.verDescarte}
      verHistorial={partida.verHistorial}
      cartasOscuras={leerBaraja()}
      galeriaDeComodines={galeriaDeComodines}
      nombresDeAsientos={partida.asientos.map((asiento) => asiento.alias)}
      onSalir={() => router.push('/')}
    />
  )
}

/** The deck finish stays a per-browser preference, as it has been since Phase 25. */
function leerBaraja(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('mazo:cartas-oscuras') !== 'no'
}
