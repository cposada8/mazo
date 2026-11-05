'use client'

/**
 * The Mentiroso table, drawn from one seat's view and the public log —
 * nothing else. Whoever feeds it (this browser's bots, or the server) hands it
 * the same things, so the table never knows which.
 *
 * Redrawn on 2026-11-05 after the owner played it on a phone and found it
 * ugly and, worse, unreadable: you could not see **who threw what**, nor
 * **how many** — the middle always drew two backs, and its number was the
 * whole pile. So the table is a table now:
 *
 *   - the other seats sit **around** it — left, top, right — each with its
 *     hand as a fan of backs and a bubble with what it last declared;
 *   - the middle holds **exactly the cards of the open play**, one card for
 *     one, three for three, flying in from the seat that threw them, with
 *     «Ana declaró dos sietes» under them; the pile is apart, with its count;
 *   - you sit at the bottom: your hand across it, big, and «Tu turno» with its
 *     clock.
 *
 * A play stays open to a call until the next one lands (the owner's rule):
 * on your turn the middle says «¡Mentiroso!» or «elige tus cartas para los
 * ochos». A call turns the called cards over in the middle.
 */

import { CircleHelp, X } from 'lucide-react'
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { colorDeAsiento, iniciales } from '@/components/mesa'
import { ComoSeJuegaMentiroso } from '@/components/reglas-mentiroso'
import { type Card, type Rank, isNormal, rankIndex } from '@/lib/engine'
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

const plural = (rango: Rank) => nombreDeRango(rango).toLowerCase()
/** «2× 7»: what a bubble says — short enough to sit beside a name. */
const corto = (cantidad: number, rango: Rank) => `${cantidad}× ${rango}`

/**
 * Where each other seat sits around the table, as an angle on the ellipse
 * (180° left, 270° top, 360° right), in turn order from the seat after yours
 * — so play goes round the table the way it is drawn.
 */
function angulos(otros: number): number[] {
  if (otros === 1) return [270]
  if (otros === 2) return [215, 325]
  // The upper arc only: the lower half of the table is the play and you.
  return Array.from({ length: otros }, (_, i) => 200 + (140 / (otros - 1)) * i)
}

/**
 * A point on the table's ellipse, as percentages of the play area — kept far
 * enough from the edges that a seat's name is never cut off.
 */
