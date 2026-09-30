/**
 * The table, drawn from one seat's view of the ronda.
 *
 * Everything here draws a state and never changes one. Interaction is optional
 * and arrives entirely through callbacks: pass `onRobar`, `onCarta` and
 * `onGrupo` and the piles, hand and grupos become tappable; leave them out and
 * the same components render a game you are only watching.
 *
 * **A table, not a form (Phase 46).** A felt with a rail, the rivals seated
 * on its rim — the far edge and, from four players up, the two sides — the
 * mesa in the space they leave, and your piles, hand and buttons across the
 * near edge. The mesa's box is measured and its cards sized to fit it whole,
 * so seats and grupos never share a pixel however full the table gets.
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

import { Check, Layers, Lightbulb } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { type Arrastre, useArrastre } from '@/components/arrastre'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import {
  ASOMA,
  HUECO,
  PROPORCION_DE_CARTA,
  alturaDeCartaEnMesa,
  solapeDeMano,
} from '@/lib/ajuste-de-mesa'
import { type Lado, asientosRivales, hayLados } from '@/lib/asientos'
import {
  type Grupo,
  type VistaDeAsiento,
  type VistaJugador,
  NOMBRE_DE_ESCALERA,
  escalaRankAt,
  isComodin,
  rangoDeEscaleraEn,
} from '@/lib/engine'
import type { Seccion } from '@/lib/mano'
import { MS_DE_VIAJE, type PuntoDeViaje, type Viaje } from '@/lib/relato'
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

/**
 * How much the mesa shrinks as grupos pile up (Phase 45).
 *
 * Six players deep into *tres escalas* is eighteen grupos, and at one fixed
 * size that is a row running off the right edge — which is what Phase 17 left
 * behind and called the honest minimum. The answer is not a bigger table, it
 * is smaller cards: the ratio drops in steps, the grupos wrap, and eighteen
 * of them land inside a landscape phone's mesa lane with room to spare.
 *
 * Steps rather than a continuous formula so the mesa does not resize by a
 * hair every time somebody ligas a card — it changes size when the table
 * genuinely got more crowded, and holds still otherwise.
 *
 * `compacto` drops the grupo's title («Trío de 7»), which costs a whole line
 * per grupo. It is the first thing to go and the cheapest: the cards say what
 * the title says, and at these counts the room matters more than the label.
 */
export function escalaDeMesa(grupos: number): {
  /** Ratio of `--carta-md`. Never above `RATIO_XS`, the uncrowded value. */
  readonly carta: number
  readonly compacto: boolean
} {
  if (grupos <= 6) return { carta: RATIO_XS, compacto: false }
  if (grupos <= 12) return { carta: 0.44, compacto: true }
  if (grupos <= 20) return { carta: 0.37, compacto: true }
  return { carta: 0.31, compacto: true }
}

/** What `--carta-xs` is when nothing is crowded. Mirrors `.cancha`. */
export const RATIO_XS = 0.52

