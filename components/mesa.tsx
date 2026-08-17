/**
 * The table, drawn from a RondaState.
 *
 * Everything here draws a state and never changes one. Interaction is optional
 * and arrives entirely through callbacks: pass `onRobar`, `onCarta` and
 * `onGrupo` and the piles, hand and grupos become tappable; leave them out and
 * the same components render a game you are only watching.
 *
 * Laid out for a phone held in one hand: opponents at the top, the mesa in the
 * middle, the piles, and your own hand along the bottom where your thumb is.
 */

import { Carta, CartaBocaAbajo } from '@/components/carta'
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
  resaltado,
}: {
  grupo: Grupo
  onClick?: () => void
  resaltado?: boolean
}) {
  const contenido = (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {tituloDeGrupo(grupo)}
      </span>
      <div className="flex flex-wrap gap-1">
        {grupo.cards.map((card, index) => (
          <Carta
            key={card.id}
            card={card}
            size="sm"
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

  if (!onClick) return contenido

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border border-transparent p-1 text-left transition-colors',
        resaltado ? 'border-foreground/40 bg-accent' : 'hover:bg-accent/60',
      )}
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

/** An opponent: what everyone can legitimately see, and nothing more. */
export function Oponente({
  jugador,
  nombre,
  esSuTurno,
  onGrupo,
}: {
  jugador: JugadorState
  nombre: string
  esSuTurno: boolean
  onGrupo?: (grupoIndex: number) => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3',
        esSuTurno ? 'border-foreground/40 bg-card' : 'border-transparent',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {nombre}
          {esSuTurno && <span className="text-muted-foreground"> · juega</span>}
        </span>
        <span className="text-muted-foreground text-xs">
          {jugador.hand.length} cartas
          {jugador.bajadoEnTurno !== null && ' · bajado'}
        </span>
      </div>

      <div className="flex flex-wrap gap-0.5">
        {jugador.hand.map((card) => (
          <CartaBocaAbajo key={card.id} size="sm" className="h-8 w-6" />
        ))}
      </div>

      {jugador.grupos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {jugador.grupos.map((grupo, index) => (
            <GrupoEnMesa
              key={index}
              grupo={grupo}
              onClick={onGrupo ? () => onGrupo(index) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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
  const estiloPila = activo
    ? 'rounded-lg ring-2 ring-foreground/30 ring-offset-2 ring-offset-background'
    : ''

  return (
    <div className="flex items-end gap-6">
      <button
        type="button"
        disabled={!activo}
        onClick={() => onRobar?.('stock')}
        className="flex cursor-default flex-col items-center gap-1.5 enabled:cursor-pointer"
      >
        <CartaBocaAbajo className={estiloPila} />
        <span className="text-muted-foreground text-xs">
          Mazo · {state.stock.length}
        </span>
      </button>

      <button
        type="button"
        disabled={!activo || !arriba}
        onClick={() => onRobar?.('descarte')}
        className="flex cursor-default flex-col items-center gap-1.5 enabled:cursor-pointer"
      >
        {arriba ? (
          <Carta card={arriba} className={estiloPila} />
        ) : (
          <div className="border-muted-foreground/30 h-20 w-14 rounded-md border border-dashed" />
        )}
        <span className="text-muted-foreground text-xs">
          Descarte · {state.discard.length}
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          Tu mano{' '}
          <span className="text-muted-foreground font-normal">· {total}</span>
          {puntos !== undefined && (
            <span
              className="text-muted-foreground font-normal"
              title="Lo que costaría esta mano si la ronda terminara ahora"
            >
              {' '}
              · {puntos} pts
            </span>
          )}
        </h2>
        {acciones}
      </div>

      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pt-3 pb-2">
        {secciones.map((seccion) => {
          const indice = posicionFijada.get(seccion.id) ?? -1

          return (
            <div key={seccion.id} className="flex shrink-0 flex-col gap-1">
              <div className="flex w-max pl-3">
                {seccion.cards.map((card) => {
                  const elegida = seleccionadas?.has(card.id) ?? false
                  const carta = (
                    <Carta
                      card={card}
                      className={cn(
                        'transition-transform',
                        elegida &&
                          'ring-foreground ring-offset-background -translate-y-3 ring-2 ring-offset-2',
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
                  className="text-muted-foreground enabled:hover:text-foreground ml-3 text-[10px] tracking-wide uppercase"
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
} & MesaInteractiva) {
  const nombreDe = (seat: number) => nombres?.[seat] ?? nombrePorDefecto(seat)
  const tu = state.jugadores[asiento]

  const otros = state.jugadores
    .map((jugador, seat) => ({ jugador, seat }))
    .filter(({ seat }) => seat !== asiento)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs tracking-widest uppercase">
            Contrato
          </span>
          <h1 className="text-lg font-semibold">{state.contrato.nombre}</h1>
        </div>
        <span className="text-muted-foreground text-sm">
          {state.ganador !== null
            ? `${nombreDe(state.ganador)} se fue`
            : `Turno ${state.numeroDeTurno} · juega ${nombreDe(state.turno)}`}
        </span>
      </header>

      <section className="flex flex-col gap-2">
        {otros.map(({ jugador, seat }) => (
          <Oponente
            key={seat}
            jugador={jugador}
            nombre={nombreDe(seat)}
            esSuTurno={state.turno === seat && state.ganador === null}
            onGrupo={onGrupo ? (index) => onGrupo(seat, index) : undefined}
          />
        ))}
      </section>

      <Pilas state={state} onRobar={onRobar} />

      {tu.grupos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lo que bajaste</h2>
          <div className="flex flex-wrap gap-3">
            {tu.grupos.map((grupo, index) => (
              <GrupoEnMesa
                key={index}
                grupo={grupo}
                onClick={onGrupo ? () => onGrupo(asiento, index) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <Mano
        secciones={
          secciones ?? [{ id: 'sueltas', cards: [...tu.hand], bloqueada: false }]
        }
        puntos={puntos}
        seleccionadas={seleccionadas}
        onCarta={onCarta}
        onSoltar={onSoltar}
        acciones={accionesDeMano}
      />
    </div>
  )
}
