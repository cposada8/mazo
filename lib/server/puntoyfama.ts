/**
 * Punto y Fama on the server (Phases 101, 103, 104): the referee.
 *
 * Its two races are the shared guessing race (`./carrera.ts`) run with Punto
 * y Fama's engine. The duel is its own small state: the server holds both
 * secret numbers and scores every guess; a phone receives its own number,
 * its own guesses, and of the other only their answers — never their number
 * nor their guesses' digits until the duel is decided.
 *
 * Writes are compare-and-swap on the stored state, as everywhere else.
 */

import {
  type EstadoDuelo,
  type IntentoPF,
  type VistaDelDuelo,
  type VistaPuntoYFama,
  intentarEnDuelo,
  intentarNumero,
  ponerSecreto,
  resultadoDelDuelo,
  retirarDelDuelo,
  vistaDelDuelo,
  vistaPuntoYFama,
} from '@/lib/engine/puntoyfama'
import { limpiarCodigo } from '@/lib/codigo'
import { type MesaCarrera, type ResultadoDeCarrera, arbitroDeCarrera } from './carrera'
import { prisma } from './db'

// ------------------------------------------------------------- the races

export type MesaPuntoYFama = MesaCarrera<VistaPuntoYFama>
export type ResultadoPuntoYFama = ResultadoDeCarrera<VistaPuntoYFama>

const arbitro = arbitroDeCarrera<IntentoPF, VistaPuntoYFama>({
  id: 'puntoyfama',
  intentar: intentarNumero,
  vista: vistaPuntoYFama,
})

export const leerCarreraPF = arbitro.leer
export const intentarEnCarreraPF = arbitro.intentar
export const cerrarCarreraPF = arbitro.cerrar

// --------------------------------------------------------------- the duel

export type MesaDuelo = {
  readonly vista: VistaDelDuelo
  /** The server's clock when this was read. */
  readonly ahora: number
  readonly asientos: readonly { indice: number; alias: string; esHost: boolean }[]
}

export type ResultadoDuelo =
  | { readonly ok: true; readonly mesa: MesaDuelo }
  | { readonly ok: false; readonly code: string }

function cargar(codigo: string) {
  return prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    include: { asientos: true },
  })
}
type Fila = NonNullable<Awaited<ReturnType<typeof cargar>>>

async function abrir(codigo: string, secreto: string) {
  const fila = await cargar(codigo)
  if (!fila) return { ok: false as const, code: 'NO_EXISTE' }
  if (fila.juego !== 'puntoyfama' || fila.modo !== 'duelo') return { ok: false as const, code: 'OTRO_JUEGO' }
  if (!fila.estado) return { ok: false as const, code: 'NO_REPARTIDA' }
  const asiento = fila.asientos.find((a) => a.secreto === secreto)
  if (!asiento) return { ok: false as const, code: 'NO_ES_TU_ASIENTO' }
  return { ok: true as const, fila, asiento }
}

function publicar(fila: Fila, estado: EstadoDuelo, asiento: number, ahora: number): MesaDuelo {
  return {
    vista: vistaDelDuelo(estado, asiento),
    ahora,
    asientos: [...fila.asientos]
      .sort((a, b) => a.indice - b.indice)
      .map(({ indice, alias, esHost }) => ({ indice, alias, esHost })),
  }
}

async function escribir(fila: Fila, estado: EstadoDuelo): Promise<boolean> {
  const escrito = await prisma.partida.updateMany({
    where: { id: fila.id, estado: fila.estado },
    data: {
      estado: JSON.stringify(estado),
      fase: resultadoDelDuelo(estado) ? 'terminada' : 'jugando',
    },
  })
  return escrito.count > 0
}

/** Apply a change to the stored duel, retrying if another request landed first. */
async function cambiar(
  codigo: string,
  secreto: string,
  ahora: number,
  cambio: (estado: EstadoDuelo, asiento: number) => { ok: true; estado: EstadoDuelo } | { ok: false; code: string },
): Promise<ResultadoDuelo> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  let fila = abierta.fila
  for (let vez = 0; vez < 6; vez++) {
    const resultado = cambio(JSON.parse(fila.estado!) as EstadoDuelo, abierta.asiento.indice)
    if (!resultado.ok) return resultado
    if (await escribir(fila, resultado.estado)) {
      return { ok: true, mesa: publicar(fila, resultado.estado, abierta.asiento.indice, ahora) }
    }
    fila = (await cargar(codigo))!
  }
  return { ok: false, code: 'OCUPADA' }
}

export async function leerDuelo(codigo: string, secreto: string, ahora = Date.now()): Promise<ResultadoDuelo> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  const estado = JSON.parse(abierta.fila.estado!) as EstadoDuelo
  return { ok: true, mesa: publicar(abierta.fila, estado, abierta.asiento.indice, ahora) }
}

/** Set your number for the other. */
export function ponerSecretoEnDuelo(codigo: string, secreto: string, numero: string, ahora = Date.now()) {
  return cambiar(codigo, secreto, ahora, (estado, asiento) => ponerSecreto(estado, asiento, numero, ahora))
}

/** One guess at the other's number. */
export function intentarEnDueloServidor(codigo: string, secreto: string, numero: string, ahora = Date.now()) {
  return cambiar(codigo, secreto, ahora, (estado, asiento) => intentarEnDuelo(estado, asiento, numero, ahora))
}

/** Leaving a duel on purpose: the one who stays wins. */
export async function retirarDeDuelo(partidaId: string, indice: number): Promise<void> {
  for (let vez = 0; vez < 6; vez++) {
    const fila = await prisma.partida.findUniqueOrThrow({ where: { id: partidaId } })
    const estado = retirarDelDuelo(JSON.parse(fila.estado!) as EstadoDuelo, indice)
    const [escrito] = await prisma.$transaction([
      prisma.partida.updateMany({
        where: { id: partidaId, estado: fila.estado },
        data: { estado: JSON.stringify(estado), fase: 'terminada' },
      }),
      prisma.asiento.updateMany({ where: { partidaId, indice }, data: { retirado: true } }),
    ])
    if (escrito.count > 0) return
  }
}
