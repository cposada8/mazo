'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mesa } from '@/components/mesa'
import { codicioso } from '@/lib/bots'
import {
  type Card,
  type Grupo,
  type Rank,
  type Suit,
  type PartidaState,
  type RondaState,
  aplicarEnPartida,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'

/**
 * The table at full screen, frozen at its most crowded (Phase 46).
 *
 * A bot partida is played out and the moment with the most grupos on the
 * mesa is kept — the state that broke the screen in real play — so a layout
 * change can be judged at a phone's actual size rather than inside /mesa's
 * little box. `?jugadores=`, `?seed=` and `?ronda=` pick the partida; `?paso=`
 * picks a moment by move count instead of the crowded one.
 */
function masLlena(seed: string, jugadores: number, ronda: number, paso?: number) {
  let partida: PartidaState = startPartida({ players: jugadores, seed })
  let mejor: RondaState | null = null
  let grupos = -1

  for (let i = 0; i < 4000 && partida.ronda; i++) {
    const actual = partida.ronda
    if (partida.indiceContrato === ronda) {
      if (paso !== undefined) {
        if (i === paso) return actual
      } else {
        const n = actual.jugadores.reduce((s, j) => s + j.grupos.length, 0)
        if (n >= grupos) {
          grupos = n
          mejor = actual
        }
      }
    } else if (partida.indiceContrato > ronda) break

    const result = aplicarEnPartida(
      partida,
      codicioso.decidir(vistaDeAsiento(actual, actual.turno)),
    )
    if (!result.ok) break
    partida = result.state
  }
  return mejor
}

const PALOS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANGOS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/** A made-up escala of `largo` cards; `semilla` picks its pinta and start. */
function escalaDePrueba(semilla: number, largo: number): Grupo {
  const suit = PALOS[semilla % 4]
  const desde = semilla % (RANGOS.length - largo)
  const cards: Card[] = Array.from({ length: largo }, (_, i) => ({
    id: `prueba-${semilla}-${i}`,
    kind: 'normal',
    rank: RANGOS[desde + i],
    suit,
  }))
  return { kind: 'escala', suit, start: RANGOS[desde], cards } as Grupo
}

function Llena() {
  const params = useSearchParams()
  const jugadores = Number(params.get('jugadores') ?? 6)
  const seed = params.get('seed') ?? 'carioca'
  const ronda = Number(params.get('ronda') ?? 0)
  const paso = params.get('paso')

  const estado = useMemo(
    () => masLlena(seed, jugadores, ronda, paso === null ? undefined : Number(paso)),
    [seed, jugadores, ronda, paso],
  )

  if (!estado) return <p className="p-4 text-sm">No hay ronda que mostrar.</p>

  // `?grupos=3` lays three escalas in front of every seat — the eighteen-grupo
  // table real play reaches and a bot partida almost never does.
  const porJugador = Number(params.get('grupos') ?? 0)
  const vista = vistaDeAsiento(estado, 0)
  const llena = porJugador
    ? {
        ...vista,
        jugadores: vista.jugadores.map((jugador, seat) => ({
          ...jugador,
          grupos: Array.from({ length: porJugador }, (_, i) =>
            escalaDePrueba(seat * 7 + i, 4 + ((seat + i) % 3)),
          ),
          bajadoEnTurno: 1,
        })),
      }
    : vista

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-950">
      <Mesa
        state={llena}
        asiento={0}
        nombres={Array.from({ length: jugadores }, (_, seat) =>
          seat === 0 ? 'lordcepm' : `El Codicioso ${seat}`,
        )}
        relatoLinea="El Codicioso 3 bota el 9♣"
        guia={params.has('guia') ? 'Roba: toca el mazo o el descarte.' : undefined}
        onVerDescarte={() => {}}
        onVerHistorial={() => {}}
        onRobar={() => {}}
        onCarta={() => {}}
      />
    </main>
  )
}

export default function MesaLlenaPage() {
  return (
    <Suspense>
      <Llena />
    </Suspense>
  )
}
