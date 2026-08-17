'use client'

import { useMemo, useState } from 'react'
import { Marcador } from '@/components/marcador'
import { Mesa, nombrePorDefecto } from '@/components/mesa'
import { codicioso } from '@/lib/bots'
import {
  type Move,
  type PartidaState,
  type RondaState,
  aplicarEnPartida,
  describeCard,
  startPartida,
} from '@/lib/engine'

const MAX_MOVIMIENTOS = 800

type Instantanea = {
  partida: PartidaState
  /** What produced this state, in words. */
  descripcion: string
}

/**
 * Play a partida with bots, keeping every state along the way so it can be
 * stepped through. Read-only: the page shows the game, it does not play it.
 */
function simular(seed: string, jugadores: number): Instantanea[] {
  let partida = startPartida({ players: jugadores, seed })
  const instantaneas: Instantanea[] = [{ partida, descripcion: 'Se reparte' }]

  for (let i = 0; i < MAX_MOVIMIENTOS && partida.ronda; i++) {
    const ronda = partida.ronda
    const move = codicioso.decidir(ronda)
    const descripcion = describirMove(move, ronda)

    const result = aplicarEnPartida(partida, move)
    if (!result.ok) break

    partida = result.state
    instantaneas.push({ partida, descripcion })
  }

  return instantaneas
}

function describirMove(move: Move, ronda: RondaState): string {
  const quien = nombrePorDefecto(ronda.turno)

  switch (move.type) {
    case 'robar':
      return move.de === 'stock'
        ? `${quien} roba del mazo`
        : `${quien} toma la del descarte`
    case 'bajarse':
      return `${quien} se baja`
    case 'agregar': {
      const donde =
        move.seat === ronda.turno ? 'a un grupo suyo' : `a un grupo de ${nombrePorDefecto(move.seat)}`
      return `${quien} agrega ${donde}`
    }
    case 'moverComodin':
      return `${quien} mueve un comodín`
    case 'descartar': {
      const card = ronda.jugadores[ronda.turno].hand.find((c) => c.id === move.cardId)
      return `${quien} bota ${card ? describeCard(card) : 'una carta'}`
    }
  }
}

export default function MesaPage() {
  const [seed, setSeed] = useState('carioca')
  const [jugadores, setJugadores] = useState(3)
  const [asiento, setAsiento] = useState(0)
  const [paso, setPaso] = useState(0)

  const instantaneas = useMemo(() => simular(seed, jugadores), [seed, jugadores])
  const indice = Math.min(paso, instantaneas.length - 1)
  const actual = instantaneas[indice]
  const ronda = actual.partida.ronda ?? ultimaRonda(instantaneas, indice)

  const cambiar = (valor: number) =>
    setPaso(Math.max(0, Math.min(valor, instantaneas.length - 1)))

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          La mesa
        </p>
        <p className="text-muted-foreground text-sm text-balance">
          Una partida real jugada por bots, paso a paso. Todavía no se puede
          tocar: esta página dibuja el estado, no lo cambia.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground text-xs">Semilla</span>
          <input
            value={seed}
            onChange={(event) => {
              setSeed(event.target.value)
              setPaso(0)
            }}
            className="bg-card rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground text-xs">Jugadores</span>
          <select
            value={jugadores}
            onChange={(event) => {
              setJugadores(Number(event.target.value))
              setAsiento(0)
              setPaso(0)
            }}
            className="bg-card rounded-md border px-2 py-2 text-sm"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground text-xs">Ver la mano de</span>
          <select
            value={asiento}
            onChange={(event) => setAsiento(Number(event.target.value))}
            className="bg-card rounded-md border px-2 py-2 text-sm"
          >
            {Array.from({ length: jugadores }, (_, seat) => (
              <option key={seat} value={seat}>
                {nombrePorDefecto(seat)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 border-y py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => cambiar(indice - 1)}
            disabled={indice === 0}
            className="bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Atrás
          </button>

          <span className="text-muted-foreground text-xs tabular-nums">
            {indice} / {instantaneas.length - 1}
          </span>

          <button
            type="button"
            onClick={() => cambiar(indice + 1)}
            disabled={indice >= instantaneas.length - 1}
            className="bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Adelante →
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={instantaneas.length - 1}
          value={indice}
          onChange={(event) => cambiar(Number(event.target.value))}
          className="w-full"
          aria-label="Movimiento"
        />

        <p className="text-center text-sm">{actual.descripcion}</p>
      </div>

      {ronda ? (
        // The table is landscape by design, so here it gets a landscape box
        // rather than the page's column. This page is a viewer, not a game.
        <div className="aspect-[16/10] min-h-[19rem] w-full overflow-hidden rounded-lg border">
          <Mesa state={ronda} asiento={Math.min(asiento, jugadores - 1)} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No hay ronda que mostrar.</p>
      )}

      <Marcador
        partida={actual.partida}
        nombres={Array.from({ length: jugadores }, (_, seat) =>
          nombrePorDefecto(seat),
        )}
      />
    </main>
  )
}

/** Once the partida is over there is no current ronda; show the last one seen. */
function ultimaRonda(instantaneas: Instantanea[], desde: number): RondaState | null {
  for (let i = desde; i >= 0; i--) {
    const ronda = instantaneas[i].partida.ronda
    if (ronda) return ronda
  }
  return null
}
