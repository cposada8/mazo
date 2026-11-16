/**
 * What one player may see of a Punto y Fama race (Phase 100): the shared
 * race's view, a try's public half being its answer — puntos and famas,
 * never the digits guessed.
 */

import { type VistaCarrera, type VistaDeRivalEn, vistaCarrera } from '../comun/vista-carrera'
import type { Respuesta } from './numeros'
import type { EstadoPuntoYFama, IntentoPF } from './partida'

export type VistaDeRivalPF = VistaDeRivalEn<IntentoPF, Respuesta>
export type VistaPuntoYFama = VistaCarrera<IntentoPF, Respuesta>

export function vistaPuntoYFama(
  estado: EstadoPuntoYFama,
  asiento: number,
  ahora: number,
): VistaPuntoYFama {
  return vistaCarrera(estado, asiento, ahora, ({ puntos, famas }) => ({ puntos, famas }))
}
