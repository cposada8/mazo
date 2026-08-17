/**
 * The contract catalog.
 *
 * Contracts are data, not code: a partida is a list of them and the engine
 * plays whatever list it is given. Adding one is adding a row here.
 *
 * The escalera contracts (9 and beyond) are deliberately absent — see the
 * Pending section of specs/carioca-rules.md.
 */

import { ESCALA_MIN_SIZE, TRIO_MIN_SIZE } from './grupos'

export type Contrato = {
  readonly id: string
  readonly nombre: string
  readonly trios: number
  readonly escalas: number
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
  return contrato.trios * TRIO_MIN_SIZE + contrato.escalas * ESCALA_MIN_SIZE
}
