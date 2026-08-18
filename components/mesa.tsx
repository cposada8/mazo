/**
 * The table, drawn from one seat's view of the ronda.
 *
 * Everything here draws a state and never changes one. Interaction is optional
 * and arrives entirely through callbacks: pass `onRobar`, `onCarta` and
 * `onGrupo` and the piles, hand and grupos become tappable; leave them out and
 * the same components render a game you are only watching.
 *
 * **Lanes.** The screen is split into three bands that cannot collide: the
 * seats own the top strip, the mesa — piles and grupos — owns the middle, and
 * your hand owns the bottom. Nothing is absolutely positioned against the
 * whole table any more; a seat can only be placed inside the seat band, so a
 * short screen squeezes the bands rather than printing one on top of another.
 *
 * **Fluid.** Sizes come from the `.cancha` scale (globals.css): everything is
 * derived from the height actually available, so the same layout is
 * comfortable at 400 pixels tall and merely small at 250.
 *
 * Once a grupo is laid down it belongs to nobody: it goes to the middle of the
 * table with everyone else's, not beside the player who put it there. The
 * engine still knows whose is whose — a move names `seat` and `grupoIndex` —
 * but that is bookkeeping, not seating.
 */

'use client'

import { Layers } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { asientosRivales } from '@/lib/asientos'
import {
  type Escala,
  type Grupo,
  type VistaDeAsiento,
  type VistaJugador,
  escalaRankAt,
  isComodin,
} from '@/lib/engine'
import type { Seccion } from '@/lib/mano'
import type { PuntoDeViaje, Viaje } from '@/lib/relato'
import { cn } from '@/lib/utils'

const SIMBOLO_DE_PALO = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
} as const

export function nombrePorDefecto(seat: number): string {
  return `Jugador ${seat + 1}`
}

