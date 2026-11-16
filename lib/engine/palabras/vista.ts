/**
 * What one player may see of the race (Phase 83).
 *
 * Their own board in full, the words they have ended — and of every rival
 * only *how far* and *which colours*: never a letter, never a word. A word
 * nobody has shown this player yet is not in here in any form.
 */

import {
  type Color,
  type EstadoPalabras,
  type Intento,
  type PalabraTerminada,
  type Puesto,
  cerrada,
  clasificacion,
  largoDe,
  tiempoDe,
  yaTermino,
} from './partida'

export type VistaDeRival = {
  readonly asiento: number
  /** Words ended so far — the word they are on is this plus one. */
  readonly terminadas: number
  readonly acertadas: number
  /** The colours of their tries on the word they are on. No letters. */
  readonly colores: readonly (readonly Color[])[]
  /** Their time with penalties, once they finish. */
  readonly tiempo: number | null
  readonly retirado: boolean
  /**
   * The words they have ended, with every try in letters — only once the
   * player looking has finished (the owner, 2026-11-15: finished, you can no
   * longer play, so it changes nothing). Null before that.
   */
  readonly palabras: readonly PalabraTerminada[] | null
}

export type VistaPalabras = {
  readonly total: number
  /** Letters per word in this race. */
  readonly largo: number
  readonly inicio: number
  /** Null for somebody looking without a board. */
  readonly propio: {
    readonly asiento: number
    readonly terminadas: readonly PalabraTerminada[]
    readonly intentos: readonly Intento[]
    readonly terminoEn: number | null
    readonly tiempo: number | null
    readonly retirado: boolean
  } | null
  readonly rivales: readonly VistaDeRival[]
  readonly cerrada: boolean
  /** The standings — final once `cerrada`, provisional before. */
  readonly clasificacion: readonly Puesto[]
}

export function vistaPalabras(
  estado: EstadoPalabras,
  asiento: number,
  ahora: number,
): VistaPalabras {
  const mio = estado.tableros.find((t) => t.asiento === asiento) ?? null
  const veoLetras = mio !== null && yaTermino(estado, mio, ahora)
  return {
    total: estado.bolsa.length,
    largo: largoDe(estado),
    inicio: estado.inicio,
    propio: mio && {
      asiento: mio.asiento,
      terminadas: mio.terminadas,
      intentos: mio.intentos,
      terminoEn: mio.terminoEn,
      tiempo: tiempoDe(mio),
      retirado: mio.retirado,
    },
    rivales: estado.tableros
      .filter((t) => t.asiento !== asiento)
      .map((t) => ({
        asiento: t.asiento,
        terminadas: t.terminadas.length,
        acertadas: t.terminadas.filter((p) => p.acertada).length,
        colores: t.intentos.map((i) => i.colores),
        tiempo: tiempoDe(t),
        retirado: t.retirado,
        palabras: veoLetras ? t.terminadas : null,
      })),
    cerrada: cerrada(estado, ahora),
    clasificacion: clasificacion(estado),
  }
}
