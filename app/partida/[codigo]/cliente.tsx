'use client'

/**
 * Lobby, then table — one URL, because it is one partida (Phase 33/34).
 *
 * Where the partida *lives* is decided by who is sitting at it (the two-homes
 * rule): a table whose only human is the host plays in this browser, so it
 * keeps playing with the signal gone. A table with other people in it belongs
 * to the server, which is the only place two phones can both trust.
 *
 * Both routes end in the same `Tablero`, fed by transports that agree by
 * design — the local one deals from the seed the server settled, which is the
 * same deal, because the engine is deterministic.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { leerBaraja } from '@/app/jugar/ajustes'
import { Juego, Tablero } from '@/app/jugar/juego'
import { useIdentidad } from '@/components/identidad'
import type { VistaDeLobby } from '@/lib/lobby'
import { Lobby } from './lobby'
import { useMesaRemota } from './useMesaRemota'

export function PartidaCliente({
  codigo,
  galeriaDeComodines,
}: {
  codigo: string
  galeriaDeComodines: readonly string[]
}) {
  const [repartida, setRepartida] = useState<VistaDeLobby | null>(null)

  if (!repartida?.partida.estado) {
    return <Lobby codigo={codigo} onEmpezar={setRepartida} />
  }

  const { partida } = repartida
  const humanos = partida.asientos.filter((asiento) => !asiento.esBot)
  const soloBots = humanos.length <= 1

  return soloBots ? (
    <MesaLocal
      codigo={codigo}
      vista={repartida}
      galeriaDeComodines={galeriaDeComodines}
    />
  ) : (
    <MesaDelServidor codigo={codigo} galeriaDeComodines={galeriaDeComodines} />
  )
}

/** A table of bots: dealt by the server, played here, no connection needed. */
function MesaLocal({
  vista,
  galeriaDeComodines,
}: {
  codigo: string
  vista: VistaDeLobby
  galeriaDeComodines: readonly string[]
}) {
  const router = useRouter()
  const { partida } = vista
  const estado = partida.estado!

  return (
    <Juego
      key={estado.seed}
      id={partida.codigo}
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

/** A table with other people at it: the server referees, this polls it. */
function MesaDelServidor({
  codigo,
  galeriaDeComodines,
}: {
  codigo: string
  galeriaDeComodines: readonly string[]
}) {
  const router = useRouter()
  const { identidad } = useIdentidad()
  const juego = useMesaRemota({ codigo, secreto: identidad?.secreto ?? '' })

  if (!juego.partida) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-12">
        <p className="text-muted-foreground text-sm">
          {juego.error ? 'No se pudo abrir la mesa.' : 'Abriendo la mesa…'}
        </p>
      </main>
    )
  }

  return (
    <Tablero
      juego={juego}
      jugadores={juego.partida.players}
      seed={juego.partida.seed}
      verDescarte={juego.verDescarte}
      verHistorial={juego.verHistorial}
      cartasOscuras={leerBaraja()}
      galeriaDeComodines={galeriaDeComodines}
      nombresDeAsientos={juego.nombresDeAsientos}
      segundosBot={juego.reloj.segundos}
      onSalir={() => router.push('/')}
    />
  )
}
