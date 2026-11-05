/**
 * El Mentiroso on the server (Phase 80): the referee when more than one
 * person sits at the table.
 *
 * The same shape as Carioca's (`juego.ts`): a serverless function has no
 * clock, so every deadline is stored and the next request — anybody's poll —
 * applies whatever has come due. Three things come due here:
 *
 *   - a **bot's play**, `segundosBot` after its turn began;
 *   - a **person's play**, `segundosPorTurno` after theirs, played by the
 *     clock (`jugadaDelReloj`) if they let it run out;
 *   - a **call**, by a bot that wants to make one, a moment into a play's
 *     window. The window itself has no length: the next play closes it
 *     (the owner, 2026-11-05, as Plato plays it).
 *
 * **The first call counts.** Every write is conditional on the stored state
 * being the one it was computed from. Two calls sent in the same instant are
 * computed from the same state; one write lands, the other finds the state
 * moved, re-reads it, and its call is refused by the engine because the
 * window is no longer open. No lock, no queue: the state is its own version.
 *
 * Nothing that answers a request carries anything but one seat's view and the
 * public log.
 */

import { BOTS_MENTIROSO, EL_EMBUSTERO } from '@/lib/bots/mentiroso'
import {
  type EstadoMentiroso,
  type MoveMentiroso,
  type VistaMentiroso,
  aplicarMentiroso,
  debeAceptarOAcusar,
  estaEnJuego,
  jugadaDelReloj,
  retirarMentiroso,
  terminada,
  vistaMentiroso,
} from '@/lib/engine/mentiroso'
import {
  type EventoMentiroso,
  MS_VUELO_JUGADA,
  msDeAcusacion,
  relatarMentiroso,
} from '@/lib/relato-mentiroso'
import { prisma } from './db'

/** How far into a window a bot that wants to call does so. */
const MS_HASTA_QUE_ACUSA_UN_BOT = 1_000

/**
 * How long the table is still showing what just happened, before the next
 * deadline starts counting: a play's cards in the air, or a whole call. Every
 * screen tells events in these times (`lib/relato-mentiroso.ts`), so a bot
 * never plays on top of a scene still playing.
 */
export function pausaDeEscena(estado: EstadoMentiroso): number {
  if (estado.fase === 'ventana') return MS_VUELO_JUGADA
  // Right after a call the pile is empty and the call is the last thing told.
  if (estado.ultimaAcusacion && estado.pila.length === 0) {
    return msDeAcusacion(estado.ultimaAcusacion.cartas.length)
  }
  return 0
}

export type VistaDeMesaMentiroso = {
  readonly vista: VistaMentiroso
  /** Everything public that has happened, oldest first. */
  readonly eventos: readonly EventoMentiroso[]
  /** When the current phase began, epoch ms — a turn or a window. */
  readonly desde: number
  /**
   * When the seat in turn must have acted, epoch ms — its thinking time if a
   * bot, its clock if a person. The table draws it as the turn's clock.
   */
  readonly plazoHasta: number
  /** The length of that deadline, in seconds, to draw it as a fraction. */
  readonly segundosDelPlazo: number
  readonly segundosBot: number
  readonly segundosPorTurno: number
  readonly segundosVentana: number
  readonly asientos: readonly {
    indice: number
    alias: string
    esBot: boolean
    retirado: boolean
  }[]
}

export type ErrorDeMesaMentiroso =
  | 'NO_EXISTE'
  | 'NO_ES_TU_ASIENTO'
  | 'NO_REPARTIDA'
  | 'OTRO_JUEGO'
  | 'TE_RETIRASTE'

export type ResultadoMesaMentiroso =
  | { readonly ok: true; readonly mesa: VistaDeMesaMentiroso }
  | { readonly ok: false; readonly code: ErrorDeMesaMentiroso | string; readonly detail?: string }

/** What a person may send. The seat is never taken from the body. */
export type JugadaDePersona =
  | { readonly type: 'jugar'; readonly cartaIds: readonly string[] }
  | { readonly type: 'mentiroso' }
  /** «Le creo»: accept a play that emptied its player's hand. */
  | { readonly type: 'creer' }

const INCLUIR = { asientos: true } as const

type Fila = NonNullable<Awaited<ReturnType<typeof cargar>>>

async function cargar(codigo: string) {
  return prisma.partida.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
    include: INCLUIR,
  })
}

/** Load a dealt Mentiroso partida and the seat this secreto owns. */
async function abrir(codigo: string, secreto: string) {
  const fila = await cargar(codigo)
  if (!fila) return { ok: false as const, code: 'NO_EXISTE' as const }
  if (fila.juego !== 'mentiroso') return { ok: false as const, code: 'OTRO_JUEGO' as const }
  if (!fila.estado) return { ok: false as const, code: 'NO_REPARTIDA' as const }
  const asiento = fila.asientos.find((a) => a.secreto === secreto)
  if (!asiento) return { ok: false as const, code: 'NO_ES_TU_ASIENTO' as const }
  return { ok: true as const, fila, asiento }
}

