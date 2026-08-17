/**
 * Partidas at rest (Phase 32).
 *
 * A partida is a row whose `estado` is the engine's own JSON — decision 5
 * (the rng rides as one number) is what makes that a plain stringify. Seats
 * are claimed by a per-browser **secreto**: the server maps secreto → seat
 * and shows a hand to nobody else. No accounts, ever.
 *
 * Server-only: nothing under `lib/server/` is imported by client code — the
 * same directory discipline that keeps the engine pure, enforced by review
 * rather than by a build error, because tests import this module from Node.
 */

import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PartidaConfig,
  type PartidaState,
  type VistaDeAsiento,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { codigoAlAzar, limpiarCodigo } from '@/lib/codigo'
import type {
  ErrorDeLobby,
  FaseDePartida,
  PartidaGuardada,
} from '@/lib/lobby'
import { prisma } from './db'

export type { ErrorDeLobby, FaseDePartida, PartidaGuardada }

export { LARGO_DE_CODIGO } from '@/lib/codigo'

export type ResultadoDeLobby =
  | { readonly ok: true; readonly partida: PartidaGuardada }
  | { readonly ok: false; readonly code: ErrorDeLobby }

type FilaPartida = {
  id: string
  codigo: string
  fase: string
  config: string
  estado: string | null
  segundosPorTurno: number
  segundosBot: number
  verDescarte: boolean
  verHistorial: boolean
  asientos: {
    indice: number
    alias: string
    esBot: boolean
    esHost: boolean
    retirado: boolean
    secreto: string | null
  }[]
}

/** The public shape: secretos never leave this module. */
function publicar(fila: FilaPartida): PartidaGuardada {
  return {
    id: fila.id,
    codigo: fila.codigo,
    fase: fila.fase as FaseDePartida,
    config: JSON.parse(fila.config) as PartidaConfig,
    // The seed, never the state: everybody at the table reads this shape.
    seed: fila.estado ? (JSON.parse(fila.estado) as PartidaState).seed : null,
    repartida: fila.estado !== null,
    segundosPorTurno: fila.segundosPorTurno,
    segundosBot: fila.segundosBot,
    verDescarte: fila.verDescarte,
    verHistorial: fila.verHistorial,
    asientos: [...fila.asientos]
      .sort((a, b) => a.indice - b.indice)
      .map(({ indice, alias, esBot, esHost, retirado }) => ({
        indice,
        alias,
        esBot,
        esHost,
        retirado,
      })),
  }
}

const INCLUIR_ASIENTOS = { asientos: true } as const

export async function crearPartida(opciones: {
  secreto: string
  alias: string
  config: PartidaConfig
  segundosPorTurno?: number
  segundosBot?: number
  /** How many bot seats to open with. The table starts with three (one door). */
  bots?: number
  aliasesDeBots?: readonly string[]
}): Promise<PartidaGuardada> {
  const {
    secreto,
    alias,
    config,
    segundosPorTurno = 45,
    segundosBot = 2,
    bots = 3,
    aliasesDeBots = [],
  } = opciones

  // A code collision is unlikely and loud: unique constraint. Retry a few
  // times rather than pretending it cannot happen.
  for (let intento = 0; intento < 5; intento++) {
    try {
      const fila = await prisma.partida.create({
        data: {
          codigo: codigoAlAzar(),
          fase: 'lobby',
          config: JSON.stringify(config),
          segundosPorTurno,
          segundosBot,
          asientos: {
            create: [
              { indice: 0, alias, secreto, esHost: true },
              ...Array.from({ length: bots }, (_, i) => ({
                indice: i + 1,
                alias: aliasesDeBots[i] ?? `El Codicioso ${i + 1}`,
                esBot: true,
              })),
            ],
          },
        },
        include: INCLUIR_ASIENTOS,
      })
      return publicar(fila)
    } catch (error) {
      if (intento === 4) throw error
    }
  }
  throw new Error('unreachable')
}

export async function cargarPorCodigo(codigo: string): Promise<PartidaGuardada | null> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    include: INCLUIR_ASIENTOS,
  })
  return fila ? publicar(fila) : null
}

/**
 * The whole state, for the server only. Nothing that answers a request may
 * return this — it holds every hand.
 */
export async function estadoDe(codigo: string): Promise<PartidaState | null> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    select: { estado: true },
  })
  return fila?.estado ? (JSON.parse(fila.estado) as PartidaState) : null
}

export async function cargarPorId(id: string): Promise<PartidaGuardada | null> {
  const fila = await prisma.partida.findUnique({
    where: { id },
    include: INCLUIR_ASIENTOS,
  })
  return fila ? publicar(fila) : null
}

export type ResultadoDeUnirse =
  | { readonly ok: true; readonly indice: number }
  | {
      readonly ok: false
      readonly code: 'NO_EXISTE' | 'YA_EMPEZO' | 'MESA_LLENA'
    }

