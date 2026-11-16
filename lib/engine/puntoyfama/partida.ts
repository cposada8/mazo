/**
 * Punto y Fama's races (Phase 100): «Números límite» and «Tiempo límite» on
 * the shared guessing race (`../comun/carrera.ts`). What is this game's own:
 * the secrets are numbers of n digits without repeats, a try must have that
 * shape, it is answered in puntos and famas, and there is no limit of tries.
 * The rules are `specs/punto-y-fama-rules.md`.
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
import { esNumeroValido, puntuarNumero, sacarNumeros } from './numeros'

/** Numbers drawn for a time race: far more than anyone gets through. */
const NUMEROS_CONTRA_RELOJ = 300

/** A guess, and its answer. `palabra` is the guess: the race calls every secret that. */
export type IntentoPF = {
  readonly palabra: string
  readonly puntos: number
  readonly famas: number
  readonly encadenado?: boolean
}

export type NumeroTerminado = Terminada<IntentoPF>
export type TableroPF = TableroDe<IntentoPF>
export type EstadoPuntoYFama = EstadoCarrera<IntentoPF>

/** What may be typed: digits only, none repeated, the race's length. */
export function leerIntento(texto: string, digitos: number): { ok: true; numero: string } | { ok: false; code: 'LARGO' | 'REPETIDO' } {
  const numero = texto.trim()
  if (numero.length !== digitos || !/^\d+$/.test(numero)) return { ok: false, code: 'LARGO' }
  if (!esNumeroValido(numero, digitos)) return { ok: false, code: 'REPETIDO' }
  return { ok: true, numero }
}

export const REGLA_PUNTO_Y_FAMA: Regla<IntentoPF> = {
  validar: (texto, estado) => {
    const leido = leerIntento(texto, estado.bolsa[0].length)
    return leido.ok ? { ok: true, palabra: leido.numero } : leido
  },
  intento: (palabra, secreto) => ({ palabra, ...puntuarNumero(palabra, secreto) }),
  // The game's own form: you keep guessing until you get it.
  maxIntentos: null,
}

export function empezarPuntoYFama(opciones: {
  seed: string
  /** How many numbers in «Números límite». */
  numeros: number
  digitos: number
  asientos: readonly number[]
  ahora: number
  modo?: Modo
  minutos?: number
  espera?: number
}): EstadoPuntoYFama {
  const conTiempo = opciones.modo === 'tiempo'
  return empezarCarrera<IntentoPF>({
    ...opciones,
    bolsa: sacarNumeros(
      opciones.seed,
      conTiempo ? NUMEROS_CONTRA_RELOJ : opciones.numeros,
      opciones.digitos,
    ),
    // No try limit, so nothing is ever missed: no penalty, no lives.
    castigo: 0,
  })
}

export function intentarNumero(
  estado: EstadoPuntoYFama,
  asiento: number,
  texto: string,
  ahora: number,
) {
  return intentarEn(REGLA_PUNTO_Y_FAMA, estado, asiento, texto, ahora)
}