/** One grupo on the table, with each comodín showing the rango it stands for. */
export function GrupoEnMesa({
  grupo,
  onClick,
}: {
  grupo: Grupo
  onClick?: () => void
}) {
  const contenido = (
    <div className="flex flex-col gap-0.5">
      <span className="text-[calc(var(--texto-mesa,0.75rem)*0.85)] font-medium tracking-wide text-stone-300/80 uppercase">
        {tituloDeGrupo(grupo)}
      </span>
      <div className="flex">
        {grupo.cards.map((card, index) => (
          <Carta
            key={card.id}
            card={card}
            size="xs"
            className="-ml-[0.9em] first:ml-0"
            represents={
              grupo.kind === 'escala' && isComodin(card)
                ? escalaRankAt(grupo as Escala, index)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )

  if (!onClick) return <div className="shrink-0 p-1">{contenido}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md border border-transparent p-1 text-left transition-colors hover:border-stone-400/40 hover:bg-white/5"
    >
      {contenido}
    </button>
  )
}

function tituloDeGrupo(grupo: Grupo): string {
  return grupo.kind === 'trio'
    ? `Trío de ${grupo.rank}`
    : `Escala de ${SIMBOLO_DE_PALO[grupo.suit]}`
}

/**
 * A player on the far side of the table.
 *
 * The turn is drawn *on the player* — a ring around their ficha — rather than
 * announced somewhere else on the screen, and how many cards they hold is
 * shown as cards, because a fan of five and a fan of twelve are different at a
 * glance in a way that "5" and "12" are not. The exact number rides along on
 * the name line, one line, because on a short screen every line costs a card's
 * worth of height.
 */
export type Reloj = {
  /** How long the seat in play gets for its whole turn. */
  readonly segundos: number
  /** Changes when a new turn starts; keys the ring so it restarts. */
  readonly clave: string
  /**
   * Seconds already gone when this ring mounts (Phase 36). A server table
   * knows when the turn started, so a phone that joins late — or reloads
   * mid-turn — picks the ring up where everyone else sees it rather than
   * starting a fresh countdown of its own.
   */
  readonly transcurrido?: number
  /**
   * Whether *your own* turn is on this clock. True where the server enforces
   * it; false at a table alone with bots, which hurries nobody.
   */
  readonly propio?: boolean
}

export function Asiento({
  jugador,
  nombre,
  esSuTurno,
  x,
  y,
  reloj,
  seat,
}: {
  jugador: VistaJugador
  nombre: string
  esSuTurno: boolean
  /** Percent of the seat band. `y` anchors the seat's top edge. */
  x: number
  y: number
  /** When given, the turn ring drains instead of merely glowing. */
  reloj?: Reloj
  /** Engine seat number; marks this element as a travel destination. */
  seat?: number
}) {
  return (
    <div
      data-destino={seat}
      className="absolute flex max-w-[26cqw] -translate-x-1/2 flex-col items-center gap-[0.6cqh]"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* The fan: sized by font so the backs and their overlap scale together. */}
      <div className="flex items-end justify-center text-[clamp(0.7rem,5cqh,1.1rem)]">
        {/* Backs, so a card count is something you see rather than read. The
            fan is drawn from the number alone: an opponent's cards are not
            ours to hold, and since Phase 34 they never arrive. */}
        {Array.from({ length: jugador.cartas }, (_, i) => (
          <CartaBocaAbajo
            key={i}
            className="-ml-[0.55em] h-[1em] w-[0.72em] rounded-[2px] border-0 shadow-none ring-1 ring-black/60 first:ml-0"
          />
        ))}
      </div>

      <div className="relative">
        {/* The countdown is drawn on the player, where the turn already is:
            a full track, and an arc that empties as the time runs out. */}
        {esSuTurno && reloj && (
          <svg
            key={reloj.clave}
            aria-hidden
            viewBox="0 0 40 40"
            className="absolute -inset-1 -rotate-90"
          >
            <circle
              cx="20"
              cy="20"
              r="17.5"
              fill="none"
              strokeWidth="3.5"
              className="stroke-amber-300/25"
            />
            <circle
              cx="20"
              cy="20"
              r="17.5"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="reloj-arco stroke-amber-300"
              style={{
                animationDuration: `${reloj.segundos}s`,
                // A negative delay starts the animation partway through,
                // which is exactly "this turn began a while ago".
                animationDelay: `-${reloj.transcurrido ?? 0}s`,
              }}
            />
          </svg>
        )}
        <div
          className={cn(
            'flex size-[var(--ficha,2rem)] items-center justify-center rounded-full border text-[calc(var(--ficha,2rem)*0.45)] font-semibold transition-shadow',
            esSuTurno
              ? cn(
                  'border-amber-300 bg-amber-300 text-amber-950',
                  !reloj && 'ring-4 ring-amber-300/40',
                )
              : 'border-stone-500/40 bg-stone-900 text-stone-100',
          )}
        >
          {inicial(nombre)}
        </div>
      </div>

      <span className="max-w-full truncate text-[var(--texto-mesa,0.75rem)] leading-tight font-medium text-stone-100">
        {nombre}
        <span className="text-stone-400">
          {' '}
          · {jugador.cartas}
          {jugador.bajadoEnTurno !== null && ' · bajado'}
        </span>
      </span>
    </div>
  )
}

const inicial = (nombre: string): string =>
  [...nombre.trim()][0]?.toUpperCase() ?? '?'

/**
 * The two piles. Each wears its count as a small chip — a line of text under
 * each pile was exactly the height the relato line needed — and the descarte
 * shows its top card, which is its own announcement.
 *
 * Nothing here browses the descarte. That control used to be this very chip,
 * a sixteen-pixel circle sitting on the corner of the draw button: reaching
 * for a peek and drawing a card instead is a mistake the table cannot undo,
 * so the peek moved to the info strip, where it has room to be missed.
 */
export function Pilas({
  state,
  onRobar,
}: {
  state: VistaDeAsiento
  /** When given, both piles become buttons for drawing. */
  onRobar?: (de: 'stock' | 'descarte') => void
}) {
  const arriba = state.descarte.at(-1)
  const activo = Boolean(onRobar)
  const estiloPila = activo ? 'ring-2 ring-stone-100/80 ring-offset-2 ring-offset-stone-950' : ''
  const chip =
    'absolute -top-1 -right-1 z-10 rounded-full bg-stone-800 px-1 text-[calc(var(--texto-mesa,0.75rem)*0.9)] text-stone-300 tabular-nums ring-1 ring-stone-600/60'

  return (
    <div className="flex shrink-0 items-end gap-2">
      <button
        type="button"
        data-pila="stock"
        disabled={!activo}
        onClick={() => onRobar?.('stock')}
        className="relative cursor-default enabled:cursor-pointer"
      >
        <CartaBocaAbajo size="sm" className={estiloPila} />
        <span className={chip}>{state.stock}</span>
      </button>

      <div className="relative" data-pila="descarte">
        <button
          type="button"
          disabled={!activo || !arriba}
          onClick={() => onRobar?.('descarte')}
          className="cursor-default enabled:cursor-pointer"
        >
          {arriba ? (
            <Carta card={arriba} size="sm" className={estiloPila} />
          ) : (
            <div className="aspect-[8/11] h-[var(--carta-sm,3.5rem)] rounded-md border border-dashed border-stone-500/40" />
          )}
        </button>
        {state.descarte.length > 0 && (
          <span className={chip}>{state.descarte.length}</span>
        )}
      </div>
    </div>
  )
}

/**
 * Your own hand, face up along the bottom.
 *
 * One row that scrolls sideways, with the cards overlapping the way they do in
 * a real hand — a wrapping grid loses the left-to-right order that makes a run
 * readable, and the order is the whole point of being able to arrange them.
 */
export function Mano({
  secciones,
  puntos,
  seleccionadas,
  resaltada,
  onCarta,
  onSoltar,
  acciones,
  cabecera,
  esTuTurno,
  reloj,
}: {
  /** Pinned bloques first, then the loose cards. */
  secciones: readonly Seccion[]
  /** What the hand would cost if the ronda ended now. */
  puntos?: number
  seleccionadas?: ReadonlySet<string>
  /**
   * The card just drawn, kept visibly marked: with a sort latched it files
   * itself into place, and a card that sorts itself in is a card you lose
   * track of the moment it lands.
   */
  resaltada?: string
  onCarta?: (cardId: string) => void
  /** Unpin a bloque, by its position among the pinned ones. */
  onSoltar?: (indice: number) => void
  /** Sorting and moving controls, rendered beside the heading. */
  acciones?: React.ReactNode
  /**
   * What to do and what is set aside, on the same line as the heading. One
   * line, not two: on a phone lying down, every row costs a card's worth of
   * height, and the hand is what has to stay readable.
   */
  cabecera?: React.ReactNode
  esTuTurno?: boolean
  /** Given one, your own turn is timed too and the badge drains (Phase 36). */
  reloj?: Reloj
}) {
  const total = secciones.reduce((suma, seccion) => suma + seccion.cards.length, 0)

  // Which pinned bloque each section is, counted among the pinned ones only —
  // that is the index `onSoltar` expects.
  const posicionFijada = new Map(
    secciones
      .filter((seccion) => seccion.bloqueada)
      .map((seccion, indice) => [seccion.id, indice]),
  )

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-nowrap items-center gap-x-3 overflow-x-auto py-0.5 text-[max(var(--texto-mesa,0.75rem),0.6875rem)] whitespace-nowrap">
        {cabecera}
        <h2 className="shrink-0 font-medium">
          <span
            className={cn(
              'relative overflow-hidden rounded px-1.5 py-0.5',
              esTuTurno && 'bg-amber-300 text-amber-950',
            )}
          >
            {/* Your own clock, once there is one (Phase 36): the badge
                empties left to right, the same countdown the ring draws on
                everybody else. Phase 21 left this deliberately still —
                nothing hurried a human until other seats were people. */}
            {esTuTurno && reloj && (
              <span
                key={reloj.clave}
                aria-hidden
                className="badge-agota absolute inset-0 bg-amber-500/45"
                style={{
                  animationDuration: `${reloj.segundos}s`,
                  animationDelay: `-${reloj.transcurrido ?? 0}s`,
                }}
              />
            )}
            <span className="relative">Tu mano</span>
          </span>{' '}
          <span className="text-muted-foreground font-normal tabular-nums">
            {total}
            {puntos !== undefined && (
              <span title="Lo que costaría esta mano si la ronda terminara ahora">
                {' '}
                · {puntos} pts
              </span>
            )}
          </span>
        </h2>
        {acciones}
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pt-1.5">
        {secciones.map((seccion) => {
          const indice = posicionFijada.get(seccion.id) ?? -1

          return (
            <div key={seccion.id} className="flex shrink-0 flex-col gap-0.5">
              {/*
                The fan is tight on purpose: each card only shows its left
                edge, and since Phase 25 that edge carries the whole identity
                — rank with its pinta right under it, like a real card. The
                overlap scales with the card so the visible slice is always
                the corner plus a finger's worth.
              */}
              <div className="flex w-max pl-[calc(var(--carta-md,5rem)*0.34)]">
                {seccion.cards.map((card) => {
                  const elegida = seleccionadas?.has(card.id) ?? false
                  const nueva = resaltada === card.id
                  const carta = (
                    <Carta
                      card={card}
                      className={cn(
                        'transition-transform',
                        // The mark on the just-drawn card: a thin gold halo,
                        // nothing raised — enough to find it after a latched
                        // sort files it into place, quiet enough to ignore.
                        // Selection wins when both apply.
                        nueva &&
                          'ring-offset-background ring-[1.5px] ring-amber-400 ring-offset-1',
                        elegida &&
                          'ring-foreground ring-offset-background -translate-y-2 ring-2 ring-offset-2',
                      )}
                    />
                  )

                  return onCarta ? (
                    // Never raised above its neighbours: a selected card
                    // slides up, like a card pushed out of a real fan. Give
                    // it a z-index and it covers the next card's corner and
                    // steals its taps — on a tight fan that made everything
                    // to the right unselectable.
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onCarta(card.id)}
                      aria-pressed={elegida}
                      className="-ml-[calc(var(--carta-md,5rem)*0.34)] shrink-0"
                    >
                      {carta}
                    </button>
                  ) : (
                    <div
                      key={card.id}
                      className="-ml-[calc(var(--carta-md,5rem)*0.34)] shrink-0"
                    >
                      {carta}
                    </div>
                  )
                })}
              </div>

              {seccion.bloqueada && (
                <button
                  type="button"
                  onClick={onSoltar ? () => onSoltar(indice) : undefined}
                  disabled={!onSoltar}
                  className="text-muted-foreground enabled:hover:text-foreground ml-3 text-[calc(var(--texto-mesa,0.75rem)*0.8)] tracking-wide uppercase"
                >
                  🔒 fijo{onSoltar && ' · soltar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * A card sliding from a pile to the hand that took it — slowly enough to
 * follow (Phase 22). Pure presentation: by the time this renders, the engine
 * has already moved the card; this is the table catching the eye up.
 *
 * Positions are measured from the live layout (`data-pila`, `data-destino`)
 * rather than passed in, so the animation survives any rearrangement of the
 * table. Keyed by `viaje.clave` in the parent: each journey is a fresh
 * element, so mounting is starting.
 */
function CartaViajera({ viaje }: { viaje: Viaje }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const cancha = el?.closest('.cancha')
    if (!el || !cancha) return

    const selector = (punto: PuntoDeViaje) =>
      'pila' in punto
        ? `[data-pila="${punto.pila}"]`
        : `[data-destino="${punto.seat}"]`

    const desde = cancha.querySelector(selector(viaje.desde))
    const hasta = cancha.querySelector(selector(viaje.hasta))
    if (!desde || !hasta) return

    const caja = cancha.getBoundingClientRect()
    const a = desde.getBoundingClientRect()
    const b = hasta.getBoundingClientRect()
    const propia = el.getBoundingClientRect()

    el.style.transform = `translate(${a.x + a.width / 2 - propia.width / 2 - caja.x}px, ${a.y - caja.y}px)`
    el.style.opacity = '1'

    // Two frames: one to paint the start, one to begin the trip.
    const marco = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition =
          'transform 500ms ease-in-out, opacity 220ms ease-in 380ms'
        el.style.transform = `translate(${b.x + b.width / 2 - propia.width / 2 - caja.x}px, ${b.y + b.height / 2 - propia.height / 2 - caja.y}px)`
        el.style.opacity = '0'
      }),
    )
    return () => cancelAnimationFrame(marco)
  }, [viaje])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-30 opacity-0"
    >
      {viaje.carta ? (
        <Carta card={viaje.carta} size="sm" />
      ) : (
        <CartaBocaAbajo size="sm" />
      )}
    </div>
  )
}

export type MesaInteractiva = {
  onRobar?: (de: 'stock' | 'descarte') => void
  onCarta?: (cardId: string) => void
  onGrupo?: (seat: number, grupoIndex: number) => void
  seleccionadas?: ReadonlySet<string>
}

export function Mesa({
  state,
  asiento,
  nombres,
  reloj,
  relatoLinea,
  viaje,
  onVerDescarte,
  onVerHistorial,
  secciones,
  puntos,
  onSoltar,
  accionesDeMano,
  acciones,
  sobreLaMano,
  onRobar,
  onCarta,
  onGrupo,
  seleccionadas,
  resaltada,
}: {
  state: VistaDeAsiento
  /** The seat whose hand is shown face up. */
  asiento: number
  nombres?: readonly string[]
  /** When given, the ring of the seat in play drains over the turn's time. */
  reloj?: Reloj
  /** The card just drawn into your hand, kept visibly marked. */
  resaltada?: string
  /** Your hand laid out. Defaults to the dealt order, unpinned. */
  secciones?: readonly Seccion[]
  /** What your hand would cost right now. */
  puntos?: number
  onSoltar?: (indice: number) => void
  /** Sorting and moving controls for your hand. */
  accionesDeMano?: React.ReactNode
  /** The turn's actions. They live in the bottom-right corner, under a thumb. */
  acciones?: React.ReactNode
  /** What to do, what went wrong, what is set aside — right above the hand. */
  sobreLaMano?: React.ReactNode
  /** The last public move in words, for the line under the piles. */
  relatoLinea?: string
  /** A drawn card in flight. Rendered once per `clave`. */
  viaje?: Viaje | null
  /** When given, a button in the info strip opens the whole descarte. */
  onVerDescarte?: () => void
  /** When given, the relato line opens the ronda's whole story. */
  onVerHistorial?: () => void
} & MesaInteractiva) {
  const nombreDe = (seat: number) => nombres?.[seat] ?? nombrePorDefecto(seat)
  const esTuTurno = state.turno === asiento && state.ganador === null
  // Your own badge drains only when your turn is actually timed — a table
  // alone with bots hurries nobody, as it never has.
  const relojDeTuTurno = esTuTurno && reloj?.propio ? reloj : undefined

  const rivales = asientosRivales(state.jugadores.length, asiento)

  // Every grupo on the table, from every player. Laid down is laid down.
  const enMesa = state.jugadores.flatMap((jugador, seat) =>
    jugador.grupos.map((grupo, grupoIndex) => ({ grupo, seat, grupoIndex })),
  )

  return (
    <div className="cancha relative flex h-full w-full flex-col overflow-hidden bg-stone-950">
      {/*
        The table: felt behind, then two lanes on top of it — seats, then the
        mesa — and an info strip along the felt's bottom edge. The room around
        the felt is dark in both themes: a card table is a lit thing in a dim
        room, and it is the surround, not the felt, that does the decorating.
      */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          aria-hidden
          className="ovalo absolute inset-x-[2%] top-[6%] bottom-[3%] rounded-[50%] border border-red-800/80 bg-stone-900 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]"
        />

        {/* Seat lane: the opponents' strip, and nothing else may enter it. */}
        <div className="relative z-10 h-[var(--banda-asientos,42%)] shrink-0">
          {rivales.map(({ seat, x, y }) => (
            <Asiento
              key={seat}
              seat={seat}
              jugador={state.jugadores[seat]}
              nombre={nombreDe(seat)}
              esSuTurno={state.turno === seat && state.ganador === null}
              x={x}
              y={y}
              reloj={reloj}
            />
          ))}
        </div>

        {/* Mesa lane: piles on the left, everyone's grupos scrolling beside.
            Bottom-aligned — toward the viewer, and away from the seat band's
            edge, where the lowest seats live. */}
        <div className="carril-mesa relative z-10 min-h-0 flex-1">
          <Pilas state={state} onRobar={onRobar} />

          <div className="grupos-en-mesa">
            {enMesa.length === 0 ? (
              <span className="self-center text-[var(--texto-mesa,0.75rem)] text-stone-500">
                Nadie se ha bajado todavía.
              </span>
            ) : (
              enMesa.map(({ grupo, seat, grupoIndex }) => (
                <GrupoEnMesa
                  key={`${seat}-${grupoIndex}`}
                  grupo={grupo}
                  onClick={onGrupo ? () => onGrupo(seat, grupoIndex) : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/*
          The info strip: what just happened on the left — in words, and only
          words everybody is entitled to — then the peek at the descarte, and
          the contract on the right, the way a table has its house name
          printed on the felt.
        */}
        <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-[7cqw] pb-[0.5cqh]">
          {onVerHistorial && relatoLinea ? (
            <button
              type="button"
              onClick={onVerHistorial}
              aria-live="polite"
              title="Ver todo lo que ha pasado esta ronda"
              className="min-w-0 truncate text-left text-[var(--texto-mesa,0.75rem)] text-stone-300 underline decoration-stone-600 decoration-dotted underline-offset-2 hover:text-stone-100"
            >
              {relatoLinea}
            </button>
          ) : (
            <span
              aria-live="polite"
              className="min-w-0 truncate text-[var(--texto-mesa,0.75rem)] text-stone-300"
            >
              {relatoLinea}
            </span>
          )}
          {/*
            Browsing the descarte lives here, not on the pile. It is something
            you reach for *while deciding whether to draw from it*, so a
            target overlapping the draw button turns a peek into a move that
            cannot be taken back.
          */}
          {onVerDescarte && state.descarte.length > 0 && (
            <button
              type="button"
              onClick={onVerDescarte}
              title="Ver todas las cartas del descarte"
              className="flex shrink-0 items-center gap-1 rounded-full border border-stone-600/60 bg-stone-800/80 py-[0.6cqh] pr-2 pl-1.5 text-[var(--texto-mesa,0.75rem)] text-stone-200 hover:bg-stone-700"
            >
              <Layers className="size-[1.1em] shrink-0" aria-hidden />
              <span className="tabular-nums">{state.descarte.length}</span>
              <span className="sr-only">cartas en el descarte, ver todas</span>
            </button>
          )}
          <span
            aria-hidden
            className="shrink-0 text-[var(--texto-mesa,0.75rem)] font-semibold tracking-[0.2em] whitespace-nowrap text-stone-100/25 uppercase"
          >
            {state.contrato.nombre}
          </span>
        </div>
      </div>

      {viaje && <CartaViajera key={viaje.clave} viaje={viaje} />}

      {/* Your side of the table. */}
      <div
        data-destino={asiento}
        className="bg-background/95 flex shrink-0 items-end gap-3 border-t px-3 pt-0.5 pb-1 backdrop-blur"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <Mano
            cabecera={sobreLaMano}
            secciones={
              secciones ?? [{ id: 'sueltas', cards: [...state.mano], bloqueada: false }]
            }
            puntos={puntos}
            seleccionadas={seleccionadas}
            resaltada={resaltada}
            onCarta={onCarta}
            onSoltar={onSoltar}
            acciones={accionesDeMano}
            esTuTurno={esTuTurno}
            reloj={relojDeTuTurno}
          />
        </div>

        {acciones && <div className="shrink-0 pb-1">{acciones}</div>}
      </div>
    </div>
  )
}
