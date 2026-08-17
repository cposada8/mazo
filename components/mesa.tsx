/**
 * The table, drawn from a RondaState.
 *
 * Everything here is presentational: it renders a state and never changes one.
 * Interaction arrives in the next phase, and it will sit on top of these same
 * components rather than replacing them.
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
export function GrupoEnMesa({ grupo }: { grupo: Grupo }) {
  return (
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
}: {
  jugador: JugadorState
  nombre: string
  esSuTurno: boolean
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
            <GrupoEnMesa key={index} grupo={grupo} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The two piles. The stock shows its count; the descarte shows its top card. */
export function Pilas({ state }: { state: RondaState }) {
  const arriba = state.discard.at(-1)

  return (
    <div className="flex items-end gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <CartaBocaAbajo />
        <span className="text-muted-foreground text-xs">
          Mazo · {state.stock.length}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {arriba ? (
          <Carta card={arriba} />
        ) : (
          <div className="border-muted-foreground/30 h-20 w-14 rounded-md border border-dashed" />
        )}
        <span className="text-muted-foreground text-xs">
          Descarte · {state.discard.length}
        </span>
      </div>
    </div>
  )
}

/** Your own hand, face up, along the bottom. */
export function Mano({ jugador }: { jugador: JugadorState }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Tu mano</h2>
        <span className="text-muted-foreground text-xs">
          {jugador.hand.length} cartas
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {jugador.hand.map((card) => (
          <Carta key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}

export function Mesa({
  state,
  asiento,
  nombres,
}: {
  state: RondaState
  /** The seat whose hand is shown face up. */
  asiento: number
  nombres?: readonly string[]
}) {
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
          />
        ))}
      </section>

      <Pilas state={state} />

      {tu.grupos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lo que bajaste</h2>
          <div className="flex flex-wrap gap-3">
            {tu.grupos.map((grupo, index) => (
              <GrupoEnMesa key={index} grupo={grupo} />
            ))}
          </div>
        </section>
      )}

      <Mano jugador={tu} />
    </div>
  )
}
