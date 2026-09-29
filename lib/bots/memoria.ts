/**
 * La memoria de la mesa (Phase 55): what every other seat has shown it wants.
 *
 * A view is a snapshot — it shows the descarte as a pile, never who took what
 * off it. The relatos are the missing half, and they are public by
 * construction (a card off the mazo is never named), so a bot reading them is
 * not peeking: it remembers what everybody at the table watched happen.
 *
 * Three things per seat:
 * - **tomadas** — cards it took off the descarte: it is collecting near them.
 * - **dejadas** — face-up cards it let pass by drawing from the mazo instead.
 * - **botadas** — cards it threw.
 *
 * Only *other* seats are read. A bot's own moves tell it nothing it does not
 * know, and leaving them out keeps a turn stable while it is being played: the
 * server can resume a half-played bot turn on a later request (Phase 34), and
 * the moves decided then must be the moves that were decided before.
 *
 * The relatos of a ronda start empty with each reparto, in both homes, so the
 * memory never reaches into a ronda that is over.
 */

import { RANKS, type Rank, type Suit } from '@/lib/engine'
import type { Relato } from '@/lib/relato'

export type CartaVista = { readonly rank: Rank; readonly suit: Suit }

export type Recuerdo = {
  readonly tomadas: readonly CartaVista[]
  readonly dejadas: readonly CartaVista[]
  readonly botadas: readonly CartaVista[]
}

export type Memoria = readonly Recuerdo[]

const PALO_POR_SIMBOLO: Record<string, Suit> = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
}

/** A card as a relato names it — `7♥`, `10♦` — or null for a comodín. */
export function leerCarta(texto: string): CartaVista | null {
  const suit = PALO_POR_SIMBOLO[texto.slice(-1)]
  const rank = texto.slice(0, -1) as Rank
  if (!suit || !RANKS.includes(rank)) return null
  return { rank, suit }
}

/**
 * What each seat but `yo` has shown, from the ronda's relatos in order.
 *
 * Who let a card pass is worked out from the order: a seat that draws from
 * the mazo while a card lies face up has declined that card. The pile is
 * followed as the relatos move it — a throw lays a card on top, a take lifts
 * it — and where the relatos cannot say what is on top (the reparto's first
 * card, the bottom of a pile after a take), nothing is inferred.
 */
export function leerMemoria(
  relatos: readonly Relato[],
  asientos: number,
  yo: number,
): Memoria {
  const memoria = Array.from({ length: asientos }, () => ({
    tomadas: [] as CartaVista[],
    dejadas: [] as CartaVista[],
    botadas: [] as CartaVista[],
  }))
  const pila: (CartaVista | null)[] = []

  for (const relato of relatos) {
    const recuerdo = relato.seat !== yo ? memoria[relato.seat] : undefined

    switch (relato.tipo) {
      case 'bota': {
        const carta = leerCarta(relato.carta)
        pila.push(carta)
        if (carta) recuerdo?.botadas.push(carta)
        break
      }
      case 'descarte': {
        pila.pop()
        const carta = leerCarta(relato.carta)
        if (carta) recuerdo?.tomadas.push(carta)
        break
      }
      case 'mazo': {
        const arriba = pila.at(-1)
        if (arriba) recuerdo?.dejadas.push(arriba)
        break
      }
    }
  }

  return memoria
}
