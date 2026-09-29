/**
 * How every bot plays an escalera ronda (Phase 48).
 *
 * An escalera contract is a different game: nothing goes on the mesa until
 * someone lays all thirteen rangos down at once and wins. So the turn is only
 * two judgements — take the face-up card or not, and what to throw — and both
 * come from one measure: how many of the thirteen places the hand covers for
 * the best escalera of this tipo it could still become
 * (`cubiertasDeEscalera`). Take a card only if it raises that; throw the card
 * whose loss lowers it least.
 *
 * Shared by every personality on purpose. Patience and memory are about
 * when to lay down and what the mesa will take, and an escalera ronda has
 * neither question: the moment the hand is complete, it goes down.
 */

import {
  type Card,
  type Move,
  type TipoDeEscalera,
  type VistaDeAsiento,
  cubiertasDeEscalera,
  isComodin,
  ordenarEscalera,
  puntosDeCarta,
} from '@/lib/engine'

export function decidirEscalera(vista: VistaDeAsiento, tipo: TipoDeEscalera): Move {
  if (vista.fase === 'draw') {
    const arriba = vista.descarte.at(-1)
    if (arriba && cubiertasTrasBotar([...vista.mano, arriba], tipo) > cubiertasDeEscalera(vista.mano, tipo)) {
      return { type: 'robar', de: 'descarte' }
    }
    return vista.stock > 0 || vista.descarte.length > 1
      ? { type: 'robar', de: 'stock' }
      : { type: 'robar', de: 'descarte' }
  }

  if (ordenarEscalera(vista.mano, tipo).ok) {
    return {
      type: 'bajarse',
      propuestas: [{ kind: 'escalera', tipo, cardIds: vista.mano.map((card) => card.id) }],
    }
  }

  return { type: 'descartar', cardId: cartaABotar(vista.mano, tipo).id }
}

/** The best the hand can cover after throwing its least useful card. */
function cubiertasTrasBotar(mano: readonly Card[], tipo: TipoDeEscalera): number {
  const botada = cartaABotar(mano, tipo)
  return cubiertasDeEscalera(
    mano.filter((card) => card.id !== botada.id),
    tipo,
  )
}

/**
 * The card whose loss costs the escalera least. Among equals, the heaviest in
 * points — if the ronda ends before the escalera does, what is left in hand is
 * what gets counted. A comodín is kept whenever anything else can go.
 */
export function cartaABotar(mano: readonly Card[], tipo: TipoDeEscalera): Card {
  const candidatas = mano.some((card) => !isComodin(card))
    ? mano.filter((card) => !isComodin(card))
    : mano

  let mejor = candidatas[0]
  let mejorCubiertas = -1
  for (const card of candidatas) {
    const cubiertas = cubiertasDeEscalera(
      mano.filter((otra) => otra.id !== card.id),
      tipo,
    )
    if (
      cubiertas > mejorCubiertas ||
      (cubiertas === mejorCubiertas && puntosDeCarta(card) > puntosDeCarta(mejor))
    ) {
      mejor = card
      mejorCubiertas = cubiertas
    }
  }
  return mejor
}
