/**
 * Palabras on the server (Phase 86): the referee of the race.
 *
 * The server holds the bag and scores every try; a phone receives only its
 * own colours, the words it has ended, and of each rival the colours without
 * the letters (`vistaPalabras`). There are no bots and no turns, so nothing
 * comes due between requests except the race closing — which the next read
 * notices and writes down.
 *
 * Every write is a compare-and-swap on the stored state, as el Mentiroso's
 * are: eight people typing at once compute their tries from the same state,
 * one lands, the others re-read and apply theirs on top.
 */

import {
  type EstadoPalabras,
  type VistaPalabras,
  cerrada,
  cerrar,
  intentar,
  retirarJugador,
  vistaPalabras,
} from '@/lib/engine/palabras'
import { limpiarCodigo } from '@/lib/codigo'
import { prisma } from './db'

export type MesaPalabras = {
  readonly vista: VistaPalabras
  /** The server's clock when this was read: the board's clock is offset by it. */
  readonly ahora: number
  readonly asientos: readonly { indice: number; alias: string; esHost: boolean }[]
}

export type ErrorDeCarrera =
  | 'NO_EXISTE'
  | 'OTRO_JUEGO'
  | 'NO_REPARTIDA'
  | 'NO_ES_TU_ASIENTO'
  | 'NO_ERES_EL_HOST'
  | 'OCUPADA'
  | 'NO_JUEGAS'
  | 'NO_EMPEZO'
  | 'YA_TERMINASTE'
  | 'CERRADA'
  | 'LARGO'
  | 'NO_ES_PALABRA'

export type ResultadoCarrera =
  | { readonly ok: true; readonly mesa: MesaPalabras }
  | { readonly ok: false; readonly code: ErrorDeCarrera }

type Fila = NonNullable<Awaited<ReturnType<typeof cargar>>>

function cargar(codigo: string) {
  return prisma.partida.findUnique({
    where: { codigo: limpiarCodigo(codigo) },
    include: { asientos: true },
  })
}

async function abrir(codigo: string, secreto: string) {
  const fila = await cargar(codigo)
  if (!fila) return { ok: false as const, code: 'NO_EXISTE' as const }
  if (fila.juego !== 'palabras') return { ok: false as const, code: 'OTRO_JUEGO' as const }
  if (!fila.estado) return { ok: false as const, code: 'NO_REPARTIDA' as const }
  const asiento = fila.asientos.find((a) => a.secreto === secreto)
  if (!asiento) return { ok: false as const, code: 'NO_ES_TU_ASIENTO' as const }
  return { ok: true as const, fila, asiento }
}

function publicar(fila: Fila, estado: EstadoPalabras, asiento: number, ahora: number): MesaPalabras {
  return {
    vista: vistaPalabras(estado, asiento, ahora),
    ahora,
    asientos: [...fila.asientos]
      .sort((a, b) => a.indice - b.indice)
      .map(({ indice, alias, esHost }) => ({ indice, alias, esHost })),
  }
}

/** Write only if the stored state is still the one this was computed from. */
async function escribir(fila: Fila, estado: EstadoPalabras, ahora: number): Promise<boolean> {
  const escrito = await prisma.partida.updateMany({
    where: { id: fila.id, estado: fila.estado },
    data: {
      estado: JSON.stringify(estado),
      fase: cerrada(estado, ahora) ? 'terminada' : 'jugando',
    },
  })
  return escrito.count > 0
}

/** Read the race — and, being a request, mark it over if it has closed. */
export async function leerCarrera(
  codigo: string,
  secreto: string,
  ahora = Date.now(),
): Promise<ResultadoCarrera> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  const { fila, asiento } = abierta
  const estado = JSON.parse(fila.estado!) as EstadoPalabras
  if (fila.fase === 'jugando' && cerrada(estado, ahora)) {
    await prisma.partida.updateMany({
      where: { id: fila.id, fase: 'jugando' },
      data: { fase: 'terminada' },
    })
  }
  if (!asiento.retirado) await senalar(fila.id, asiento.indice, asiento.ultimaSenal, ahora)
  return { ok: true, mesa: publicar(fila, estado, asiento.indice, ahora) }
}

/** One try. Refused tries cost nothing and change nothing. */
export async function intentarEnCarrera(
  codigo: string,
  secreto: string,
  palabra: string,
  ahora = Date.now(),
): Promise<ResultadoCarrera> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  const { asiento } = abierta
  let fila = abierta.fila

  for (let intento = 0; intento < 6; intento++) {
    const estado = JSON.parse(fila.estado!) as EstadoPalabras
    const resultado = intentar(estado, asiento.indice, palabra, ahora)
    if (!resultado.ok) return resultado
    if (await escribir(fila, resultado.estado, ahora)) {
      return { ok: true, mesa: publicar(fila, resultado.estado, asiento.indice, ahora) }
    }
    fila = (await cargar(codigo))!
  }
  return { ok: false, code: 'OCUPADA' }
}

/** The host ends the race: everybody's standing is final as it is. */
export async function cerrarCarrera(
  codigo: string,
  secreto: string,
  ahora = Date.now(),
): Promise<ResultadoCarrera> {
  const abierta = await abrir(codigo, secreto)
  if (!abierta.ok) return abierta
  if (!abierta.asiento.esHost) return { ok: false, code: 'NO_ERES_EL_HOST' }
  let fila = abierta.fila
  for (let intento = 0; intento < 6; intento++) {
    const estado = cerrar(JSON.parse(fila.estado!) as EstadoPalabras, ahora)
    if (await escribir(fila, estado, ahora)) {
      return { ok: true, mesa: publicar(fila, estado, abierta.asiento.indice, ahora) }
    }
    fila = (await cargar(codigo))!
  }
  return { ok: false, code: 'OCUPADA' }
}

/** Leaving on purpose: ranked with what they finished, waited for by nobody. */
export async function retirarDeCarrera(partidaId: string, indice: number): Promise<void> {
  for (let intento = 0; intento < 6; intento++) {
    const fila = await prisma.partida.findUniqueOrThrow({ where: { id: partidaId } })
    const estado = retirarJugador(JSON.parse(fila.estado!) as EstadoPalabras, indice)
    const ahora = Date.now()
    const [escrito] = await prisma.$transaction([
      prisma.partida.updateMany({
        where: { id: partidaId, estado: fila.estado },
        data: {
          estado: JSON.stringify(estado),
          fase: cerrada(estado, ahora) ? 'terminada' : 'jugando',
        },
      }),
      prisma.asiento.updateMany({
        where: { partidaId, indice },
        data: { retirado: true },
      }),
    ])
    if (escrito.count > 0) return
  }
}

/** Presence, written at most twice a minute — the panel asks in minutes. */
async function senalar(partidaId: string, indice: number, ultima: Date | null, ahora: number) {
  if (ultima && ahora - ultima.getTime() < 30_000) return
  await prisma.asiento.updateMany({
    where: { partidaId, indice },
    data: { ultimaSenal: new Date(ahora) },
  })
}
