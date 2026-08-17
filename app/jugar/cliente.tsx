'use client'

import { useState } from 'react'
import { type Ajustes, Inicio } from './inicio'
import { Juego } from './juego'

/**
 * Setup first, then the game.
 *
 * Splitting them is what lets a partida be dealt at random: it is created when
 * you press the button, not while the page renders. The game is keyed by its
 * settings, so starting another one simply mounts a fresh game rather than
 * unwinding the old one by hand.
 */
export function JugarCliente({
  galeriaDeComodines,
}: {
  /** Every image the server found for comodín faces, as public URLs. */
  galeriaDeComodines: readonly string[]
}) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)

  if (!ajustes) {
    return <Inicio onEmpezar={setAjustes} />
  }

  return (
    <Juego
      key={`${ajustes.jugadores}-${ajustes.seed}-${ajustes.contratos.length}-${ajustes.comodines}`}
      jugadores={ajustes.jugadores}
      seed={ajustes.seed}
      contratos={ajustes.contratos}
      comodines={ajustes.comodines}
      segundosBot={ajustes.segundosBot}
      verDescarte={ajustes.verDescarte}
      verHistorial={ajustes.verHistorial}
      cartasOscuras={ajustes.cartasOscuras}
      galeriaDeComodines={galeriaDeComodines}
      onSalir={() => setAjustes(null)}
    />
  )
}
