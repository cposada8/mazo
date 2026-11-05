'use client'

/**
 * The Mentiroso table (Phase 79), drawn from one seat's view and the public
 * log — nothing else. Whoever feeds it (this browser's bots, or the server in
 * Phase 80) hands it the same things, so the table never knows which.
 *
 * Phone first, held either way. From the top: the seats, each a disc with a
 * card count, amber for whoever is up; the felt, with the pile, the rank in
 * turn as the biggest thing on it, and — while a play is open to a call — a
 * draining bar and «¡Mentiroso!»; one line saying what just happened; and
 * your hand, with the one button that plays it.
 *
 * A call is shown where it happened: the called cards turn face up on the
 * felt, with who lied or told the truth and who took the pile, and stay there
 * until the next play lands. Everything a person needs to follow a call is on
 * the screen, without reading the log.
 */

import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { colorDeAsiento, iniciales } from '@/components/mesa'
import { type Card, isNormal, rankIndex } from '@/lib/engine'
import { MAX_CARTAS_POR_JUGADA, type VistaMentiroso } from '@/lib/engine/mentiroso'
import {
  type EventoMentiroso,
  cantidadDeRango,
  nombreDeRango,
  textoDeEvento,
} from '@/lib/relato-mentiroso'
import { cn } from '@/lib/utils'

export type PropsDeMesaMentiroso = {
  vista: VistaMentiroso
  /** Everything public that has happened, oldest first. */
  eventos: readonly EventoMentiroso[]
  /** One name per seat. */
  nombres: readonly string[]
  /** Epoch ms when the open window closes; null when none is open. */
  ventanaHasta: number | null
  /** The window's full length, for drawing how much of it is left. */
  segundosVentana: number
  /** The last refusal of one of your own moves, in words. */
  error?: string | null
  onJugar: (cartaIds: readonly string[]) => void
  onMentiroso: () => void
  onSalir: () => void
  /** Offered on the winner's screen when given. */
  onOtra?: () => void
}

/** Your hand in sequence order, A to K, so the rank in turn is easy to find. */
function ordenar(mano: readonly Card[]): Card[] {
  const SUIT = ['spades', 'hearts', 'diamonds', 'clubs']
  return [...mano].sort((a, b) =>
    isNormal(a) && isNormal(b)
      ? rankIndex(a.rank) - rankIndex(b.rank) || SUIT.indexOf(a.suit) - SUIT.indexOf(b.suit)
      : 0,
  )
}

