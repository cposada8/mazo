/**
 * Planning a bot's turn in a local partida (Phase 56): in a Web Worker when
 * the browser has one, right here when it does not.
 *
 * The plan is the same either way — `movesDelTurno` is pure — so the worker
 * only moves the waiting off the page. Where there is no worker (tests, an
 * old browser, a worker that failed to load) the plan is made synchronously,
 * exactly as before this existed.
 */

import { movesDelTurno } from '@/lib/bots'
import type { Move, PartidaState } from '@/lib/engine'
import type { Relato } from '@/lib/relato'

export type PeticionDePlan = {
  readonly id: number
  readonly estado: PartidaState
  readonly bots: readonly (string | null | undefined)[] | undefined
  readonly relatos: readonly Relato[]
}

export type RespuestaDePlan = { readonly id: number; readonly moves: Move[] }

let trabajador: Worker | null | undefined
let ultimoId = 0

function obtener(): Worker | null {
  if (trabajador !== undefined) return trabajador
  try {
    // Bundled on its own by `npm run bots:worker` (run by dev and build):
    // this Turbopack copies `new URL('./x.ts', import.meta.url)` as a raw
    // file instead of compiling it as a worker.
    trabajador = typeof Worker === 'undefined' ? null : new Worker('/bots.worker.js')
  } catch {
    trabajador = null
  }
  return trabajador
}

/**
 * Plan the turn and hand the moves to `listo`. Returns a cancel: a turn that
 * is abandoned (the page moved on) never delivers its plan.
 */
export function planearTurno(
  estado: PartidaState,
  bots: readonly (string | null | undefined)[] | undefined,
  relatos: readonly Relato[],
  listo: (moves: Move[]) => void,
): () => void {
  const enElHilo = () => listo(movesDelTurno(estado, bots, relatos))
  const worker = obtener()
  if (!worker) {
    enElHilo()
    return () => {}
  }

  const id = ++ultimoId
  let vivo = true

  const soltar = () => {
    worker.removeEventListener('message', alRecibir)
    worker.removeEventListener('error', alFallar)
  }
  const alRecibir = (evento: MessageEvent<RespuestaDePlan>) => {
    if (evento.data.id !== id) return
    soltar()
    if (vivo) listo(evento.data.moves)
  }
  // A worker that cannot run is dropped for good, and this turn planned here.
  const alFallar = () => {
    soltar()
    trabajador = null
    if (vivo) enElHilo()
  }

  worker.addEventListener('message', alRecibir)
  worker.addEventListener('error', alFallar)
  worker.postMessage({ id, estado, bots, relatos } satisfies PeticionDePlan)

  return () => {
    vivo = false
    soltar()
  }
}