function publicar(fila: Fila, estado: EstadoMentiroso, asiento: number): VistaDeMesaMentiroso {
  const desde = fila.turnoDesde?.getTime() ?? fila.actualizadaEn.getTime()
  const enTurno = fila.asientos.find((a) => a.indice === estado.turno)
  const plazo = enTurno?.esBot ? fila.segundosBot : fila.segundosPorTurno
  const pausa = pausaDeEscena(estado)
  return {
    vista: vistaMentiroso(estado, asiento),
    eventos: JSON.parse(fila.relatos) as EventoMentiroso[],
    desde,
    plazoHasta: desde + pausa + plazo * 1000,
    segundosDelPlazo: plazo,
    segundosBot: fila.segundosBot,
    segundosPorTurno: fila.segundosPorTurno,
    segundosVentana: fila.segundosVentana,
    asientos: [...fila.asientos]
      .sort((a, b) => a.indice - b.indice)
      .map(({ indice, alias, esBot, retirado }) => ({ indice, alias, esBot, retirado })),
  }
}

/**
 * Apply everything due by `ahora`, starting from the stored state. Pure: the
 * caller decides whether and how to write. Returns the new state, the events
 * it produced, and when its current phase began.
 */
export function ponerAlDia(
  estado: EstadoMentiroso,
  desde: number,
  fila: {
    segundosBot: number
    segundosPorTurno: number
    segundosVentana: number
    asientos: readonly { indice: number; esBot: boolean; bot: string | null }[]
  },
  ahora: number,
): { estado: EstadoMentiroso; desde: number; eventos: EventoMentiroso[] } {
  const eventos: EventoMentiroso[] = []
  const botDe = (asiento: number) => {
    const fila_ = fila.asientos.find((a) => a.indice === asiento)
    if (!fila_?.esBot) return null
    return BOTS_MENTIROSO.find((b) => b.id === fila_.bot) ?? EL_EMBUSTERO
  }
  const aplicar = (move: MoveMentiroso, cuando: number) => {
    const resultado = aplicarMentiroso(estado, move)
    if (!resultado.ok) return false
    eventos.push(...relatarMentiroso(move, estado, resultado.estado))
    estado = resultado.estado
    desde = cuando
    return true
  }

  for (let vuelta = 0; vuelta < 200 && !terminada(estado); vuelta++) {
    // An open play: a bot that wants to call does so a moment in — before a
    // bot in turn would play over it, so the call is never lost to the play.
    if (estado.fase === 'ventana') {
      const jugo = estado.ultimaJugada!.asiento
      const cuandoAcusa =
        desde + MS_VUELO_JUGADA + Math.min(MS_HASTA_QUE_ACUSA_UN_BOT, fila.segundosBot * 500)
      let acusador: number | null = null
      for (let paso = 1; paso < estado.jugadores; paso++) {
        const asiento = (jugo + paso) % estado.jugadores
        const bot = botDe(asiento)
        if (bot && estaEnJuego(estado, asiento) && bot.acusar(vistaMentiroso(estado, asiento))) {
          acusador = asiento
          break
        }
      }
      if (acusador !== null) {
        if (ahora < cuandoAcusa) break
        if (aplicar({ type: 'mentiroso', asiento: acusador }, cuandoAcusa)) continue
      }
    }

    // The seat in turn: a bot after its thinking time, a person when their
    // clock runs out. Either way the play closes the window on the one before
    // — or, if that one emptied a hand, accepts it.
    const bot = botDe(estado.turno)
    const vence =
      desde + pausaDeEscena(estado) + (bot ? fila.segundosBot : fila.segundosPorTurno) * 1000
    if (ahora < vence) break
    const move: MoveMentiroso | null = bot
      ? debeAceptarOAcusar(estado)
        ? { type: 'cerrarVentana' }
        : { type: 'jugar', asiento: estado.turno, cartaIds: bot.jugar(vistaMentiroso(estado, estado.turno)) }
      : jugadaDelReloj(estado)
    if (!move || !aplicar(move, vence)) break
  }

  return { estado, desde, eventos }
}

/**
 * Write a new state only if the stored one is still `antes`. Returns the row
 * as it is now either way, and whether this write was the one that landed.
 */
async function escribir(
  fila: Fila,
  estado: EstadoMentiroso,
  desde: number,
  eventos: readonly EventoMentiroso[],
): Promise<{ fila: Fila; escrito: boolean }> {
  const todos = [...(JSON.parse(fila.relatos) as EventoMentiroso[]), ...eventos]
  const escrito = await prisma.partida.updateMany({
    where: { id: fila.id, estado: fila.estado },
    data: {
      estado: JSON.stringify(estado),
      relatos: JSON.stringify(todos),
      turnoDesde: new Date(desde),
      fase: terminada(estado) ? 'terminada' : 'jugando',
    },
  })
  const fresca = (await cargar(fila.codigo))!
  return { fila: fresca, escrito: escrito.count > 0 }
}

