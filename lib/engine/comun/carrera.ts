/**
 * A guessing race (Phase 99): what Palabras and Punto y Fama share.
 *
 * Everyone gets the same list of secrets — words, numbers — in the same
 * order, each on their own board at their own pace. A race is won by
 * getting through n of them first, or by getting the most in x minutes.
 * Late joiners race on the same clock; a missed secret may cost time or a
 * life; a race closes when everyone is done, when the host says, when the
 * time is up, or after a wait. None of that knows what is being guessed.
 *
 * What a game brings is its `Regla`: how a try is checked, how it is scored
 * against the secret, and how many tries a secret allows. Pure, like every
 * engine here, and it owns no clock — `ahora` is always handed in.
 */

/** The 3, 2, 1 before the first secret opens for everybody. */
export const MS_CUENTA_ATRAS = 3_000
/** What a missed secret adds when a race does not say (Palabras' default). */
export const MS_CASTIGO = 2 * 60_000
/** The wait after the first finish in races dealt before it was a choice. */
export const MS_HASTA_CERRAR = 30 * 60_000

/**
 * Two ways to race: n secrets against the clock (`'palabras'` — the name it
 * was stored under before there was a second game), or x minutes for the
 * most secrets (`'tiempo'`).
 */
export const MODOS = ['palabras', 'tiempo'] as const
export type Modo = (typeof MODOS)[number]
export function modoValido(valor: unknown): Modo {
  return valor === 'tiempo' ? 'tiempo' : 'palabras'
}

/** Every try carries what was guessed; the rest is the game's. */
export type IntentoBase = {
  readonly palabra: string
  /** Played for the player: the secret before, opening this one. */
  readonly encadenado?: boolean
}

/** A secret a player has ended — got, or its tries spent. */
export type Terminada<I extends IntentoBase> = {
  /** The secret itself. */
  readonly palabra: string
  readonly acertada: boolean
  readonly intentos: readonly I[]
  /** Ms from the race's start to the try that ended it. */
  readonly en?: number
  /** Built by the view only: the secret a player was on when the race closed. */
  readonly sinTerminar?: boolean
}

export type TableroDe<I extends IntentoBase> = {
  readonly asiento: number
  /** The secrets already ended, in order. Its length is the one in play. */
  readonly terminadas: readonly Terminada<I>[]
  /** The tries on the secret in play. */
  readonly intentos: readonly I[]
  /** Ms from the race's start to the moment this player was done. */
  readonly terminoEn: number | null
  /** Left on purpose: ranked with what they finished, waited for by nobody. */
  readonly retirado: boolean
}

export type EstadoCarrera<I extends IntentoBase> = {
  readonly seed: string
  readonly bolsa: readonly string[]
  /** Epoch ms when the first secret opens for everybody — after the 3-2-1. */
  readonly inicio: number
  readonly tableros: readonly TableroDe<I>[]
  /** Epoch ms the race was closed by the host, if it was. */
  readonly cerradaEn: number | null
  /** How this race is won. Absent in races dealt before: n secrets. */
  readonly modo?: Modo
  /** The time mode's length, ms from `inicio`. */
  readonly msLimite?: number
  /** The time mode's lives per player; null or absent: none to lose. */
  readonly vidas?: number | null
  /** What a missed secret adds, ms. Absent in older races: two minutes. */
  readonly msCastigo?: number
  /** The wait after the first finish, ms; null is «sin límite»; absent: half an hour. */
  readonly msEspera?: number | null
  /** Each secret opens with the one before as its first try. */
  readonly encadenadas?: boolean
}

/** What a game brings to a race. */
export type Regla<I extends IntentoBase> = {
  /** Read what was typed: the try in play form, or why it is refused. */
  readonly validar: (
    texto: string,
    estado: EstadoCarrera<I>,
  ) => { readonly ok: true; readonly palabra: string } | { readonly ok: false; readonly code: string }
  /** A try scored against its secret. */
  readonly intento: (palabra: string, secreto: string) => I
  /** Tries a secret allows before it counts as missed; null for no limit. */
  readonly maxIntentos: number | null
}

export type ErrorDeCarrera = 'NO_JUEGAS' | 'NO_EMPEZO' | 'YA_TERMINASTE' | 'CERRADA'

export type ResultadoDeIntentoEn<I extends IntentoBase> =
  | {
      readonly ok: true
      readonly estado: EstadoCarrera<I>
      readonly intento: I
      /** The secret in play ended with this try. */
      readonly termino: Terminada<I> | null
    }
  | { readonly ok: false; readonly code: string }

// --------------------------------------------------------------- dealing

export function tableroNuevo<I extends IntentoBase>(asiento: number): TableroDe<I> {
  return { asiento, terminadas: [], intentos: [], terminoEn: null, retirado: false }
}

