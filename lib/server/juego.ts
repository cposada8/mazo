/**
 * The partida, refereed on the server (Phase 34).
 *
 * The same `apply()` that refereed in the browser referees here — there is one
 * engine and it is pure, so moving where it runs changes nothing about what is
 * legal. What changes is who holds the truth: the row does, and each player
 * receives only `vistaDePartida` of it.
 *
 * Bots think here too, and here there is no clock between requests. So a turn
 * is **due** rather than scheduled: its start is stored, and any request
 * arriving after the allotted time plays whatever has come due — a bot's
 * turn, or a person's timeout (Phase 36). An opponent's poll is what makes
 * both land, so nobody has to keep a tab open for the table to advance.
 */

import { movesDelTurno } from '@/lib/bots'
import {
  type Move,
  type PartidaState,
  type VistaDePartida,
  aplicarEnPartida,
  siguienteMovePorTiempo,
  vistaDePartida,
} from '@/lib/engine'
import { type Relato, relatar } from '@/lib/relato'
import { prisma } from './db'
import { asientoDe } from './partidas'

/** Everything one browser needs to draw the table on its next frame. */
export type VistaDeMesa = {
  readonly vista: VistaDePartida
  /** Everything public that has happened this ronda, oldest first. */
  readonly relatos: readonly Relato[]
  /** When the turn in play started, as epoch ms — the clock's start line. */
  readonly turnoDesde: number | null
  readonly segundosBot: number
  readonly segundosPorTurno: number
  readonly verDescarte: boolean
  readonly verHistorial: boolean
  readonly asientos: readonly {
    indice: number
    alias: string
    esBot: boolean
    bot: string | null
  }[]
}

export type ErrorDeMesa = 'NO_EXISTE' | 'NO_ES_TU_ASIENTO' | 'NO_REPARTIDA'

export type ResultadoDeMesa =
  | { readonly ok: true; readonly mesa: VistaDeMesa }
  | { readonly ok: false; readonly code: ErrorDeMesa }

/** A refused move keeps the engine's own code, so the UI can speak as before. */
export type ResultadoDeJugada =
  | { readonly ok: true; readonly mesa: VistaDeMesa }
  | {
      readonly ok: false
      readonly code: ErrorDeMesa | 'NO_ES_TU_TURNO' | string
      readonly detail?: string
    }

type Fila = {
  id: string
  codigo: string
  estado: string | null
  relatos: string
  turnoDesde: Date | null
  segundosBot: number
  segundosPorTurno: number
  verDescarte: boolean
  verHistorial: boolean
  asientos: {
    indice: number
    alias: string
    esBot: boolean
    bot: string | null
    secreto: string | null
  }[]
}

const INCLUIR = { asientos: true } as const

async function cargar(codigo: string): Promise<Fila | null> {
  return prisma.partida.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
    include: INCLUIR,
  })
}

function publicar(fila: Fila, estado: PartidaState, asiento: number): VistaDeMesa {
  return {
    vista: vistaDePartida(estado, asiento),
    relatos: JSON.parse(fila.relatos) as Relato[],
    turnoDesde: fila.turnoDesde ? fila.turnoDesde.getTime() : null,
    segundosBot: fila.segundosBot,
    segundosPorTurno: fila.segundosPorTurno,
    verDescarte: fila.verDescarte,
    verHistorial: fila.verHistorial,
    asientos: [...fila.asientos]
      .sort((a, b) => a.indice - b.indice)
      .map(({ indice, alias, esBot, bot }) => ({ indice, alias, esBot, bot })),
  }
}

/**
 * Read the table. Advancing overdue bots happens here rather than on a timer:
 * everybody's poll is the clock, so a bot moves for every watcher at once.
 */
export async function leerMesa(
  codigo: string,
  secreto: string,
  ahora = Date.now(),
): Promise<ResultadoDeMesa> {
  const fila = await cargar(codigo)
  if (!fila) return { ok: false, code: 'NO_EXISTE' }
  if (!fila.estado) return { ok: false, code: 'NO_REPARTIDA' }

  const asiento = await asientoDe(fila.id, secreto)
  if (asiento === null) return { ok: false, code: 'NO_ES_TU_ASIENTO' }

  const avanzada = await avanzar(fila, ahora)
  return { ok: true, mesa: publicar(avanzada.fila, avanzada.estado, asiento) }
}

/**
 * Play a move for the seat this secreto owns.
 *
 * Overdue bots are played first: a human whose poll was slow must not move
 * before the bot whose time already ran out.
 */