export function MesaMentiroso({
  vista,
  eventos,
  nombres,
  ventanaHasta,
  segundosVentana,
  error,
  onJugar,
  onMentiroso,
  onSalir,
  onOtra,
}: PropsDeMesaMentiroso) {
  const yo = vista.asiento
  const [seleccion, setSeleccion] = useState<readonly string[]>([])
  const mano = useMemo(() => ordenar(vista.mano), [vista.mano])

  // A selection only means something for the hand it was made in.
  const ids = useMemo(() => new Set(vista.mano.map((c) => c.id)), [vista.mano])
  const elegidas = seleccion.filter((id) => ids.has(id))

  const miTurno = vista.ganador === null && vista.fase === 'jugar' && vista.turno === yo
  const ventanaAbierta = vista.ganador === null && vista.fase === 'ventana' && ventanaHasta !== null
  const jugadaEnVentana = ventanaAbierta ? vista.ultimaJugada : null
  const esMiJugada = jugadaEnVentana?.asiento === yo

  // The reveal stays on the felt from the call until the next play lands.
  const ultimaAcusacion = [...eventos].reverse().find((e) => e.tipo === 'acusacion' || e.tipo === 'jugada')
  const revelada = ultimaAcusacion?.tipo === 'acusacion' ? ultimaAcusacion : null
  const narracion = eventos.length > 0 ? textoDeEvento(eventos.at(-1)!, nombres, yo) : null

  const alternar = (id: string) => {
    if (!miTurno) return
    setSeleccion((actual) => {
      const vigente = actual.filter((x) => ids.has(x))
      if (vigente.includes(id)) return vigente.filter((x) => x !== id)
      if (vigente.length >= MAX_CARTAS_POR_JUGADA) return vigente
      return [...vigente, id]
    })
  }

  const jugar = () => {
    if (elegidas.length === 0) return
    onJugar(elegidas)
    setSeleccion([])
  }

  const otros = Array.from({ length: vista.cartasPorAsiento.length }, (_, i) => (yo + 1 + i) % vista.cartasPorAsiento.length).filter(
    (asiento) => asiento !== yo,
  )

  return (
    <main
      className="text-tinta fixed inset-0 z-10 flex flex-col overflow-hidden bg-[oklch(0.18_0.02_160)]"
      style={{ ['--carta-md' as string]: 'clamp(3rem, 14dvh, 5.5rem)', ['--carta-sm' as string]: 'clamp(2.25rem, 10dvh, 4rem)' }}
    >
      {/* The seats, and the way out. */}
      <header className="flex shrink-0 items-start gap-2 px-3 pt-2">
        <button
          type="button"
          onClick={onSalir}
          aria-label="Salir de la partida"
          className="text-tinta-suave hover:text-tinta mt-1 rounded-md p-1 transition-colors"
        >
          <X className="size-5" />
        </button>
        <ul className="flex flex-1 flex-wrap justify-center gap-x-3 gap-y-1">
          {otros.map((asiento) => (
            <Ficha
              key={asiento}
              nombre={nombres[asiento]}
              asiento={asiento}
              cartas={vista.cartasPorAsiento[asiento]}
              enTurno={vista.ganador === null && vista.fase === 'jugar' && vista.turno === asiento}
              enVentana={jugadaEnVentana?.asiento === asiento}
            />
          ))}
        </ul>
      </header>

      {/* The felt: the pile, the rank in turn, the window or the reveal. */}
      <section className="relative mx-3 my-2 flex min-h-0 flex-1 items-center justify-center rounded-[2rem] border border-[oklch(0.72_0.09_80/0.45)] bg-[radial-gradient(ellipse_70%_65%_at_50%_42%,oklch(0.46_0.085_158)_0%,oklch(0.36_0.075_160)_55%,oklch(0.27_0.06_162)_100%)] shadow-[0_0_0_6px_#3a2418,0_10px_30px_rgba(0,0,0,0.6)]">
        <div className="flex w-full max-w-md flex-col items-center gap-[1.5dvh] px-4 text-center">
          {revelada ? (
            <Revelacion evento={revelada} nombres={nombres} yo={yo} />
          ) : (
            <Pila cantidad={vista.pila} ultima={vista.ultimaJugada?.cantidad ?? 0} />
          )}

          {jugadaEnVentana ? (
            <div className="flex w-full flex-col items-center gap-2">
              <p className="text-sm">
                {esMiJugada ? 'Pusiste' : `${nombres[jugadaEnVentana.asiento]} dice`}{' '}
                <b>{cantidadDeRango(jugadaEnVentana.cantidad, jugadaEnVentana.rango)}</b>
                {esMiJugada ? '. ¿Te creerán?' : '. ¿Le crees?'}
              </p>
              <BarraDeVentana
                key={`${vista.numeroDeJugada}`}
                hasta={ventanaHasta!}
                segundos={segundosVentana}
              />
              <button
                type="button"
                onClick={onMentiroso}
                disabled={esMiJugada}
                className="w-full max-w-xs rounded-xl bg-red-600 px-6 py-[1.6dvh] text-lg font-bold tracking-wide text-white shadow-lg transition active:scale-95 disabled:opacity-30"
              >
                ¡Mentiroso!
              </button>
            </div>
          ) : (
            vista.ganador === null && (
              <div className="flex flex-col items-center">
                <span className="text-tinta-suave text-xs tracking-widest uppercase">Toca</span>
                <span className="text-4xl font-bold tracking-tight">
                  {nombreDeRango(vista.rangoEnTurno)}
                </span>
                <span className="text-tinta-suave text-xs">
                  {vista.turno === yo ? 'Te toca a ti' : `Juega ${nombres[vista.turno]}`}
                </span>
              </div>
            )
          )}
        </div>
      </section>

      {/* One line: what just happened, or what went wrong. */}
      <p
        aria-live="polite"
        className={cn(
          'min-h-[1.25rem] shrink-0 px-4 text-center text-sm',
          error ? 'text-red-300' : 'text-tinta-suave',
        )}
      >
        {error ?? narracion}
      </p>

      {/* Your hand, and the button that plays it. */}
      <footer className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-tinta-suave">
            Tu mano · {vista.mano.length} {vista.mano.length === 1 ? 'carta' : 'cartas'}
          </span>
          {miTurno && (
            <button
              type="button"
              onClick={jugar}
              disabled={elegidas.length === 0}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black shadow transition active:scale-95 disabled:opacity-40"
            >
              {elegidas.length === 0
                ? `Elige 1 a 4 cartas: van como ${PLURAL_CORTO(vista.rangoEnTurno)}`
                : `Jugar ${elegidas.length} como ${PLURAL_CORTO(vista.rangoEnTurno)}`}
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto pt-3 pb-1">
          <div className="mx-auto flex">
            {mano.map((carta, i) => {
              const elegida = elegidas.includes(carta.id)
              return (
                <button
                  key={carta.id}
                  type="button"
                  onClick={() => alternar(carta.id)}
                  aria-pressed={elegida}
                  aria-label={`${describir(carta)}${elegida ? ', elegida' : ''}`}
                  disabled={!miTurno}
                  className={cn(
                    'shrink-0 rounded-md transition-transform',
                    // A fan only as tight as the hand needs: a few cards sit
                    // side by side, a big hand overlaps to its corners.
                    i > 0 &&
                      (mano.length <= 5
                        ? 'ml-1'
                        : mano.length <= 9
                          ? '-ml-[calc(var(--carta-md)*0.25)]'
                          : '-ml-[calc(var(--carta-md)*0.42)]'),
                    elegida && '-translate-y-3 ring-2 ring-amber-400',
                  )}
                >
                  <Carta card={carta} />
                </button>
              )
            })}
          </div>
        </div>
      </footer>

      {vista.ganador !== null && (
        <Ganador
          ganador={vista.ganador}
          nombres={nombres}
          yo={yo}
          onOtra={onOtra}
          onSalir={onSalir}
        />
      )}
    </main>
  )
}

const PLURAL_CORTO = (rango: VistaMentiroso['rangoEnTurno']) => nombreDeRango(rango).toLowerCase()

function describir(carta: Card): string {
  if (!isNormal(carta)) return 'Comodín'
  const PINTA = { spades: 'picas', hearts: 'corazones', diamonds: 'diamantes', clubs: 'tréboles' }
  return `${carta.rank} de ${PINTA[carta.suit]}`
}

function Ficha({
  nombre,
  asiento,
  cartas,
  enTurno,
  enVentana,
}: {
  nombre: string
  asiento: number
  cartas: number
  enTurno: boolean
  enVentana: boolean
}) {
  return (
    <li className="flex w-[4.75rem] flex-col items-center gap-0.5 text-center">
      <span
        className={cn(
          'relative flex size-[clamp(1.75rem,7dvh,2.5rem)] items-center justify-center rounded-full text-sm font-semibold text-white',
          enTurno && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black',
          enVentana && 'ring-2 ring-red-400 ring-offset-2 ring-offset-black',
        )}
        style={{ background: colorDeAsiento(asiento) }}
      >
        {iniciales(nombre)}
        <span className="absolute -right-1.5 -bottom-1 min-w-5 rounded-full bg-black/80 px-1 text-[0.65rem] leading-4 tabular-nums">
          {cartas}
        </span>
      </span>
      <span className="text-tinta-suave line-clamp-2 text-[0.7rem] leading-tight">{nombre}</span>
    </li>
  )
}

/** The pile, face down, its count on it. The top play is drawn a little apart. */
function Pila({ cantidad, ultima }: { cantidad: number; ultima: number }) {
  if (cantidad === 0) {
    return (
      <div className="text-tinta-tenue flex h-[var(--carta-sm)] items-center text-xs">
        La pila está vacía
      </div>
    )
  }
  const debajo = Math.min(3, cantidad - ultima)
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`La pila: ${cantidad} cartas`}>
      <div className="relative flex">
        {Array.from({ length: debajo }, (_, i) => (
          <CartaBocaAbajo key={`d${i}`} size="sm" className={cn(i > 0 && '-ml-[calc(var(--carta-sm)*0.62)]')} />
        ))}
        {Array.from({ length: Math.min(ultima, 4) }, (_, i) => (
          <CartaBocaAbajo
            key={`u${i}`}
            size="sm"
            className={cn(
              debajo > 0 || i > 0 ? '-ml-[calc(var(--carta-sm)*0.5)]' : '',
              '-translate-y-1 rotate-3',
            )}
          />
        ))}
      </div>
      <span className="text-tinta-suave text-xs tabular-nums">
        {cantidad} {cantidad === 1 ? 'carta' : 'cartas'} en la pila
      </span>
    </div>
  )
}