/** Bring a row up to date and store it. Losing the race is fine: the winner's row is read. */
async function avanzar(fila: Fila, ahora: number): Promise<Fila> {
  const estado = JSON.parse(fila.estado!) as EstadoMentiroso
  const desde = fila.turnoDesde?.getTime() ?? fila.actualizadaEn.getTime()
  const puesta = ponerAlDia(estado, desde, fila, ahora)
  if (puesta.eventos.length === 0 && puesta.desde === desde) return fila
  return (await escribir(fila, puesta.estado, puesta.desde, puesta.eventos)).fila
}

/** Read the table — and, being a request, apply whatever is due. */
export async function leerMesaMentiroso(
  codigo: string,
  secreto: string,
  ahora = Date.now(),
): Promise<ResultadoMesaMentiroso> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  const { asiento } = abierta
  // A seat that left may still look; it is no longer the clock (Phase 44).
  const fila = asiento.retirado ? abierta.fila : await avanzar(abierta.fila, ahora)
  if (!asiento.retirado) await senalar(fila.id, asiento.indice, asiento.ultimaSenal, ahora)
  return {
    ok: true,
    mesa: publicar(fila, JSON.parse(fila.estado!) as EstadoMentiroso, asiento.indice),
  }
}

/**
 * A person's play or call. Everything due is applied first, so a call that
 * arrives after its window has run out is refused as too late — the window
 * closed, by the clock, before it.
 */
export async function jugarMentirosoEnMesa(
  codigo: string,
  secreto: string,
  jugada: JugadaDePersona,
  ahora = Date.now(),
): Promise<ResultadoMesaMentiroso> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  const { asiento } = abierta
  if (asiento.retirado) return { ok: false, code: 'TE_RETIRASTE' }

  // Up to date first, then the move on top — retried once if another
  // request wrote in between, so a move is never applied to a stale state.
  let fila = await avanzar(abierta.fila, ahora)
  for (let intento = 0; intento < 2; intento++) {
    const estado = JSON.parse(fila.estado!) as EstadoMentiroso
    // «Le creo» is only the seat in turn's to say, and only to a last play.
    if (jugada.type === 'creer' && (estado.turno !== asiento.indice || !debeAceptarOAcusar(estado))) {
      return { ok: false, code: 'fase-equivocada', detail: 'nothing to accept' }
    }
    const move: MoveMentiroso =
      jugada.type === 'jugar'
        ? { type: 'jugar', asiento: asiento.indice, cartaIds: jugada.cartaIds }
        : jugada.type === 'creer'
          ? { type: 'cerrarVentana' }
          : { type: 'mentiroso', asiento: asiento.indice }
    const resultado = aplicarMentiroso(estado, move)
    if (!resultado.ok) return { ok: false, code: resultado.code, detail: resultado.detail }

    const escrita = await escribir(
      fila,
      resultado.estado,
      ahora,
      relatarMentiroso(move, estado, resultado.estado),
    )
    fila = escrita.fila
    if (escrita.escrito) {
      return {
        ok: true,
        mesa: publicar(fila, resultado.estado, asiento.indice),
      }
    }
  }
  // Lost the race twice in a row: the table is moving under us. The move was
  // never applied; the client simply sends it again.
  return { ok: false, code: 'OCUPADA', detail: 'the table moved; try again' }
}

/** Presence, written at most twice a minute — the panel asks in minutes. */
async function senalar(
  partidaId: string,
  indice: number,
  ultima: Date | null,
  ahora: number,
) {
  if (ultima && ahora - ultima.getTime() < 30_000) return
  await prisma.asiento.updateMany({
    where: { partidaId, indice },
    data: { ultimaSenal: new Date(ahora) },
  })
}

/**
 * Leaving a dealt Mentiroso partida on purpose (Phase 80, `mentiroso-rules.md`
 * «Leaving»): the seat's cards leave play and the turn skips it. Fewer than two
 * seats left, or no person, and the partida is over.
 */
export async function retirarDeMesaMentiroso(
  fila: { id: string; estado: string | null },
  indice: number,
  gente: number,
): Promise<void> {
  const estado = retirarMentiroso(JSON.parse(fila.estado!) as EstadoMentiroso, indice)
  const fin = terminada(estado) || gente === 0
  await prisma.$transaction([
    prisma.asiento.updateMany({
      where: { partidaId: fila.id, indice },
      data: { retirado: true },
    }),
    prisma.partida.update({
      where: { id: fila.id },
      data: {
        estado: JSON.stringify(fin && estado.ganador === null ? { ...estado, sinGanador: true } : estado),
        fase: fin ? 'terminada' : 'jugando',
      },
    }),
  ])
}
