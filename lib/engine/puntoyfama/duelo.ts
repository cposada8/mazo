/**
 * The duel (Phase 100): exactly two players, each setting the other a
 * number. Once both are set, both guess at once, each against the other's
 * number, at their own pace. Whoever gets it in fewer tries wins; whoever
 * finishes first waits for the other to finish (the owner). A tie in tries
 * goes to whoever got it first (Mazo's call), and a tie in that too is a
 * draw. Leaving loses (Mazo's call): the one who stays wins.
 */

import { MS_CUENTA_ATRAS } from '../comun/carrera'
import { type Respuesta, puntuarNumero } from './numeros'
import { type IntentoPF, leerIntento } from './partida'

export type LadoDelDuelo = {
  readonly asiento: number
  /** The number this player set for the other. Never sent to the other before the end. */
  readonly secreto: string | null
  /** This player's guesses at the other's number. */
  readonly intentos: readonly IntentoPF[]
  /** Ms from the start to the guess that got it. */
  readonly terminoEn: number | null
  readonly retirado: boolean
}

export type EstadoDuelo = {
  readonly seed: string
  readonly digitos: number
  readonly lados: readonly [LadoDelDuelo, LadoDelDuelo]
  /** Epoch ms when guessing opens — a 3-2-1 after the second number is set; null before. */
  readonly inicio: number | null
}

export type ResultadoDelDuelo =
  | { readonly tipo: 'gana'; readonly asiento: number; readonly porque: 'intentos' | 'tiempo' | 'retiro' }
  | { readonly tipo: 'empate' }

export function empezarDuelo(opciones: {
  seed: string
  digitos: number
  asientos: readonly [number, number]
}): EstadoDuelo {
  const lado = (asiento: number): LadoDelDuelo => ({
    asiento,
    secreto: null,
    intentos: [],
    terminoEn: null,
    retirado: false,
  })
  return {
    seed: opciones.seed,
    digitos: opciones.digitos,
    lados: [lado(opciones.asientos[0]), lado(opciones.asientos[1])],
    inicio: null,
  }
}

const indiceDe = (estado: EstadoDuelo, asiento: number) =>
  estado.lados.findIndex((l) => l.asiento === asiento)

function conLado(estado: EstadoDuelo, i: number, lado: LadoDelDuelo): EstadoDuelo {
  const lados = [...estado.lados] as [LadoDelDuelo, LadoDelDuelo]
  lados[i] = lado
  return { ...estado, lados }
}

export type ErrorDelDuelo =
  | 'NO_JUEGAS'
  | 'YA_PUSISTE'
  | 'NO_EMPEZO'
  | 'YA_TERMINASTE'
  | 'TERMINADO'
  | 'LARGO'
  | 'REPETIDO'

/** Set your number for the other. Once both are in, the 3-2-1 starts. */
export function ponerSecreto(
  estado: EstadoDuelo,
  asiento: number,
  texto: string,
  ahora: number,
): { ok: true; estado: EstadoDuelo } | { ok: false; code: ErrorDelDuelo } {
  const i = indiceDe(estado, asiento)
  if (i < 0 || estado.lados[i].retirado) return { ok: false, code: 'NO_JUEGAS' }
  if (estado.lados[i].secreto !== null) return { ok: false, code: 'YA_PUSISTE' }
  const leido = leerIntento(texto, estado.digitos)
  if (!leido.ok) return leido
  let nuevo = conLado(estado, i, { ...estado.lados[i], secreto: leido.numero })
  if (nuevo.lados.every((l) => l.secreto !== null)) {
    nuevo = { ...nuevo, inicio: ahora + MS_CUENTA_ATRAS }
  }
  return { ok: true, estado: nuevo }
}

/** The number this player is guessing: the one the other set. */
function objetivoDe(estado: EstadoDuelo, i: number): string {
  return estado.lados[1 - i].secreto!
}

