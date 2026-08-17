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

/** Your own hand, face up, along the bottom. */
export function Mano({
  jugador,
  seleccionadas,
  onCarta,
}: {
  jugador: JugadorState
  seleccionadas?: ReadonlySet<string>
  onCarta?: (cardId: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Tu mano</h2>
        <span className="text-muted-foreground text-xs">
          {jugador.hand.length} cartas
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {jugador.hand.map((card) => {
          const elegida = seleccionadas?.has(card.id) ?? false
          const carta = (
            <Carta
              card={card}
              className={cn(
                elegida && 'ring-foreground ring-offset-background -translate-y-2 ring-2 ring-offset-2',
                onCarta && 'transition-transform',
              )}
            />
          )

          return onCarta ? (
            <button
              key={card.id}
              type="button"
              onClick={() => onCarta(card.id)}
              aria-pressed={elegida}
            >
              {carta}
            </button>
          ) : (
            <div key={card.id}>{carta}</div>
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
  onRobar,
  onCarta,
  onGrupo,
  seleccionadas,
}: {
  state: RondaState
  /** The seat whose hand is shown face up. */
  asiento: number
  nombres?: readonly string[]
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

      <Mano jugador={tu} seleccionadas={seleccionadas} onCarta={onCarta} />
    </div>
  )
}
