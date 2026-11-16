/**
 * The bot that guesses your number (Phase 100, for Phase 105) — the owner's
 * solver from `punto-y-fama`, ported as it is: keep every number that would
 * have given exactly the answers so far; first guess at random; after that,
 * for each place, the digit most common among the numbers left (ties to the
 * lower digit, as the owner's code breaks them). With 4 digits it gets any
 * number in about 5.5 guesses on average, 8 at most.
 *
 * It never sees your number: you answer each guess in puntos and famas.
 */

import { createRng } from '../comun/random'
import { type Respuesta, numeroAlAzar, puntuarNumero, todosLosNumeros } from './numeros'

export type PasoDelBot = { readonly intento: string } & Respuesta

export type EstadoDelBot = {
  readonly digitos: number
  readonly seed: string
  /** Every guess answered so far. */
  readonly pasos: readonly PasoDelBot[]
}

/** Keep the numbers that would have answered this guess exactly so. */
export function filtrar(posibles: readonly string[], paso: PasoDelBot): string[] {
  return posibles.filter((numero) => {
    const r = puntuarNumero(paso.intento, numero)
    return r.puntos === paso.puntos && r.famas === paso.famas
  })
}

/** For each place, the digit most common among the numbers left. */
export function intentoGoloso(posibles: readonly string[]): string {
  const largo = posibles[0].length
  let quedan = posibles
  let intento = ''
  for (let i = 0; i < largo; i++) {
    const cuenta = new Array<number>(10).fill(0)
    for (const numero of quedan) cuenta[Number(numero[i])]++
    let mejor = 0
    for (let d = 1; d < 10; d++) if (cuenta[d] > cuenta[mejor]) mejor = d
    intento += mejor
    quedan = quedan.filter((numero) => numero[i] === String(mejor))
  }
  return intento
}

export function empezarBot(digitos: number, seed: string): EstadoDelBot {
  return { digitos, seed, pasos: [] }
}

/** The numbers still possible after every answer so far. */
export function posiblesDe(estado: EstadoDelBot): string[] {
  return estado.pasos.reduce<string[]>(filtrar, todosLosNumeros(estado.digitos))
}

/**
 * The bot's next guess — or null when no number fits every answer (one of
 * them was wrong; «Deshacer» fixes it) or when it has already got it.
 */
export function siguienteIntento(estado: EstadoDelBot): string | null {
  const ultimo = estado.pasos[estado.pasos.length - 1]
  if (ultimo && ultimo.famas === estado.digitos) return null
  if (estado.pasos.length === 0) return numeroAlAzar(createRng(`bot:${estado.seed}`), estado.digitos)
  const posibles = posiblesDe(estado)
  return posibles.length === 0 ? null : intentoGoloso(posibles)
}

/** Answer the bot's guess. Puntos and famas never add up past the digits. */
export function responder(estado: EstadoDelBot, respuesta: Respuesta): EstadoDelBot {
  const intento = siguienteIntento(estado)
  if (intento === null) return estado
  return { ...estado, pasos: [...estado.pasos, { intento, ...respuesta }] }
}

/** «Deshacer»: take the last answer back. */
export function deshacer(estado: EstadoDelBot): EstadoDelBot {
  return { ...estado, pasos: estado.pasos.slice(0, -1) }
}

export function adivino(estado: EstadoDelBot): boolean {
  const ultimo = estado.pasos[estado.pasos.length - 1]
  return Boolean(ultimo && ultimo.famas === estado.digitos)
}

/** No number fits every answer: one of them was wrong. */
export function contradice(estado: EstadoDelBot): boolean {
  return !adivino(estado) && estado.pasos.length > 0 && posiblesDe(estado).length === 0
}
