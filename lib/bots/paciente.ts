/**
 * El Paciente — the bot that will not lay down just because it can.
 *
 * Its bet is simple and it is a real bet. Laying down early puts the contrato
 * safely on the mesa and leaves you holding whatever is left over, turn after
 * turn, with nowhere to put it. Waiting keeps the hand working: every card
 * drawn can still join a grupo that has not been committed yet, so when the
 * bajada finally comes there is almost nothing behind it.
 *
 * The engine is what makes this a bet rather than a free lunch: **the mesa is
 * untouchable on the turn you bajás.** Nothing gets unloaded until the turn
 * after, so what matters is not how much of the hand the bajada uses — it is
 * how much of the *rest* has somewhere to go once the mesa opens again. That is
 * measured here by playing the bajada out against the view and looking at the
 * table it would leave.
 *
 * And it loses that bet in public: when somebody else goes out first, El
 * Paciente is caught holding a full hand and eats every point of it. That is
 * the character, not a bug — a bot that hoards without risk would just be a
 * better bot, and this one is meant to be a different one.
 */

import { type Move, type Propuesta, type VistaDeAsiento } from '@/lib/engine'
import { aplicarEnVista } from '@/lib/engine'
import { utilidadDeCarta } from './agrupar'
import { type Bot } from './bot'
import { ligaEnAlgunGrupo, valorBase } from './evaluar'
import { type Perfil, alguienEstaPorSalir, decidirConPerfil } from './perfil'

/**
 * Cards it is willing to be left holding with nowhere to put them. Above this
 * it keeps collecting, whatever the contrato already allows.
 */
const LASTRE_TOLERABLE = 1

/** A stock this thin means the ronda is closing with or without us. */
const STOCK_QUE_APURA = 6

/**
 * Cards in a bajado opponent's hand at which patience stops being clever.
 *
 * Somebody merely laying down is not the danger — it happens on the fourth turn
 * of every ronda and waiting through it is the entire point of this bot. The
 * danger is somebody bajado who is nearly *empty*, because the ronda ends when
 * a hand does, and it ends on their turn, not on ours.
 */
const CARTAS_QUE_ASUSTAN = 4

/**
 * The same bar El Codicioso draws at, and deliberately so.
 *
 * The first version of this bot hoarded at the draw as well — it took anything
 * with a partner of its rango or a neighbour in its suit, the loose rule the
 * baseline was measured and denied. Four of them at one table hung 222 rondas
 * out of 400, and the tablas rule did not save them: tablas fires when the
 * **stock** cannot be served, and a table of hoarders takes the face-up card
 * every turn and never touches the stock. So they passed the same cards around
 * the descarte forever, each one improving, none of them finishing.
 *
 * Patience is about when to lay down. Greed at the draw is not a personality
 * this game can carry — it is a way of never ending.
 */
const MITAD_DEL_CAMINO = 0.5

const PERFIL: Perfil = {
  quiereElDescarte: (arriba, vista) =>
    utilidadDeCarta(arriba, [...vista.mano, arriba], vista.contrato) >= MITAD_DEL_CAMINO,

  seBaja: (agrupacion, vista) =>
    // Somebody is down and running out of cards: the ronda is about to end on
    // their turn, and being caught undressed costs the whole hand.
    alguienEstaPorSalir(vista, CARTAS_QUE_ASUSTAN) ||
    // The stock is nearly out, or has already been rebuilt once. Waiting for a
    // better hand only works while there are cards left to wait for.
    vista.stock <= STOCK_QUE_APURA ||
    vista.rebarajadas > 0 ||
    lastreTrasBajarse(agrupacion, vista) <= LASTRE_TOLERABLE,

  valorEnMano: valorBase,
}

/**
 * Cards that would be left over with nowhere to put them, once the mesa opens
 * again on the following turn.
 *
 * The bajada is played against the view — the same trick the table uses to show
 * a move before the server answers — and then the clock is nudged forward one
 * turn, because that is when the referee stops refusing to let the new grupos
 * be touched. Anything still unplaceable on that imagined table is dead weight,
 * and dead weight is what El Paciente is trying not to be caught with.
 */
function lastreTrasBajarse(
  agrupacion: readonly Propuesta[],
  vista: VistaDeAsiento,
): number {
  const bajada = aplicarEnVista(vista, { type: 'bajarse', propuestas: agrupacion })
  // If the referee would refuse this grouping, holding it back proves nothing.
  if (!bajada.ok) return 0

  const manana: VistaDeAsiento = {
    ...bajada.vista,
    numeroDeTurno: bajada.vista.numeroDeTurno + 1,
  }

  const colocables = manana.mano.filter(
    (card) => ligaEnAlgunGrupo(manana, card) !== null,
  ).length

  // One of the leftovers is thrown at the end of the turn, so it is not lastre.
  return Math.max(0, manana.mano.length - colocables - 1)
}

export const paciente: Bot = {
  id: 'paciente',
  nombre: 'El Paciente',
  descripcion: 'Aguanta la mano hasta que bajarse le deje poco encima.',
  decidir: decidirPaciente,
}

export function decidirPaciente(vista: VistaDeAsiento): Move {
  return decidirConPerfil(vista, PERFIL)
}