/** A call, shown on the felt: the cards turned over, and what it meant. */
function Revelacion({
  evento,
  nombres,
  yo,
}: {
  evento: Extract<EventoMentiroso, { tipo: 'acusacion' }>
  nombres: readonly string[]
  yo: number
}) {
  const quien = (asiento: number) => (asiento === yo ? 'tú' : nombres[asiento])
  return (
    <div className="flex flex-col items-center gap-1.5" role="status">
      <span
        className={cn(
          'rounded-full px-3 py-0.5 text-xs font-bold tracking-widest uppercase',
          evento.eraMentira ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white',
        )}
      >
        {evento.eraMentira ? '¡Mentira!' : 'Era verdad'}
      </span>
      <div className="flex gap-1">
        {evento.cartas.map((carta) => (
          <Carta
            key={carta.id}
            card={carta}
            size="sm"
            className={cn(
              'carta-volteada',
              isNormal(carta) && carta.rank !== evento.rango && 'ring-2 ring-red-500',
            )}
          />
        ))}
      </div>
      <p className="text-xs">
        {evento.acusado === yo ? 'Dijiste' : `${nombres[evento.acusado]} dijo`}{' '}
        {cantidadDeRango(evento.cartas.length, evento.rango)}.{' '}
        <b>
          {evento.seLlevo === yo ? 'Te llevas' : `${quien(evento.seLlevo)} se lleva`} la pila
        </b>{' '}
        ({evento.cartasDeLaPila})
      </p>
    </div>
  )
}

