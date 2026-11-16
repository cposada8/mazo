/**
 * What one player may see of the race (Phase 83).
 *
 * Their own board in full, the words they have ended — and of every rival
 * only *how far* and *which colours*: never a letter, never a word. A word
 * nobody has shown this player yet is not in here in any form. Since Phase
 * 99 it is the shared race's view (`../comun/vista-carrera.ts`), with a
 * try's public half being its colours.
 */

import { type VistaCarrera, type VistaDeRivalEn, vistaCarrera } from '../comun/vista-carrera'
import type { Color, EstadoPalabras, Intento } from './partida'

export type VistaDeRival = VistaDeRivalEn<Intento, readonly Color[]>
export type VistaPalabras = VistaCarrera<Intento, readonly Color[]>

export function vistaPalabras(
  estado: EstadoPalabras,
  asiento: number,
  ahora: number,
): VistaPalabras {
  return vistaCarrera(estado, asiento, ahora, (intento) => intento.colores)
}
