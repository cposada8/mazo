/**
 * The table, drawn from a RondaState.
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

import { Carta, CartaBocaAbajo } from '@/components/carta'
import { asientosRivales } from '@/lib/asientos'
import {
  type Escala,
  type Grupo,
  type JugadorState,
  type RondaState,
  escalaRankAt,
  isComodin,
} from '@/lib/engine'
import type { Seccion } from '@/lib/mano'
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
      <span className="text-[calc(var(--texto-mesa,0.75rem)*0.85)] font-medium tracking-wide text-emerald-50/70 uppercase">
        {tituloDeGrupo(grupo)}
      </span>
      <div className="flex">
        {grupo.cards.map((card, index) => (
          <Carta
            key={card.id}
            card={card}
            size="xs"
            className="-ml-[0.55em] first:ml-0"
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
      className="shrink-0 rounded-md border border-transparent p-1 text-left transition-colors hover:border-emerald-100/40 hover:bg-emerald-50/10"
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
export function Asiento({
  jugador,
  nombre,
  esSuTurno,
  x,
  y,
}: {
  jugador: JugadorState
  nombre: string
  esSuTurno: boolean
  /** Percent of the seat band. `y` anchors the seat's top edge. */
  x: number
  y: number
}) {
  return (
    <div
      className="absolute flex max-w-[26cqw] -translate-x-1/2 flex-col items-center gap-[0.6cqh]"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* The fan: sized by font so the backs and their overlap scale together. */}
      <div className="flex items-end justify-center text-[clamp(0.7rem,5cqh,1.1rem)]">
        {jugador.hand.map((card) => (
          <CartaBocaAbajo
            key={card.id}
            className="-ml-[0.55em] h-[1em] w-[0.72em] rounded-[2px] border-0 shadow-none ring-1 ring-emerald-950/40 first:ml-0"
          />
        ))}
      </div>

      <div
        className={cn(
          'flex size-[var(--ficha,2rem)] items-center justify-center rounded-full border text-[calc(var(--ficha,2rem)*0.45)] font-semibold transition-shadow',
          esSuTurno
            ? 'border-amber-300 bg-amber-300 text-amber-950 ring-4 ring-amber-300/40'
            : 'border-emerald-100/25 bg-emerald-950/60 text-emerald-50',
        )}
      >
        {inicial(nombre)}
      </div>

      <span className="max-w-full truncate text-[var(--texto-mesa,0.75rem)] leading-tight font-medium text-emerald-50">
        {nombre}
        <span className="text-emerald-100/60">
          {' '}
          · {jugador.hand.length}
          {jugador.bajadoEnTurno !== null && ' · bajado'}
        </span>
      </span>
    </div>
  )
}

const inicial = (nombre: string): string =>
  [...nombre.trim()][0]?.toUpperCase() ?? '?'

