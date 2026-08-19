/**
 * Every table that is still open (Phase 44).
 *
 * There are no accounts in this game and there will not be any, so this is
 * not a role: it is one value the owner knows, held in an environment
 * variable and checked on the server. If the variable is not set, there is no
 * panel at all — a deployment where nobody chose a key is not a deployment
 * with an open door.
 *
 * What it reads is deliberately dull: rows, ages and who is at them. The
 * interesting work of Phase 44 is the rules that keep this list short without
 * anybody opening it.
 */

import type { PartidaState } from '@/lib/engine'
import { prisma } from './db'

export type AsientoDelPanel = {
  readonly indice: number
  readonly alias: string
  readonly esBot: boolean
  readonly retirado: boolean
  readonly esHost: boolean
  /** Epoch ms of the last poll from this seat's browser, or null. */
  readonly ultimaSenal: number | null
}

export type PartidaDelPanel = {
  readonly codigo: string
  readonly fase: string
  readonly creadaEn: number
  readonly actualizadaEn: number
  /** The last time any *person* at this table was heard from. */
  readonly ultimaSenal: number | null
  /** Which contract it is on, 1-based, and how many the partida has. */
  readonly reparto: number | null
  readonly repartos: number | null
  readonly asientos: readonly AsientoDelPanel[]
}

/** Where the key rides between requests. Read by the page, set by the action. */
export const COOKIE_DEL_PANEL = 'mazo:panel'

/** Is the key right? The comparison is the whole of the authorization. */
export function claveCorrecta(dada: string | undefined): boolean {
  const esperada = process.env.CLAVE_DEL_PANEL
  if (!esperada || esperada.length === 0) return false
  return typeof dada === 'string' && dada === esperada
}

/** Whether this deployment has a panel at all. */
export function hayPanel(): boolean {
  return Boolean(process.env.CLAVE_DEL_PANEL)
}

/**
 * The list, and the instant it was taken. The ages on screen are all measured
 * against one moment, and it is this one — read where reading a clock is
 * allowed, rather than during a render.
 */
export async function listarPartidas(): Promise<{
  ahora: number
  partidas: readonly PartidaDelPanel[]
}> {
  const ahora = Date.now()
  const filas = await prisma.partida.findMany({
    orderBy: { actualizadaEn: 'desc' },
    include: { asientos: { orderBy: { indice: 'asc' } } },
  })

  const partidas = filas.map((fila) => {
    const asientos = fila.asientos.map((asiento) => ({
      indice: asiento.indice,
      alias: asiento.alias,
      esBot: asiento.esBot,
      retirado: asiento.retirado,
      esHost: asiento.esHost,
      ultimaSenal: asiento.ultimaSenal?.getTime() ?? null,
    }))

    const senales = asientos
      .filter((asiento) => !asiento.esBot && asiento.ultimaSenal !== null)
      .map((asiento) => asiento.ultimaSenal as number)

    const estado = leerEstado(fila.estado)

    return {
      codigo: fila.codigo,
      fase: fila.fase,
      creadaEn: fila.creadaEn.getTime(),
      actualizadaEn: fila.actualizadaEn.getTime(),
      ultimaSenal: senales.length > 0 ? Math.max(...senales) : null,
      reparto: estado ? estado.indiceContrato + 1 : null,
      repartos: estado ? estado.config.contratos.length : null,
      asientos,
    }
  })

  return { ahora, partidas }
}

/** A stored state that will not parse is a row to show, not a page to break. */
function leerEstado(crudo: string | null): PartidaState | null {
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as PartidaState
  } catch {
    return null
  }
}

/**
 * Close one table by hand.
 *
 * A lobby that was never dealt is deleted — there is nothing in it to keep —
 * and a partida that was played is marked `terminada`, which is the same
 * thing the sweep does and the same thing the last person leaving does. It is
 * not a delete: a real game's score outlives the row it costs.
 */
export async function cerrarPartida(codigo: string): Promise<'borrada' | 'cerrada' | null> {
  const fila = await prisma.partida.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
    select: { id: true, estado: true },
  })
  if (!fila) return null

  if (!fila.estado) {
    await prisma.partida.delete({ where: { id: fila.id } })
    return 'borrada'
  }

  await prisma.partida.update({
    where: { id: fila.id },
    data: { fase: 'terminada' },
  })
  return 'cerrada'
}

/** Delete a closed table for good. Only ever the ones already `terminada`. */
export async function borrarTerminadas(): Promise<number> {
  const { count } = await prisma.partida.deleteMany({
    where: { fase: 'terminada' },
  })
  return count
}
