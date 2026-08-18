'use client'

import { useMemo, useState } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Card,
  type Grupo,
  type Phase,
  buildDeck,
  createRng,
  deal,
  escalaRankAt,
  isComodin,
  validateGrupo,
} from '@/lib/engine'
import { EJEMPLOS } from './ejemplos'

const ids = (cards: readonly Card[]) => cards.map((card) => card.id).join(',')

export default function Pruebas() {
  const [seed, setSeed] = useState('carioca')
  const [players, setPlayers] = useState(4)
  const [comodines, setComodines] = useState(true)
  const [phase, setPhase] = useState<Phase>('layDown')

  const { hands, stock, discard, deterministic } = useMemo(() => {
    const deck = buildDeck({ comodines })
    const first = deal(deck, players, createRng(seed))
    const second = deal(deck, players, createRng(seed))
    return {
      ...first,
      deterministic:
        first.hands.map(ids).join('|') === second.hands.map(ids).join('|'),
    }
  }, [seed, players, comodines])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Banco de pruebas
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          El motor, a la vista
        </h1>
        <p className="text-muted-foreground text-balance">
          Esta página no es el juego. Reparte y valida usando el mismo motor que
          usarán los bots y el servidor, para poder verlo sin abrir la terminal.
        </p>
      </header>

      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-medium">Reparto</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              deterministic
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-700 dark:text-red-400'
            }`}
          >
            {deterministic
              ? 'Repartido dos veces: idéntico'
              : 'No determinista — hay un bug'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Semilla</span>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="bg-card rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="escribe cualquier cosa"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Jugadores</span>
            <select
              value={players}
              onChange={(event) => setPlayers(Number(event.target.value))}
              className="bg-card rounded-md border px-3 py-2 text-sm"
            >
              {Array.from(
                { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
                (_, i) => MIN_PLAYERS + i,
              ).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Comodines</span>
            <button
              type="button"
              onClick={() => setComodines((on) => !on)}
              className="bg-card rounded-md border px-3 py-2 text-left text-sm"
            >
              {comodines ? 'Con comodines (108)' : 'Sin comodines (104)'}
            </button>
          </label>
        </div>

        <p className="text-muted-foreground text-sm">
          Cambia la semilla y el reparto cambia. Vuelve a escribir la misma y
          sale exactamente el mismo — así se podrán repetir partidas enteras.
        </p>

        <div className="flex flex-col gap-5">
          {hands.map((hand, seat) => (
            <div key={seat} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Jugador {seat + 1} · {hand.length} cartas
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {hand.map((card) => (
                  <Carta key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-8 border-t pt-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Mazo · {stock.length}
            </h3>
            <CartaBocaAbajo />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Descarte · {discard.length}
            </h3>
            <Carta card={discard[discard.length - 1]} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Validación de grupos</h2>
          <p className="text-muted-foreground text-sm text-balance">
            Los mismos ejemplos de las reglas, pasados por el validador real.
            Cambia la fase y mira cuáles cambian de color: esa es la regla de que
            al bajarse solo se permite un comodín.
          </p>
        </div>

        <div className="flex gap-2">
          {(['layDown', 'mesa'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPhase(option)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                phase === option ? 'bg-primary text-primary-foreground' : 'bg-card'
              }`}
            >
              {option === 'layDown' ? 'Al bajarse' : 'En la mesa'}
            </button>
          ))}
        </div>

        <ul className="flex flex-col gap-3">
          {EJEMPLOS.map((ejemplo) => (
            <EjemploFila
              key={ejemplo.titulo}
              titulo={ejemplo.titulo}
              nota={ejemplo.nota}
              grupo={ejemplo.grupo}
              phase={phase}
            />
          ))}
        </ul>
      </section>
    </main>
  )
}

function EjemploFila({
  titulo,
  nota,
  grupo,
  phase,
}: {
  titulo: string
  nota: string
  grupo: Grupo
  phase: Phase
}) {
  const check = validateGrupo(grupo, phase)

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-3 ${
        check.ok
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-red-500/40 bg-red-500/5'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-medium">{titulo}</h3>
        <span
          className={`text-xs font-medium ${
            check.ok
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {check.ok ? 'Válido' : check.code}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {grupo.cards.map((card, index) => (
          <Carta
            key={card.id}
            card={card}
            represents={
              grupo.kind === 'escala' && isComodin(card)
                ? escalaRankAt(grupo, index)
                : undefined
            }
          />
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        {check.ok ? nota : check.detail}
      </p>
    </li>
  )
}
