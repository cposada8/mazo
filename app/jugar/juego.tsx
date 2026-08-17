'use client'

import { useMemo, useState } from 'react'
import { Carta } from '@/components/carta'
import { Marcador } from '@/components/marcador'
import { Mesa, nombrePorDefecto } from '@/components/mesa'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Contrato,
  type PartidaState,
  type Propuesta,
} from '@/lib/engine'
import { TU_ASIENTO, usePartida } from './usePartida'

export function Juego({
  jugadores,
  seed,
  contratos,
  onSalir,
}: {
  jugadores: number
  seed: string
  contratos: readonly Contrato[]
  onSalir: () => void
}) {
  const config = useMemo(
    () => ({ ...CONFIG_POR_DEFECTO, contratos }),
    [contratos],
  )
  const juego = usePartida({ jugadores, seed, config })
  const [verMarcador, setVerMarcador] = useState(false)

  const { partida, ronda, esTuTurno, esperando, aviso } = juego

  if (!ronda) {
    return (
      <FinDePartida
        partida={partida}
        nombres={nombres(jugadores)}
        seed={seed}
        onOtra={onSalir}
      />
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-6 pb-40">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setVerMarcador((abierto) => !abierto)}
          aria-expanded={verMarcador}
          className="bg-card hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
        >
          {verMarcador ? 'Ocultar marcador' : 'Ver marcador'}
        </button>
        <span className="text-muted-foreground font-mono text-xs">{seed}</span>
      </div>

      {verMarcador && (
        <Marcador
          partida={partida}
          nombres={nombres(jugadores)}
          className="rounded-lg border p-3"
        />
      )}

      <Mesa
        state={ronda}
        asiento={TU_ASIENTO}
        nombres={nombres(jugadores)}
        mano={juego.disponibles}
        accionesDeMano={<AccionesDeMano juego={juego} />}
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

      <footer className="bg-background/95 fixed inset-x-0 bottom-0 border-t backdrop-blur">
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
            onClick={onSalir}
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

/**
 * Arranging your hand. Always available — it changes nothing about the game, so
 * there is no reason to lock it to your turn.
 */
function AccionesDeMano({ juego }: { juego: ReturnType<typeof usePartida> }) {
  const haySeleccion = juego.seleccion.length > 0

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {haySeleccion && (
        <div className="flex gap-px overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => juego.moverCartas('izquierda')}
            aria-label="Mover las cartas seleccionadas a la izquierda"
            className="bg-card hover:bg-accent px-2 py-1 text-sm"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => juego.moverCartas('derecha')}
            aria-label="Mover las cartas seleccionadas a la derecha"
            className="bg-card hover:bg-accent px-2 py-1 text-sm"
          >
            →
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => juego.acomodarMano('pintas')}
        className="bg-card hover:bg-accent rounded-md border px-2.5 py-1 text-xs"
      >
        Por pintas
      </button>
      <button
        type="button"
        onClick={() => juego.acomodarMano('numeros')}
        className="bg-card hover:bg-accent rounded-md border px-2.5 py-1 text-xs"
      >
        Por números
      </button>
    </div>
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
  partida,
  nombres,
  seed,
  onOtra,
}: {
  partida: PartidaState
  nombres: readonly string[]
  seed: string
  onOtra: () => void
}) {
  const ganadores = partida.ganadores ?? []
  const ganaste = ganadores.includes(TU_ASIENTO)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          {ganaste ? '¡Ganaste!' : 'Se acabó'}
        </h1>
        <p className="text-muted-foreground">
          {ganaste
            ? 'Menos puntos que nadie.'
            : `Gana${ganadores.length > 1 ? 'n' : ''} ${ganadores
                .map((seat) => nombres[seat])
                .join(' y ')}.`}
        </p>
      </div>

      <Marcador partida={partida} nombres={nombres} />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onOtra}
          className="bg-foreground text-background rounded-md px-4 py-3.5 text-sm font-medium"
        >
          Otra partida
        </button>
        <p className="text-muted-foreground text-center font-mono text-xs">{seed}</p>
      </div>
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