function punto(angulo: number) {
  const rad = (angulo * Math.PI) / 180
  const x = 50 + 44 * Math.cos(rad)
  return { x: Math.min(86, Math.max(14, x)), y: 47 + 38 * Math.sin(rad) }
}

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
  const retirados = vista.retirados ?? []
  const meRetire = retirados.includes(yo)

  // The call to show in the middle: the last one, until the next play lands.
  const ultimo = [...eventos].reverse().find((e) => e.tipo === 'acusacion' || e.tipo === 'jugada')
  const revelada = ultimo?.tipo === 'acusacion' && !abierta ? ultimo : null
  const narracion = eventos.length > 0 ? textoDeEvento(eventos.at(-1)!, nombres, yo) : null

  // What each seat last declared — the bubble beside it. A call clears the
  // board, so only plays since the last call count.
  const declarado = useMemo(() => {
    const porAsiento = new Map<number, { cantidad: number; rango: Rank; numero: number }>()
    for (const evento of eventos) {
      if (evento.tipo === 'acusacion') porAsiento.clear()
      if (evento.tipo === 'jugada') porAsiento.set(evento.asiento, evento)
    }
    return porAsiento
  }, [eventos])

  const total = vista.cartasPorAsiento.length
  const otros = Array.from({ length: total - 1 }, (_, i) => (yo + 1 + i) % total)
  const lugares = new Map(otros.map((asiento, i) => [asiento, angulos(otros.length)[i]]))

  // Where a play flies in from: the thrower's seat on the ellipse, or below.
  const desde = (asiento: number): CSSProperties => {
    if (asiento === yo) return { ['--desde-x' as string]: '0px', ['--desde-y' as string]: '40dvh' }
    const { x, y } = punto(lugares.get(asiento) ?? 270)
    return {
      ['--desde-x' as string]: `${(x - 50) * 0.9}vw`,
      ['--desde-y' as string]: `${(y - 60) * 0.6}dvh`,
    }
  }

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

  return (
    <main
      className="text-tinta fixed inset-0 z-10 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.26_0.03_250),oklch(0.13_0.02_260)_70%)]"
      style={{
        ['--carta-md' as string]: 'clamp(3.75rem, 15dvh, 8rem)',
        ['--carta-sm' as string]: 'clamp(3rem, 12dvh, 6rem)',
        ['--carta-xs' as string]: 'clamp(1rem, 3.4dvh, 1.6rem)',
      }}
    >
      <header className="flex shrink-0 items-center justify-between px-2 pt-1">
        <button
          type="button"
          onClick={onSalir}
          aria-label="Salir de la partida"
          className="text-tinta-suave hover:text-tinta rounded-md p-2 transition-colors"
        >
          <X className="size-5" />
        </button>
        <span className="text-tinta-suave text-xs tracking-widest uppercase">
          Toca · <b className="text-tinta">{plural(vista.rangoEnTurno)}</b>
        </span>
        <button
          type="button"
          onClick={() => setReglas(true)}
          aria-label="Cómo se juega"
          className="text-tinta-suave hover:text-tinta rounded-md p-2 transition-colors"
        >
          <CircleHelp className="size-5" />
        </button>
      </header>

      {/* The table, and everybody around it but you. */}
      <section className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className="absolute inset-x-[6%] top-[12%] bottom-[3%] rounded-[50%] border-[6px] border-[#4a2c1a] bg-[radial-gradient(ellipse_at_50%_40%,oklch(0.47_0.09_158),oklch(0.33_0.075_160)_60%,oklch(0.25_0.06_162))] shadow-[inset_0_0_40px_rgba(0,0,0,0.55),0_14px_40px_rgba(0,0,0,0.6)]"
        />

        {otros.map((asiento) => {
          const { x, y } = punto(lugares.get(asiento)!)
          return (
            <Asiento
              key={asiento}
              x={x}
              y={y}
              nombre={nombres[asiento]}
              asiento={asiento}
              cartas={vista.cartasPorAsiento[asiento]}
              enTurno={enJuego && vista.turno === asiento}
              suJugadaAbierta={abierta?.asiento === asiento}
              declaro={declarado.get(asiento) ?? null}
              retirado={retirados.includes(asiento)}
            />
          )
        })}

        {/* The middle: the open play, or the call that turned it over. */}
        <div className="absolute inset-x-[8%] top-[38%] bottom-[6%] flex flex-col items-center justify-center gap-[1.2dvh] text-center">
          {revelada ? (
            <Revelacion evento={revelada} nombres={nombres} yo={yo} />
          ) : abierta ? (
            <>
              <div
                key={vista.numeroDeJugada}
                className="jugada-llega flex"
                style={desde(abierta.asiento)}
                aria-label={`${abierta.cantidad} ${abierta.cantidad === 1 ? 'carta' : 'cartas'} boca abajo`}
              >
                {Array.from({ length: abierta.cantidad }, (_, i) => (
                  <CartaBocaAbajo
                    key={i}
                    size="sm"
                    className={cn(
                      'shadow-lg',
                      i > 0 && '-ml-[calc(var(--carta-sm)*0.42)]',
                      abierta.cantidad > 1 && (i % 2 ? 'rotate-6' : '-rotate-6'),
                    )}
                  />
                ))}
              </div>
              <p className="text-[clamp(1rem,2.4dvh,1.3rem)] leading-tight font-semibold text-white drop-shadow">
                {esMiJugada ? 'Declaraste' : `${nombres[abierta.asiento]} declaró`}{' '}
                <span className="text-amber-300">
                  {cantidadDeRango(abierta.cantidad, abierta.rango)}
                </span>
                {debeDecidir && !esMiJugada && (
                  <span className="block text-sm font-normal text-white/80">
                    y se quedó sin cartas
                  </span>
                )}
              </p>
            </>
          ) : (
            enJuego && (
              <p className="text-sm text-white/80">
                {vista.turno === yo ? 'Juegas tú' : `Juega ${nombres[vista.turno]}`}
              </p>
            )
          )}

          {abierta && !esMiJugada && !meRetire && (
            <button
              type="button"
              onClick={onMentiroso}
              className="w-full max-w-[16rem] rounded-xl bg-red-600 px-6 py-[1.3dvh] text-lg font-bold tracking-wide text-white shadow-lg shadow-black/40 transition active:scale-95"
            >
              ¡Mentiroso!
            </button>
          )}
          {miTurno && debeDecidir && (
            <button
              type="button"
              onClick={onCreer}
              className="w-full max-w-[16rem] rounded-xl border border-white/40 bg-black/30 px-6 py-[1.1dvh] text-base font-semibold transition active:scale-95"
            >
              Le creo
            </button>
          )}
          {puedoJugar && (
            <p className="text-sm text-white/90 drop-shadow">
              {abierta ? 'o elige' : 'Elige'} tus cartas para los{' '}
              <b className="text-[1.15em] text-white">{plural(vista.rangoEnTurno)}</b>
            </p>
          )}
          <Pila cantidad={vista.pila} />
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

      {/* You: your hand, big, and your turn. */}
      <footer className="flex shrink-0 flex-col items-center gap-1 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        <Mano mano={mano} elegidas={elegidas} activa={puedoJugar} onTocar={alternar} />
        <div className="flex min-h-10 w-full items-center justify-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
              miTurno && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black',
            )}
            style={{ background: colorDeAsiento(yo) }}
          >
            {iniciales(nombres[yo] ?? 'Tú')}
          </span>
          {puedoJugar && elegidas.length > 0 ? (
            <button
              type="button"
              onClick={jugar}
              className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black shadow transition active:scale-95"
            >
              Jugar {elegidas.length} como {plural(vista.rangoEnTurno)}
            </button>
          ) : miTurno ? (
            <span className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white">
              Tu turno
            </span>
          ) : (
            <span className="text-tinta-suave text-xs">
              {vista.mano.length} {vista.mano.length === 1 ? 'carta' : 'cartas'}
            </span>
          )}
          {miTurno && plazoHasta !== null && (
            <Reloj
              key={`${vista.numeroDeJugada}-${vista.fase}`}
              hasta={plazoHasta}
              segundos={segundosDelPlazo}
            />
          )}
        </div>
      </footer>

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
        <Ganador ganador={vista.ganador} nombres={nombres} yo={yo} onOtra={onOtra} onSalir={onSalir} />
      )}
    </main>
  )
}

