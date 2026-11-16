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

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { leerBaraja } from '@/app/jugar/ajustes'
import { Juego, Tablero } from '@/app/jugar/juego'
import { useIdentidad } from '@/components/identidad'
import { MesaMentirosoLocal } from '@/components/mentiroso/local'
import { MesaMentiroso } from '@/components/mentiroso/mesa'
import { TableroPalabras } from '@/components/palabras/tablero'
import { abandonarPartida, type VistaDeLobby } from '@/lib/lobby'
import { Lobby } from './lobby'
import { useMentirosoRemoto } from './useMentirosoRemoto'
import { usePalabrasRemoto } from './usePalabrasRemoto'
import { useMesaRemota } from './useMesaRemota'

/**
 * Leaving a dealt partida frees the chair for good (Phase 37): no more cards,
 * no more turns, and nobody waits for you — and no bot takes over, because
 * the point of leaving is that the table stops waiting, not that a stand-in
 * keeps playing your hand.
 *
 * So it asks first. This is the one action here that cannot be taken back,
 * and «Salir» is also what somebody presses meaning "show me the home page".
 */
function useSalir(codigo: string, secreto: string | undefined) {
  const router = useRouter()
  return useCallback(
    async (repartida: boolean, carrera = false) => {
      if (carrera) {
        const seguro = window.confirm(
          'Si sales, dejas la carrera: quedas en la tabla con lo que llevas y ' +
            'nadie te espera.\n\n¿Salir de todos modos?',
        )
        if (!seguro) return
      } else if (repartida) {
        const seguro = window.confirm(
          'Si sales, dejas la partida para siempre: tu puesto queda libre, no ' +
            'te reparten más cartas y los demás siguen sin esperarte. Tu puntaje ' +
            'se queda como está.\n\n¿Salir de todos modos?',
        )
        if (!seguro) return
      }
      if (secreto) await abandonarPartida(codigo, secreto)
      router.push('/')
    },
    [codigo, secreto, router],
  )
}

export function PartidaCliente({
  codigo,
  galeriaDeComodines,
}: {
  codigo: string
  galeriaDeComodines: readonly string[]
}) {
  const [repartida, setRepartida] = useState<VistaDeLobby | null>(null)
  const { identidad } = useIdentidad()
  const salir = useSalir(codigo, identidad?.secreto)

  if (!repartida?.partida.repartida) {
    return (
      <Lobby
        codigo={codigo}
        onEmpezar={setRepartida}
        onSalir={() => void salir(false)}
      />
    )
  }

  const { partida } = repartida
  const humanos = partida.asientos.filter((asiento) => !asiento.esBot)
  const soloBots = humanos.length <= 1

  // Palabras has one home, the server: it alone holds the answers (Phase 86).
  // Leaving a race asks nothing — your time stays in the ranking.
  // Punto y Fama's tables arrive with Phases 102–104.
  if (partida.juego === 'puntoyfama') {
    return <MesaPuntoYFama codigo={codigo} onSalir={() => void salir(false, true)} />
  }

  if (partida.juego === 'palabras') {
    return <CarreraDelServidor codigo={codigo} onSalir={() => void salir(false, true)} />
  }

  // A Mentiroso partida never reaches Carioca's tables (Phase 78): alone with
  // bots it plays here (Phase 79), with other people the server referees it
  // (Phase 80) — the same split as Carioca's.
  if (partida.juego === 'mentiroso') {
    const nombres = partida.asientos.map((asiento) => asiento.alias)
    return soloBots ? (
      <MesaMentirosoLocal
        seed={partida.seed!}
        jugadores={partida.asientos.length}
        nombres={nombres}
        segundosBot={partida.segundosBot}
        balas={partida.balas}
        onSalir={() => void salir(true)}
      />
    ) : (
      <MesaMentirosoDelServidor codigo={codigo} onSalir={() => void salir(true)} />
    )
  }

  return soloBots ? (
    <MesaLocal
      codigo={codigo}
      vista={repartida}
      galeriaDeComodines={galeriaDeComodines}
      onSalir={() => void salir(true)}
    />
  ) : (
    <MesaDelServidor
      codigo={codigo}
      galeriaDeComodines={galeriaDeComodines}
      onSalir={() => void salir(true)}
    />
  )
}

