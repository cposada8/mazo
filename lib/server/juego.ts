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

import { movesDelTurno, tiemposDeMoves } from '@/lib/bots'
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
import { asientoConEstado, asientoDe } from './partidas'

/**
 * How stale a seat's last signal may get before the next read refreshes it
 * (Phase 44). Polling is every half second while somebody else plays, and
 * presence is a question the panel asks in minutes — so it is written once in
 * a while rather than once a poll.
 */
const MS_ENTRE_SENALES = 30_000

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
    retirado: boolean
    ultimaSenal: Date | null
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

  const propio = await asientoConEstado(fila.id, secreto)
  if (propio === null) return { ok: false, code: 'NO_ES_TU_ASIENTO' }

  /*
   * A seat that left may still look; it may no longer be the clock (Phase 44).
   * Everybody's poll advancing whatever is due is what makes a table work
   * without a timer — and it is also what let a phone in a pocket, page still
   * open, keep bots playing and human clocks running at a table its owner had
   * walked away from.
   */
  if (propio.retirado) {
    const estado = JSON.parse(fila.estado) as PartidaState
    return { ok: true, mesa: publicar(fila, estado, propio.indice) }
  }

  await senalar(fila, propio.indice, ahora)
  const avanzada = await avanzar(fila, ahora)
  return { ok: true, mesa: publicar(avanzada.fila, avanzada.estado, propio.indice) }
}

/**
 * Mark that this seat's browser was heard from (Phase 44, wiring the column
 * Phase 37 declared and never wrote). It is what lets the panel answer *is
 * anybody actually there?* instead of guessing from when the table last moved
 * — a table moves because a bot's time ran out, which is no evidence of a
 * person at all.
 */
async function senalar(fila: Fila, indice: number, ahora: number) {
  const asiento = fila.asientos.find((a) => a.indice === indice)
  const ultima = asiento?.ultimaSenal?.getTime() ?? 0
  if (ahora - ultima < MS_ENTRE_SENALES) return

  await prisma.asiento
    .updateMany({
      where: { partidaId: fila.id, indice },
      data: { ultimaSenal: new Date(ahora) },
    })
    .catch(() => {
      // Presence is a nicety. Failing to record it must never fail a read.
    })
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
 *
 * **A bot's turn lands in pieces (Phase 41).** It used to be applied whole,
 * which meant the next poll was handed draw, bajada and discard as one jump —
 * *de repente el jugador ya botó y cogió*. The browser has always done the
 * opposite: `tiemposDeMoves` spreads a bot's moves across its seconds so the
 * turn can be watched. The same division applies here, as deadlines rather
 * than timers: move *k* of *n* comes due at its share of the allotment, and a
 * request plays only what is due. The last move still lands at the end of the
 * allotment, so a turn takes exactly the seconds the lobby said.
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

    const contratoAntes = estado.indiceContrato

    if (bot) {
      // What is left of this turn, re-decided from where it stands: the bot is
      // pure, so a turn resumed on a later request plays out exactly as the
      // one that was interrupted would have.
      const moves = movesDelTurno(estado, botsPorAsiento)
      if (moves.length === 0) break
      const vencen = tiemposDeMoves(moves.length, plazo)

      let aplicados = 0
      for (const [indice, move] of moves.entries()) {
        if (ahora - desde < vencen[indice]) break
        const antes = estado.ronda
        if (!antes) break
        const cuento = relatar(move, antes)
        const result = aplicarEnPartida(estado, move)
        if (!result.ok) break
        estado = result.state
        if (cuento) relatos.push(cuento)
        aplicados++
      }

      if (aplicados === 0) break

      if (aplicados < moves.length) {
        // Part of a turn. The clock's start line does not move — the turn is
        // still the one that began at `desde`, and the rest of it comes due
        // to whoever asks next.
        if (estado.indiceContrato !== contratoAntes) relatos = []
        movio = true
        break
      }
    } else {
      if (ahora - desde < plazo) break
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

  /*
   * Two people watching means two requests can find the same move due, and
   * now that a turn lands in pieces there are several times more windows in
   * which that happens. They compute the same thing — the engine and the bots
   * are pure — so the danger was never disagreement, it is order: a request
   * that played one move must not land on top of one that played two, or the
   * table visibly goes backwards before it catches up again.
   *
   * So the write is conditional on the state it was computed from still being
   * the stored one, and the request that loses reads the winner's answer
   * rather than overwriting it. No new column: the state is its own version.
   */
  const escrito = await prisma.partida.updateMany({
    where: { id: fila.id, estado: fila.estado },
    data: {
      estado: JSON.stringify(estado),
      relatos: JSON.stringify(relatos),
      turnoDesde: new Date(desde),
      fase: estado.ronda ? 'jugando' : 'terminada',
    },
  })

  const fresca = await cargar(fila.codigo)
  if (!fresca?.estado) return { fila: actual, estado }
  return {
    fila: fresca,
    estado:
      escrito.count === 0 ? (JSON.parse(fresca.estado) as PartidaState) : estado,
  }
}
