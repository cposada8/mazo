'use client'

/**
 * The Mentiroso table (Phases 79–80), drawn from one seat's view and the
 * public log — nothing else. Whoever feeds it (this browser's bots, or the
 * server) hands it the same things, so the table never knows which.
 *
 * Phone first, held either way. Reworked once (2026-11-05) with Plato's table
 * as the owner's reference — not its look — and with the rule that came with
 * it: **the next play closes a play's window**. So the felt is about the one
 * decision at hand. From the top:
 *
 *   - the other seats: a disc, a little fan of backs for the hand, the count;
 *   - the felt: the pile as one big face-down card with its count on it, what
 *     was declared in large type, and the decision — «¡Mentiroso!», and if it
 *     is your turn «o elige tus cartas para los ochos»; a call turns the
 *     called cards over right there;
 *   - «Tu turno» and the turn's clock;
 *   - your whole hand, always all of it on screen: the overlap is computed
 *     from the width, and a hand too big for one row takes two.
 */

import { CircleHelp, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { colorDeAsiento, iniciales } from '@/components/mesa'
import { ComoSeJuegaMentiroso } from '@/components/reglas-mentiroso'
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
  /**
   * When the seat in turn must have acted, epoch ms — a bot's thinking, or a
   * person's clock. Null when nobody is timed (you, alone with bots).
   */
  plazoHasta: number | null
  /** That deadline's full length, to draw how much of it is left. */
  segundosDelPlazo: number
  /** The last refusal of one of your own moves, in words. */
  error?: string | null
  onJugar: (cartaIds: readonly string[]) => void
  onMentiroso: () => void
  /** «Le creo»: accept a play that emptied its player's hand. */
  onCreer: () => void
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

const plural = (rango: VistaMentiroso['rangoEnTurno']) => nombreDeRango(rango).toLowerCase()

export function MesaMentiroso({
  vista,
  eventos,
  nombres,
  plazoHasta,
  segundosDelPlazo,
  error,
  onJugar,
  onMentiroso,
  onCreer,
  onSalir,
  onOtra,
}: PropsDeMesaMentiroso) {
  const yo = vista.asiento
  const [seleccion, setSeleccion] = useState<readonly string[]>([])
  const [reglas, setReglas] = useState(false)
  const mano = useMemo(() => ordenar(vista.mano), [vista.mano])
  const ids = useMemo(() => new Set(vista.mano.map((c) => c.id)), [vista.mano])
  const elegidas = seleccion.filter((id) => ids.has(id))

  const enJuego = vista.ganador === null && !vista.sinGanador
  const abierta = enJuego && vista.fase === 'ventana' ? vista.ultimaJugada : null
  const esMiJugada = abierta?.asiento === yo
  const miTurno = enJuego && vista.turno === yo
  // The open play emptied a hand: whoever is in turn must call or accept.
  const debeDecidir = abierta !== null && vista.cartasPorAsiento[abierta.asiento] === 0
  const puedoJugar = miTurno && !debeDecidir

  const ultima = [...eventos].reverse().find((e) => e.tipo === 'acusacion' || e.tipo === 'jugada')
  const revelada = ultima?.tipo === 'acusacion' ? ultima : null
  const narracion = eventos.length > 0 ? textoDeEvento(eventos.at(-1)!, nombres, yo) : null

  const alternar = (id: string) => {
    if (!puedoJugar) return
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

  const total = vista.cartasPorAsiento.length
  const otros = Array.from({ length: total - 1 }, (_, i) => (yo + 1 + i) % total)
  const retirados = vista.retirados ?? []

  return (
    <main
      className="text-tinta fixed inset-0 z-10 flex flex-col overflow-hidden bg-[oklch(0.18_0.02_160)]"
      style={{
        ['--carta-md' as string]: 'clamp(3.25rem, 13dvh, 6rem)',
        ['--carta-sm' as string]: 'clamp(2.5rem, 11dvh, 4.5rem)',
        ['--carta-xs' as string]: 'clamp(0.9rem, 3.2dvh, 1.4rem)',
      }}
    >
      {/* The other seats, and the way out. */}
      <header className="flex shrink-0 items-start gap-2 px-3 pt-2">
        <button
          type="button"
          onClick={onSalir}
          aria-label="Salir de la partida"
          className="text-tinta-suave hover:text-tinta mt-1 rounded-md p-1 transition-colors"
        >
          <X className="size-5" />
        </button>
        <ul className="flex flex-1 flex-wrap justify-center gap-x-2 gap-y-1">
          {otros.map((asiento) => (
            <Ficha
              key={asiento}
              nombre={nombres[asiento]}
              asiento={asiento}
              cartas={vista.cartasPorAsiento[asiento]}
              enTurno={enJuego && vista.turno === asiento}
              suJugadaAbierta={abierta?.asiento === asiento}
              retirado={retirados.includes(asiento)}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setReglas(true)}
          aria-label="Cómo se juega"
          className="text-tinta-suave hover:text-tinta mt-1 rounded-md p-1 transition-colors"
        >
          <CircleHelp className="size-5" />
        </button>
      </header>

      {/* The felt: the pile, what was declared, and the decision at hand. */}
      <section className="relative mx-3 my-2 flex min-h-0 flex-1 items-center justify-center rounded-[2rem] border border-[oklch(0.72_0.09_80/0.45)] bg-[radial-gradient(ellipse_70%_65%_at_50%_42%,oklch(0.46_0.085_158)_0%,oklch(0.36_0.075_160)_55%,oklch(0.27_0.06_162)_100%)] shadow-[0_0_0_6px_#3a2418,0_10px_30px_rgba(0,0,0,0.6)]">
        <div className="flex w-full max-w-md flex-col items-center gap-[1.6dvh] px-4 text-center">
          {revelada && !abierta ? (
            <Revelacion evento={revelada} nombres={nombres} yo={yo} />
          ) : (
            <Pila cantidad={vista.pila} />
          )}

          {abierta ? (
            <p className="text-[clamp(1rem,2.6dvh,1.4rem)] leading-snug font-semibold">
              {esMiJugada ? 'Declaraste' : `${nombres[abierta.asiento]} declaró`}{' '}
              {cantidadDeRango(abierta.cantidad, abierta.rango)}
              {debeDecidir && !esMiJugada && (
                <span className="text-tinta-suave block text-sm font-normal">
                  y se quedó sin cartas
                </span>
              )}
            </p>
          ) : (
            enJuego && (
              <p className="text-tinta-suave text-sm">
                {vista.turno === yo ? 'Juegas tú' : `Juega ${nombres[vista.turno]}`}
              </p>
            )
          )}

          {abierta && !esMiJugada && retirados.includes(yo) === false && (
            <button
              type="button"
              onClick={onMentiroso}
              className="w-full max-w-xs rounded-xl bg-red-600 px-6 py-[1.5dvh] text-lg font-bold tracking-wide text-white shadow-lg transition active:scale-95"
            >
              ¡Mentiroso!
            </button>
          )}

          {miTurno && debeDecidir && (
            <button
              type="button"
              onClick={onCreer}
              className="border-tinta-suave/50 w-full max-w-xs rounded-xl border bg-black/25 px-6 py-[1.2dvh] text-base font-semibold transition active:scale-95"
            >
              Le creo
            </button>
          )}

          {enJuego && (
            <p className="text-sm">
              {puedoJugar ? (
                <>
                  {abierta && 'o '}elige tus cartas para los{' '}
                  <b className="text-[1.15em]">{plural(vista.rangoEnTurno)}</b>
                </>
              ) : (
                <span className="text-tinta-suave">
                  Toca: <b className="text-tinta">{plural(vista.rangoEnTurno)}</b>
                </span>
              )}
            </p>
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

      <footer className="flex shrink-0 flex-col gap-1.5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-9 items-center justify-between gap-2">
          {miTurno ? (
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-sky-600 px-3 py-1 text-sm font-semibold text-white">
                Tu turno
              </span>
              {plazoHasta !== null && (
                <Reloj
                  key={`${vista.numeroDeJugada}-${vista.fase}`}
                  hasta={plazoHasta}
                  segundos={segundosDelPlazo}
                />
              )}
            </span>
          ) : (
            <span className="text-tinta-suave text-xs">
              Tu mano · {vista.mano.length} {vista.mano.length === 1 ? 'carta' : 'cartas'}
            </span>
          )}
          {puedoJugar && elegidas.length > 0 && (
            <button
              type="button"
              onClick={jugar}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow transition active:scale-95"
            >
              Jugar {elegidas.length} como {plural(vista.rangoEnTurno)}
            </button>
          )}
        </div>
        <Mano mano={mano} elegidas={elegidas} activa={puedoJugar} onTocar={alternar} />
      </footer>

      {/* The rules over the felt (Phase 81): the game keeps going under them. */}
      {reglas && (
        <div className="absolute inset-0 z-30 flex justify-center bg-black/70 p-3">
          <div className="bg-background text-foreground flex max-h-full w-full max-w-md flex-col rounded-xl border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">Cómo se juega</h2>
              <button
                type="button"
                onClick={() => setReglas(false)}
                autoFocus
                aria-label="Cerrar las reglas"
                className="text-muted-foreground hover:text-foreground rounded-md p-1"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4">
              <ComoSeJuegaMentiroso />
            </div>
          </div>
        </div>
      )}

      {(vista.ganador !== null || vista.sinGanador) && (
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

function describir(carta: Card): string {
  if (!isNormal(carta)) return 'Comodín'
  const PINTA = { spades: 'picas', hearts: 'corazones', diamonds: 'diamantes', clubs: 'tréboles' }
  return `${carta.rank} de ${PINTA[carta.suit]}`
}

/**
 * The whole hand, on screen, always. The overlap is computed from the width
 * the footer has: as loose as fits, never so tight a card's corner is hidden —
 * and past that, two rows. A hand never scrolls sideways, because a card you
 * cannot see is a card you forget you hold.
 */
function Mano({
  mano,
  elegidas,
  activa,
  onTocar,
}: {
  mano: readonly Card[]
  elegidas: readonly string[]
  activa: boolean
  onTocar: (id: string) => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [medidas, setMedidas] = useState({ ancho: 0, carta: 0 })

  useLayoutEffect(() => {
    const nodo = caja.current
    if (!nodo) return
    const medir = () => {
      const primera = nodo.querySelector<HTMLElement>('[data-carta]')
      setMedidas({ ancho: nodo.clientWidth, carta: primera?.offsetWidth ?? 0 })
    }
    medir()
    // Where the platform has no ResizeObserver (old browsers, the test DOM),
    // the window's own resize is close enough: the footer spans it.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [mano.length])

  // How far apart cards sit in a row of `n`: their width plus a gap if there
  // is room, less if not.
  const paso = (n: number) =>
    n <= 1 || medidas.carta === 0
      ? medidas.carta + 4
      : Math.min(medidas.carta + 4, (medidas.ancho - medidas.carta) / (n - 1))
  // A corner needs about a third of a card showing to be read.
  const dosFilas = medidas.carta > 0 && paso(mano.length) < medidas.carta * 0.32
  const filas = dosFilas
    ? [mano.slice(0, Math.ceil(mano.length / 2)), mano.slice(Math.ceil(mano.length / 2))]
    : [mano]

  return (
    <div ref={caja} className="flex flex-col items-center pt-3">
      {filas.map((fila, f) => {
        const p = paso(fila.length)
        return (
          <div key={f} className={cn('flex', f > 0 && '-mt-[calc(var(--carta-md)*0.45)]')}>
            {fila.map((carta, i) => {
              const elegida = elegidas.includes(carta.id)
              return (
                <button
                  key={carta.id}
                  data-carta
                  type="button"
                  onClick={() => onTocar(carta.id)}
                  aria-pressed={elegida}
                  aria-label={`${describir(carta)}${elegida ? ', elegida' : ''}`}
                  disabled={!activa}
                  style={i > 0 && medidas.carta > 0 ? { marginLeft: p - medidas.carta } : undefined}
                  className={cn(
                    'shrink-0 rounded-md transition-transform',
                    elegida && '-translate-y-3 ring-2 ring-amber-400',
                  )}
                >
                  <Carta card={carta} />
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Ficha({
  nombre,
  asiento,
  cartas,
  enTurno,
  suJugadaAbierta,
  retirado,
}: {
  nombre: string
  asiento: number
  cartas: number
  enTurno: boolean
  suJugadaAbierta: boolean
  retirado: boolean
}) {
  return (
    <li
      className={cn('flex w-[5rem] flex-col items-center gap-0.5 text-center', retirado && 'opacity-40')}
    >
      <span
        className={cn(
          'relative flex size-[clamp(1.75rem,6.5dvh,2.5rem)] items-center justify-center rounded-full text-sm font-semibold text-white',
          enTurno && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black',
          suJugadaAbierta && 'ring-2 ring-red-400 ring-offset-2 ring-offset-black',
        )}
        style={{ background: colorDeAsiento(asiento) }}
      >
        {iniciales(nombre)}
      </span>
      <span className="text-tinta-suave line-clamp-1 text-[0.7rem] leading-tight">{nombre}</span>
      {/* The hand as a little fan of backs: how big it is, at a glance. */}
      <span className="flex items-center gap-1" aria-label={`${cartas} cartas`}>
        <span className="flex">
          {Array.from({ length: Math.min(cartas, 6) }, (_, i) => (
            <CartaBocaAbajo
              key={i}
              size="xs"
              className={cn(i > 0 && '-ml-[calc(var(--carta-xs)*0.55)]')}
            />
          ))}
        </span>
        <span className="text-[0.7rem] tabular-nums">{retirado ? 'se fue' : cartas}</span>
      </span>
    </li>
  )
}

/** The pile: one big face-down card with the count on it, a few more under it. */
function Pila({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) {
    return (
      <div className="text-tinta-tenue flex h-[var(--carta-md)] items-center text-sm">
        La pila está vacía
      </div>
    )
  }
  return (
    <div className="relative" aria-label={`La pila: ${cantidad} cartas`}>
      {cantidad > 1 && (
        <CartaBocaAbajo className="absolute top-0 left-0 translate-x-1.5 -translate-y-1 rotate-6 opacity-80" />
      )}
      <CartaBocaAbajo className="relative" />
      <span className="absolute -bottom-3 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-black/85 text-sm font-bold tabular-nums ring-2 ring-white/20">
        {cantidad}
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
      <p className="text-sm">
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

/** The turn's clock, as a bar that drains. Keyed by the turn, so a new one restarts it. */
function Reloj({ hasta, segundos }: { hasta: number; segundos: number }) {
  const [inicio] = useState(() => Date.now())
  const [ahora, setAhora] = useState(inicio)
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const restante = Math.max(0, hasta - inicio) / 1000
  const quedan = Math.max(0, Math.ceil((hasta - ahora) / 1000))
  return (
    <span className="flex w-24 items-center gap-1.5" aria-label={`Quedan ${quedan} segundos`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
        <span
          className="ventana-agota block h-full origin-left rounded-full bg-amber-400"
          style={{
            animationDuration: `${segundos}s`,
            animationDelay: `-${Math.max(0, segundos - restante)}s`,
          }}
        />
      </span>
      <span className="text-tinta-suave w-5 text-right text-xs tabular-nums">{quedan}</span>
    </span>
  )
}

function Ganador({
  ganador,
  nombres,
  yo,
  onOtra,
  onSalir,
}: {
  ganador: number | null
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
          {ganador === null ? 'Sin ganador' : ganador === yo ? '¡Ganaste!' : `Ganó ${nombres[ganador]}`}
        </p>
        <p className="text-muted-foreground text-sm">
          {ganador === null
            ? 'Quedaron muy pocos en la mesa para seguir.'
            : ganador === yo
              ? 'Te quedaste sin cartas.'
              : 'Se quedó sin cartas.'}
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
