/**
 * The table as it has been *told*, not as it has happened (Phase 59).
 *
 * The engine applies a move the instant it is played; the table tells it a
 * moment later, a line at a time, with the card flying across. Drawn from the
 * state, the descarte showed a thrown card before its flight had even
 * started — with quick bots, a card landed and then a copy of it flew in.
 *
 * So the table is drawn from the state *rewound* by the moves still waiting to
 * land: the piles, the stock and every seat's card count go back to where they
 * were, and the cards those moves put on the mesa are hidden — hidden, not
 * removed, so the mesa keeps their room and does not jump when they land, and
 * the flight has somewhere to aim.
 *
 * Presentation only. The state stays the truth, every rule is judged on it,
 * and the reader's own hand is never rewound: what you did is in your hand at
 * once.
 *
 * Every step checks that the view agrees before undoing anything — a relato
 * and a view that disagree (one arrived a render before the other) leave that
 * step alone rather than invent a table.
 */

import {
  type Card,
  type VistaDeAsiento,
  type VistaJugador,
  describeCard,
  isComodin,
} from '@/lib/engine'
import type { Relato } from '@/lib/relato'

export type MesaContada = {
  /** The view with the piles and the counts rewound. The mesa is untouched. */
  readonly vista: VistaDeAsiento
  /** Cards on the mesa whose move has not landed yet: drawn, but invisible. */
  readonly ocultas: ReadonlySet<string>
}

/**
 * `vista` less the moves in `pendientes` (oldest first), as far as the table
 * shows them.
 */
export function rebobinar(
  vista: VistaDeAsiento,
  pendientes: readonly Relato[],
): MesaContada {
  const ocultas = new Set<string>()
  if (pendientes.length === 0) return { vista, ocultas }

  const descarte = [...vista.descarte]
  let stock = vista.stock
  const cartas = vista.jugadores.map((jugador) => jugador.cartas)
  const bajado = vista.jugadores.map((jugador) => jugador.bajadoEnTurno)

  /** The last card on the mesa that reads `texto` and is not hidden yet. */
  const enMesa = (texto: string, asientos: readonly number[]): Card | null => {
    let hallada: Card | null = null
    for (const seat of asientos) {
      for (const grupo of vista.jugadores[seat]?.grupos ?? []) {
        for (const card of grupo.cards) {
          if (!ocultas.has(card.id) && describeCard(card) === texto) hallada = card
        }
      }
    }
    return hallada
  }
  const todos = vista.jugadores.map((_, seat) => seat)

  for (let i = pendientes.length - 1; i >= 0; i--) {
    const relato = pendientes[i]
    const seat = relato.seat

    switch (relato.tipo) {
      case 'bota': {
        const arriba = descarte.at(-1)
        if (!arriba || describeCard(arriba) !== relato.carta) break
        descarte.pop()
        cartas[seat]++
        break
      }
      case 'descarte': {
        // Back on top: the reader's own copy if it took it, a face otherwise.
        const propia =
          seat === vista.asiento
            ? vista.mano.find((card) => describeCard(card) === relato.carta)
            : undefined
        const carta = propia ?? cartaDeTexto(relato.carta, `rebobinada-${i}`)
        if (!carta) break
        descarte.push(carta)
        cartas[seat] = Math.max(0, cartas[seat] - 1)
        break
      }
      case 'mazo':
        stock++
        cartas[seat] = Math.max(0, cartas[seat] - 1)
        break
      case 'bajada': {
        // A bajada is a seat's first grupos: everything it has on the mesa.
        for (const grupo of vista.jugadores[seat]?.grupos ?? []) {
          for (const card of grupo.cards) {
            if (ocultas.has(card.id)) continue
            ocultas.add(card.id)
            cartas[seat]++
          }
        }
        bajado[seat] = null
        break
      }
      case 'agrega':
        for (const texto of relato.cartas) {
          const card = enMesa(texto, [relato.dueno])
          if (!card) continue
          ocultas.add(card.id)
          cartas[seat]++
        }
        break
      case 'comodin': {
        const card = enMesa(relato.carta, todos)
        if (!card) break
        ocultas.add(card.id)
        cartas[seat]++
        break
      }
    }
  }

  const jugadores: VistaJugador[] = vista.jugadores.map((jugador, seat) => ({
    ...jugador,
    cartas: cartas[seat],
    bajadoEnTurno: bajado[seat],
  }))

  return { vista: { ...vista, descarte, stock, jugadores }, ocultas }
}

/**
 * A card read back from the way a relato names it — `J♥`, `10♦`, `comodin` —
 * for drawing only: `id` is whatever the caller needs it to be. Only ever for
 * cards that were face up, so nothing secret is reconstructed.
 */
export function cartaDeTexto(texto: string, id: string): Card | null {
  if (texto === 'comodin' || texto.startsWith('★') || texto === '**') {
    return { id, kind: 'comodin' }
  }
  const match = /^(10|[2-9AJQK])([♠♥♦♣])$/.exec(texto)
  if (!match) return null

  const palos = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' } as const
  const carta = {
    id,
    kind: 'normal',
    rank: match[1],
    suit: palos[match[2] as keyof typeof palos],
  } as Card
  return isComodin(carta) ? null : carta
}