/**
 * Sit down at a partida, idempotently: the same secreto always gets its own
 * seat back — that is what surviving a reload means — and never anyone
 * else's. New players take the next free index while the lobby is open.
 */
export async function unirse(opciones: {
  codigo: string
  secreto: string
  alias: string
}): Promise<ResultadoDeUnirse> {
  const { codigo, secreto, alias } = opciones
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    include: INCLUIR_ASIENTOS,
  })
  if (!fila) return { ok: false, code: 'NO_EXISTE' }

  const propio = fila.asientos.find((asiento) => asiento.secreto === secreto)
  if (propio) return { ok: true, indice: propio.indice }

  if (fila.fase !== 'lobby') return { ok: false, code: 'YA_EMPEZO' }
  if (fila.asientos.length >= MAX_PLAYERS) return { ok: false, code: 'MESA_LLENA' }

  const indice = Math.max(...fila.asientos.map((a) => a.indice)) + 1
  await prisma.asiento.create({
    data: {
      partidaId: fila.id,
      indice,
      alias: aliasLibre(alias, fila.asientos.map((a) => a.alias)),
      secreto,
    },
  })
  return { ok: true, indice }
}

/**
 * An alias already at this table is not handed out twice — two «milo» at one
 * table is a table nobody can talk about. The newcomer keeps their name with
 * a number after it.
 */
function aliasLibre(alias: string, tomados: readonly string[]): string {
  const usados = new Set(tomados.map((otro) => otro.toLowerCase()))
  if (!usados.has(alias.toLowerCase())) return alias
  for (let n = 2; n < 100; n++) {
    const intento = `${alias} ${n}`
    if (!usados.has(intento.toLowerCase())) return intento
  }
  return alias
}

/** The seat this secreto owns at this partida, or null — never a guess. */
export async function asientoDe(
  partidaId: string,
  secreto: string,
): Promise<number | null> {
  const asiento = await prisma.asiento.findFirst({
    where: { partidaId, secreto },
    select: { indice: true },
  })
  return asiento?.indice ?? null
}

export async function guardarEstado(
  partidaId: string,
  estado: PartidaState,
  fase: FaseDePartida = 'jugando',
): Promise<void> {
  await prisma.partida.update({
    where: { id: partidaId },
    data: { estado: JSON.stringify(estado), fase },
  })
}

/**
 * What this secreto is entitled to see of the ronda in play: its own seat's
 * view, or nothing. The wrong secreto does not get an error to probe — it
 * gets null, the same as a partida that does not exist.
 */
export async function vistaParaSecreto(
  partidaId: string,
  secreto: string,
): Promise<VistaDeAsiento | null> {
  const [indice, fila] = await Promise.all([
    asientoDe(partidaId, secreto),
    prisma.partida.findUnique({ where: { id: partidaId }, select: { estado: true } }),
  ])
  if (indice === null || !fila?.estado) return null

  const estado = JSON.parse(fila.estado) as PartidaState
  if (!estado.ronda) return null
  return vistaDeAsiento(estado.ronda, indice)
}

// ------------------------------------------------------------------ lobby

/**
 * Load a partida and check that this secreto runs it. Every host action goes
 * through here, so "only the host may" is one rule in one place rather than a
 * check each caller is trusted to remember.
 */
async function comoHost(
  codigo: string,
  secreto: string,
): Promise<
  | { ok: true; fila: FilaPartida }
  | { ok: false; code: ErrorDeLobby }
> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    include: INCLUIR_ASIENTOS,
  })
  if (!fila) return { ok: false, code: 'NO_EXISTE' }

  const host = fila.asientos.find((asiento) => asiento.esHost)
  if (!host || host.secreto !== secreto) return { ok: false, code: 'NO_ERES_EL_HOST' }
  if (fila.fase !== 'lobby') return { ok: false, code: 'YA_EMPEZO' }

  return { ok: true, fila }
}

/** Reload and publish, after a write. */
async function recargar(id: string): Promise<PartidaGuardada> {
  const fila = await prisma.partida.findUniqueOrThrow({
    where: { id },
    include: INCLUIR_ASIENTOS,
  })
  return publicar(fila)
}

export async function agregarBot(opciones: {
  codigo: string
  secreto: string
  alias?: string
}): Promise<ResultadoDeLobby> {
  const acceso = await comoHost(opciones.codigo, opciones.secreto)
  if (!acceso.ok) return acceso

  const { fila } = acceso
  if (fila.asientos.length >= MAX_PLAYERS) return { ok: false, code: 'MESA_LLENA' }

  const indice = Math.max(...fila.asientos.map((a) => a.indice)) + 1
  await prisma.asiento.create({
    data: {
      partidaId: fila.id,
      indice,
      alias: aliasLibre(
        opciones.alias ?? 'El Codicioso',
        fila.asientos.map((a) => a.alias),
      ),
      esBot: true,
    },
  })
  return { ok: true, partida: await recargar(fila.id) }
}

