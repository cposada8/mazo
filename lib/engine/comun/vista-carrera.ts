/**
 * What one player may see of a guessing race (Phase 99, from Palabras'
 * Phase 83): their own board in full, the secrets they have ended — and of
 * every rival only how far, and the public half of each try (`publico`:
 * Palabras' colours, Punto y Fama's puntos and famas), never what was
 * guessed. Once the player looking can play no more, the rivals' ended
 * secrets come in full; once nobody can, so does the one each was on.
 */

import {
  type EstadoCarrera,
  type IntentoBase,
  type Modo,
  type Puesto,
  type TableroDe,
  type Terminada,
  castigoDe,
  cerrada,
  clasificacion,
  finDelTiempo,
  intentosTotales,
  largoDe,
  modoDe,
  tiempoDe,
  vidasDe,
  yaTermino,
} from './carrera'

export type VistaDeRivalEn<I extends IntentoBase, M> = {
  readonly asiento: number
  /** Secrets ended so far — the one they are on is this plus one. */
  readonly terminadas: number
  readonly acertadas: number
  /** They can play no more by their own doing: every secret ended, or no lives. */
  readonly termino: boolean
  /** Lives left in the time mode; null when there are none to lose. */
  readonly vidas: number | null
  /** Every try they have made, all secrets added up. A count, nothing guessed. */
  readonly intentos: number
  /**
   * The public half of each try on the secret they are on — named for
   * Palabras, where it is colours; in Punto y Fama it is puntos and famas.
   */
  readonly colores: readonly M[]
  /** Their time with penalties, once they finish. */
  readonly tiempo: number | null
  readonly retirado: boolean
  /** Their ended secrets with every try — only once the player looking has finished. */
  readonly palabras: readonly Terminada<I>[] | null
  /** The secret they were on when the race closed, with its tries and answer. */
  readonly enCurso: Terminada<I> | null
}

export type VistaCarrera<I extends IntentoBase, M> = {
  /** n secrets, or x minutes for the most. */
  readonly modo: Modo
  /** Epoch ms the time-limit race stops; null for n secrets. */
  readonly fin: number | null
  /** What a missed secret adds in the n-secrets race, ms. */
  readonly msCastigo: number
  readonly total: number
  /** Characters per secret in this race: letters, or digits. */
  readonly largo: number
  readonly inicio: number
  /** Null for somebody looking without a board. */
  readonly propio: {
    readonly asiento: number
    readonly terminadas: readonly Terminada<I>[]
    readonly intentos: readonly I[]
    readonly terminoEn: number | null
    readonly tiempo: number | null
    readonly retirado: boolean
    /** Lives left; null when there are none to lose. */
    readonly vidas: number | null
    /** The secret you were on when the race closed; null while anybody can play. */
    readonly enCurso: Terminada<I> | null
  } | null
  /** Lives each player started with; null in a race without them. */
  readonly vidasIniciales: number | null
  readonly rivales: readonly VistaDeRivalEn<I, M>[]
  readonly cerrada: boolean
  /** The standings — final once `cerrada`, provisional before. */
  readonly clasificacion: readonly Puesto[]
}

export function vistaCarrera<I extends IntentoBase, M>(
  estado: EstadoCarrera<I>,
  asiento: number,
  ahora: number,
  publico: (intento: I) => M,
): VistaCarrera<I, M> {
  const mio = estado.tableros.find((t) => t.asiento === asiento) ?? null
  const veoTodo = mio !== null && yaTermino(estado, mio, ahora)
  // A secret nobody ended is revealed only when nobody can play any more.
  const cerro = cerrada(estado, ahora)
  const enCursoDe = (t: TableroDe<I>): Terminada<I> | null =>
    cerro && t.terminoEn === null && t.intentos.length > 0
      ? {
          palabra: estado.bolsa[t.terminadas.length],
          acertada: false,
          intentos: t.intentos,
          sinTerminar: true,
        }
      : null
  const modo = modoDe(estado)
  return {
    modo,
    fin: finDelTiempo(estado),
    msCastigo: castigoDe(estado),
    total: estado.bolsa.length,
    largo: largoDe(estado),
    inicio: estado.inicio,
    propio: mio && {
      asiento: mio.asiento,
      terminadas: mio.terminadas,
      intentos: mio.intentos,
      terminoEn: mio.terminoEn,
      tiempo: tiempoDe(mio, modo, castigoDe(estado)),
      retirado: mio.retirado,
      vidas: vidasDe(estado, mio),
      enCurso: enCursoDe(mio),
    },
    vidasIniciales: modo === 'tiempo' && estado.vidas ? estado.vidas : null,
    rivales: estado.tableros
      .filter((t) => t.asiento !== asiento)
      .map((t) => ({
        asiento: t.asiento,
        terminadas: t.terminadas.length,
        acertadas: t.terminadas.filter((p) => p.acertada).length,
        termino: t.terminoEn !== null,
        vidas: vidasDe(estado, t),
        intentos: intentosTotales(t),
        colores: t.intentos.map(publico),
        tiempo: tiempoDe(t, modo, castigoDe(estado)),
        retirado: t.retirado,
        palabras: veoTodo ? t.terminadas : null,
        enCurso: veoTodo ? enCursoDe(t) : null,
      })),
    cerrada: cerro,
    clasificacion: clasificacion(estado),
  }
}