/** A table of bots: dealt by the server, played here, no connection needed. */
function MesaLocal({
  vista,
  galeriaDeComodines,
  onSalir,
}: {
  codigo: string
  vista: VistaDeLobby
  galeriaDeComodines: readonly string[]
  onSalir: () => void
}) {
  const { partida } = vista

  return (
    <Juego
      key={partida.seed!}
      id={partida.codigo}
      jugadores={partida.asientos.length}
      seed={partida.seed!}
      contratos={partida.config.contratos}
      comodines={partida.config.comodines}
      bajada={partida.config.bajada}
      rebarajadas={partida.config.rebarajadas}
      segundosBot={partida.segundosBot}
      verDescarte={partida.verDescarte}
      verHistorial={partida.verHistorial}
      cartasOscuras={leerBaraja()}
      galeriaDeComodines={galeriaDeComodines}
      nombresDeAsientos={partida.asientos.map((asiento) => asiento.alias)}
      bots={partida.asientos.map((asiento) => asiento.bot)}
      onSalir={onSalir}
    />
  )
}

/** A table with other people at it: the server referees, this polls it. */
function MesaDelServidor({
  codigo,
  galeriaDeComodines,
  onSalir,
}: {
  codigo: string
  galeriaDeComodines: readonly string[]
  onSalir: () => void
}) {
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
      segundosBot={juego.segundosBot}
      // Only the host's menu gets the buttons (Phase 98); everyone else sees
      // the pace, read-only, and sees it change.
      onSegundosBot={juego.soyHost ? (segundos) => void juego.cambiarRitmo(segundos) : undefined}
      onSalir={onSalir}
    />
  )
}

/** A Mentiroso table among several people: the server is the referee (Phase 80). */
function MesaMentirosoDelServidor({
  codigo,
  onSalir,
}: {
  codigo: string
  onSalir: () => void
}) {
  const { identidad } = useIdentidad()
  const remota = useMentirosoRemoto({ codigo, secreto: identidad?.secreto ?? '' })

  if (!remota.mesa) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          {remota.perdida ? 'Ya no tienes asiento en esta mesa.' : 'Abriendo la mesa…'}
        </p>
        {remota.perdida && (
          <button
            type="button"
            onClick={onSalir}
            className="border-input hover:bg-accent rounded-md border px-4 py-2 text-sm"
          >
            Salir
          </button>
        )}
      </main>
    )
  }

  const { mesa } = remota
  return (
    <MesaMentiroso
      vista={mesa.vista}
      eventos={mesa.eventos}
      nombres={mesa.asientos.map((asiento) => asiento.alias)}
      plazoHasta={mesa.plazoHasta}
      segundosDelPlazo={mesa.segundosDelPlazo}
      error={remota.error}
      onJugar={remota.onJugar}
      onMentiroso={remota.onMentiroso}
      onCreer={remota.onCreer}
      onSalir={onSalir}
    />
  )
}

/** A Palabras race: always on the server, which holds the words (Phase 86). */
function CarreraDelServidor({ codigo, onSalir }: { codigo: string; onSalir: () => void }) {
  const { identidad } = useIdentidad()
  const remota = usePalabrasRemoto({ codigo, secreto: identidad?.secreto ?? '' })
  const router = useRouter()
  const nombres = useMemo(
    () => new Map((remota.mesa?.asientos ?? []).map((a) => [a.indice, a.alias] as const)),
    [remota.mesa?.asientos],
  )

  if (!remota.mesa) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          {remota.perdida ? 'Ya no tienes lugar en esta carrera.' : 'Abriendo la carrera…'}
        </p>
        {remota.perdida && (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="border-input hover:bg-accent rounded-md border px-4 py-2 text-sm"
          >
            Volver al inicio
          </button>
        )}
      </main>
    )
  }

  const { mesa } = remota
  const yo = mesa.asientos.find((a) => a.indice === mesa.vista.propio?.asiento)
  return (
    <TableroPalabras
      vista={mesa.vista}
      nombres={nombres}
      soyHost={Boolean(yo?.esHost)}
      enviando={remota.enviando}
      error={remota.error}
      ahora={remota.ahora}
      onEnviar={remota.enviar}
      onCerrar={remota.cerrar}
      onSalir={mesa.vista.cerrada || mesa.vista.propio?.terminoEn != null ? () => router.push('/') : onSalir}
    />
  )
}

/** Punto y Fama, refereed by the server: a race or a duel (Phases 102–104). */
function MesaPuntoYFama({ codigo, onSalir }: { codigo: string; onSalir: () => void }) {
  void codigo
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-muted-foreground text-sm">La mesa de Punto y Fama está en camino.</p>
      <button type="button" onClick={onSalir} className="border-input hover:bg-accent rounded-md border px-4 py-2 text-sm">
        Salir
      </button>
    </main>
  )
}