/** One grupo on the table, with each comodín showing the rango it stands for. */
export function GrupoEnMesa({
  grupo,
  onClick,
  doradas,
  ocultas,
  destino,
  compacto,
  ajustado,
}: {
  /**
   * Cards whose move has not landed yet (Phase 59): drawn invisible, so the
   * grupo keeps their room and the flight has somewhere to land.
   */
  ocultas?: ReadonlySet<string>
  /** The key a flight aims at, `${seat}-${grupoIndex}` (Phase 58). */
  destino?: string
  grupo: Grupo
  onClick?: () => void
  /**
   * Cards this turn put here, marked until the turn is over (Phase 41). A
   * grupo grows in silence otherwise: the card that joined it looks exactly
   * like the ones that were there all along.
   */
  doradas?: ReadonlySet<string>
  /** Drop the title to buy a line back on a crowded mesa (Phase 45). */
  compacto?: boolean
  /**
   * Drawn to the exact geometry the live mesa was measured with (Phase 46):
   * no title, no padding, and each card showing only its corner past the one
   * before — `ASOMA` of its height, the number `alturaDeCartaEnMesa` packs
   * with. A grupo that is wider on screen than on paper is a grupo that
   * overflows.
   */
  ajustado?: boolean
}) {
  const contenido = (
    <div className="flex flex-col gap-0.5">
      {!compacto && !ajustado && (
        <span className="text-[calc(var(--texto-mesa,0.75rem)*0.85)] font-medium tracking-wide text-tinta/80 uppercase">
          {tituloDeGrupo(grupo)}
        </span>
      )}
      <div className="flex">
        {grupo.cards.map((card, index) => {
          const nueva = doradas?.has(card.id) ?? false
          const oculta = ocultas?.has(card.id) ?? false

          return (
            <Carta
              key={card.id}
              card={card}
              size="xs"
              className={cn(
                ajustado
                  ? 'shadow-[0_1px_3px_rgba(0,0,0,0.45)] not-first:-ml-[calc(var(--carta-xs)*var(--solapa))]'
                  : '-ml-[0.9em] first:ml-0',
                // Raised as well as ringed: the fan overlaps to the right, so
                // a ring on any card but the last would be painted over by
                // its neighbour.
                nueva && 'relative z-10 ring-[1.5px] ring-amber-400',
                oculta && 'invisible',
              )}
              represents={
                !isComodin(card)
                  ? undefined
                  : grupo.kind === 'escala'
                    ? escalaRankAt(grupo, index)
                    : grupo.kind === 'escalera'
                      ? rangoDeEscaleraEn(grupo, index)
                      : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )

  // The padding gives way with the title: on a crowded mesa four pixels a
  // side, times twenty grupos, is a row's worth of space spent on nothing.
  const hueco = ajustado ? '' : compacto ? 'p-0.5' : 'p-1'

  if (!onClick) {
    return (
      <div data-grupo={destino} className={cn('shrink-0', hueco)}>
        {contenido}
      </div>
    )
  }

  return (
    <button
      type="button"
      data-grupo={destino}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-md text-left transition-[outline-color] outline-2 outline-offset-2 outline-transparent hover:outline-amber-300/60',
        !ajustado && 'border border-transparent hover:border-tinta-suave/40 hover:bg-tinta/5',
        hueco,
      )}
    >
      {contenido}
    </button>
  )
}

function tituloDeGrupo(grupo: Grupo): string {
  switch (grupo.kind) {
    case 'trio':
      return `Trío de ${grupo.rank}`
    case 'escala':
      return `Escala de ${SIMBOLO_DE_PALO[grupo.suit]}`
    case 'escalera':
      return NOMBRE_DE_ESCALERA[grupo.tipo]
  }
}

/**
 * A turn's clock, as the table draws it. The turn is drawn *on the player* —
 * a ring around their ficha — rather than announced somewhere else.
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

/**
 * The countdown as a ring: a full track, and an arc that empties as the
 * turn's time runs out.
 *
 * One component for both places it is drawn — around the ficha of whoever is
 * up, and beside your own hand (Phase 40) — so your own clock and everybody
 * else's can never drift into showing different amounts of the same turn.
 * Mount it with `key={reloj.clave}`: restarting the animation is remounting,
 * and no JavaScript runs per frame.
 */
export function AnilloDeReloj({
  reloj,
  className,
}: {
  reloj: Reloj
  className?: string
}) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={cn('-rotate-90', className)}>
      <circle
        cx="20"
        cy="20"
        r="17.5"
        fill="none"
        strokeWidth="3.5"
        className="stroke-amber-600/20"
      />
      <circle
        cx="20"
        cy="20"
        r="17.5"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="reloj-arco stroke-amber-600"
        style={{
          animationDuration: `${reloj.segundos}s`,
          // A negative delay starts the animation partway through, which is
          // exactly "this turn began a while ago".
          animationDelay: `-${reloj.transcurrido ?? 0}s`,
        }}
      />
    </svg>
  )
}

export function Asiento({
  jugador,
  nombre,
  esSuTurno,
  x,
  y,
  reloj,
  seat,
  lado = 'arriba',
}: {
  jugador: VistaJugador
  nombre: string
  esSuTurno: boolean
  /** Percent of the table zone. `y` anchors the top of the ficha. */
  x: number
  y: number
  /**
   * A side seat is narrower than one on the far edge — its width comes out
   * of the mesa's — so its name may take two lines instead of one wide one.
   */
  lado?: Lado
  /** When given, the turn ring drains instead of merely glowing. */
  reloj?: Reloj
  /** Engine seat number; marks this element as a travel destination. */
  seat?: number
}) {
  const bajado = jugador.bajadoEnTurno !== null
  const lateral = lado !== 'arriba'

  // A side seat is pinned by its edge, so however wide the name it never
  // hangs off the screen; one on the far edge is centred on its `x`.
  const posicion: React.CSSProperties = lateral
    ? {
        [lado === 'izquierda' ? 'left' : 'right']: '1cqw',
        top: `${y}%`,
      }
    : { left: `${x}%`, top: `calc(${y}% + 0.55rem)` }

  return (
    <div
      data-destino={seat}
      className={cn(
        'absolute z-10 flex flex-col items-center gap-[0.2rem]',
        lateral ? 'w-[var(--ancho-lado)] -translate-y-1/2' : 'w-[var(--ancho-asiento)] -translate-x-1/2',
      )}
      style={posicion}
    >
      {/*
        A player is a ficha — a coloured disc with their initials — and two
        small badges on it: how many cards they hold, and a tick once they
        are down (Phase 46). The fan of backs this replaced was a smear of
        red at the sizes a phone allows, and «· 12 · bajado» spelled out on
        the name line is what ran five names into one another.
      */}
      <div className="relative">
        {esSuTurno && reloj && (
          <AnilloDeReloj
            key={reloj.clave}
            reloj={reloj}
            className="absolute -inset-[0.3rem] size-[calc(100%+0.6rem)]"
          />
        )}
        <div
          className={cn(
            'flex size-[var(--ficha,2rem)] items-center justify-center rounded-full text-[calc(var(--ficha,2rem)*0.38)] font-semibold tracking-tight text-white/90 shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-2 transition-shadow',
            esSuTurno
              ? cn('ring-amber-400', !reloj && 'shadow-[0_0_14px_rgba(251,191,36,0.55)]')
              : 'ring-black/35',
          )}
          style={{ background: colorDeAsiento(seat ?? 0) }}
        >
          {iniciales(nombre)}
        </div>

        {/* The hand, counted: one card back and the number, on the ficha's
            corner where a glance already lands. */}
        <span
          title={`${jugador.cartas} cartas en la mano`}
          className="absolute -right-[0.55rem] -bottom-[0.2rem] flex items-center gap-[0.15rem] rounded-full bg-stone-950/90 py-px pr-[0.3rem] pl-[0.2rem] text-[calc(var(--texto-mesa,0.75rem)*0.92)] leading-none font-semibold text-tinta tabular-nums ring-1 ring-white/10"
        >
          <span aria-hidden className="dorso-mini h-[0.85em] w-[0.6em] rounded-[1.5px]" />
          {jugador.cartas}
        </span>

        {bajado && (
          <span
            title="Ya se bajó"
            className="absolute -top-[0.2rem] -right-[0.3rem] flex size-[1.05rem] items-center justify-center rounded-full bg-emerald-500 text-emerald-950 ring-2 ring-stone-950"
          >
            <Check className="size-[0.7rem]" strokeWidth={3.5} aria-hidden />
            <span className="sr-only">bajado</span>
          </span>
        )}
      </div>

      <span
        className={cn(
          'max-w-full rounded-full px-[0.45rem] py-[0.1rem] text-center text-[calc(var(--texto-mesa,0.75rem)*0.82)] leading-tight font-medium',
          lateral ? 'line-clamp-2 rounded-[0.6rem] px-[0.3rem] text-balance' : 'truncate',
          esSuTurno ? 'bg-amber-400 text-amber-950' : 'bg-black/55 text-tinta-suave',
        )}
      >
        {nombre}
      </span>
    </div>
  )
}

/**
 * The initials on a ficha. «El Codicioso 3» is «C3», not «E»: when every bot
 * starts with the same article, the first letter is the one letter that
 * tells nobody apart.
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra && !ARTICULOS.has(palabra.toLowerCase()))
  if (palabras.length === 0) return '?'

  const primera = [...palabras[0]][0]?.toUpperCase() ?? '?'
  const ultima = palabras.at(-1) ?? ''
  return palabras.length > 1 && /^\d+$/.test(ultima) ? `${primera}${ultima}` : primera
}

const ARTICULOS = new Set(['el', 'la', 'los', 'las'])

/**
 * One colour per seat, so a player is recognised by their disc before their
 * name is read. Deep and a little muted: they sit on a dark felt at night,
 * and none of them is amber, which is reserved for whoever is up.
 */
const COLORES_DE_ASIENTO = [
  ['#64748b', '#334155'],
  ['#6366f1', '#3730a3'],
  ['#0891b2', '#155e75'],
  ['#db2777', '#9d174d'],
  ['#7c3aed', '#5b21b6'],
  ['#0d9488', '#115e59'],
] as const

export function colorDeAsiento(seat: number): string {
  const [claro, oscuro] = COLORES_DE_ASIENTO[seat % COLORES_DE_ASIENTO.length]
  return `linear-gradient(145deg, ${claro}, ${oscuro})`
}

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
  // Your draw is the one moment the piles are the next move, so that is when
  // they glow — in the amber that means *you, now* everywhere on the table.
  const estiloPila = cn(
    'shadow-[0_2px_6px_rgba(0,0,0,0.5)]',
    activo && 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]',
  )
  const chip =
    'absolute -top-1.5 -right-1.5 z-10 min-w-[1.4em] rounded-full bg-stone-950/90 px-1 text-center text-[calc(var(--texto-mesa,0.75rem)*0.9)] leading-[1.5] font-semibold text-tinta tabular-nums ring-1 ring-white/15'

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
            <div className="aspect-[8/11] h-[var(--carta-sm,3.5rem)] rounded-md border border-dashed border-white/25" />
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
  onLlevar,
  acciones,
  cabecera,
  esTuTurno,
  reloj,
  soloCabecera,
  soloCartas,
  solape,
}: {
  /**
   * Draw only the heading line, or only the cards (Phase 46). The table puts
   * the piles beside your cards and the words above both, so it asks for the
   * two halves separately; anywhere else, the whole hand is one piece.
   */
  soloCabecera?: boolean
  soloCartas?: boolean
  /** How much each card hides of the one before, in pixels (Phase 46). */
  solape?: number
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
  /**
   * Given one, loose cards can be held and dragged (Phase 63): the card, or
   * the whole selection when it is selected, lands in front of `antesDe`.
   */
  onLlevar?: (cardId: string, antesDe: string | null) => void
  /** Sorting and moving controls, rendered beside the heading. */
  acciones?: React.ReactNode
  /**
   * What is set aside, and anything the referee refused, sharing the heading
   * row. It shares rather than owning one because on a phone lying down every
   * row costs a card's worth of height — but it is the part that gives way:
   * it takes the width the heading and the controls do not need, and wraps to
   * a line of its own only when it cannot fit (Phase 40).
   */
  cabecera?: React.ReactNode
  esTuTurno?: boolean
  /** Given one, your own turn is timed too and the badge drains (Phase 36). */
  reloj?: Reloj
}) {
  const total = secciones.reduce((suma, seccion) => suma + seccion.cards.length, 0)

  const fila = useRef<HTMLDivElement>(null)
  const { arrastre, empezar, tragarClick } = useArrastre({
    fila,
    // The same rule `llevarCartas` applies: a selected card brings the
    // selected loose cards with it, any other card travels alone.
    llevadasDe: (cardId) => {
      const sueltas = secciones.find((seccion) => !seccion.bloqueada)?.cards ?? []
      return seleccionadas?.has(cardId)
        ? sueltas.filter((card) => seleccionadas.has(card.id)).map((card) => card.id)
        : [cardId]
    },
    onSoltar: onLlevar,
  })
  const llevadas = new Set(arrastre?.llevadas)

  // Which pinned bloque each section is, counted among the pinned ones only —
  // that is the index `onSoltar` expects.
  const posicionFijada = new Map(
    secciones
      .filter((seccion) => seccion.bloqueada)
      .map((seccion, indice) => [seccion.id, indice]),
  )

  return (
    <div className={cn('flex min-w-0 flex-col', soloCartas && 'flex-1', soloCabecera && 'shrink-0')}>
      {!soloCartas && (
      /*
        The heading row, and who gets to keep their place in it (Phase 40).
        Upright there is not enough width for everything, and what used to
        give way were the arranging controls: they were pushed off the right
        edge and had to be scrolled into view. So the row wraps instead of
        scrolling, and the two things that must always be reachable — the
        hand's own heading, clock and all, and the controls — never shrink.
        Whatever else is passed in takes the room that is left, and drops to
        a second line when there is none.
      */
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[calc(var(--texto-mesa,0.75rem)*0.9)]">
        <h2 className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {/*
            Quiet unless it is your turn (Phase 46). «Tu mano» on an orange
            slab said the one thing nobody needs told — whose cards these
            are — louder than anything else on the table. What is worth a
            badge is *now*: «Tu turno», with the clock, and only then.
          */}
          {esTuTurno && reloj && (
            <AnilloDeReloj
              key={reloj.clave}
              reloj={reloj}
              className="size-[1.4em] shrink-0"
            />
          )}
          {esTuTurno && (
            <span className="relative overflow-hidden rounded-full bg-amber-500 px-1.5 py-px text-[0.92em] font-semibold text-amber-950">
              {/* The badge empties left to right, the same countdown the
                  ring draws (Phase 36). */}
              {reloj && (
                <span
                  key={reloj.clave}
                  aria-hidden
                  className="badge-agota absolute inset-0 bg-amber-300/60"
                  style={{
                    animationDuration: `${reloj.segundos}s`,
                    animationDelay: `-${reloj.transcurrido ?? 0}s`,
                  }}
                />
              )}
              <span className="relative">Tu turno</span>
            </span>
          )}
          <span className="text-tinta-tenue tabular-nums">
            <span className="sr-only">Tu mano: </span>
            {total} {total === 1 ? 'carta' : 'cartas'}
            {puntos !== undefined && (
              <span title="Lo que costaría esta mano si la ronda terminara ahora">
                {' '}
                · {puntos} pts
              </span>
            )}
          </span>
        </h2>
        {acciones}
        {cabecera}
      </div>
      )}

      {!soloCabecera && (
      <div
        ref={fila}
        className={cn(
          // The row scrolls sideways, and a scrolling box clips upward too —
          // so the lift a selected card makes is room reserved here, not
          // borrowed from the line above, where it used to be cut off.
          // `px` for the same reason on the sides: the selection ring and
          // its glow are drawn outside the card, and the scroller would
          // shave them off the first and last cards.
          'relative flex items-start gap-3 overflow-x-auto px-1.5 pt-[calc(var(--carta-md,5rem)*0.16)]',
        )}
        style={
          solape === undefined
            ? undefined
            : ({ '--solape-mano': `${solape}px` } as React.CSSProperties)
        }
      >
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
              <div className="flex w-max pl-[var(--solape-mano,calc(var(--carta-md,5rem)*0.34))]">
                {seccion.cards.map((card) => {
                  const elegida = seleccionadas?.has(card.id) ?? false
                  const nueva = resaltada === card.id
                  const arrastrable = Boolean(onLlevar) && !seccion.bloqueada
                  const carta = (
                    <Carta
                      card={card}
                      className={cn(
                        'transition-transform',
                        // The mark on the just-drawn card: a thin gold halo,
                        // nothing raised — enough to find it after a latched
                        // sort files it into place, quiet enough to ignore.
                        // Selection wins when both apply.
                        'shadow-[-2px_2px_6px_rgba(0,0,0,0.45)]',
                        nueva && 'ring-2 ring-amber-400',
                        elegida &&
                          '-translate-y-[calc(var(--carta-md,5rem)*0.14)] ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.6)]',
                        // In the air: what is left behind is the gap it
                        // came from, faintly.
                        llevadas.has(card.id) && 'opacity-30',
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
                      onClick={() => {
                        if (!tragarClick()) onCarta(card.id)
                      }}
                      aria-pressed={elegida}
                      data-suelta={arrastrable ? card.id : undefined}
                      onPointerDown={arrastrable ? (e) => empezar(e, card.id) : undefined}
                      // A held finger is a pick-up here, not a request for
                      // the phone's own long-press menu.
                      onContextMenu={arrastrable ? (e) => e.preventDefault() : undefined}
                      className={cn(
                        '-ml-[var(--solape-mano,calc(var(--carta-md,5rem)*0.34))] shrink-0',
                        arrastrable && '[-webkit-touch-callout:none]',
                      )}
                    >
                      {carta}
                    </button>
                  ) : (
                    <div
                      key={card.id}
                      className="-ml-[var(--solape-mano,calc(var(--carta-md,5rem)*0.34))] shrink-0"
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
                  className="ml-3 text-[calc(var(--texto-mesa,0.75rem)*0.8)] tracking-wide text-tinta-tenue uppercase enabled:hover:text-tinta"
                >
                  🔒 fijo{onSoltar && ' · soltar'}
                </button>
              )}
            </div>
          )
        })}

        {arrastre && (
          <>
            {/* Where it will land: a seam of light between two cards. */}
            <span
              aria-hidden
              className="pointer-events-none absolute z-10 h-[var(--carta-md,5rem)] w-1 -translate-x-1/2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]"
              style={{ left: arrastre.marca, top: 'calc(var(--carta-md,5rem) * 0.16)' }}
            />
            <EnElAire arrastre={arrastre} secciones={secciones} />
          </>
        )}
      </div>
      )}
    </div>
  )
}

