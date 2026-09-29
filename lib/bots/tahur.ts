/**
 * El Tahúr — a bot that tries its moves out before playing them (Phase 56).
 *
 * El Calculador judges a card by rules of thumb. El Tahúr asks the game: to
 * choose what to throw, it takes the three cards El Calculador likes least,
 * deals the cards it cannot see into the other hands a hundred times over
 * (`imaginarRonda`, with what the memory knows about who took what), plays
 * each deal out to the end of the ronda once per candidate, and throws the
 * one that left it holding the fewest points on average. In the imagined
 * rondas it plays itself carefully, as El Calculador, and the others the
 * quick way (`lib/bots/rapido.ts`) — they make three moves in four.
 *
 * Everything else is El Calculador's, on purpose: the draw, the best bajada
 * and the unloading. Simulating the draw was tried and only added noise.
 *
 * Deterministic like every bot: the deals come from a seed made of the view,
 * so the server can resume a half-played turn and decide the same thing.
 */

import { type Move, type VistaDeAsiento, apply, isComodin } from '@/lib/engine'
import type { Relato } from '@/lib/relato'
import { type Bot } from './bot'
import { decidirCalculador, valorParaQuedarse } from './calculador'
import { imaginarRonda } from './imaginar'
import { type Memoria, leerMemoria } from './memoria'
import { jugarConCuidado } from './rapido'

/** Deals imagined per option. More is steadier and slower. */
export const REPARTOS = 100

/** Cards considered for the discard: the ones El Calculador likes least. */
const CANDIDATAS = 3

/**
 * Discards already worked out, by the exact situation they were worked out
 * for. The server re-plans a bot's pending turn on every request (Phase 41),
 * and a decision that costs hundreds of imagined rondas should be paid once:
 * the same view and the same memory always give the same discard anyway.
 */
const RECORDADAS = new Map<string, Move>()
const MAX_RECORDADAS = 256

/** Forget every discard worked out so far — for tests that time or re-derive them. */
export function olvidarDescartes(): void {
  RECORDADAS.clear()
}

export const tahur: Bot = {
  id: 'tahur',
  nombre: 'El Tahúr',
  nivel: 'dificil',
  descripcion: 'Antes de cada jugada se imagina la ronda muchas veces y juega lo que mejor le salió.',
  decidir: decidirTahur,
}

export function decidirTahur(vista: VistaDeAsiento, relatos?: readonly Relato[]): Move {
  // Drawing, laying down and unloading are El Calculador's. The draw was put
  // to the simulation too, and it only added noise (roadmap, Phase 56).
  const propia = decidirCalculador(vista)
  if (vista.contrato.escalera || propia.type !== 'descartar') return propia

  const candidatas = [...vista.mano]
    .filter((card) => !isComodin(card))
    .sort((a, b) => valorParaQuedarse(a, vista) - valorParaQuedarse(b, vista))
    .slice(0, CANDIDATAS)
  if (candidatas.length < 2) return propia

  const memoria = relatos ? leerMemoria(relatos, vista.jugadores.length, vista.asiento) : undefined
  const clave = JSON.stringify([vista, memoria ?? null])
  const recordada = RECORDADAS.get(clave)
  if (recordada) return recordada

  const opciones: Move[] = candidatas.map((card) => ({ type: 'descartar', cardId: card.id }))
  const elegida = mejorOpcion(vista, opciones, memoria) ?? propia
  if (RECORDADAS.size >= MAX_RECORDADAS) RECORDADAS.delete(RECORDADAS.keys().next().value!)
  RECORDADAS.set(clave, elegida)
  return elegida
}

/**
 * The option that ends the ronda with the fewest points in this seat's hand,
 * averaged over the same imagined deals for every option — so the options are
 * compared on equal luck. Null if no option could even be tried.
 */
function mejorOpcion(
  vista: VistaDeAsiento,
  opciones: readonly Move[],
  memoria: Memoria | undefined,
): Move | null {
  const base = semillaDe(vista)
  const totales = opciones.map(() => 0)
  const validas = opciones.map(() => true)

  for (let i = 0; i < REPARTOS; i++) {
    const imaginada = imaginarRonda(vista, base + i * 7919, memoria)
    opciones.forEach((opcion, o) => {
      if (!validas[o]) return
      const tras = apply(imaginada, opcion)
      if (!tras.ok) {
        validas[o] = false
        return
      }
      totales[o] += jugarConCuidado(tras.state, vista.asiento)
    })
  }

  let mejor = -1
  opciones.forEach((_, o) => {
    if (validas[o] && (mejor < 0 || totales[o] < totales[mejor])) mejor = o
  })
  return mejor < 0 ? null : opciones[mejor]
}

/** A seed made of what the seat sees: the same view always deals the same. */
function semillaDe(vista: VistaDeAsiento): number {
  const texto = [
    vista.asiento,
    vista.numeroDeTurno,
    vista.fase,
    vista.descarte.length,
    ...vista.mano.map((card) => card.id),
  ].join('|')
  let hash = 2166136261
  for (let i = 0; i < texto.length; i++) {
    hash = Math.imul(hash ^ texto.charCodeAt(i), 16777619)
  }
  return hash >>> 0
}
