'use client'

import { useState } from 'react'
import { Carta } from '@/components/carta'
import { Mesa, nombrePorDefecto } from '@/components/mesa'
import type { Card, Propuesta } from '@/lib/engine'
import { TU_ASIENTO, usePartida } from './usePartida'

const PRIMERA_PARTIDA = 'primera'

export default function Jugar() {
  const [jugadores, setJugadores] = useState(3)
  // Fixed on the first load, on purpose: a random seed here would deal one
  // partida on the server and a different one in the browser, which is what a
  // hydration mismatch is. Randomness starts when you ask for another partida.
  const [seed, setSeed] = useState(PRIMERA_PARTIDA)
  const juego = usePartida({ jugadores, seed })

  const { partida, ronda, esTuTurno, esperando, aviso } = juego

  const nuevaPartida = (cuantos: number) => {
    const semilla = `partida-${Math.floor(Math.random() * 1_000_000)}`
    setJugadores(cuantos)
    setSeed(semilla)
    juego.reiniciar(semilla, cuantos)
  }

  if (!ronda) {
    return (
      <FinDePartida
        ganadores={partida.ganadores ?? []}
        totales={partida.totales}
        onOtra={() => nuevaPartida(jugadores)}
      />
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-6 pb-40">
      <Mesa
        state={ronda}
        asiento={TU_ASIENTO}
        nombres={nombres(jugadores)}
        seleccionadas={new Set(juego.seleccion)}
        onCarta={esTuTurno ? juego.alternarCarta : undefined}
        onRobar={esTuTurno && ronda.fase === 'draw' ? juego.robar : undefined}
        onGrupo={esTuTurno && ronda.fase === 'act' ? juego.agregarA : undefined}
      />

      {juego.propuestas.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <h2 className="text-sm font-medium">Vas a bajar</h2>
          <div className="flex flex-wrap gap-3">
            {juego.propuestas.map((propuesta, index) => (
              <PropuestaApartada
                key={index}
                propuesta={propuesta}
                cartas={cartasDe(propuesta, ronda.jugadores[TU_ASIENTO].hand)}
                onQuitar={() => juego.soltarGrupo(index)}
              />
            ))}
          </div>
        </section>
      )}

      <Controles juego={juego} />

      <footer className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-3">
          <p className="text-center text-sm">
            {aviso ? (
              <span className="text-red-600 dark:text-red-400">{aviso}</span>
            ) : (
              <Instruccion
                esTuTurno={esTuTurno}
                esperando={esperando}
                fase={ronda.fase}
                turno={ronda.turno}
              />
            )}
          </p>
          <button
            type="button"
            onClick={() => nuevaPartida(jugadores)}
            className="text-muted-foreground self-center text-xs underline"
          >
            Empezar otra partida
          </button>
        </div>
      </footer>
    </main>
  )
}

function Instruccion({
  esTuTurno,
  esperando,
  fase,
  turno,
}: {
  esTuTurno: boolean
  esperando: boolean
  fase: 'draw' | 'act'
  turno: number
}) {
  if (!esTuTurno) {
    return (
      <span className="text-muted-foreground">
        {esperando ? `Juega ${nombrePorDefecto(turno)}…` : 'Esperando…'}
      </span>
    )
  }

  return fase === 'draw' ? (
    <>Toca el mazo o el descarte para robar.</>
  ) : (
    <>Arma grupos, pon cartas en la mesa, y bota una para terminar.</>
  )
}

function Controles({ juego }: { juego: ReturnType<typeof usePartida> }) {
  const { ronda, esTuTurno } = juego
  if (!ronda || !esTuTurno || ronda.fase !== 'act') return null

  const seleccionadas = juego.seleccionadas.length

  return (
    <div className="flex flex-wrap gap-2">
      {!juego.yaBajado && (
        <>
          <Boton onClick={juego.apartarGrupo} disabled={seleccionadas < 3}>
            Armar grupo ({seleccionadas})
          </Boton>
          <Boton
            onClick={juego.bajarse}
            disabled={!juego.contratoCompleto}
            principal
          >
            Bajarme
          </Boton>
        </>
      )}

      <Boton onClick={juego.descartar} disabled={seleccionadas !== 1} principal>
        Botar
      </Boton>

      {seleccionadas > 0 && (
        <Boton onClick={juego.limpiarSeleccion}>Quitar selección</Boton>
      )}
    </div>
  )
}

function Boton({
  onClick,
  disabled,
  principal,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  principal?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
        principal ? 'bg-foreground text-background border-transparent' : 'bg-card'
      }`}
    >
      {children}
    </button>
  )
}

function PropuestaApartada({
  propuesta,
  cartas,
  onQuitar,
}: {
  propuesta: Propuesta
  cartas: Card[]
  onQuitar: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onQuitar}
        className="text-muted-foreground text-left text-[10px] tracking-wide uppercase underline"
      >
        {propuesta.kind === 'trio' ? `Trío de ${propuesta.rank}` : 'Escala'} ·
        quitar
      </button>
      <div className="flex flex-wrap gap-1">
        {cartas.map((card) => (
          <Carta key={card.id} card={card} size="sm" />
        ))}
      </div>
    </div>
  )
}

function FinDePartida({
  ganadores,
  totales,
  onOtra,
}: {
  ganadores: readonly number[]
  totales: readonly number[]
  onOtra: () => void
}) {
  const ganaste = ganadores.includes(TU_ASIENTO)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          {ganaste ? '¡Ganaste!' : 'Se acabó'}
        </h1>
        <p className="text-muted-foreground">
          {ganaste
            ? 'Menos puntos que nadie.'
            : `Gana${ganadores.length > 1 ? 'n' : ''} ${ganadores
                .map((seat) => nombrePorDefecto(seat))
                .join(' y ')}.`}
        </p>
      </div>

      <ul className="flex flex-col gap-px overflow-hidden rounded-lg border">
        {totales.map((total, seat) => (
          <li
            key={seat}
            className={`bg-card flex items-baseline justify-between px-4 py-3 text-sm ${
              ganadores.includes(seat) ? 'font-semibold' : ''
            }`}
          >
            <span>{seat === TU_ASIENTO ? 'Tú' : nombrePorDefecto(seat)}</span>
            <span className="tabular-nums">{total}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOtra}
        className="bg-foreground text-background rounded-md px-4 py-3 text-sm font-medium"
      >
        Otra partida
      </button>
    </main>
  )
}

const nombres = (jugadores: number): string[] =>
  Array.from({ length: jugadores }, (_, seat) =>
    seat === TU_ASIENTO ? 'Tú' : nombrePorDefecto(seat),
  )

function cartasDe(propuesta: Propuesta, hand: readonly Card[]): Card[] {
  const porId = new Map(hand.map((card) => [card.id, card]))
  return propuesta.cardIds
    .map((id) => porId.get(id))
    .filter((card): card is Card => Boolean(card))
}
