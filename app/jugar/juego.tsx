'use client'

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp01,
  Lock,
  Maximize,
  Menu,
  Minimize,
  Spade,
} from 'lucide-react'
import { Carta } from '@/components/carta'
import { Marcador } from '@/components/marcador'
import { Mesa, nombrePorDefecto } from '@/components/mesa'
import {
  alternarPantallaCompleta,
  hayPantallaCompleta,
  usePantallaCompleta,
} from '@/lib/pantalla'
import { type Relato, contarRelato } from '@/lib/relato'
import { cn } from '@/lib/utils'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Contrato,
  type Marcador as MarcadorDeRonda,
  type PartidaState,
  type Propuesta,
} from '@/lib/engine'
import { carasDeRonda } from '@/lib/caras'
import { CarasDeComodinProvider } from '@/components/caras'
import { useIdentidad } from '@/components/identidad'
import { BotonDeBaraja, SEGUNDOS, recordarBaraja } from './inicio'
import { TU_ASIENTO, usePartida } from './usePartida'

export function Juego({
  jugadores,
  seed,
  contratos,
  comodines,
  segundosBot: segundosBotInicial,
  verDescarte,
  verHistorial,
  cartasOscuras: cartasOscurasInicial,
  galeriaDeComodines,
  nombresDeAsientos,
  onSalir,
}: {
  jugadores: number
  seed: string
  contratos: readonly Contrato[]
  /** Deal with the four comodines, or with none at all. */
  comodines: boolean
  /** Seconds a bot spends on its whole turn. */
  segundosBot: number
  /** Memory aids from the setup screen: browse the pile, reread the story. */
  verDescarte: boolean
  verHistorial: boolean
  /** The dark deck: near-black card faces, chosen on the setup screen. */
  cartasOscuras: boolean
  /** Images the comodines can wear, dealt fresh each ronda. May be empty. */
  galeriaDeComodines: readonly string[]
  /**
   * Who is in each seat, by index — the lobby's aliases (Phase 33). Without
   * it the table falls back to «Jugador n», which is what a partida with no
   * lobby behind it still gets.
   */
  nombresDeAsientos?: readonly string[]
  onSalir: () => void
}) {
  const config = useMemo(
    () => ({ ...CONFIG_POR_DEFECTO, contratos, comodines }),
    [contratos, comodines],
  )
  // Pacing and paint, not rules (Phase 28): both can be changed mid-partida
  // from the menu, so the setup screen only says where they start.
  const [segundosBot, setSegundosBot] = useState(segundosBotInicial)
  const [cartasOscuras, setCartasOscuras] = useState(cartasOscurasInicial)
  const juego = usePartida({ jugadores, seed, config, segundosBot })
  const { identidad } = useIdentidad()
  const nombresEnMesa = useMemo(
    () => nombres(jugadores, identidad?.alias, nombresDeAsientos),
    [jugadores, identidad?.alias, nombresDeAsientos],
  )
  const [verMenu, setVerMenu] = useState(false)
  const [verPila, setVerPila] = useState(false)
  const [verHistoria, setVerHistoria] = useState(false)

  const escogerBaraja = (oscuras: boolean) => {
    recordarBaraja(oscuras)
    setCartasOscuras(oscuras)
  }

  const { partida, ronda, esTuTurno, esperando, aviso, resumen } = juego

  // The faces this ronda's comodines wear — dealt from the seed, like the
  // cards, so a replayed partida replays its comodines too.
  const caras = useMemo(
    () =>
      carasDeRonda({
        imagenes: galeriaDeComodines,
        seed,
        ronda: partida.indiceContrato,
      }),
    [galeriaDeComodines, seed, partida.indiceContrato],
  )

  // The pause comes first: a ronda has ended and nobody has seen it yet, even
  // when the next one is already dealt behind it.
  if (resumen) {
    return (
      <FinDeRonda
        partida={partida}
        resumen={resumen}
        nombres={nombresEnMesa}
        seAcabo={juego.seAcabo}
        onSiguiente={juego.siguiente}
        onSalir={onSalir}
      />
    )
  }

  // The view is derived from the ronda, so they are absent together.
  if (!ronda || !juego.vista) {
    return (
      <FinDePartida
        partida={partida}
        nombres={nombresEnMesa}
        seed={seed}
        onOtra={onSalir}
      />
    )
  }

  return (
    // The table takes the whole viewport, over the site's own chrome: a phone
    // lying down has no room to spare for a header, and 100dvh under one puts
    // the hand off the bottom of the screen.
    <CarasDeComodinProvider value={caras}>
    <main className="fixed inset-0 z-10 overflow-hidden">
      {/* Safe areas are padded, not ignored: fullscreen and standalone put the
          table under the notch, and a card behind a camera is a card lost. */}
      {/* The deck class sits on the wrapper so the overlays — descarte,
          historial — deal from the same deck as the table. */}
      <div
        className={cn(
          'relative h-full bg-stone-950 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
          cartasOscuras && 'cartas-oscuras',
        )}
      >
        <Mesa
          state={juego.vista}
          asiento={TU_ASIENTO}
          nombres={nombresEnMesa}
          reloj={juego.reloj}
          relatoLinea={
            juego.relato
              ? contarRelato(juego.relato, nombresEnMesa, TU_ASIENTO)
              : undefined
          }
          viaje={juego.viaje}
          onVerDescarte={verDescarte ? () => setVerPila(true) : undefined}
          onVerHistorial={verHistorial ? () => setVerHistoria(true) : undefined}
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
                  nombres={nombresEnMesa}
                  yaBajado={juego.yaBajado}
                  mesaAbierta={juego.mesaAbierta}
                />
              )}
              <Apartadas juego={juego} mano={ronda.jugadores[TU_ASIENTO].hand} />
            </div>
          }
          seleccionadas={new Set(juego.seleccion)}
          resaltada={juego.recienRobada ?? undefined}
          onCarta={esTuTurno ? juego.alternarCarta : undefined}
          onRobar={esTuTurno && ronda.fase === 'draw' ? juego.robar : undefined}
          onGrupo={esTuTurno && ronda.fase === 'act' ? juego.agregarA : undefined}
        />

        {/*
          One small button, not a row: the top-left corner borders the seat
          band, and a strip of controls up there is exactly the kind of
          neighbour the lanes exist to forbid. Everything it used to say —
          contract, marcador, seed, salir — lives behind it.
        */}
        <button
          type="button"
          onClick={() => setVerMenu(true)}
          aria-label="Menú de la partida"
          aria-expanded={verMenu}
          className="absolute top-1.5 left-1.5 z-20 rounded-md border border-stone-600/60 bg-stone-900/80 p-1.5 text-stone-100"
        >
          <Menu className="size-4" aria-hidden />
        </button>

        {verMenu && (
          <MenuDePartida
            partida={partida}
            contrato={ronda.contrato.nombre}
            nombres={nombresEnMesa}
            seed={seed}
            segundosBot={segundosBot}
            onSegundosBot={setSegundosBot}
            cartasOscuras={cartasOscuras}
            onCartasOscuras={escogerBaraja}
            onCerrar={() => setVerMenu(false)}
            onSalir={onSalir}
          />
        )}

        {verPila && (
          <PilaDeDescarte
            cartas={ronda.discard}
            onCerrar={() => setVerPila(false)}
          />
        )}

        {verHistoria && (
          <HistorialDeRonda
            historia={juego.historia}
            nombres={nombresEnMesa}
            onCerrar={() => setVerHistoria(false)}
          />
        )}
      </div>
    </main>
    </CarasDeComodinProvider>
  )
}

