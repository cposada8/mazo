/**
 * Palabras: the race as a pure state machine (Phase 83).
 *
 * The rules are `specs/palabras-rules.md`. Like the other two engines, this
 * validates and never decides, and it owns no clock: every function that
 * needs the time is handed `ahora` (epoch ms), so the server's clock is the
 * only one and the tests own every instant.
 *
 * A partida is a bag of n answers drawn from the seed, and one board per
 * player. Players never wait for each other: each solves the same words in
 * the same order at their own pace, and the state is simply every board.
 */

import { createRng, shuffle } from '../comun/random'
import { aceptadasDe, respuestasDe } from './listas'
import {
  INTENTOS_POR_PALABRA,
  LARGO_POR_DEFECTO,
  MS_CASTIGO,
  MS_CUENTA_ATRAS,
  MS_HASTA_CERRAR,
} from './opciones'

export * from './listas'
export * from './opciones'

export type Color = 'verde' | 'amarillo' | 'gris'

export type Intento = {
  readonly palabra: string
  readonly colores: readonly Color[]
}

/** A word a player has ended — solved, or its six tries spent. */
export type PalabraTerminada = {
  readonly palabra: string
  readonly acertada: boolean
  readonly intentos: readonly Intento[]
}

export type Tablero = {
  readonly asiento: number
  /** The words already ended, in bag order. Its length is the word in play. */
  readonly terminadas: readonly PalabraTerminada[]
  /** The tries on the word in play. */
  readonly intentos: readonly Intento[]
  /** Ms from the race's start to the moment the last word ended. */
  readonly terminoEn: number | null
  /** Left on purpose: ranked with what they finished, waited for by nobody. */
  readonly retirado: boolean
}

export type EstadoPalabras = {
  readonly seed: string
  readonly bolsa: readonly string[]
  /** Epoch ms when the first word opens for everybody — after the 3-2-1. */
  readonly inicio: number
  readonly tableros: readonly Tablero[]
  /** Epoch ms the race was closed by the host, if it was. */
  readonly cerradaEn: number | null
}

export type ErrorDePalabras =
  | 'NO_JUEGAS'
  | 'NO_EMPEZO'
  | 'YA_TERMINASTE'
  | 'CERRADA'
  | 'LARGO'
  | 'NO_ES_PALABRA'

export type ResultadoDeIntento =
  | {
      readonly ok: true
      readonly estado: EstadoPalabras
      readonly intento: Intento
      /** The word in play ended with this try. */
      readonly termino: PalabraTerminada | null
    }
  | { readonly ok: false; readonly code: ErrorDePalabras }

// ----------------------------------------------------------------- words

/**
 * A word as play reads it: uppercase, tildes and diaeresis removed, Ñ kept.
 * «árbol» is ARBOL; «niño» is NIÑO; «pingüino» is PINGUINO.
 */
export function normalizar(texto: string): string {
  return texto
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/Ñ/g, 'Ñ')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
}

/** Is this a word a try may be? Answers are always accepted. */
export function esAceptada(palabra: string): boolean {
  return aceptadasDe([...palabra].length).has(palabra)
}

/**
 * n answers of one length drawn from the seed, without repetition, in the
 * order they are played.
 */
export function sacarBolsa(seed: string, cuantas: number, largo: number = LARGO_POR_DEFECTO): string[] {
  const respuestas = respuestasDe(largo)
  const n = Math.max(1, Math.min(cuantas, respuestas.length))
  // Five letters keeps the seed's old draw; other lengths salt it with theirs.
  const sal = largo === LARGO_POR_DEFECTO ? '' : `:${largo}`
  return shuffle(respuestas, createRng(`palabras${sal}:${seed}`)).slice(0, n)
}

/** How many letters this race's words have. */
export function largoDe(estado: EstadoPalabras): number {
  return [...estado.bolsa[0]].length
}

/**
 * Score a try against the answer — the puzzle's standard rule. Greens first;
 * then, left to right, a letter is yellow only while the answer still has an
 * unmatched copy of it. Never more coloured copies of a letter than the
 * answer holds.
 */
export function puntuar(intento: string, respuesta: string): Color[] {
  const letras = [...intento]
  const objetivo = [...respuesta]
  const colores: Color[] = letras.map(() => 'gris')
  const sobran = new Map<string, number>()

  letras.forEach((letra, i) => {
    if (letra === objetivo[i]) colores[i] = 'verde'
    else sobran.set(objetivo[i], (sobran.get(objetivo[i]) ?? 0) + 1)
  })
  letras.forEach((letra, i) => {
    if (colores[i] === 'verde') return
    const quedan = sobran.get(letra) ?? 0
    if (quedan > 0) {
      colores[i] = 'amarillo'
      sobran.set(letra, quedan - 1)
    }
  })
  return colores
}

// ------------------------------------------------------------------ race

function tableroNuevo(asiento: number): Tablero {
  return { asiento, terminadas: [], intentos: [], terminoEn: null, retirado: false }
}

export function empezarPalabras(opciones: {
  seed: string
  palabras: number
  /** Letters per word; five when not said. */
  largo?: number
  asientos: readonly number[]
  /** When the race is dealt; the first word opens a 3-2-1 later. */
  ahora: number
}): EstadoPalabras {
  return {
    seed: opciones.seed,
    bolsa: sacarBolsa(opciones.seed, opciones.palabras, opciones.largo),
    inicio: opciones.ahora + MS_CUENTA_ATRAS,
    tableros: opciones.asientos.map(tableroNuevo),
    cerradaEn: null,
  }
}

/**
 * A player joining a race already running (Mazo's call): their clock is the
 * race's, so they simply start behind. Idempotent.
 */
