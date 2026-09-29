/**
 * El Calculador — the first bot above the *Fácil* level (Phase 54).
 *
 * Same turn as every bot — draw, lay down or unload, throw — but none of the
 * three shortcuts the *Fácil* bots take, which the owner decided they keep:
 *
 * - **The best bajada, not the first.** Every grouping the hand allows is
 *   compared by what it leaves behind, and under the libre bajada each one is
 *   grown with every card its grupos will take — points out of hand while the
 *   mesa is still closed, and out of the ronda outright if the hand runs out.
 * - **Points count in the discard, and count more as the ronda closes.** A
 *   K and a 3 of equal use are not equal to throw, and a stock running thin
 *   or a seat bajado and nearly empty make the difference sharper.
 * - **No gifts.** Only the next seat can take a discard; when that seat is
 *   bajado, a card that fits the mesa is a card it puts down.
 *
 * Everything it knows is in its seat's view, like every other bot.
 */

import {
  type Card,
  type Move,
  type Propuesta,
  type VistaDeAsiento,
  aplicarEnVista,
  isComodin,
  puntosDeCarta,
} from '@/lib/engine'
import { ampliarBajada, todasLasAgrupaciones, utilidadDeCarta } from './agrupar'
import { type Bot } from './bot'
import { decidirEscalera } from './escalera'
import { alcanceEnMesa, buscarDescarga, ligaDeInmediato, ligaEnAlgunGrupo } from './evaluar'
import { alguienEstaPorSalir, alguienMasSeBajo } from './perfil'

/** The *Fácil* bar at the draw, kept: loosening it is how tables hang. */
const MITAD_DEL_CAMINO = 0.5

/** Groupings compared per bajada; a hand rarely offers more. */
const MAX_AGRUPACIONES = 48

export const calculador: Bot = {
  id: 'calculador',
  nombre: 'El Calculador',
  descripcion: 'Escoge la bajada que menos le deja y bota caro cuando la ronda se cierra.',
  decidir: decidirCalculador,
}

export function decidirCalculador(vista: VistaDeAsiento): Move {
  if (vista.contrato.escalera) return decidirEscalera(vista, vista.contrato.escalera)
  if (vista.fase === 'draw') return robar(vista)

  if (vista.jugadores[vista.asiento].bajadoEnTurno === null) {
    const bajada = mejorBajada(vista)
    if (bajada) return { type: 'bajarse', propuestas: bajada }
  } else {
    const descarga = buscarDescarga(vista)
    if (descarga) return descarga
  }

  return { type: 'descartar', cardId: cartaABotar(vista).id }
}

// ------------------------------------------------------------------ draw

function robar(vista: VistaDeAsiento): Move {
  const arriba = vista.descarte.at(-1)
  const bajado = vista.jugadores[vista.asiento].bajadoEnTurno !== null

  if (arriba) {
    const laQuiere = bajado
      ? ligaDeInmediato(vista, arriba)
      : utilidadDeCarta(arriba, [...vista.mano, arriba], vista.contrato) >= MITAD_DEL_CAMINO ||
        // The card that lets it lay down this very turn, whatever it scores.
        (todasLasAgrupaciones(vista.mano, vista.contrato, 1).length === 0 &&
          todasLasAgrupaciones([...vista.mano, arriba], vista.contrato, 1).length > 0)
    if (laQuiere) return { type: 'robar', de: 'descarte' }
  }

  return vista.stock > 0 || vista.descarte.length > 1
    ? { type: 'robar', de: 'stock' }
    : { type: 'robar', de: 'descarte' }
}

// ---------------------------------------------------------------- bajada

/**
 * The bajada that leaves the least behind, or null if there is none.
 *
 * Each candidate is played against the view and the clock nudged to the next
 * turn, when the mesa opens: a card still in hand that fits somewhere then is
 * nearly free, one that does not is its full points — less the one that will
 * be thrown this turn.
 */
export function mejorBajada(vista: VistaDeAsiento): Propuesta[] | null {
  const agrupaciones = todasLasAgrupaciones(vista.mano, vista.contrato, MAX_AGRUPACIONES)

  let mejor: Propuesta[] | null = null
  let mejorCosto = Infinity

  for (const agrupacion of agrupaciones) {
    const propuestas = vista.bajadaEstricta
      ? agrupacion
      : ampliarBajada(agrupacion, vista.mano)
    const usadas = propuestas.reduce((total, propuesta) => total + propuesta.cardIds.length, 0)

    // Out on the spot: nothing beats it.
    if (usadas === vista.mano.length) return propuestas

    const costo = costoTrasBajarse(propuestas, vista)
    if (costo < mejorCosto) {
      mejor = propuestas
      mejorCosto = costo
    }
  }

  return mejor
}

function costoTrasBajarse(propuestas: readonly Propuesta[], vista: VistaDeAsiento): number {
  const bajada = aplicarEnVista(vista, { type: 'bajarse', propuestas })
  if (!bajada.ok) return Infinity

  const manana: VistaDeAsiento = {
    ...bajada.vista,
    numeroDeTurno: bajada.vista.numeroDeTurno + 1,
  }

  const costos = manana.mano.map((card) => {
    const puntos = puntosDeCarta(card)
    return ligaEnAlgunGrupo(manana, card) ? puntos * 0.1 : puntos
  })
  // The dearest leftover goes out with this turn's discard.
  return costos.reduce((a, b) => a + b, 0) - Math.max(0, ...costos)
}

// --------------------------------------------------------------- discard

/**
 * How much the ronda's end should weigh on what to throw, from 0 up: small
 * while everybody is still collecting, large once somebody could go out.
 */
export function presion(vista: VistaDeAsiento): number {
  let total = 0.15
  if (vista.jugadores[vista.asiento].bajadoEnTurno !== null) total += 0.35
  if (alguienMasSeBajo(vista)) total += 0.2
  if (alguienEstaPorSalir(vista, 3)) total += 0.5
  if (vista.stock <= 6 || vista.rebarajadas > 0) total += 0.2
  return total
}

/** Whether the next seat, bajado, could put this card down on its turn. */
export function leRegalaAlSiguiente(card: Card, vista: VistaDeAsiento): boolean {
  const siguiente = (vista.asiento + 1) % vista.jugadores.length
  if (vista.jugadores[siguiente].bajadoEnTurno === null) return false

  const suTurno: VistaDeAsiento = {
    ...vista,
    asiento: siguiente,
    turno: siguiente,
    fase: 'act',
    mano: [card],
    numeroDeTurno: vista.numeroDeTurno + 1,
  }
  return ligaEnAlgunGrupo(suTurno, card) !== null
}

/** What a card is worth keeping: higher is kept, the lowest is thrown. */
export function valorParaQuedarse(card: Card, vista: VistaDeAsiento): number {
  if (isComodin(card)) return Number.MAX_SAFE_INTEGER

  const bajado = vista.jugadores[vista.asiento].bajadoEnTurno !== null
  const uso = bajado
    ? alcanceEnMesa(card, vista)
    : utilidadDeCarta(card, vista.mano, vista.contrato)
  const regalo = leRegalaAlSiguiente(card, vista) ? 10 : 0

  return uso - (presion(vista) * puntosDeCarta(card)) / 20 + regalo
}

export function cartaABotar(vista: VistaDeAsiento): Card {
  const valores = new Map(vista.mano.map((card) => [card.id, valorParaQuedarse(card, vista)]))
  return vista.mano.reduce((peor, card) =>
    valores.get(card.id)! < valores.get(peor.id)! ? card : peor,
  )
}
