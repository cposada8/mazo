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
  type PartidaConfig,
  type PartidaState,
  type VistaDeAsiento,
  vistaDeAsiento,
} from '@/lib/engine'
import { prisma } from './db'

/** No 0/O/1/I: a code is read out loud across a room. */
const ALFABETO_DE_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LARGO_DE_CODIGO = 5

export function codigoAlAzar(): string {
  let codigo = ''
  for (let i = 0; i < LARGO_DE_CODIGO; i++) {
    codigo += ALFABETO_DE_CODIGO[Math.floor(Math.random() * ALFABETO_DE_CODIGO.length)]
  }
  return codigo
}

export type FaseDePartida = 'lobby' | 'jugando' | 'terminada'

export type AsientoGuardado = {
  readonly indice: number
  readonly alias: string
  readonly esBot: boolean
  readonly esHost: boolean
  readonly retirado: boolean
}

export type PartidaGuardada = {
  readonly id: string
  readonly codigo: string
  readonly fase: FaseDePartida
  readonly config: PartidaConfig
  readonly estado: PartidaState | null
  readonly segundosPorTurno: number
  readonly segundosBot: number
  readonly asientos: readonly AsientoGuardado[]
}

type FilaPartida = {
  id: string
  codigo: string
  fase: string
  config: string
  estado: string | null
  segundosPorTurno: number
  segundosBot: number
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
    estado: fila.estado ? (JSON.parse(fila.estado) as PartidaState) : null,
    segundosPorTurno: fila.segundosPorTurno,
    segundosBot: fila.segundosBot,
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
    where: { codigo: codigo.trim().toUpperCase() },
    include: INCLUIR_ASIENTOS,
  })
  return fila ? publicar(fila) : null
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
    where: { codigo: codigo.trim().toUpperCase() },
    include: INCLUIR_ASIENTOS,
  })
  if (!fila) return { ok: false, code: 'NO_EXISTE' }

  const propio = fila.asientos.find((asiento) => asiento.secreto === secreto)
  if (propio) return { ok: true, indice: propio.indice }

  if (fila.fase !== 'lobby') return { ok: false, code: 'YA_EMPEZO' }
  if (fila.asientos.length >= MAX_PLAYERS) return { ok: false, code: 'MESA_LLENA' }

  const indice = Math.max(...fila.asientos.map((a) => a.indice)) + 1
  await prisma.asiento.create({
    data: { partidaId: fila.id, indice, alias, secreto },
  })
  return { ok: true, indice }
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