/** A race over a list already drawn. The settings of the other mode are left out. */
export function empezarCarrera<I extends IntentoBase>(opciones: {
  seed: string
  bolsa: readonly string[]
  asientos: readonly number[]
  /** When the race is dealt; the first secret opens a 3-2-1 later. */
  ahora: number
  modo?: Modo
  /** The time mode's minutes. */
  minutos?: number
  /** The time mode's lives; 0 or absent is none to lose. */
  vidas?: number
  /** Minutes a missed secret adds in the n-secrets race; two when not said. */
  castigo?: number
  /** Minutes the n-secrets race waits after the first finish; 0 or absent: no limit. */
  espera?: number
  encadenadas?: boolean
}): EstadoCarrera<I> {
  const conTiempo = opciones.modo === 'tiempo'
  return {
    seed: opciones.seed,
    bolsa: opciones.bolsa,
    inicio: opciones.ahora + MS_CUENTA_ATRAS,
    tableros: opciones.asientos.map((asiento) => tableroNuevo<I>(asiento)),
    cerradaEn: null,
    ...(opciones.encadenadas ? { encadenadas: true } : {}),
    ...(conTiempo
      ? {
          modo: 'tiempo' as const,
          msLimite: (opciones.minutos ?? 5) * 60_000,
          vidas: opciones.vidas ? opciones.vidas : null,
        }
      : {
          msCastigo: (opciones.castigo ?? 2) * 60_000,
          msEspera: opciones.espera ? opciones.espera * 60_000 : null,
        }),
  }
}

/** A player joining a race already running: the race's clock, so they start behind. */
export function sumarJugador<I extends IntentoBase>(
  estado: EstadoCarrera<I>,
  asiento: number,
): EstadoCarrera<I> {
  if (estado.tableros.some((t) => t.asiento === asiento)) return estado
  return { ...estado, tableros: [...estado.tableros, tableroNuevo<I>(asiento)] }
}

// ----------------------------------------------------------------- reading

export function modoDe(estado: EstadoCarrera<IntentoBase>): Modo {
  return estado.modo ?? 'palabras'
}

/** Epoch ms when a time-limit race stops for everyone; null for n secrets. */
export function finDelTiempo(estado: EstadoCarrera<IntentoBase>): number | null {
  return modoDe(estado) === 'tiempo' && estado.msLimite ? estado.inicio + estado.msLimite : null
}

/** How long this race's secrets are, in characters. */
export function largoDe(estado: EstadoCarrera<IntentoBase>): number {
  return [...estado.bolsa[0]].length
}

export function tableroDe<I extends IntentoBase>(
  estado: EstadoCarrera<I>,
  asiento: number,
): TableroDe<I> | null {
  return estado.tableros.find((t) => t.asiento === asiento) ?? null
}

export function termino(tablero: TableroDe<IntentoBase>): boolean {
  return tablero.terminoEn !== null
}

/** This player can play no more: done, or the race is over for everyone. */
export function yaTermino(
  estado: EstadoCarrera<IntentoBase>,
  tablero: TableroDe<IntentoBase>,
  ahora: number,
): boolean {
  return termino(tablero) || cerrada(estado, ahora)
}

export function fallosDe(tablero: TableroDe<IntentoBase>): number {
  return tablero.terminadas.filter((p) => !p.acertada).length
}

export function acertadasDe(tablero: TableroDe<IntentoBase>): number {
  return tablero.terminadas.filter((p) => p.acertada).length
}

export function intentosTotales(tablero: TableroDe<IntentoBase>): number {
  return (
    tablero.terminadas.reduce((suma, p) => suma + p.intentos.length, 0) + tablero.intentos.length
  )
}

/** When this player got their most recent secret, ms from the start. */
export function ultimaAcertadaEn(tablero: TableroDe<IntentoBase>): number | null {
  const acertadas = tablero.terminadas.filter((p) => p.acertada && p.en !== undefined)
  return acertadas.length > 0 ? acertadas[acertadas.length - 1].en! : null
}

/**
 * A player's time. n secrets: when they finished, plus the penalty per
 * missed one. Against the clock: when they got their last secret.
 */
export function tiempoDe(
  tablero: TableroDe<IntentoBase>,
  modo: Modo = 'palabras',
  msCastigo: number = MS_CASTIGO,
): number | null {
  if (modo === 'tiempo') return ultimaAcertadaEn(tablero)
  if (tablero.terminoEn === null) return null
  return tablero.terminoEn + fallosDe(tablero) * msCastigo
}

/** What a missed secret adds in this race, ms. */
export function castigoDe(estado: EstadoCarrera<IntentoBase>): number {
  return estado.msCastigo ?? MS_CASTIGO
}

/** Lives left in the time mode, or null when there are none to lose. */
export function vidasDe(
  estado: EstadoCarrera<IntentoBase>,
  tablero: TableroDe<IntentoBase>,
): number | null {
  if (modoDe(estado) !== 'tiempo' || !estado.vidas) return null
  return Math.max(0, estado.vidas - fallosDe(tablero))
}

/** How long this race waits after the first finish, ms; null for «sin límite». */
export function esperaDe(estado: EstadoCarrera<IntentoBase>): number | null {
  return estado.msEspera === undefined ? MS_HASTA_CERRAR : estado.msEspera
}

/**
 * Closed when every player still racing is done, when the host closed it,
 * when the time is up, or the wait after the first finish has passed.
 */
