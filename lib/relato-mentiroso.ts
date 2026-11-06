/**
 * What just happened at a Mentiroso table, told in words (Phase 79).
 *
 * Public information only, by construction: an event is built from a move and
 * the states around it, and the only cards it can carry are the ones a call
 * turned face up — which everybody watched turn. A play is told by its size
 * and its announced rank, never by what it really was. That is what lets the
 * server (Phase 80) send the same log to every seat.
 */

import { type Card, type Rank } from '@/lib/engine'
import type { EstadoMentiroso, MoveMentiroso } from '@/lib/engine/mentiroso'

export type EventoMentiroso =
  /** A play went face down on the pile, announced as `rango`. */
  | {
      readonly tipo: 'jugada'
      readonly asiento: number
      readonly cantidad: number
      readonly rango: Rank
      readonly numero: number
    }
  /** «¡Mentiroso!»: the called play turned over, and the pile went to someone. */
  | {
      readonly tipo: 'acusacion'
      readonly acusador: number
      readonly acusado: number
      readonly rango: Rank
      readonly cartas: readonly Card[]
      readonly eraMentira: boolean
      readonly seLlevo: number
      readonly cartasDeLaPila: number
      /** The caller spent a bullet (a true play). */
      readonly gastoBala: boolean
    }
  /** The window ran out: nobody doubted the play, and it stands. */
  | { readonly tipo: 'ventanaCerrada'; readonly asiento: number }
  /** Somebody went out. */
  | { readonly tipo: 'gano'; readonly asiento: number }

/**
 * The events one accepted move produced, in order. A call on a last play can
 * be two — the call, and the win it settled.
 */
export function relatarMentiroso(
  move: MoveMentiroso,
  antes: EstadoMentiroso,
  despues: EstadoMentiroso,
): EventoMentiroso[] {
  const eventos: EventoMentiroso[] = []
  if (move.type === 'jugar' && despues.ultimaJugada) {
    eventos.push({
      tipo: 'jugada',
      asiento: despues.ultimaJugada.asiento,
      cantidad: despues.ultimaJugada.cantidad,
      rango: despues.ultimaJugada.rango,
      numero: despues.numeroDeJugada,
    })
  }
  if (move.type === 'mentiroso' && despues.ultimaAcusacion) {
    const a = despues.ultimaAcusacion
    eventos.push({
      tipo: 'acusacion',
      acusador: a.acusador,
      acusado: a.acusado,
      rango: a.rango,
      cartas: a.cartas,
      eraMentira: a.eraMentira,
      seLlevo: a.seLlevo,
      cartasDeLaPila: a.cartasDeLaPila,
      gastoBala: a.gastoBala,
    })
  }
  if (move.type === 'cerrarVentana' && antes.ultimaJugada) {
    eventos.push({ tipo: 'ventanaCerrada', asiento: antes.ultimaJugada.asiento })
  }
  if (antes.ganador === null && despues.ganador !== null) {
    eventos.push({ tipo: 'gano', asiento: despues.ganador })
  }
  return eventos
}

const SINGULAR: Record<Rank, string> = {
  A: 'as',
  '2': 'dos',
  '3': 'tres',
  '4': 'cuatro',
  '5': 'cinco',
  '6': 'seis',
  '7': 'siete',
  '8': 'ocho',
  '9': 'nueve',
  '10': 'diez',
  J: 'jota',
  Q: 'reina',
  K: 'rey',
}

const PLURAL: Record<Rank, string> = {
  A: 'ases',
  '2': 'doses',
  '3': 'treses',
  '4': 'cuatros',
  '5': 'cincos',
  '6': 'seises',
  '7': 'sietes',
  '8': 'ochos',
  '9': 'nueves',
  '10': 'dieces',
  J: 'jotas',
  Q: 'reinas',
  K: 'reyes',
}

const CUANTOS = ['', 'un', 'dos', 'tres', 'cuatro']

/** «un siete», «tres reyes» — a claim as a person would say it. */
export function cantidadDeRango(cantidad: number, rango: Rank): string {
  // Jota and reina are feminine: «una reina», never «un reina».
  if (cantidad === 1) return `${rango === 'J' || rango === 'Q' ? 'una' : 'un'} ${SINGULAR[rango]}`
  return `${CUANTOS[cantidad] ?? cantidad} ${PLURAL[rango]}`
}

/** The rank in turn as a heading says it: «Ases», «Sietes». */
export function nombreDeRango(rango: Rank): string {
  const plural = PLURAL[rango]
  return plural[0].toUpperCase() + plural.slice(1)
}

/** One line for an event. `yo` is the seat reading it, told in second person. */
export function textoDeEvento(
  evento: EventoMentiroso,
  nombres: readonly string[],
  yo?: number,
): string {
  const quien = (asiento: number) => (asiento === yo ? 'Tú' : nombres[asiento])
  switch (evento.tipo) {
    case 'jugada':
      return evento.asiento === yo
        ? `Pusiste ${cantidadDeRango(evento.cantidad, evento.rango)}.`
        : `${quien(evento.asiento)} pone ${cantidadDeRango(evento.cantidad, evento.rango)}.`
    case 'acusacion': {
      const grita =
        evento.acusador === yo ? 'Gritaste ¡Mentiroso!' : `${quien(evento.acusador)} grita ¡Mentiroso!`
      const pila = `la pila (${evento.cartasDeLaPila} ${evento.cartasDeLaPila === 1 ? 'carta' : 'cartas'})`
      const seLleva =
        evento.seLlevo === yo ? `te llevas ${pila}` : `${quien(evento.seLlevo)} se lleva ${pila}`
      if (evento.eraMentira) {
        // A lie is always taken by the liar: one subject, said once.
        return evento.acusado === yo
          ? `${grita} Mentías y te llevas ${pila}.`
          : `${grita} ${quien(evento.acusado)} mentía y se lleva ${pila}.`
      }
      const verdad = evento.acusado === yo ? 'Decías la verdad' : 'Era verdad'
      // A true play costs the caller a bullet as well as the pile.
      const bala = evento.acusador === yo ? ' y pierdes una bala' : ' y pierde una bala'
      return `${grita} ${verdad}: ${seLleva}${bala}.`
    }
    case 'ventanaCerrada':
      return evento.asiento === yo ? 'Nadie dudó de ti.' : `Nadie dudó de ${quien(evento.asiento)}.`
    case 'gano':
      return evento.asiento === yo
        ? '¡Te quedaste sin cartas: ganaste!'
        : `${quien(evento.asiento)} se quedó sin cartas y gana.`
  }
}

/*
 * How long each thing takes to *show* (2026-11-05, after the owner found the
 * table too abrupt). The table tells events one at a time, in these times —
 * Carioca's rule from Phases 58–60: the state has moved, the eye catches up —
 * and whoever keeps the clock (the local transport, the server) waits them
 * out before the next play, so nothing lands on top of a scene still playing.
 */

/** A play's cards crossing from the seat that threw them to the middle. */
export const MS_VUELO_JUGADA = 700
/** «¡Mentiroso!» shouted, before anything turns over. */
export const MS_GRITO = 900
/** Each called card turning face up, one after another. */
export const MS_POR_VOLTEO = 420
/** The verdict on the table, read before the pile moves. */
export const MS_VEREDICTO = 1500
/** The whole pile gathered and crossing to whoever takes it. */
export const MS_RECOGE = 1100

/** The whole scene of a call over `cartas` cards, start to empty middle. */
export function msDeAcusacion(cartas: number): number {
  return MS_GRITO + MS_POR_VOLTEO * cartas + 300 + MS_VEREDICTO + MS_RECOGE
}