/**
 * Take a seat off the table. Only bots: a person leaves by their own choice
 * (Abandonar, Phase 37), never by the host's.
 *
 * Seats are renumbered so the indices stay 0…n−1 — the engine deals by seat
 * index, so a gap would be a seat nobody sits in.
 */
export async function quitarAsiento(opciones: {
  codigo: string
  secreto: string
  indice: number
}): Promise<ResultadoDeLobby> {
  const acceso = await comoHost(opciones.codigo, opciones.secreto)
  if (!acceso.ok) return acceso

  const { fila } = acceso
  const victima = fila.asientos.find((a) => a.indice === opciones.indice)
  if (!victima || !victima.esBot) return { ok: false, code: 'NO_SE_PUEDE_QUITAR' }
  if (fila.asientos.length <= MIN_PLAYERS) return { ok: false, code: 'MESA_MUY_CHICA' }

  await prisma.$transaction([
    prisma.asiento.deleteMany({
      where: { partidaId: fila.id, indice: opciones.indice },
    }),
    ...fila.asientos
      .filter((a) => a.indice > opciones.indice)
      .map((a) =>
        prisma.asiento.updateMany({
          where: { partidaId: fila.id, indice: a.indice },
          data: { indice: a.indice - 1 },
        }),
      ),
  ])

  return { ok: true, partida: await recargar(fila.id) }
}

/** The rules and the pacing, all of them the host's while the lobby is open. */
export async function actualizarAjustes(opciones: {
  codigo: string
  secreto: string
  config?: PartidaConfig
  segundosPorTurno?: number
  segundosBot?: number
  verDescarte?: boolean
  verHistorial?: boolean
}): Promise<ResultadoDeLobby> {
  const acceso = await comoHost(opciones.codigo, opciones.secreto)
  if (!acceso.ok) return acceso

  await prisma.partida.update({
    where: { id: acceso.fila.id },
    data: {
      ...(opciones.config ? { config: JSON.stringify(opciones.config) } : {}),
      ...(opciones.segundosPorTurno !== undefined
        ? { segundosPorTurno: opciones.segundosPorTurno }
        : {}),
      ...(opciones.segundosBot !== undefined
        ? { segundosBot: opciones.segundosBot }
        : {}),
      ...(opciones.verDescarte !== undefined
        ? { verDescarte: opciones.verDescarte }
        : {}),
      ...(opciones.verHistorial !== undefined
        ? { verHistorial: opciones.verHistorial }
        : {}),
    },
  })
  return { ok: true, partida: await recargar(acceso.fila.id) }
}

/** Rename yourself at the table. Your own seat only — found by secreto. */
export async function renombrarAsiento(opciones: {
  codigo: string
  secreto: string
  alias: string
}): Promise<ResultadoDeLobby> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(opciones.codigo) },
    include: INCLUIR_ASIENTOS,
  })
  if (!fila) return { ok: false, code: 'NO_EXISTE' }

  const propio = fila.asientos.find((a) => a.secreto === opciones.secreto)
  if (!propio) return { ok: false, code: 'NO_EXISTE' }

  const alias = opciones.alias.trim().slice(0, 24)
  if (alias) {
    await prisma.asiento.update({
      where: { id: (await asientoIdDe(fila.id, propio.indice))! },
      data: {
        alias: aliasLibre(
          alias,
          fila.asientos.filter((a) => a.indice !== propio.indice).map((a) => a.alias),
        ),
      },
    })
  }
  return { ok: true, partida: await recargar(fila.id) }
}

async function asientoIdDe(partidaId: string, indice: number): Promise<string | null> {
  const fila = await prisma.asiento.findFirst({
    where: { partidaId, indice },
    select: { id: true },
  })
  return fila?.id ?? null
}

/**
 * Deal. The lobby's seat list becomes the table, and the partida's state is
 * the engine's from here on — the same `startPartida` the solo game calls,
 * because there is only one game.
 */
export async function empezar(opciones: {
  codigo: string
  secreto: string
  seed: string
}): Promise<ResultadoDeLobby> {
  const acceso = await comoHost(opciones.codigo, opciones.secreto)
  if (!acceso.ok) return acceso

  const { fila } = acceso
  if (fila.asientos.length < MIN_PLAYERS) return { ok: false, code: 'MESA_MUY_CHICA' }

  const config = JSON.parse(fila.config) as PartidaConfig
  const estado = startPartida({
    players: fila.asientos.length,
    seed: opciones.seed,
    config,
  })

  await prisma.partida.update({
    where: { id: fila.id },
    data: { estado: JSON.stringify(estado), fase: 'jugando' },
  })
  return { ok: true, partida: await recargar(fila.id) }
}
