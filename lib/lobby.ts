/**
 * The wire between the door and the server (Phase 33).
 *
 * Shared on purpose: these are the shapes the lobby sends and receives, so
 * client and server cannot drift. Nothing here touches the database or React —
 * it is types plus one fetch helper.
 *
 * A **secreto** never appears in any of these shapes. It travels in the
 * request body, is checked server-side, and comes back as nothing more than
 * "which seat is yours".
 */

import type { PartidaConfig } from '@/lib/engine'

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
  /**
   * The seed the partida was dealt from, once it has been. Never the state:
   * the lobby is read by everybody at the table, so it may carry nothing that
   * a seat is not entitled to — and a whole PartidaState holds every hand.
   * The table's own endpoint sends each player their view instead.
   */
  readonly seed: string | null
  readonly repartida: boolean
  readonly segundosPorTurno: number
  readonly segundosBot: number
  /** Memory aids (Phase 24): browse the descarte, reread the ronda's story. */
  readonly verDescarte: boolean
  readonly verHistorial: boolean
  readonly asientos: readonly AsientoGuardado[]
}

/** Every refusal the lobby can answer with. Codes, not prose: the UI speaks. */
export type ErrorDeLobby =
  | 'NO_EXISTE'
  | 'NO_ES_TU_ASIENTO'
  | 'NO_ERES_EL_HOST'
  | 'YA_EMPEZO'
  | 'MESA_LLENA'
  | 'MESA_MUY_CHICA'
  | 'NO_SE_PUEDE_QUITAR'

/**
 * What a lobby looks like to one browser: the partida, minus every secreto,
 * plus which seat is this browser's. `asiento` is null for an onlooker —
 * somebody who opened the code without sitting down.
 */
export type VistaDeLobby = {
  readonly partida: PartidaGuardada
  readonly asiento: number | null
}

export type Accion =
  | { readonly tipo: 'unirse'; readonly alias: string }
  | { readonly tipo: 'bot' }
  | { readonly tipo: 'quitar'; readonly indice: number }
  | {
      readonly tipo: 'ajustes'
      readonly config?: PartidaConfig
      readonly segundosPorTurno?: number
      readonly segundosBot?: number
      readonly verDescarte?: boolean
      readonly verHistorial?: boolean
    }
  | { readonly tipo: 'renombrar'; readonly alias: string }
  | { readonly tipo: 'empezar'; readonly seed: string }
  /** Leave for good (Phase 37). Only ever sent because Salir was pressed. */
  | { readonly tipo: 'abandonar' }

export type RespuestaDeLobby =
  | { readonly ok: true; readonly vista: VistaDeLobby }
  | { readonly ok: false; readonly code: ErrorDeLobby }

/** Human words for a refusal. The server sends codes; this is the UI's half. */
export function mensajeDeLobby(code: ErrorDeLobby): string {
  switch (code) {
    case 'NO_EXISTE':
      return 'No existe una partida con ese código.'
    case 'NO_ES_TU_ASIENTO':
      return 'No tienes un asiento en esa partida.'
    case 'NO_ERES_EL_HOST':
      return 'Solo el host puede cambiar eso.'
    case 'YA_EMPEZO':
      return 'Esa partida ya empezó.'
    case 'MESA_LLENA':
      return 'La mesa está llena.'
    case 'MESA_MUY_CHICA':
      return 'Se necesitan al menos dos en la mesa.'
    case 'NO_SE_PUEDE_QUITAR':
      return 'Solo se pueden quitar bots.'
  }
}

// ------------------------------------------------------------------- fetch

export async function leerLobby(
  codigo: string,
  secreto: string,
): Promise<RespuestaDeLobby> {
  const respuesta = await fetch(
    `/api/partidas/${encodeURIComponent(codigo)}?secreto=${encodeURIComponent(secreto)}`,
    { cache: 'no-store' },
  )
  return (await respuesta.json()) as RespuestaDeLobby
}

export async function actuar(
  codigo: string,
  secreto: string,
  accion: Accion,
): Promise<RespuestaDeLobby> {
  const respuesta = await fetch(`/api/partidas/${encodeURIComponent(codigo)}/accion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secreto, accion }),
  })
  return (await respuesta.json()) as RespuestaDeLobby
}

export async function crearPartidaRemota(cuerpo: {
  secreto: string
  alias: string
  config: PartidaConfig
  segundosPorTurno: number
  segundosBot: number
}): Promise<VistaDeLobby> {
  const respuesta = await fetch('/api/partidas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!respuesta.ok) throw new Error('No se pudo crear la partida')
  return (await respuesta.json()) as VistaDeLobby
}

/** Leave a partida for good. The seat is freed; nobody takes it over. */
export async function abandonarPartida(
  codigo: string,
  secreto: string,
): Promise<void> {
  await actuar(codigo, secreto, { tipo: 'abandonar' })
}

/** The partida this browser is sitting at, if any — the way back in. */
export async function dondeEstoyRemoto(secreto: string): Promise<string | null> {
  const respuesta = await fetch(
    `/api/asiento?secreto=${encodeURIComponent(secreto)}`,
    { cache: 'no-store' },
  )
  if (!respuesta.ok) return null
  const dato = (await respuesta.json()) as { codigo: string | null }
  return dato.codigo
}
