/**
 * El Codicioso — the simplest bot that can finish a game.
 *
 * It plays legally and to the end, and no better than that. It lays down the
 * moment it can, unloads anything that fits, and throws the card that is
 * furthest from being useful. There is no memory of what has been discarded, no
 * reading of opponents, and no waiting for a better hand.
 *
 * That impatience is its whole character, and the yardstick the other bots are
 * measured against: whatever they do differently, they do it against a player
 * that never once hesitates.
 *
 * It cannot peek at another hand, because it never receives one: a bot decides
 * from a `VistaDeAsiento` — what its seat can legitimately see — and the view
 * has no field that could carry anyone else's cards (Phase 30).
 */

import { type Move, type VistaDeAsiento } from '@/lib/engine'
import { utilidadDeCarta } from './agrupar'
import { type Bot } from './bot'
import { valorBase } from './evaluar'
import { type Perfil, decidirConPerfil } from './perfil'

/**
 * Only take the face-up card if it puts this hand at least halfway to a grupo
 * the **contrato** is asking for. Otherwise draw blind.
 *
 * This threshold matters more than it looks. A looser rule — take anything with
 * a partner — measurably stops rondas from ending: the hand fills with pairs and
 * chains that pair up nicely and serve no contrato, and there is never room to
 * collect what is actually needed.
 */
const MITAD_DEL_CAMINO = 0.5

const PERFIL: Perfil = {
  quiereElDescarte: (arriba, vista) =>
    utilidadDeCarta(arriba, [...vista.mano, arriba], vista.contrato) >= MITAD_DEL_CAMINO,

  // A patient bot would sometimes wait; this one never does, which is exactly
  // what makes it a baseline.
  seBaja: () => true,

  valorEnMano: valorBase,
}

export const codicioso: Bot = {
  id: 'codicioso',
  nombre: 'El Codicioso',
  descripcion: 'Se baja apenas puede y suelta todo lo que la mesa le acepte.',
  decidir: decidirCodicioso,
}

export function decidirCodicioso(vista: VistaDeAsiento): Move {
  return decidirConPerfil(vista, PERFIL)
}
