/**
 * The turn every bot plays, and the three places a personality gets a say.
 *
 * The shape of a turn is not character: draw, then either lay down or unload
 * what the mesa will take, then throw something. What *is* character is three
 * judgements inside it — is that face-up card worth taking, is this the moment
 * to lay down, and what is a card worth in hand. A `Perfil` answers those three
 * and inherits the rest, which is what makes a new bot one file and no engine
 * change, and what keeps a personality from quietly becoming an incompetence.
 *
 * One judgement is deliberately **not** offered: once a bot has bajado it takes
 * the face-up card only if the mesa will take it right now. That is not
 * conservatism, it is the rule that keeps two bajado bots from passing the same
 * "useful" card back and forth forever — the loop that hung seed soak-204.
 */

import {
  type Card,
  type Move,
  type Propuesta,
  type VistaDeAsiento,
} from '@/lib/engine'
import { buscarAgrupacion } from './agrupar'
import { buscarDescarga, ligaDeInmediato, peorCarta } from './evaluar'

export type Perfil = {
  /** Not bajado yet: is the card lying face up worth taking? */
  quiereElDescarte(arriba: Card, vista: VistaDeAsiento): boolean
  /**
   * A grouping the contrato would accept is in hand. Lay it down now, or hold
   * it and keep collecting? Declining costs a turn of exposure and buys a
   * lighter hand later.
   */
  seBaja(agrupacion: readonly Propuesta[], vista: VistaDeAsiento): boolean
  /** What a card is worth in hand, weighed against every other card in it. */
  valorEnMano(card: Card, vista: VistaDeAsiento): number
}

export function decidirConPerfil(vista: VistaDeAsiento, perfil: Perfil): Move {
  if (vista.fase === 'draw') return decidirRobo(vista, perfil)

  if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
    const agrupacion = buscarAgrupacion(vista.mano, vista.contrato)
    if (agrupacion && perfil.seBaja(agrupacion, vista)) {
      return { type: 'bajarse', propuestas: agrupacion }
    }
  } else {
    const descarga = buscarDescarga(vista)
    if (descarga) return descarga
  }

  return { type: 'descartar', cardId: peorCarta(vista, perfil.valorEnMano).id }
}

function decidirRobo(vista: VistaDeAsiento, perfil: Perfil): Move {
  const arriba = vista.descarte.at(-1)

  if (arriba) {
    if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
      if (perfil.quiereElDescarte(arriba, vista)) return { type: 'robar', de: 'descarte' }
    } else if (ligaDeInmediato(vista, arriba)) {
      // Once bajado, "useful for the contrato" means nothing — the contrato is
      // already on the mesa. The face-up card is only worth taking if it can be
      // placed right now, and no personality overrides that.
      return { type: 'robar', de: 'descarte' }
    }
  }

  return vista.stock > 0 || vista.descarte.length > 1
    ? { type: 'robar', de: 'stock' }
    : { type: 'robar', de: 'descarte' }
}

/** How many cards would stay in hand after laying this grouping down and throwing one. */
export function restanTrasBajarse(
  agrupacion: readonly Propuesta[],
  vista: VistaDeAsiento,
): number {
  const usadas = agrupacion.reduce((total, propuesta) => total + propuesta.cardIds.length, 0)
  return vista.mano.length - usadas - 1
}

/** Whether anybody else is already down — the signal that the ronda is on a clock. */
export function alguienMasSeBajo(vista: VistaDeAsiento): boolean {
  return vista.jugadores.some(
    (jugador, seat) => seat !== vista.asiento && jugador.bajadoEnTurno !== null,
  )
}

/**
 * Whether somebody else is bajado and down to `cartas` cards or fewer.
 *
 * Both halves are public — the mesa shows who is down, and a hand is a count
 * everybody can see. A seat that is bajado and nearly empty is the one that
 * decides when this ronda ends.
 */
export function alguienEstaPorSalir(vista: VistaDeAsiento, cartas: number): boolean {
  return vista.jugadores.some(
    (jugador, seat) =>
      seat !== vista.asiento &&
      jugador.bajadoEnTurno !== null &&
      jugador.cartas <= cartas,
  )
}