/**
 * The cards being dragged, under the finger (Phase 63). Held up off the
 * row, so the seam where they will land shows beneath them — and above a
 * finger, which would otherwise hide the very corner that names the card.
 *
 * Drawn `fixed` so the row's scrolling cannot clip them — but `.cancha` is a
 * size container, and a container is where `fixed` is measured from. Rather
 * than assume which box that is, an empty frame at `0, 0` is asked where it
 * actually landed, and the cards are placed from there.
 */
function EnElAire({
  arrastre,
  secciones,
}: {
  arrastre: Arrastre
  secciones: readonly Seccion[]
}) {
  const marco = useRef<HTMLDivElement>(null)
  const cartas = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!marco.current || !cartas.current) return
    const origen = marco.current.getBoundingClientRect()
    cartas.current.style.transform = `translate(${arrastre.x - origen.left}px, ${arrastre.y - origen.top}px)`
  }, [arrastre.x, arrastre.y])

  const porId = new Map(secciones.flatMap((seccion) => seccion.cards).map((card) => [card.id, card]))

  return (
    <div ref={marco} aria-hidden className="pointer-events-none fixed top-0 left-0 z-50 size-0">
      <div ref={cartas} className="relative">
        {arrastre.llevadas.map((id, indice) => {
          const card = porId.get(id)
          return (
            card && (
              <div key={id} className="absolute top-0" style={{ left: indice * arrastre.paso }}>
                <Carta
                  card={card}
                  className="-translate-y-[calc(var(--carta-md,5rem)*0.45)] scale-105 ring-2 ring-sky-300 shadow-[-4px_8px_16px_rgba(0,0,0,0.55)]"
                />
              </div>
            )
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
        : 'grupo' in punto
          ? `[data-grupo="${punto.grupo}"]`
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
        const ms = viaje.ms ?? MS_DE_VIAJE
        // The fade ends exactly on landing, when the move shows where it
        // arrived: fading past it drew the card twice for a moment (Phase 60).
        el.style.transition = `transform ${ms}ms ease-in-out, opacity ${Math.round(ms * 0.4)}ms ease-in ${Math.round(ms * 0.6)}ms`
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
      {viaje.cartas && viaje.cartas.length > 0 ? (
        // Several at once — a bajada, or one agregar of more than a card —
        // fanned, so it reads as the grupo it is about to become.
        <div className="flex">
          {viaje.cartas.map((card, index) => (
            <Carta key={`${card.id}-${index}`} card={card} size="sm" className="-ml-3 first:ml-0" />
          ))}
        </div>
      ) : viaje.carta ? (
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
  /** Drop dragged cards in front of `antesDe`, or at the end (Phase 63). */
  onLlevar?: (cardId: string, antesDe: string | null) => void
  onGrupo?: (seat: number, grupoIndex: number) => void
  seleccionadas?: ReadonlySet<string>
}

export function Mesa({
  state,
  asiento,
  nombres,
  reloj,
  relatoLinea,
  guia,
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
  onLlevar,
  onGrupo,
  seleccionadas,
  resaltada,
  doradas,
  ocultas,
}: {
  state: VistaDeAsiento
  /** The seat whose hand is shown face up. */
  asiento: number
  nombres?: readonly string[]
  /** When given, the ring of the seat in play drains over the turn's time. */
  reloj?: Reloj
  /** The card just drawn into your hand, kept visibly marked. */
  resaltada?: string
  /** Cards the turn in play has put on the mesa, marked gold (Phase 41). */
  doradas?: ReadonlySet<string>
  /** Mesa cards whose move has not landed yet (Phase 59). */
  ocultas?: ReadonlySet<string>
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
  /**
   * What to do right now, for a player still learning the game (Phase 45).
   * When given it takes the relato's place in the strip — while it is your
   * turn, the next move is the more useful sentence, and the relato is one
   * tap away in the historial. Null on every turn that is not yours, which is
   * when the strip goes back to narrating.
   */
  guia?: string | null
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
  const lados = hayLados(state.jugadores.length)

  // Every grupo on the table, from every player. Laid down is laid down.
  const enMesa = state.jugadores.flatMap((jugador, seat) =>
    jugador.grupos.map((grupo, grupoIndex) => ({ grupo, seat, grupoIndex })),
  )

  // The mesa is measured, and the cards drawn at the largest height at which
  // every grupo fits it (Phase 46).
  const [carril, medida] = useMedida<HTMLDivElement>()
  const alturaDeCarta = alturaDeCartaEnMesa({
    grupos: enMesa.map(({ grupo }) => grupo.cards.length),
    // A couple of pixels short of the box: the browser rounds sub-pixel
    // widths its own way, and a row that fits to the hundredth on paper
    // wraps on screen.
    ancho: medida.ancho - 3,
    alto: medida.alto - 3,
    minimo: 22,
    maximo: Math.max(22, medida.maxima),
  })

  // Your hand fans tighter as it grows, so it fits instead of scrolling.
  const seccionesDeMano = secciones ?? [
    { id: 'sueltas', cards: [...state.mano], bloqueada: false },
  ]
  const [columnaDeMano, anchoDeMano] = useMedida<HTMLDivElement>()
  const [bloqueDeMano, anchoDelBloque] = useMedida<HTMLDivElement>()
  // The line over the hand hangs from the cards' left edge and may run past
  // their right one — but never past the column's, where the turn's buttons
  // start. It used to be allowed nearly the whole table, and the grupos set
  // aside for a bajada grew over «Armar» until the third trío could not be
  // armed. The cards sit centred in the column, so from their left edge to
  // the column's right one is half of each width.
  const anchoSobreLaMano =
    anchoDeMano.ancho > 0 && anchoDelBloque.ancho > 0
      ? (anchoDeMano.ancho + anchoDelBloque.ancho) / 2
      : undefined
  const solape = solapeDeMano({
    cartas: seccionesDeMano.reduce((suma, seccion) => suma + seccion.cards.length, 0),
    bloques: seccionesDeMano.filter((seccion) => seccion.cards.length > 0).length,
    // The row's own side padding, and a hair for rounding.
    ancho: anchoDeMano.ancho - 16,
    alto: anchoDeMano.carta,
    separacion: 12,
  })

  return (
    <div
      className={cn(
        'cancha relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#2b211c_0%,#15100d_60%,#0b0908_100%)]',
        lados && 'con-lados',
      )}
    >
      {/*
        The felt (Phase 46): a lit table in a dim room, with a rail around it.
        Everything else is placed over it — the seats on its rim, the mesa in
        its middle, your hand across its near edge the way cards lie on a real
        table — rather than cut into bands that each draw their own box.
      */}
      <div aria-hidden className="fieltro absolute" />

      {/* The table zone: everything above your hand. Seats and mesa are
          placed in it, never in the hand's strip. */}
      <div className="zona-mesa absolute inset-x-0 top-0">
        {rivales.map(({ seat, x, y, lado }) => (
          <Asiento
            key={seat}
            seat={seat}
            jugador={state.jugadores[seat]}
            nombre={nombreDe(seat)}
            esSuTurno={state.turno === seat && state.ganador === null}
            x={x}
            y={y}
            lado={lado}
            reloj={reloj}
          />
        ))}

        {/*
          The mesa. Its box is what the seats leave free, it is measured, and
          the cards are sized to it — so eighteen grupos land inside it whole,
          and three land at a size worth looking at.
        */}
        <div ref={carril} className="carril-mesa absolute">

          <div
            className="grupos-en-mesa relative"
            style={
              {
                '--carta-xs': `${alturaDeCarta}px`,
                '--solapa': PROPORCION_DE_CARTA - ASOMA,
                gap: `${alturaDeCarta * HUECO}px`,
              } as React.CSSProperties
            }
          >
            {enMesa.length === 0 ? (
              <span className="sr-only">Nadie se ha bajado todavía.</span>
            ) : (
              enMesa.map(({ grupo, seat, grupoIndex }) => (
                <GrupoEnMesa
                  key={`${seat}-${grupoIndex}`}
                  destino={`${seat}-${grupoIndex}`}
                  grupo={grupo}
                  doradas={doradas}
                  ocultas={ocultas}
                  ajustado
                  onClick={onGrupo ? () => onGrupo(seat, grupoIndex) : undefined}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {viaje && <CartaViajera key={viaje.clave} viaje={viaje} />}

      {/*
        Your side of the table: the piles on the left, your hand, and the
        turn's buttons under the right thumb. No panel of its own — the
        cards lie on the felt's near edge, which is where a hand is held.
      */}
      {/*
        The table's voice (Phase 46): what to do now, or what just happened.
        A note in the margin — small, bottom-left, over your piles — and not
        a banner across the middle of the felt, where the eye is busy with
        the mesa. The owner's call, after a pill in the centre «ensucia la
        vista».
      */}
      <div className="linea-relato pointer-events-none absolute left-[3cqw] flex max-w-[34cqw] items-end">
        <Relato guia={guia} relatoLinea={relatoLinea} onVerHistorial={onVerHistorial} />
      </div>

      {/*
        Your side of the table, in three clusters, each holding what belongs
        to it (Phase 46):
        - where you draw: the mazo, the descarte, and the peek at the
          descarte right above the pile it opens — above it, not on it, so
          reaching for a look never draws a card;
        - your hand, with its count and the arranging controls sitting on
          the hand's own top-left corner, however wide the hand is;
        - the turn's buttons, under the right thumb.
      */}
      <div
        data-destino={asiento}
        className="zona-mano absolute inset-x-0 bottom-0 flex items-end gap-[2.5cqw] px-[2.5cqw] pb-[1.5cqh]"
      >
        <div className="flex shrink-0 flex-col items-end gap-1">
          {onVerDescarte && state.descarte.length > 0 && (
            <button
              type="button"
              onClick={onVerDescarte}
              title="Ver todas las cartas del descarte"
              className="flex items-center gap-1 rounded-full bg-black/45 py-0.5 pr-2 pl-1.5 text-[var(--texto-mesa,0.75rem)] text-tinta-suave ring-1 ring-white/10 hover:bg-black/60"
            >
              <Layers className="size-[1.1em] shrink-0" aria-hidden />
              <span>Ver</span>
              <span className="sr-only">
                las {state.descarte.length} cartas del descarte
              </span>
            </button>
          )}
          <Pilas state={state} onRobar={onRobar} />
        </div>

        <div ref={columnaDeMano} className="flex min-w-0 flex-1 justify-center">
          {/*
            The cards alone decide where the hand sits. The line above hangs
            from their top-left corner and may run past their right edge, so
            that selecting a card — which adds the moving controls to that
            line — can never widen the block and slide the whole hand across
            the table under your finger.
          */}
          <div ref={bloqueDeMano} className="relative flex max-w-full min-w-0 flex-col">
            <div
              className="absolute bottom-full left-0 w-max max-w-[calc(100cqw-2rem)]"
              style={anchoSobreLaMano ? { maxWidth: anchoSobreLaMano } : undefined}
            >
            <Mano
              soloCabecera
              cabecera={sobreLaMano}
              secciones={seccionesDeMano}
              puntos={puntos}
              acciones={accionesDeMano}
              esTuTurno={esTuTurno}
              reloj={relojDeTuTurno}
            />
            </div>
            <Mano
              soloCartas
              secciones={seccionesDeMano}
              seleccionadas={seleccionadas}
              resaltada={resaltada}
              onCarta={onCarta}
              onSoltar={onSoltar}
              onLlevar={onLlevar}
              solape={anchoDeMano.carta ? solape : undefined}
            />
          </div>
        </div>

        {acciones && <div className="shrink-0">{acciones}</div>}
      </div>
    </div>
  )
}

/**
 * The line over your hand that talks: the guide while it is your turn
 * (Phase 45), and otherwise the last public move, which opens the ronda's
 * whole story when the partida keeps one.
 */
function Relato({
  guia,
  relatoLinea,
  onVerHistorial,
}: {
  guia?: string | null
  relatoLinea?: string
  onVerHistorial?: () => void
}) {
  const texto =
    'pointer-events-auto line-clamp-2 min-w-0 text-left text-[calc(var(--texto-mesa,0.75rem)*0.88)] leading-snug [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]'

  if (guia) {
    // In the amber the table uses for *this is you, and it is now*. Text and
    // not a button: it names the move, and the move is made on the table.
    return (
      <span
        aria-live="polite"
        className={cn(texto, 'font-medium text-amber-300')}
      >
        <Lightbulb className="mr-1 inline size-[1.1em] align-[-0.2em]" aria-hidden />
        {guia}
      </span>
    )
  }

  if (onVerHistorial && relatoLinea) {
    return (
      <button
        type="button"
        onClick={onVerHistorial}
        aria-live="polite"
        title="Ver todo lo que ha pasado esta ronda"
        className={cn(
          texto,
          'text-tinta-tenue hover:text-tinta',
        )}
      >
        {relatoLinea}
      </button>
    )
  }

  if (!relatoLinea) return null

  return (
    <span aria-live="polite" className={cn(texto, 'text-tinta-tenue')}>
      {relatoLinea}
    </span>
  )
}

/**
 * The size of an element, kept current. The mesa needs its own box in
 * pixels to know how large its cards can be; `maxima` is the uncrowded card
 * height, read from the `.cancha` scale so the mesa never draws cards bigger
 * than the design allows just because it has room.
 */
function useMedida<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [medida, setMedida] = useState({ ancho: 0, alto: 0, maxima: 0, carta: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const medir = () => {
      const estilo = getComputedStyle(el)
      const px = (nombre: string) => {
        const valor = parseFloat(estilo.getPropertyValue(nombre))
        return Number.isFinite(valor) ? valor : 0
      }
      setMedida({
        ancho: el.clientWidth,
        alto: el.clientHeight,
        maxima: px('--carta-mesa-max'),
        carta: px('--carta-md-px'),
      })
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return [ref, medida] as const
}
