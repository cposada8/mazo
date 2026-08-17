'use client'

import { useState } from 'react'
import {
  CATALOGO,
  CONTRATOS_POR_DEFECTO,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Contrato,
} from '@/lib/engine'
import { limpiarSemilla, semillaAleatoria } from '@/lib/semilla'

export type Ajustes = {
  jugadores: number
  seed: string
  /** The contratos to play, in order. Never empty. */
  contratos: Contrato[]
}

/**
 * Everything chosen before the first card is dealt.
 *
 * This screen also settles a technical problem it does not look like it is
 * solving: a partida is now created when you press the button, not while the
 * page renders. Random dealing during render would mean the prerendered HTML
 * and the browser disagree — which is exactly why every first partida used to
 * be the same one.
 */
export function Inicio({
  onEmpezar,
  semillaPrevia,
}: {
  onEmpezar: (ajustes: Ajustes) => void
  /** Offered back after a finished partida, so it can be replayed. */
  semillaPrevia?: string
}) {
  const [jugadores, setJugadores] = useState(3)
  const [semilla, setSemilla] = useState('')
  const [encendidos, setEncendidos] = useState<readonly string[]>(
    CONTRATOS_POR_DEFECTO,
  )

  // Always in catalogue order, however they were switched on.
  const contratos = CATALOGO.filter((contrato) => encendidos.includes(contrato.id))

  const alternar = (id: string) =>
    setEncendidos((actual) =>
      actual.includes(id) ? actual.filter((otro) => otro !== id) : [...actual, id],
    )

  const empezar = () => {
    if (contratos.length === 0) return
    onEmpezar({
      jugadores,
      seed: limpiarSemilla(semilla) || semillaAleatoria(),
      contratos: [...contratos],
    })
  }

  const bots = jugadores - 1

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Jugar Carioca</h1>
        <p className="text-muted-foreground text-balance">
          Contra El Codicioso, que se baja apenas puede y no perdona un descarte
          útil.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Cuántos en la mesa
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {Array.from(
            { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
            (_, i) => MIN_PLAYERS + i,
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setJugadores(n)}
              aria-pressed={jugadores === n}
              className={`rounded-md border py-3 text-sm tabular-nums transition-colors ${
                jugadores === n
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-card hover:bg-accent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          Tú y {bots} {bots === 1 ? 'bot' : 'bots'}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Rondas que se juegan
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {contratos.length} de {CATALOGO.length}
          </span>
        </div>

        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border">
          {CATALOGO.map((contrato, indice) => {
            const activo = encendidos.includes(contrato.id)
            return (
              <li key={contrato.id}>
                <button
                  type="button"
                  onClick={() => alternar(contrato.id)}
                  aria-pressed={activo}
                  className="bg-card hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                >
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded border text-xs ${
                      activo
                        ? 'bg-foreground text-background border-transparent'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {activo ? '✓' : ''}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {indice + 1}
                  </span>
                  <span className={`text-sm ${activo ? '' : 'text-muted-foreground'}`}>
                    {contrato.nombre}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-muted-foreground text-sm text-balance">
          Se juegan en este orden, una ronda cada una. Apaga las que no quieras:
          menos rondas, partida más corta.
          {contratos.length === 0 && (
            <span className="text-red-600 dark:text-red-400">
              {' '}
              Deja al menos una encendida.
            </span>
          )}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Semilla
        </h2>
        <input
          value={semilla}
          onChange={(event) => setSemilla(event.target.value)}
          placeholder="al azar"
          className="bg-card rounded-md border px-3 py-2 font-mono text-sm"
          aria-label="Semilla"
        />
        <p className="text-muted-foreground text-sm text-balance">
          Déjala vacía y sale una al azar. Escribe la misma de una partida
          anterior y vuelven a salir exactamente las mismas cartas.
          {semillaPrevia && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setSemilla(semillaPrevia)}
                className="underline"
              >
                Repetir {semillaPrevia}
              </button>
            </>
          )}
        </p>
      </section>

      <button
        type="button"
        onClick={empezar}
        disabled={contratos.length === 0}
        className="bg-foreground text-background rounded-md px-4 py-3.5 text-sm font-medium disabled:opacity-40"
      >
        Repartir
      </button>
    </main>
  )
}
