/**
 * The bots' thinking, off the page's thread (Phase 56).
 *
 * El Tahúr plays out hundreds of imagined rondas before each discard — a
 * fraction of a second on a laptop, more on a phone — and in a local partida
 * that runs in this browser. Here it runs beside the page instead of on it,
 * so the table keeps animating while a bot thinks. Same `movesDelTurno` as
 * everywhere else: the plan is identical wherever it is made.
 */

import { movesDelTurno } from '@/lib/bots'
import type { PeticionDePlan, RespuestaDePlan } from './planificador'

const ambito = self as unknown as {
  onmessage: ((evento: MessageEvent<PeticionDePlan>) => void) | null
  postMessage(respuesta: RespuestaDePlan): void
}

ambito.onmessage = (evento) => {
  const { id, estado, bots, relatos } = evento.data
  ambito.postMessage({ id, moves: movesDelTurno(estado, bots, relatos) })
}
