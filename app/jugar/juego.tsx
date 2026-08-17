'use client'

import { useMemo, useState } from 'react'
import { Carta } from '@/components/carta'
import { Marcador } from '@/components/marcador'
import { Mesa, nombrePorDefecto } from '@/components/mesa'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Contrato,
  type Marcador as MarcadorDeRonda,
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

  const { partida, ronda, esTuTurno, esperando, aviso, resumen } = juego

  // The pause comes first: a ronda has ended and nobody has seen it yet, even
  // when the next one is already dealt behind it.
  if (resumen) {
    return (
      <FinDeRonda
        partida={partida}
        resumen={resumen}
        nombres={nombres(jugadores)}
        seAcabo={juego.seAcabo}
        onSiguiente={juego.siguiente}
        onSalir={onSalir}
      />
    )
  }

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
    // The table takes the whole viewport, over the site's own chrome: a phone
    // lying down has no room to spare for a header, and 100dvh under one puts
    // the hand off the bottom of the screen.
    <main className="fixed inset-0 z-10 overflow-hidden">
      <GiraElTelefono onSalir={onSalir} />

      <div className="relative hidden h-full landscape:block">
        <Mesa
          state={ronda}
          asiento={TU_ASIENTO}
          nombres={nombres(jugadores)}
          secciones={juego.secciones}
          puntos={juego.puntos}
          onSoltar={juego.soltar}
          accionesDeMano={<AccionesDeMano juego={juego} />}
          acciones={<Controles juego={juego} />}
          sobreLaMano={
            <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {aviso ? (
                <span className="text-red-600 dark:text-red-400">{aviso}</span>
              ) : (
                <Instruccion
                  esTuTurno={esTuTurno}
                  esperando={esperando}
                  fase={ronda.fase}
                  turno={ronda.turno}
                  yaBajado={juego.yaBajado}
                  mesaAbierta={juego.mesaAbierta}
                />
              )}
              <Apartadas juego={juego} mano={ronda.jugadores[TU_ASIENTO].hand} />
            </div>
          }
          seleccionadas={new Set(juego.seleccion)}
          onCarta={esTuTurno ? juego.alternarCarta : undefined}
          onRobar={esTuTurno && ronda.fase === 'draw' ? juego.robar : undefined}
          onGrupo={esTuTurno && ronda.fase === 'act' ? juego.agregarA : undefined}
        />

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="rounded-md bg-amber-300/90 px-2 py-1 text-[11px] font-semibold text-amber-950">
            {ronda.contrato.nombre}
          </span>
          <button
            type="button"
            onClick={() => setVerMarcador((abierto) => !abierto)}
            aria-expanded={verMarcador}
            className="rounded-md border border-emerald-100/25 bg-emerald-950/60 px-2 py-1 text-[11px] text-emerald-50"
          >
            Marcador
          </button>
          <button
            type="button"
            onClick={onSalir}
            className="rounded-md border border-emerald-100/25 bg-emerald-950/60 px-2 py-1 text-[11px] text-emerald-50"
          >
            Salir
          </button>
        </div>

        {verMarcador && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background max-h-full w-full max-w-md overflow-y-auto rounded-lg border p-4">
              <Marcador partida={partida} nombres={nombres(jugadores)} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-mono text-xs">
                  {seed}
                </span>
                <button
                  type="button"
                  onClick={() => setVerMarcador(false)}
                  className="bg-card hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/**
 * The table wants the width, so the phone has to be turned. Said once, kindly,
 * and with a way out — being stuck on a screen you cannot use is worse than an
 * ugly table.
 */
function GiraElTelefono({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center landscape:hidden">
      <span aria-hidden className="text-5xl">
        📱↻
      </span>
      <p className="text-lg font-medium text-balance">
        Gira el teléfono para jugar.
      </p>
      <p className="text-muted-foreground text-sm text-balance">
        La mesa se juega acostada: trece cartas en la mano y los grupos de todos
        no caben de pie.
      </p>
      <button
        type="button"
        onClick={onSalir}
        className="text-muted-foreground text-xs underline"
      >
        Empezar otra partida
      </button>
    </div>
  )
}

/** The grupos set aside for a bajada, small enough to sit above the hand. */
function Apartadas({
  juego,
  mano,
}: {
  juego: ReturnType<typeof usePartida>
  mano: readonly Card[]
}) {
  if (juego.propuestas.length === 0) return null

  return (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
        Vas a bajar
      </span>
      {juego.propuestas.map((propuesta, index) => (
        <button
          key={index}
          type="button"
          onClick={() => juego.soltarGrupo(index)}
          title="Quitar este grupo"
          className="hover:bg-accent flex items-center gap-1 rounded border px-1 py-0.5"
        >
          {cartasDe(propuesta, mano).map((card) => (
            <Carta key={card.id} card={card} size="xs" className="-ml-1 first:ml-0" />
          ))}
          <span className="text-muted-foreground text-[10px]">✕</span>
        </button>
      ))}
    </span>
  )
}

function Instruccion({
  esTuTurno,
  esperando,
  fase,
  turno,
  yaBajado,
  mesaAbierta,
}: {
  esTuTurno: boolean
  esperando: boolean
  fase: 'draw' | 'act'
  turno: number
  yaBajado: boolean
  mesaAbierta: boolean
}) {
  if (!esTuTurno) {
    return (
      <span className="text-muted-foreground">
        {esperando ? `Juega ${nombrePorDefecto(turno)}…` : 'Esperando…'}
      </span>
    )
  }

  if (fase === 'draw') return <>Toca el mazo o el descarte para robar.</>

  // What you may actually do depends on the mesa, and saying otherwise sends
  // people tapping at grupos the engine is going to refuse.
  if (!yaBajado) return <>Arma tus grupos para bajarte, o bota una carta.</>
  if (!mesaAbierta) return <>Ya te bajaste. Bota una carta para terminar el turno.</>
  return <>Pon cartas en la mesa y bota una para terminar.</>
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

      {haySeleccion && (
        <button
          type="button"
          onClick={juego.fijarSeleccion}
          className="bg-card hover:bg-accent rounded-md border px-2.5 py-1 text-xs"
          title="Deja estas cartas fijas: acomodar no las va a mover"
        >
          🔒 Fijar
        </button>
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

/**
 * The turn's actions, in the bottom-right corner where the thumb already is,
 * and in the same order every turn so the corner can be used without reading.
 */
function Controles({ juego }: { juego: ReturnType<typeof usePartida> }) {
  const { ronda, esTuTurno } = juego
  if (!ronda || !esTuTurno || ronda.fase !== 'act') return null

  const seleccionadas = juego.seleccionadas.length

  return (
    <div className="flex w-28 flex-col gap-1">
      {!juego.yaBajado && (
        <>
          <Boton onClick={juego.apartarGrupo} disabled={seleccionadas < 3}>
            Armar ({seleccionadas})
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
        <Boton onClick={juego.limpiarSeleccion}>Quitar</Boton>
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
      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        principal ? 'bg-foreground text-background border-transparent' : 'bg-card'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * A ronda has ended. Who went out, what it cost everyone, and where that leaves
 * the partida — held until whoever is at the phone says to deal the next one.
 */
function FinDeRonda({
  partida,
  resumen,
  nombres,
  seAcabo,
  onSiguiente,
  onSalir,
}: {
  partida: PartidaState
  resumen: MarcadorDeRonda
  nombres: readonly string[]
  seAcabo: boolean
  onSiguiente: () => void
  onSalir: () => void
}) {
  const ganaste = resumen.ganador === TU_ASIENTO
  const tuyos = resumen.puntos[TU_ASIENTO]

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {resumen.contrato.nombre}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {ganaste ? '¡Ganaste la ronda!' : `Ganó ${nombres[resumen.ganador]}`}
        </h1>
        <p className="text-muted-foreground">
          {ganaste
            ? 'Te quedaste sin cartas primero.'
            : `Te quedaste con ${tuyos} punto${tuyos === 1 ? '' : 's'} en la mano.`}
        </p>
      </div>

      <Marcador
        partida={partida}
        nombres={nombres}
        destacar={partida.historial.length - 1}
        siguiente
      />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSiguiente}
          autoFocus
          className="bg-foreground text-background rounded-md px-4 py-3.5 text-sm font-medium"
        >
          {seAcabo ? 'Ver el resultado' : 'Siguiente reparto'}
        </button>
        <button
          type="button"
          onClick={onSalir}
          className="text-muted-foreground self-center text-xs underline"
        >
          Empezar otra partida
        </button>
      </div>
    </main>
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