export function sumarJugador(estado: EstadoPalabras, asiento: number): EstadoPalabras {
  if (estado.tableros.some((t) => t.asiento === asiento)) return estado
  return { ...estado, tableros: [...estado.tableros, tableroNuevo(asiento)] }
}

export function tableroDe(estado: EstadoPalabras, asiento: number): Tablero | null {
  return estado.tableros.find((t) => t.asiento === asiento) ?? null
}

export function termino(tablero: Tablero): boolean {
  return tablero.terminoEn !== null
}

/** A player's time: when they finished, plus two minutes per missed word. */
export function tiempoDe(tablero: Tablero): number | null {
  if (tablero.terminoEn === null) return null
  return tablero.terminoEn + fallosDe(tablero) * MS_CASTIGO
}

export function fallosDe(tablero: Tablero): number {
  return tablero.terminadas.filter((p) => !p.acertada).length
}

export function acertadasDe(tablero: Tablero): number {
  return tablero.terminadas.filter((p) => p.acertada).length
}

function intentosTotales(tablero: Tablero): number {
  return (
    tablero.terminadas.reduce((suma, p) => suma + p.intentos.length, 0) + tablero.intentos.length
  )
}

/**
 * Closed when every player still racing has finished, when the host closed
 * it, or half an hour after the first player finished.
 */
export function cerrada(estado: EstadoPalabras, ahora: number): boolean {
  if (estado.cerradaEn !== null) return true
  const enCarrera = estado.tableros.filter((t) => !t.retirado)
  if (enCarrera.length > 0 && enCarrera.every(termino)) return true
  if (estado.tableros.length > 0 && estado.tableros.every((t) => t.retirado || termino(t))) {
    return true
  }
  const primero = Math.min(
    ...estado.tableros.filter(termino).map((t) => estado.inicio + t.terminoEn!),
  )
  return Number.isFinite(primero) && ahora >= primero + MS_HASTA_CERRAR
}

export function cerrar(estado: EstadoPalabras, ahora: number): EstadoPalabras {
  return estado.cerradaEn !== null ? estado : { ...estado, cerradaEn: ahora }
}

export function retirarJugador(estado: EstadoPalabras, asiento: number): EstadoPalabras {
  return {
    ...estado,
    tableros: estado.tableros.map((t) => (t.asiento === asiento ? { ...t, retirado: true } : t)),
  }
}

/** One try by one player. Refused tries cost nothing. */
export function intentar(
  estado: EstadoPalabras,
  asiento: number,
  texto: string,
  ahora: number,
): ResultadoDeIntento {
  const tablero = tableroDe(estado, asiento)
  if (!tablero || tablero.retirado) return { ok: false, code: 'NO_JUEGAS' }
  if (ahora < estado.inicio) return { ok: false, code: 'NO_EMPEZO' }
  if (termino(tablero)) return { ok: false, code: 'YA_TERMINASTE' }
  if (cerrada(estado, ahora)) return { ok: false, code: 'CERRADA' }

  const palabra = normalizar(texto)
  if ([...palabra].length !== largoDe(estado) || !/^[A-ZÑ]+$/.test(palabra)) {
    return { ok: false, code: 'LARGO' }
  }
  if (!esAceptada(palabra)) return { ok: false, code: 'NO_ES_PALABRA' }

  const respuesta = estado.bolsa[tablero.terminadas.length]
  const intento: Intento = { palabra, colores: puntuar(palabra, respuesta) }
  const intentos = [...tablero.intentos, intento]
  const acerto = palabra === respuesta
  const fin = acerto || intentos.length >= INTENTOS_POR_PALABRA

  let nuevo: Tablero = { ...tablero, intentos }
  let terminada: PalabraTerminada | null = null
  if (fin) {
    terminada = { palabra: respuesta, acertada: acerto, intentos }
    const terminadas = [...tablero.terminadas, terminada]
    nuevo = {
      ...tablero,
      terminadas,
      intentos: [],
      terminoEn: terminadas.length === estado.bolsa.length ? ahora - estado.inicio : null,
    }
  }

  return {
    ok: true,
    estado: {
      ...estado,
      tableros: estado.tableros.map((t) => (t.asiento === asiento ? nuevo : t)),
    },
    intento,
    termino: terminada,
  }
}

export type Puesto = {
  readonly asiento: number
  readonly lugar: number
  readonly termino: boolean
  /** Finished time with penalties, ms; null if they did not finish. */
  readonly tiempo: number | null
  readonly acertadas: number
  readonly fallos: number
  readonly intentos: number
  readonly retirado: boolean
}

/**
 * The ranking. Those who finished first, by time with penalties, ties to
 * fewer tries; then the rest by words solved, then by words ended.
 */
export function clasificacion(estado: EstadoPalabras): Puesto[] {
  const filas = estado.tableros.map((t) => ({
    asiento: t.asiento,
    termino: termino(t),
    tiempo: tiempoDe(t),
    acertadas: acertadasDe(t),
    fallos: fallosDe(t),
    intentos: intentosTotales(t),
    terminadas: t.terminadas.length,
    retirado: t.retirado,
  }))
  filas.sort((a, b) => {
    if (a.termino !== b.termino) return a.termino ? -1 : 1
    if (a.termino) return a.tiempo! - b.tiempo! || a.intentos - b.intentos
    return b.acertadas - a.acertadas || b.terminadas - a.terminadas || a.intentos - b.intentos
  })
  return filas.map((fila, i) => ({
    asiento: fila.asiento,
    lugar: i + 1,
    termino: fila.termino,
    tiempo: fila.tiempo,
    acertadas: fila.acertadas,
    fallos: fila.fallos,
    intentos: fila.intentos,
    retirado: fila.retirado,
  }))
}
