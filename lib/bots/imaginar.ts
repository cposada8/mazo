/**
 * Imagining the hands a seat cannot see (Phase 56).
 *
 * A view hides the other hands and the stock's order, and a bot that wants to
 * try a move out needs a whole ronda to try it in. So one is dealt: every card
 * the seat has not seen, shuffled into the other hands and the stock in the
 * right amounts — and, where the memory says so, the cards a seat took off the
 * descarte put back in that seat's hand, because that is where they are.
 *
 * Nothing is guessed that the seat could know. Card ids are fixed by the deck
 * (`7-hearts#0`), so the unseen cards are exactly the deck less the seen ones;
 * and whether this partida plays with comodines, which the view does not say,
 * follows from counting every card at the table.
 */

import {
  type Card,
  type RondaState,
  type VistaDeAsiento,
  buildDeck,
  createRng,
  isComodin,
  shuffle,
} from '@/lib/engine'
import type { Memoria } from './memoria'

/** Cards in a deck with comodines; without them, four fewer. */
const MAZO_CON_COMODINES = buildDeck({ comodines: true }).length

/** Every card this seat has seen: its hand, the descarte, the mesa. */
function vistas(vista: VistaDeAsiento): Card[] {
  return [
    ...vista.mano,
    ...vista.descarte,
    ...vista.jugadores.flatMap((jugador) => jugador.grupos.flatMap((grupo) => grupo.cards)),
  ]
}

/** Whether this partida was dealt with comodines, from the count of cards. */
export function juegaConComodines(vista: VistaDeAsiento): boolean {
  const ocultas = vista.jugadores.reduce(
    (total, jugador, seat) => (seat === vista.asiento ? total : total + jugador.cartas),
    vista.stock,
  )
  return vistas(vista).length + ocultas === MAZO_CON_COMODINES
}

/**
 * A whole ronda consistent with everything this seat knows, the unseen cards
 * dealt at random from `semilla`.
 */
export function imaginarRonda(
  vista: VistaDeAsiento,
  semilla: number,
  memoria?: Memoria,
): RondaState {
  const rng = createRng(semilla)
  const vistasIds = new Set(vistas(vista).map((card) => card.id))
  const ocultas = shuffle(
    buildDeck({ comodines: juegaConComodines(vista) }).filter((card) => !vistasIds.has(card.id)),
    rng,
  )
  const libres = new Set(ocultas.map((card) => card.id))

  const manos: Card[][] = vista.jugadores.map(() => [])

  // What the memory places: a card taken off the descarte and not seen since.
  if (memoria) {
    vista.jugadores.forEach((jugador, seat) => {
      if (seat === vista.asiento) return
      for (const tomada of memoria[seat]?.tomadas ?? []) {
        if (manos[seat].length >= jugador.cartas) break
        const carta = ocultas.find(
          (card) =>
            libres.has(card.id) &&
            !isComodin(card) &&
            card.rank === tomada.rank &&
            card.suit === tomada.suit,
        )
        if (!carta) continue
        manos[seat].push(carta)
        libres.delete(carta.id)
      }
    })
  }

  const resto = ocultas.filter((card) => libres.has(card.id))
  let siguiente = 0
  vista.jugadores.forEach((jugador, seat) => {
    if (seat === vista.asiento) return
    while (manos[seat].length < jugador.cartas && siguiente < resto.length) {
      manos[seat].push(resto[siguiente++])
    }
  })

  return {
    contrato: vista.contrato,
    ...(vista.bajadaEstricta ? { bajadaEstricta: true } : {}),
    jugadores: vista.jugadores.map((jugador, seat) => ({
      hand: seat === vista.asiento ? [...vista.mano] : manos[seat],
      grupos: jugador.grupos,
      bajadoEnTurno: jugador.bajadoEnTurno,
    })),
    stock: resto.slice(siguiente),
    discard: [...vista.descarte],
    rebarajadas: vista.rebarajadas,
    turno: vista.turno,
    numeroDeTurno: vista.numeroDeTurno,
    fase: vista.fase,
    rngState: rng.state(),
    ganador: vista.ganador,
  }
}
