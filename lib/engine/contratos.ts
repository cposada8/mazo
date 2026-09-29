/**
 * The contract catalog.
 *
 * Contracts are data, not code: a partida is a list of them and the engine
 * plays whatever list it is given. Adding one is adding a row here.
 *
 * Contracts 9–12 are the escaleras (Phase 48): not a count of tríos and
 * escalas but the thirteen rangos laid down whole, which wins the ronda.
 */

import { LARGO_DE_ESCALERA, type TipoDeEscalera } from './escalera'
import { ESCALA_MIN_SIZE, TRIO_MIN_SIZE } from './grupos'

export type Contrato = {
  readonly id: string
  readonly nombre: string
  readonly trios: number
  readonly escalas: number
  /**
   * An escalera contract (Phase 48): the whole hand, 2 through A, laid down
   * in one move to win. Its trios and escalas are both zero.
   */
  readonly escalera?: TipoDeEscalera
}

export const CATALOGO: readonly Contrato[] = [
  { id: 'c1', nombre: 'Dos tríos', trios: 2, escalas: 0 },
  { id: 'c2', nombre: 'Un trío y una escala', trios: 1, escalas: 1 },
  { id: 'c3', nombre: 'Dos escalas', trios: 0, escalas: 2 },
  { id: 'c4', nombre: 'Tres tríos', trios: 3, escalas: 0 },
  { id: 'c5', nombre: 'Dos tríos y una escala', trios: 2, escalas: 1 },
  { id: 'c6', nombre: 'Dos escalas y un trío', trios: 1, escalas: 2 },
  { id: 'c7', nombre: 'Tres escalas', trios: 0, escalas: 3 },
  { id: 'c8', nombre: 'Cuatro tríos', trios: 4, escalas: 0 },
  { id: 'c9', nombre: 'Escalera sucia', trios: 0, escalas: 0, escalera: 'sucia' },
  { id: 'c10', nombre: 'Escalera pintada', trios: 0, escalas: 0, escalera: 'pintada' },
  { id: 'c11', nombre: 'Escalera color', trios: 0, escalas: 0, escalera: 'color' },
  { id: 'c12', nombre: 'Escalera real', trios: 0, escalas: 0, escalera: 'real' },
]

/** Enabled unless the players say otherwise: the first seven. */
export const CONTRATOS_POR_DEFECTO: readonly string[] = CATALOGO.slice(0, 7).map(
  (contrato) => contrato.id,
)

export function contratoPorId(id: string): Contrato | undefined {
  return CATALOGO.find((contrato) => contrato.id === id)
}

/**
 * Fewest cards a contract can be laid down with.
 *
 * Contracts 7 and 8 come to 12, which is why bajarse and going out are the same
 * move in those rondas: the player holds 13 mid-turn and the thirteenth card is
 * the discard.
 */
export function cartasMinimas(contrato: Contrato): number {
  if (contrato.escalera) return LARGO_DE_ESCALERA
  return contrato.trios * TRIO_MIN_SIZE + contrato.escalas * ESCALA_MIN_SIZE
}