/**
 * How much of the window is left, as a bar that drains. Keyed by the play, so
 * a new window restarts it; a CSS animation does the draining, and a page
 * that mounts late starts it partway through.
 */
function BarraDeVentana({ hasta, segundos }: { hasta: number; segundos: number }) {
  // The clock is read in effects and the initializer, never while rendering.
  const [inicio] = useState(() => Date.now())
  const [ahora, setAhora] = useState(inicio)
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const restante = Math.max(0, hasta - inicio) / 1000
  const segundosQuedan = Math.max(0, Math.ceil((hasta - ahora) / 1000))
  return (
    <div className="flex w-full max-w-xs items-center gap-2" aria-label={`Quedan ${segundosQuedan} segundos para acusar`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
        <div
          className="ventana-agota h-full origin-left rounded-full bg-red-400"
          style={{
            animationDuration: `${segundos}s`,
            animationDelay: `-${Math.max(0, segundos - restante)}s`,
          }}
        />
      </div>
      <span className="text-tinta-suave w-4 text-right text-xs tabular-nums">{segundosQuedan}</span>
    </div>
  )
}

function Ganador({
  ganador,
  nombres,
  yo,
  onOtra,
  onSalir,
}: {
  ganador: number
  nombres: readonly string[]
  yo: number
  onOtra?: () => void
  onSalir: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
      <div className="bg-background text-foreground flex w-full max-w-xs flex-col items-center gap-4 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">Fin de la partida</p>
        <p className="text-2xl font-semibold">
          {ganador === yo ? '¡Ganaste!' : `Ganó ${nombres[ganador]}`}
        </p>
        <p className="text-muted-foreground text-sm">
          {ganador === yo ? 'Te quedaste sin cartas.' : 'Se quedó sin cartas.'}
        </p>
        <div className="flex w-full flex-col gap-2">
          {onOtra && (
            <button
              type="button"
              onClick={onOtra}
              autoFocus
              className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium"
            >
              Otra
            </button>
          )}
          <button
            type="button"
            onClick={onSalir}
            className="border-input hover:bg-accent rounded-md border px-4 py-2.5 text-sm"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