export function cerrada(estado: EstadoCarrera<IntentoBase>, ahora: number): boolean {
  if (estado.cerradaEn !== null) return true
  const fin = finDelTiempo(estado)
  if (fin !== null && ahora >= fin) return true
  const enCarrera = estado.tableros.filter((t) => !t.retirado)
  if (enCarrera.length > 0 && enCarrera.every(termino)) return true
  if (estado.tableros.length > 0 && estado.tableros.every((t) => t.retirado || termino(t))) {
    return true
  }
  // The wait for stragglers is the n-secrets race's; time has its own end.
  if (fin !== null) return false
  const espera = esperaDe(estado)
  if (espera === null) return false
  const primero = Math.min(
    ...estado.tableros.filter(termino).map((t) => estado.inicio + t.terminoEn!),
  )
  return Number.isFinite(primero) && ahora >= primero + espera
}

// ----------------------------------------------------------------- moving

export function cerrar<I extends IntentoBase>(estado: EstadoCarrera<I>, ahora: number): EstadoCarrera<I> {
  return estado.cerradaEn !== null ? estado : { ...estado, cerradaEn: ahora }
}

export function retirarJugador<I extends IntentoBase>(
  estado: EstadoCarrera<I>,
  asiento: number,
): EstadoCarrera<I> {
  return {
    ...estado,
    tableros: estado.tableros.map((t) => (t.asiento === asiento ? { ...t, retirado: true } : t)),
  }
}

/** One try by one player, under a game's rule. Refused tries cost nothing. */
export function intentarEn<I extends IntentoBase>(
  regla: Regla<I>,
  estado: EstadoCarrera<I>,
  asiento: number,
  texto: string,
  ahora: number,
): ResultadoDeIntentoEn<I> {
  const tablero = tableroDe(estado, asiento)
  if (!tablero || tablero.retirado) return { ok: false, code: 'NO_JUEGAS' }
  if (ahora < estado.inicio) return { ok: false, code: 'NO_EMPEZO' }
  if (termino(tablero)) return { ok: false, code: 'YA_TERMINASTE' }
  if (cerrada(estado, ahora)) return { ok: false, code: 'CERRADA' }

  const leido = regla.validar(texto, estado)
  if (!leido.ok) return leido
  const { palabra } = leido

  const secreto = estado.bolsa[tablero.terminadas.length]
  const intento = regla.intento(palabra, secreto)
  const intentos = [...tablero.intentos, intento]
  const acerto = palabra === secreto
  const fin = acerto || (regla.maxIntentos !== null && intentos.length >= regla.maxIntentos)

  let nuevo: TableroDe<I> = { ...tablero, intentos }
  let terminada: Terminada<I> | null = null
  if (fin) {
    terminada = { palabra: secreto, acertada: acerto, intentos, en: ahora - estado.inicio }
    const terminadas = [...tablero.terminadas, terminada]
    nuevo = {
      ...tablero,
      terminadas,
      intentos: [],
      terminoEn: terminadas.length === estado.bolsa.length ? ahora - estado.inicio : null,
    }
    // The last life gone: this player's race is over, with what they got.
    if (vidasDe(estado, nuevo) === 0) nuevo = { ...nuevo, terminoEn: ahora - estado.inicio }
    // Chained: the next secret opens with this one already played — solved
    // or missed — scored against the new one. Never the answer, since a list
    // never repeats.
    const siguiente = estado.bolsa[terminadas.length]
    if (estado.encadenadas && nuevo.terminoEn === null && siguiente) {
      nuevo = { ...nuevo, intentos: [{ ...regla.intento(secreto, siguiente), encadenado: true }] }
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

// ---------------------------------------------------------------- ranking

export type Puesto = {
  readonly asiento: number
  readonly lugar: number
  readonly termino: boolean
  /**
   * n secrets: finished time with penalties, ms; null if not finished.
   * Time limit: when they got their last secret; null if they got none.
   */
  readonly tiempo: number | null
  readonly acertadas: number
  readonly fallos: number
  readonly intentos: number
  readonly retirado: boolean
}

/**
 * n secrets: those who finished first, by time with penalties, ties to fewer
 * tries; then the rest by secrets got, then ended. Against the clock: the
 * most got, then whoever got there first, then fewer tries.
 */
export function clasificacion(estado: EstadoCarrera<IntentoBase>): Puesto[] {
  const modo = modoDe(estado)
  const filas = estado.tableros.map((t) => ({
    asiento: t.asiento,
    termino: termino(t),
    tiempo: tiempoDe(t, modo, castigoDe(estado)),
    acertadas: acertadasDe(t),
    fallos: fallosDe(t),
    intentos: intentosTotales(t),
    terminadas: t.terminadas.length,
    retirado: t.retirado,
  }))
  filas.sort((a, b) => {
    if (modo === 'tiempo') {
      return (
        b.acertadas - a.acertadas ||
        (a.tiempo ?? Infinity) - (b.tiempo ?? Infinity) ||
        a.intentos - b.intentos
      )
    }
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