export async function jugarEnMesa(
  codigo: string,
  secreto: string,
  move: Move,
  ahora = Date.now(),
): Promise<ResultadoDeJugada> {
  const fila = await cargar(codigo)
  if (!fila) return { ok: false, code: 'NO_EXISTE' }
  if (!fila.estado) return { ok: false, code: 'NO_REPARTIDA' }

  const asiento = await asientoDe(fila.id, secreto)
  if (asiento === null) return { ok: false, code: 'NO_ES_TU_ASIENTO' }

  const puestaAlDia = await avanzar(fila, ahora)
  let { estado } = puestaAlDia
  const relatos = [...(JSON.parse(puestaAlDia.fila.relatos) as Relato[])]

  const ronda = estado.ronda
  if (!ronda || ronda.turno !== asiento) {
    return { ok: false, code: 'NO_ES_TU_TURNO' }
  }

  const contratoAntes = estado.indiceContrato
  const cuento = relatar(move, ronda)
  const result = aplicarEnPartida(estado, move)
  if (!result.ok) return { ok: false, code: result.code, detail: result.detail }

  estado = result.state
  if (cuento) relatos.push(cuento)

  const guardada = await guardar(puestaAlDia.fila, estado, relatos, contratoAntes, ahora)
  return { ok: true, mesa: publicar(guardada, estado, asiento) }
}

/**
 * Write the state back, clearing the log when the reparto changed — the log
 * belongs to the ronda it narrated, exactly as it does in the browser.
 */
async function guardar(
  fila: Fila,
  estado: PartidaState,
  relatos: readonly Relato[],
  contratoAntes: number,
  ahora: number,
): Promise<Fila> {
  const nuevoReparto = estado.indiceContrato !== contratoAntes
  const finales = nuevoReparto ? [] : relatos

  const actualizada = await prisma.partida.update({
    where: { id: fila.id },
    data: {
      estado: JSON.stringify(estado),
      relatos: JSON.stringify(finales),
      turnoDesde: new Date(ahora),
      fase: estado.ronda ? 'jugando' : 'terminada',
    },
    include: INCLUIR,
  })
  return actualizada
}

/**
 * Play every turn whose time has already run out — a bot that has finished
 * thinking, or a person who never moved.
 *
 * A loop rather than one turn: three bots in a row and a player who looked
 * away for ten seconds means three turns are due at once, and the table must
 * come back caught up rather than one move at a time.
 */
async function avanzar(
  fila: Fila,
  ahora: number,
): Promise<{ fila: Fila; estado: PartidaState }> {
  let estado = JSON.parse(fila.estado!) as PartidaState
  let relatos = JSON.parse(fila.relatos) as Relato[]
  let actual = fila
  let desde = fila.turnoDesde?.getTime() ?? ahora
  let movio = false

  const esBot = (seat: number) =>
    Boolean(fila.asientos.find((asiento) => asiento.indice === seat)?.esBot)

  // Who is sitting where, by seat index, for the bots that have to think.
  const botsPorAsiento: (string | null)[] = []
  for (const asiento of fila.asientos) {
    if (asiento.esBot) botsPorAsiento[asiento.indice] = asiento.bot
  }

  for (let vuelta = 0; vuelta < 64; vuelta++) {
    const ronda = estado.ronda
    if (!ronda || ronda.ganador !== null) break

    const bot = esBot(ronda.turno)
    const plazo = (bot ? fila.segundosBot : fila.segundosPorTurno) * 1000
    if (ahora - desde < plazo) break

    const contratoAntes = estado.indiceContrato

    if (bot) {
      const moves = movesDelTurno(estado, botsPorAsiento)
      if (moves.length === 0) break
      for (const move of moves) {
        const antes = estado.ronda
        if (!antes) break
        const cuento = relatar(move, antes)
        const result = aplicarEnPartida(estado, move)
        if (!result.ok) break
        estado = result.state
        if (cuento) relatos.push(cuento)
      }
    } else {
      // A turn nobody played: draw, throw one at random, pass. The line says
      // so in words — the ring everybody watched empty is the evidence.
      relatos.push({ tipo: 'tiempo', seat: ronda.turno })
      for (let paso = 0; paso < 4; paso++) {
        const antes = estado.ronda
        if (!antes || antes.turno !== ronda.turno) break
        const move = siguienteMovePorTiempo(antes)
        if (!move) break
        const cuento = relatar(move, antes)
        const result = aplicarEnPartida(estado, move)
        if (!result.ok) break
        estado = result.state
        if (cuento) relatos.push(cuento)
      }
    }

    if (estado.indiceContrato !== contratoAntes) relatos = []
    desde += plazo
    movio = true
  }

  if (!movio) {
    // Nothing came due. Start the clock if it was never started — the first
    // read after a deal is what sets the first turn's start line.
    if (!fila.turnoDesde) {
      actual = await prisma.partida.update({
        where: { id: fila.id },
        data: { turnoDesde: new Date(ahora) },
        include: INCLUIR,
      })
    }
    return { fila: actual, estado }
  }

  actual = await prisma.partida.update({
    where: { id: fila.id },
    data: {
      estado: JSON.stringify(estado),
      relatos: JSON.stringify(relatos),
      turnoDesde: new Date(desde),
      fase: estado.ronda ? 'jugando' : 'terminada',
    },
    include: INCLUIR,
  })
  return { fila: actual, estado }
}