function describir(carta: Card): string {
  if (!isNormal(carta)) return 'Comodín'
  const PINTA = { spades: 'picas', hearts: 'corazones', diamonds: 'diamantes', clubs: 'tréboles' }
  return `${carta.rank} de ${PINTA[carta.suit]}`
}

/** Another seat at the table: who, how many cards, and what it last declared. */
function Asiento({
  x,
  y,
  nombre,
  asiento,
  cartas,
  enTurno,
  suJugadaAbierta,
  declaro,
  retirado,
}: {
  x: number
  y: number
  nombre: string
  asiento: number
  cartas: number
  enTurno: boolean
  suJugadaAbierta: boolean
  declaro: { cantidad: number; rango: Rank } | null
  retirado: boolean
}) {
  return (
    <div
      className={cn(
        'absolute flex w-[5.75rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center',
        retirado && 'opacity-40',
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className="relative">
        <span
          className={cn(
            'flex size-[clamp(2.25rem,7dvh,3.25rem)] items-center justify-center rounded-full text-sm font-semibold text-white shadow-lg',
            enTurno && 'ring-[3px] ring-sky-400 ring-offset-2 ring-offset-black/60',
            suJugadaAbierta && 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-black/60',
          )}
          style={{ background: colorDeAsiento(asiento) }}
        >
          {iniciales(nombre)}
        </span>
        {declaro && (
          <span
            className={cn(
              'absolute -top-2 left-[72%] rounded-full px-1.5 py-0.5 text-xs font-bold whitespace-nowrap shadow',
              suJugadaAbierta ? 'bg-amber-400 text-black' : 'bg-white/85 text-black/70',
            )}
          >
            {corto(declaro.cantidad, declaro.rango)}
          </span>
        )}
      </span>
      <span className="line-clamp-1 text-[0.72rem] leading-tight font-medium text-white drop-shadow">
        {nombre}
      </span>
      <span className="flex items-center gap-1" aria-label={`${cartas} cartas`}>
        <span className="flex">
          {Array.from({ length: Math.min(cartas, 7) }, (_, i) => (
            <CartaBocaAbajo
              key={i}
              size="xs"
              className={cn(i > 0 && '-ml-[calc(var(--carta-xs)*0.6)]')}
            />
          ))}
        </span>
        <span className="text-[0.75rem] font-semibold text-white tabular-nums drop-shadow">
          {retirado ? 'se fue' : cartas}
        </span>
      </span>
    </div>
  )
}

/** The pile, apart from the play: a small stack and its count. */
function Pila({ cantidad }: { cantidad: number }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-black/45 py-1 pr-3 pl-1.5 text-xs text-white/90"
      aria-label={`La pila: ${cantidad} cartas`}
    >
      <span className="flex">
        {Array.from({ length: Math.min(Math.max(cantidad, 1), 3) }, (_, i) => (
          <CartaBocaAbajo
            key={i}
            size="xs"
            className={cn(i > 0 && '-ml-[calc(var(--carta-xs)*0.75)]', cantidad === 0 && 'opacity-25')}
          />
        ))}
      </span>
      Pila · <b className="tabular-nums">{cantidad}</b>
    </div>
  )
}

/** A call, shown in the middle: the cards turned over, and what it meant. */
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
          'rounded-full px-3 py-0.5 text-xs font-bold tracking-widest uppercase shadow',
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
              'carta-volteada shadow-lg',
              isNormal(carta) && carta.rank !== evento.rango && 'ring-[3px] ring-red-500',
            )}
          />
        ))}
      </div>
      <p className="text-sm text-white drop-shadow">
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

  const paso = (n: number) =>
    n <= 1 || medidas.carta === 0
      ? medidas.carta + 4
      : Math.min(medidas.carta + 4, (medidas.ancho - medidas.carta) / (n - 1))
  // A corner needs about a quarter of a card showing to be read.
  const dosFilas = medidas.carta > 0 && paso(mano.length) < medidas.carta * 0.24
  const filas = dosFilas
    ? [mano.slice(0, Math.ceil(mano.length / 2)), mano.slice(Math.ceil(mano.length / 2))]
    : [mano]

  return (
    <div ref={caja} className="flex w-full flex-col items-center pt-3">
      {filas.map((fila, f) => {
        const p = paso(fila.length)
        return (
          <div key={f} className={cn('flex', f > 0 && '-mt-[calc(var(--carta-md)*0.5)]')}>
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
                    'shrink-0 rounded-md shadow-md transition-transform',
                    elegida && '-translate-y-4 ring-[3px] ring-amber-400',
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