/**
 * Everything about the partida that is not the next move: the contract being
 * played, the marcador, the ajustes, the seed, leaving, and the screen
 * itself. It opens over the table and holds nothing that is needed mid-turn.
 *
 * The ajustes here are pacing and paint — the bots' thinking time and the
 * card finish — and take effect on the very next turn. What *is* a rule —
 * comodines, the contract list, the seed — is visible but not editable: a
 * partida's identity does not change mid-game.
 */
function MenuDePartida({
  partida,
  contrato,
  nombres,
  seed,
  segundosBot,
  onSegundosBot,
  cartasOscuras,
  onCartasOscuras,
  onCerrar,
  onSalir,
}: {
  partida: PartidaState
  contrato: string
  nombres: readonly string[]
  seed: string
  segundosBot: number
  onSegundosBot: (segundos: number) => void
  cartasOscuras: boolean
  onCartasOscuras: (oscuras: boolean) => void
  onCerrar: () => void
  onSalir: () => void
}) {
  const enPantallaCompleta = usePantallaCompleta()

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background max-h-full w-full max-w-md overflow-y-auto rounded-lg border p-4">
        <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
          {contrato} ·{' '}
          {partida.config.comodines ? 'con comodines' : 'sin comodines'}
        </p>
        <Marcador partida={partida} nombres={nombres} />

        <div className="mt-4 flex flex-col gap-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Cuánto piensa un bot
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SEGUNDOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSegundosBot(s)}
                aria-pressed={segundosBot === s}
                className={`rounded-md border py-2 text-sm tabular-nums transition-colors ${
                  segundosBot === s
                    ? 'bg-foreground text-background border-transparent'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                {s} s
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            La baraja
          </p>
          <div className="grid grid-cols-2 gap-2">
            <BotonDeBaraja
              nombre="Claras"
              activo={!cartasOscuras}
              onClick={() => onCartasOscuras(false)}
              carta="border-stone-300 bg-stone-50 text-stone-900"
            />
            <BotonDeBaraja
              nombre="Oscuras"
              activo={cartasOscuras}
              onClick={() => onCartasOscuras(true)}
              carta="border-stone-600 bg-stone-900 text-stone-50"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-muted-foreground font-mono text-xs">{seed}</span>
          <div className="flex items-center gap-1.5">
            {hayPantallaCompleta() && (
              <button
                type="button"
                onClick={alternarPantallaCompleta}
                aria-label={
                  enPantallaCompleta
                    ? 'Salir de pantalla completa'
                    : 'Pantalla completa'
                }
                title={
                  enPantallaCompleta
                    ? 'Salir de pantalla completa'
                    : 'Pantalla completa'
                }
                className="bg-card hover:bg-accent rounded-md border p-2"
              >
                {enPantallaCompleta ? (
                  <Minimize className="size-4" aria-hidden />
                ) : (
                  <Maximize className="size-4" aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onSalir}
              className="bg-card hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
            >
              Salir
            </button>
            <button
              type="button"
              onClick={onCerrar}
              autoFocus
              className="bg-foreground text-background rounded-md border border-transparent px-3 py-1.5 text-sm"
            >
              Seguir jugando
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The whole descarte, top card first. Only the top card is playable — this
 * changes no rule, it just spares the memory of what everyone already saw.
 */
function PilaDeDescarte({
  cartas,
  onCerrar,
}: {
  cartas: readonly Card[]
  onCerrar: () => void
}) {
  const desdeArriba = [...cartas].reverse()

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background max-h-full w-full max-w-md overflow-y-auto rounded-lg border p-4">
        <p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
          El descarte, de arriba hacia abajo · {cartas.length}
        </p>
        <div className="flex flex-wrap items-start gap-1.5">
          {desdeArriba.map((card, indice) => (
            <div key={card.id} className="relative">
              <Carta card={card} size="sm" />
              {indice === 0 && (
                <span className="text-muted-foreground absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] tracking-wide uppercase">
                  arriba
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            autoFocus
            className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Everything public that happened this ronda, newest first — every line under
 * the Phase 22 rule: only what everybody was entitled to see.
 */
function HistorialDeRonda({
  historia,
  nombres,
  onCerrar,
}: {
  historia: readonly Relato[]
  nombres: readonly string[]
  onCerrar: () => void
}) {
  const recientesPrimero = [...historia].reverse()

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background flex max-h-full w-full max-w-md flex-col rounded-lg border p-4">
        <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
          Lo que ha pasado · lo último primero
        </p>
        <ol className="min-h-0 flex-1 overflow-y-auto text-sm">
          {recientesPrimero.length === 0 && (
            <li className="text-muted-foreground py-1">
              Todavía no pasa nada en esta ronda.
            </li>
          )}
          {recientesPrimero.map((relato, indice) => (
            <li
              key={historia.length - indice}
              className="border-border/60 border-b py-1.5 last:border-0"
            >
              {contarRelato(relato, nombres, TU_ASIENTO)}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            autoFocus
            className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
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
  nombres,
  yaBajado,
  mesaAbierta,
}: {
  esTuTurno: boolean
  esperando: boolean
  fase: 'draw' | 'act'
  turno: number
  nombres: readonly string[]
  yaBajado: boolean
  mesaAbierta: boolean
}) {
  if (!esTuTurno) {
    const quien = nombres[turno] ?? nombrePorDefecto(turno)
    return (
      <span className="text-muted-foreground">
        {esperando ? `Juega ${quien}…` : 'Esperando…'}
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
 *
 * Icons, not words: as text these controls wrapped into three rows on a real
 * phone and pushed the table into a strip. Each one still says its name to a
 * finger held on it and to a screen reader.
 */
function AccionesDeMano({ juego }: { juego: ReturnType<typeof usePartida> }) {
  const haySeleccion = juego.seleccion.length > 0

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {haySeleccion && (
        <div className="flex gap-px overflow-hidden rounded-md border">
          <BotonDeMano
            onClick={() => juego.moverCartas('izquierda')}
            etiqueta="Mover las cartas seleccionadas a la izquierda"
            sinBorde
          >
            <ArrowLeft className="size-4" aria-hidden />
          </BotonDeMano>
          <BotonDeMano
            onClick={() => juego.moverCartas('derecha')}
            etiqueta="Mover las cartas seleccionadas a la derecha"
            sinBorde
          >
            <ArrowRight className="size-4" aria-hidden />
          </BotonDeMano>
        </div>
      )}

      {haySeleccion && (
        <BotonDeMano
          onClick={juego.fijarSeleccion}
          etiqueta="Fijar: deja estas cartas juntas, acomodar no las mueve"
        >
          <Lock className="size-4" aria-hidden />
        </BotonDeMano>
      )}

      <BotonDeMano
        onClick={() => juego.acomodarMano('pintas')}
        etiqueta="Acomodar por pintas — mantenlo presionado y lo que robes se acomoda solo"
        activo={juego.acomodoActivo === 'pintas'}
      >
        <Spade className="size-4" aria-hidden />
      </BotonDeMano>
      <BotonDeMano
        onClick={() => juego.acomodarMano('numeros')}
        etiqueta="Acomodar por números — mantenlo presionado y lo que robes se acomoda solo"
        activo={juego.acomodoActivo === 'numeros'}
      >
        <ArrowUp01 className="size-4" aria-hidden />
      </BotonDeMano>
    </div>
  )
}

function BotonDeMano({
  onClick,
  etiqueta,
  sinBorde,
  activo,
  children,
}: {
  onClick: () => void
  etiqueta: string
  sinBorde?: boolean
  /** A latched toggle: pressed stays pressed, and the styling says so. */
  activo?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      className={`p-1.5 ${sinBorde ? '' : 'rounded-md border'} ${
        activo
          ? 'bg-foreground text-background border-transparent'
          : 'bg-card hover:bg-accent'
      }`}
    >
      {children}
    </button>
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
  const tablas = resumen.ganador === 'nadie'
  const tuyos = resumen.puntos[TU_ASIENTO]

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {resumen.contrato.nombre}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {tablas
            ? 'Tablas: nadie ganó'
            : ganaste
              ? '¡Ganaste la ronda!'
              : `Ganó ${nombres[resumen.ganador as number]}`}
        </h1>
        <p className="text-muted-foreground">
          {tablas
            ? `El mazo se agotó por última vez. Todos suman su mano: la tuya costó ${tuyos} punto${tuyos === 1 ? '' : 's'}.`
            : ganaste
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

/**
 * Who to call each seat. The lobby's aliases when there is a lobby; your own
 * alias for your seat, which the lobby also knows but which survives a table
 * dealt without one.
 */
const nombres = (
  jugadores: number,
  tu?: string | null,
  deAsientos?: readonly string[],
): string[] =>
  Array.from({ length: jugadores }, (_, seat) =>
    seat === TU_ASIENTO
      ? (tu ?? deAsientos?.[seat] ?? 'Tú')
      : (deAsientos?.[seat] ?? nombrePorDefecto(seat)),
  )

function cartasDe(propuesta: Propuesta, hand: readonly Card[]): Card[] {
  const porId = new Map(hand.map((card) => [card.id, card]))
  return propuesta.cardIds
    .map((id) => porId.get(id))
    .filter((card): card is Card => Boolean(card))
}
