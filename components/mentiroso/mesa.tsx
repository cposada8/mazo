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
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { colorDeAsiento, iniciales } from '@/components/mesa'
import { ComoSeJuegaMentiroso } from '@/components/reglas-mentiroso'
import { type Card, type Rank, isNormal, rankIndex } from '@/lib/engine'
import { MAX_CARTAS_POR_JUGADA, type VistaMentiroso } from '@/lib/engine/mentiroso'
import {
  type EventoMentiroso,
  MS_GRITO,
  MS_POR_VOLTEO,
  MS_RECOGE,
  MS_VEREDICTO,
  MS_VUELO_JUGADA,
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

  // The table tells what happened one event at a time, in the times of
  // `lib/relato-mentiroso.ts`: a play flies in, a call is shouted, turned over,
  // judged and carried off. Everything in the middle is drawn from what has
  // been *told*, never from the state ahead of it.
  const escena = useEscenas(eventos)
  const hasta = escena.contados
  const contados = useMemo(() => eventos.slice(0, hasta), [eventos, hasta])
  const enEscena = escena.evento
  const alDia = escena.contados === eventos.length && enEscena === null
  const ultimoContado = [...contados]
    .reverse()
    .find((e) => e.tipo === 'acusacion' || e.tipo === 'jugada')
  const jugadaEnMedio = ultimoContado?.tipo === 'jugada' ? ultimoContado : null
  const narracion = contados.length > 0 ? textoDeEvento(contados.at(-1)!, nombres, yo) : null

  // What each seat last declared — the bubble beside it. A call clears the
  // board, so only plays since the last call count.
  const declarado = useMemo(() => {
    const porAsiento = new Map<number, { cantidad: number; rango: Rank; numero: number }>()
    for (const evento of contados) {
      if (evento.tipo === 'acusacion') porAsiento.clear()
      if (evento.tipo === 'jugada') porAsiento.set(evento.asiento, evento)
    }
    return porAsiento
  }, [contados])

  const total = vista.cartasPorAsiento.length
  const otros = Array.from({ length: total - 1 }, (_, i) => (yo + 1 + i) % total)
  const lugares = new Map(otros.map((asiento, i) => [asiento, angulos(otros.length)[i]]))
  const gritando =
    enEscena?.tipo === 'acusacion' && escena.etapa === 'grito' ? enEscena.acusador : null

  // Whoever takes the pile only has it once it has crossed the table: until
  // the scene ends their count — and, if it is you, your hand — stays as it
  // was. (The state took it at once; the table shows it arriving.)
  const recogiendo = enEscena?.tipo === 'acusacion' ? enEscena : null
  const cartasDe = (asiento: number) =>
    vista.cartasPorAsiento[asiento] -
    (recogiendo && recogiendo.seLlevo === asiento ? recogiendo.cartasDeLaPila : 0)
  const [manoFija, setManoFija] = useState(vista.mano)
  const retener = recogiendo?.seLlevo === yo
  if (!retener && manoFija !== vista.mano) setManoFija(vista.mano)

  const mano = useMemo(() => ordenar(retener ? manoFija : vista.mano), [retener, manoFija, vista.mano])

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
        ['--carta-md' as string]: 'clamp(3.5rem, 12dvh, 6.5rem)',
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
              cartas={cartasDe(asiento)}
              enTurno={enJuego && vista.turno === asiento}
              suJugadaAbierta={jugadaEnMedio?.asiento === asiento && enEscena === null}
              declaro={declarado.get(asiento) ?? null}
              gritando={gritando === asiento}
              retirado={retirados.includes(asiento)}
            />
          )
        })}

        {/* The middle: what is being told now, or the last play told. */}
        <div className="absolute inset-x-[8%] top-[38%] bottom-[6%] flex flex-col items-center justify-center gap-[1.2dvh] text-center">
          {enEscena?.tipo === 'acusacion' ? (
            <Revelacion
              key={`acusacion-${escena.contados}`}
              evento={enEscena}
              etapa={escena.etapa!}
              volteadas={escena.volteadas}
              nombres={nombres}
              yo={yo}
            />
          ) : enEscena?.tipo === 'jugada' ? (
            <Viajan key={`vuela-${escena.contados}`} desde={enEscena.asiento} ms={MS_VUELO_JUGADA}>
              <Dorsos cantidad={enEscena.cantidad} />
            </Viajan>
          ) : jugadaEnMedio ? (
            <>
              <Dorsos cantidad={jugadaEnMedio.cantidad} />
              <p className="text-[clamp(1rem,2.4dvh,1.3rem)] leading-tight font-semibold text-white drop-shadow">
                {jugadaEnMedio.asiento === yo ? 'Declaraste' : `${nombres[jugadaEnMedio.asiento]} declaró`}{' '}
                <span className="text-amber-300">
                  {cantidadDeRango(jugadaEnMedio.cantidad, jugadaEnMedio.rango)}
                </span>
                {alDia && debeDecidir && !esMiJugada && (
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

          {/* Only what has been seen can be called: the button waits for the table. */}
          {alDia && abierta && !esMiJugada && !meRetire && (
            <button
              type="button"
              onClick={onMentiroso}
              className="w-full max-w-[16rem] rounded-xl bg-red-600 px-6 py-[1.3dvh] text-lg font-bold tracking-wide text-white shadow-lg shadow-black/40 transition active:scale-95"
            >
              ¡Mentiroso!
            </button>
          )}
          {alDia && miTurno && debeDecidir && (
            <button
              type="button"
              onClick={onCreer}
              className="w-full max-w-[16rem] rounded-xl border border-white/40 bg-black/30 px-6 py-[1.1dvh] text-base font-semibold transition active:scale-95"
            >
              Le creo
            </button>
          )}
          {alDia && puedoJugar && (
            <p className="text-sm text-white/90 drop-shadow">
              {abierta ? 'o elige' : 'Elige'} tus cartas para los{' '}
              <b className="text-[1.15em] text-white">{plural(vista.rangoEnTurno)}</b>
            </p>
          )}
          <Pila cantidad={vista.pila + (recogiendo ? recogiendo.cartasDeLaPila : 0)} />
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
            data-asiento={yo}
            className={cn(
              'relative',
              'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
              miTurno && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black',
            )}
            style={{ background: colorDeAsiento(yo) }}
          >
            {iniciales(nombres[yo] ?? 'Tú')}
            {gritando === yo && <Grito className="-top-1 left-full ml-2 translate-x-0" />}
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
  gritando,
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
  /** Shouting «¡Mentiroso!» right now — the first beat of a call. */
  gritando: boolean
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
        {gritando && <Grito />}
        <span
          data-asiento={asiento}
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

type Etapa = 'vuela' | 'grito' | 'volteo' | 'veredicto' | 'recoge'

/** The beats an event is told in, and how long each lasts. */
function planDe(evento: EventoMentiroso): { etapa: Etapa; ms: number }[] {
  if (evento.tipo === 'jugada') return [{ etapa: 'vuela', ms: MS_VUELO_JUGADA }]
  if (evento.tipo === 'acusacion') {
    return [
      { etapa: 'grito', ms: MS_GRITO },
      ...evento.cartas.map(() => ({ etapa: 'volteo' as const, ms: MS_POR_VOLTEO })),
      { etapa: 'volteo', ms: 300 },
      { etapa: 'veredicto', ms: MS_VEREDICTO },
      { etapa: 'recoge', ms: MS_RECOGE },
    ]
  }
  return []
}

/**
 * Tells the log one event at a time (Carioca's rule, Phases 58–60: the state
 * has moved, the eye catches up). Starts caught up — a table opened mid-game
 * does not replay its history — and, when it falls behind by more than an
 * event, tells the backlog at a fraction of the pace instead of dropping it.
 */
function useEscenas(eventos: readonly EventoMentiroso[]) {
  const [contados, setContados] = useState(eventos.length)
  const [paso, setPaso] = useState<number | null>(null)
  // A new partida at the same table starts a new log.
  const [largo, setLargo] = useState(eventos.length)
  if (eventos.length < largo) {
    setLargo(eventos.length)
    setContados(eventos.length)
    setPaso(null)
  } else if (eventos.length !== largo) {
    setLargo(eventos.length)
  }

  const evento = contados < eventos.length ? eventos[contados] : null
  const plan = useMemo(() => (evento ? planDe(evento) : []), [evento])

  useEffect(() => {
    if (!evento) return
    if (plan.length === 0) {
      const t = setTimeout(() => setContados((c) => c + 1), 0)
      return () => clearTimeout(t)
    }
    if (paso === null) {
      const t = setTimeout(() => setPaso(0), 0)
      return () => clearTimeout(t)
    }
    const atrasado = eventos.length - contados > 2
    const t = setTimeout(
      () => {
        if (paso + 1 < plan.length) setPaso(paso + 1)
        else {
          setPaso(null)
          setContados((c) => c + 1)
        }
      },
      atrasado ? plan[paso].ms * 0.35 : plan[paso].ms,
    )
    return () => clearTimeout(t)
  }, [evento, plan, paso, eventos.length, contados])

  const enCurso = evento && paso !== null && plan.length > 0
  return {
    contados,
    evento: enCurso ? evento : null,
    etapa: enCurso ? plan[paso].etapa : null,
    /** During a call: how many of its cards are face up so far. */
    volteadas: enCurso ? Math.max(0, paso - 1 + (plan[paso].etapa === 'volteo' ? 1 : 0)) : 0,
  }
}

/**
 * Cards in transit between two seats and the middle, measured from the live
 * layout (`data-asiento`) the way Carioca's `CartaViajera` is: the element
 * starts where `desde` is and slides into place, or slides from its place to
 * `hacia` and fades as it arrives.
 */
function Viajan({
  desde,
  hacia,
  ms,
  children,
}: {
  desde?: number
  hacia?: number
  ms: number
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const raiz = el?.closest('main')
    if (!el || !raiz) return
    const punto = (asiento: number) => raiz.querySelector(`[data-asiento="${asiento}"]`)
    const propio = el.getBoundingClientRect()
    const centro = (r: DOMRect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
    const yo = centro(propio)
    const delta = (asiento: number) => {
      const otro = punto(asiento)
      if (!otro) return null
      const c = centro(otro.getBoundingClientRect())
      return `translate(${c.x - yo.x}px, ${c.y - yo.y}px) scale(0.35)`
    }
    if (desde !== undefined) {
      const inicio = delta(desde)
      if (!inicio) return
      el.style.transform = inicio
      el.style.opacity = '0.6'
      const marco = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.7, 0.3, 1), opacity ${ms * 0.5}ms ease-out`
          el.style.transform = 'none'
          el.style.opacity = '1'
        }),
      )
      return () => cancelAnimationFrame(marco)
    }
    if (hacia !== undefined) {
      const fin = delta(hacia)
      if (!fin) return
      const marco = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = `transform ${ms}ms ease-in, opacity ${ms * 0.4}ms ease-in ${ms * 0.6}ms`
          el.style.transform = fin
          el.style.opacity = '0'
        }),
      )
      return () => cancelAnimationFrame(marco)
    }
  }, [desde, hacia, ms])
  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  )
}

/** A play's cards, face down: exactly as many as were thrown. */
function Dorsos({ cantidad }: { cantidad: number }) {
  return (
    <div className="flex" aria-label={`${cantidad} ${cantidad === 1 ? 'carta' : 'cartas'} boca abajo`}>
      {Array.from({ length: cantidad }, (_, i) => (
        <CartaBocaAbajo
          key={i}
          size="sm"
          className={cn(
            'shadow-lg',
            i > 0 && '-ml-[calc(var(--carta-sm)*0.42)]',
            cantidad > 1 && (i % 2 ? 'rotate-6' : '-rotate-6'),
          )}
        />
      ))}
    </div>
  )
}

/** «¡Mentiroso!», shouted from a seat: the first beat of a call. */
function Grito({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grito absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-full bg-red-600 px-3 py-1 text-sm font-black whitespace-nowrap text-white shadow-lg',
        className,
      )}
    >
      ¡Mentiroso!
    </span>
  )
}

/**
 * A call, told in beats: the shout (cards still face down), the cards turning
 * one by one, the verdict, and the pile carried off to whoever takes it —
 * after which the middle is empty, because the cards are in a hand now.
 */
function Revelacion({
  evento,
  etapa,
  volteadas,
  nombres,
  yo,
}: {
  evento: Extract<EventoMentiroso, { tipo: 'acusacion' }>
  etapa: Etapa
  volteadas: number
  nombres: readonly string[]
  yo: number
}) {
  const quien = (asiento: number) => (asiento === yo ? 'tú' : nombres[asiento])
  const juzgada = etapa === 'veredicto' || etapa === 'recoge'
  const cartas = (
    <div className="flex gap-1">
      {evento.cartas.map((carta, i) =>
        i < volteadas || juzgada ? (
          <Carta
            key={carta.id}
            card={carta}
            size="sm"
            className={cn(
              'carta-volteada shadow-lg',
              juzgada && isNormal(carta) && carta.rank !== evento.rango && 'ring-[3px] ring-red-500',
            )}
          />
        ) : (
          <CartaBocaAbajo key={carta.id} size="sm" className="shadow-lg" />
        ),
      )}
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-1.5" role="status">
      {/* The verdict exists only once it is given — never hidden in the page
          ahead of the cards, where a screen reader would tell it early. */}
      <span className="flex h-6 items-center">
        {juzgada && (
          <span
            className={cn(
              'grito-veredicto rounded-full px-3 py-0.5 text-xs font-bold tracking-widest uppercase shadow',
              evento.eraMentira ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white',
            )}
          >
            {evento.eraMentira ? '¡Mentira!' : 'Era verdad'}
          </span>
        )}
      </span>
      {etapa === 'recoge' ? (
        <Viajan hacia={evento.seLlevo} ms={MS_RECOGE}>
          {cartas}
        </Viajan>
      ) : (
        cartas
      )}
      <p className="min-h-[2.5em] text-sm text-white drop-shadow">
        {etapa === 'grito' ? (
          <>
            <b>{quien(evento.acusador) === 'tú' ? 'Gritaste' : `${nombres[evento.acusador]} grita`}</b>{' '}
            «¡Mentiroso!» a {evento.acusado === yo ? 'ti' : nombres[evento.acusado]}…
          </>
        ) : juzgada ? (
          <>
            {evento.acusado === yo ? 'Dijiste' : `${nombres[evento.acusado]} dijo`}{' '}
            {cantidadDeRango(evento.cartas.length, evento.rango)}.{' '}
            <b>
              {evento.seLlevo === yo ? 'Te llevas' : `${quien(evento.seLlevo)} se lleva`} la pila
            </b>{' '}
            ({evento.cartasDeLaPila})
          </>
        ) : (
          <>Dijo {cantidadDeRango(evento.cartas.length, evento.rango)}…</>
        )}
      </p>
    </div>
  )
}

/**
 * The whole hand, on screen, in one row — the way Carioca fans it (the
 * owner: «que se junten y puedan estar en una misma fila; mira cómo se unen
 * en carioca»). Cards overlap so only their corner strip shows: never wider
 * than Carioca's strip, however much room there is, and tighter when the hand
 * is big. Only a hand too big even for a sliver of corner takes two rows.
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

  // Carioca's strip: a card's height times 0.34 hidden, about half its width
  // showing (components/mesa.tsx). Here as a share of the width.
  const FRANJA = 0.5
  const paso = (n: number) =>
    n <= 1 || medidas.carta === 0
      ? medidas.carta
      : Math.min(medidas.carta * FRANJA, (medidas.ancho - medidas.carta) / (n - 1))
  // The rank and suit in the corner need about a fifth of the width to read.
  const dosFilas = medidas.carta > 0 && paso(mano.length) < medidas.carta * 0.2
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
                    'shrink-0 rounded-md shadow-[-2px_0_4px_rgba(0,0,0,0.35)] transition-transform',
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
