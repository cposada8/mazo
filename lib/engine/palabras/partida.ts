/**
 * Palabras: the race as a pure state machine (Phase 83).
 *
 * The rules are `specs/palabras-rules.md`. Since Phase 99 the race itself —
 * boards, clocks, closing, lives, penalties, chaining, the ranking — is the
 * shared one in `../comun/carrera.ts`, which Punto y Fama races on too. What
 * is Palabras' own is here: the words, how a try is read (a real word of
 * the right length), how it is scored (green, yellow, grey), and six tries.
 * The names the rest of the app has always used are kept, so nothing that
 * imports this had to change.
 */

import {
  type EstadoCarrera,
  type Modo,
  type Regla,
  type TableroDe,
  type Terminada,
  empezarCarrera,
  intentarEn,
} from '../comun/carrera'
import { createRng, shuffle } from '../comun/random'
import { aceptadasDe, respuestasDe } from './listas'
import { INTENTOS_POR_PALABRA, LARGO_POR_DEFECTO } from './opciones'

export * from './listas'
export * from './opciones'
export {
  type Puesto,
  acertadasDe,
  castigoDe,
  cerrada,
  cerrar,
  clasificacion,
  esperaDe,
  fallosDe,
  finDelTiempo,
  largoDe,
  modoDe,
  retirarJugador,
  sumarJugador,
  tableroDe,
  termino,
  tiempoDe,
  ultimaAcertadaEn,
  vidasDe,
  yaTermino,
} from '../comun/carrera'

export type Color = 'verde' | 'amarillo' | 'gris'

export type Intento = {
  readonly palabra: string
  readonly colores: readonly Color[]
  /** Played for the player (Phase 96): the word before, opening this one. */
  readonly encadenado?: boolean
}

/** A word a player has ended — solved, or its six tries spent. */
export type PalabraTerminada = Terminada<Intento>
export type Tablero = TableroDe<Intento>
export type EstadoPalabras = EstadoCarrera<Intento>

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

/** Palabras' rule for the shared race: a real word of the race's length, six tries. */
export const REGLA_PALABRAS: Regla<Intento> = {
  validar: (texto, estado) => {
    const palabra = normalizar(texto)
    if ([...palabra].length !== [...estado.bolsa[0]].length || !/^[A-ZÑ]+$/.test(palabra)) {
      return { ok: false, code: 'LARGO' }
    }
    if (!esAceptada(palabra)) return { ok: false, code: 'NO_ES_PALABRA' }
    return { ok: true, palabra }
  },
  intento: (palabra, respuesta) => ({ palabra, colores: puntuar(palabra, respuesta) }),
  maxIntentos: INTENTOS_POR_PALABRA,
}

// ------------------------------------------------------------------ race

export function empezarPalabras(opciones: {
  seed: string
  palabras: number
  /** Letters per word; five when not said. */
  largo?: number
  asientos: readonly number[]
  /** When the race is dealt; the first word opens a 3-2-1 later. */
  ahora: number
  /** n words (the default), or x minutes for the most words. */
  modo?: Modo
  /** The time mode's minutes. */
  minutos?: number
  /** The time mode's lives; 0 or absent is «sin vidas». */
  vidas?: number
  /** Minutes a missed word adds in «Palabras límite»; two when not said. */
  castigo?: number
  /** Minutes «Palabras límite» waits after the first finish; 0 or absent: no limit. */
  espera?: number
  /** Each word opens with the one before already played (Phase 96). */
  encadenadas?: boolean
}): EstadoPalabras {
  const largo = opciones.largo ?? LARGO_POR_DEFECTO
  const conTiempo = opciones.modo === 'tiempo'
  return empezarCarrera<Intento>({
    ...opciones,
    // Against the clock the list is every answer, so nobody runs out.
    bolsa: sacarBolsa(
      opciones.seed,
      conTiempo ? respuestasDe(largo).length : opciones.palabras,
      largo,
    ),
  })
}

/** One try by one player. Refused tries cost nothing. */
export function intentar(
  estado: EstadoPalabras,
  asiento: number,
  texto: string,
  ahora: number,
): ResultadoDeIntento {
  return intentarEn(REGLA_PALABRAS, estado, asiento, texto, ahora) as ResultadoDeIntento
}