/** The two piles. The stock shows its count; the descarte shows its top card. */
export function Pilas({
  state,
  onRobar,
}: {
  state: RondaState
  /** When given, both piles become buttons for drawing. */
  onRobar?: (de: 'stock' | 'descarte') => void
}) {
  const arriba = state.discard.at(-1)
  const activo = Boolean(onRobar)
  const estiloPila = activo ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-emerald-900' : ''

  return (
    <div className="flex shrink-0 items-start gap-2">
      <button
        type="button"
        disabled={!activo}
        onClick={() => onRobar?.('stock')}
        className="flex cursor-default flex-col items-center gap-0.5 enabled:cursor-pointer"
      >
        <CartaBocaAbajo size="sm" className={estiloPila} />
        <span className="text-[var(--texto-mesa,0.75rem)] text-emerald-100/70">
          {state.stock.length}
        </span>
      </button>

      <button
        type="button"
        disabled={!activo || !arriba}
        onClick={() => onRobar?.('descarte')}
        className="flex cursor-default flex-col items-center gap-0.5 enabled:cursor-pointer"
      >
        {arriba ? (
          <Carta card={arriba} size="sm" className={estiloPila} />
        ) : (
          <div className="aspect-[8/11] h-[var(--carta-sm,3.5rem)] rounded-md border border-dashed border-emerald-100/30" />
        )}
        <span className="text-[var(--texto-mesa,0.75rem)] text-emerald-100/70">
          {state.discard.length}
        </span>
      </button>
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
  onCarta,
  onSoltar,
  acciones,
  cabecera,
  esTuTurno,
}: {
  /** Pinned bloques first, then the loose cards. */
  secciones: readonly Seccion[]
  /** What the hand would cost if the ronda ended now. */
  puntos?: number
  seleccionadas?: ReadonlySet<string>
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
              'rounded px-1.5 py-0.5',
              esTuTurno && 'bg-amber-300 text-amber-950',
            )}
          >
            Tu mano
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
              <div className="flex w-max pl-3">
                {seccion.cards.map((card) => {
                  const elegida = seleccionadas?.has(card.id) ?? false
                  const carta = (
                    <Carta
                      card={card}
                      className={cn(
                        'transition-transform',
                        elegida &&
                          'ring-foreground ring-offset-background -translate-y-2 ring-2 ring-offset-2',
                      )}
                    />
                  )

                  return onCarta ? (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onCarta(card.id)}
                      aria-pressed={elegida}
                      className={cn('-ml-3 shrink-0', elegida && 'z-10')}
                    >
                      {carta}
                    </button>
                  ) : (
                    <div key={card.id} className="-ml-3 shrink-0">
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
}: {
  state: RondaState
  /** The seat whose hand is shown face up. */
  asiento: number
  nombres?: readonly string[]
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
} & MesaInteractiva) {
  const nombreDe = (seat: number) => nombres?.[seat] ?? nombrePorDefecto(seat)
  const tu = state.jugadores[asiento]
  const esTuTurno = state.turno === asiento && state.ganador === null

  const rivales = asientosRivales(state.jugadores.length, asiento)

  // Every grupo on the table, from every player. Laid down is laid down.
  const enMesa = state.jugadores.flatMap((jugador, seat) =>
    jugador.grupos.map((grupo, grupoIndex) => ({ grupo, seat, grupoIndex })),
  )

  return (
    <div className="cancha flex h-full w-full flex-col overflow-hidden bg-emerald-950">
      {/*
        The table: felt behind, then two lanes on top of it — seats, then the
        mesa. The room around the felt is dark in both themes: a card table is
        a lit thing in a dim room, and it is the surround, not the felt, that
        does the decorating.
      */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          aria-hidden
          className="ovalo absolute inset-x-[2%] top-[6%] bottom-[3%] rounded-[50%] border-4 border-emerald-950/60 bg-emerald-800 shadow-[inset_0_0_60px_rgba(0,0,0,0.35)] dark:bg-emerald-900"
        />
        {/* The contract, printed on the felt the way a table has its house
            name on it: always there, never in the way. */}
        <span
          aria-hidden
          className="absolute bottom-[4%] left-1/2 -translate-x-1/2 text-[var(--texto-mesa,0.75rem)] font-semibold tracking-[0.3em] whitespace-nowrap text-emerald-100/20 uppercase"
        >
          {state.contrato.nombre}
        </span>

        {/* Seat lane: the opponents' strip, and nothing else may enter it. */}
        <div className="relative z-10 h-[var(--banda-asientos,42%)] shrink-0">
          {rivales.map(({ seat, x, y }) => (
            <Asiento
              key={seat}
              jugador={state.jugadores[seat]}
              nombre={nombreDe(seat)}
              esSuTurno={state.turno === seat && state.ganador === null}
              x={x}
              y={y}
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
              <span className="self-center text-[var(--texto-mesa,0.75rem)] text-emerald-100/40">
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
      </div>

      {/* Your side of the table. */}
      <div className="bg-background/95 flex shrink-0 items-end gap-3 border-t px-3 pt-0.5 pb-1 backdrop-blur">
        <div className="flex min-w-0 flex-1 flex-col">
          <Mano
            cabecera={sobreLaMano}
            secciones={
              secciones ?? [{ id: 'sueltas', cards: [...tu.hand], bloqueada: false }]
            }
            puntos={puntos}
            seleccionadas={seleccionadas}
            onCarta={onCarta}
            onSoltar={onSoltar}
            acciones={accionesDeMano}
            esTuTurno={esTuTurno}
          />
        </div>

        {acciones && <div className="shrink-0 pb-1">{acciones}</div>}
      </div>
    </div>
  )
}