/** One guess at the other's number. No limit of tries. */
export function intentarEnDuelo(
  estado: EstadoDuelo,
  asiento: number,
  texto: string,
  ahora: number,
): { ok: true; estado: EstadoDuelo; intento: IntentoPF } | { ok: false; code: ErrorDelDuelo } {
  const i = indiceDe(estado, asiento)
  if (i < 0 || estado.lados[i].retirado) return { ok: false, code: 'NO_JUEGAS' }
  if (resultadoDelDuelo(estado) !== null) return { ok: false, code: 'TERMINADO' }
  if (estado.inicio === null || ahora < estado.inicio) return { ok: false, code: 'NO_EMPEZO' }
  if (estado.lados[i].terminoEn !== null) return { ok: false, code: 'YA_TERMINASTE' }
  const leido = leerIntento(texto, estado.digitos)
  if (!leido.ok) return leido
  const objetivo = objetivoDe(estado, i)
  const intento: IntentoPF = { palabra: leido.numero, ...puntuarNumero(leido.numero, objetivo) }
  const lado = estado.lados[i]
  return {
    ok: true,
    intento,
    estado: conLado(estado, i, {
      ...lado,
      intentos: [...lado.intentos, intento],
      terminoEn: leido.numero === objetivo ? ahora - estado.inicio : lado.terminoEn,
    }),
  }
}

export function retirarDelDuelo(estado: EstadoDuelo, asiento: number): EstadoDuelo {
  const i = indiceDe(estado, asiento)
  return i < 0 ? estado : conLado(estado, i, { ...estado.lados[i], retirado: true })
}

/** Null until it is decided: both got it, or one left. */
export function resultadoDelDuelo(estado: EstadoDuelo): ResultadoDelDuelo | null {
  const [a, b] = estado.lados
  if (a.retirado !== b.retirado) {
    return { tipo: 'gana', asiento: a.retirado ? b.asiento : a.asiento, porque: 'retiro' }
  }
  if (a.terminoEn === null || b.terminoEn === null) return null
  if (a.intentos.length !== b.intentos.length) {
    return {
      tipo: 'gana',
      asiento: a.intentos.length < b.intentos.length ? a.asiento : b.asiento,
      porque: 'intentos',
    }
  }
  if (a.terminoEn !== b.terminoEn) {
    return { tipo: 'gana', asiento: a.terminoEn < b.terminoEn ? a.asiento : b.asiento, porque: 'tiempo' }
  }
  return { tipo: 'empate' }
}

export type VistaDelDuelo = {
  readonly digitos: number
  readonly inicio: number | null
  readonly yo: {
    readonly asiento: number
    /** Your own number for the other — yours to see. */
    readonly secreto: string | null
    readonly intentos: readonly IntentoPF[]
    readonly terminoEn: number | null
  } | null
  readonly rival: {
    readonly asiento: number
    readonly puso: boolean
    /** Their guesses at your number: answers only until the end, then in full. */
    readonly respuestas: readonly Respuesta[]
    readonly intentos: readonly IntentoPF[] | null
    readonly terminoEn: number | null
    readonly retirado: boolean
    /** Their number for you: only at the end. */
    readonly secreto: string | null
  } | null
  readonly resultado: ResultadoDelDuelo | null
}

/** What one side may see: never the other's number, nor their guesses' digits, before the end. */
export function vistaDelDuelo(estado: EstadoDuelo, asiento: number): VistaDelDuelo {
  const i = indiceDe(estado, asiento)
  const resultado = resultadoDelDuelo(estado)
  const fin = resultado !== null
  const yo = i >= 0 ? estado.lados[i] : null
  const otro = i >= 0 ? estado.lados[1 - i] : null
  return {
    digitos: estado.digitos,
    inicio: estado.inicio,
    yo: yo && { asiento: yo.asiento, secreto: yo.secreto, intentos: yo.intentos, terminoEn: yo.terminoEn },
    rival: otro && {
      asiento: otro.asiento,
      puso: otro.secreto !== null,
      respuestas: otro.intentos.map(({ puntos, famas }) => ({ puntos, famas })),
      intentos: fin ? otro.intentos : null,
      terminoEn: otro.terminoEn,
      retirado: otro.retirado,
      secreto: fin ? otro.secreto : null,
    },
    resultado,
  }
}

