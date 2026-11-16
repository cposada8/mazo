/**
 * Palabras on the server (Phase 86): the referee of the race — since Phase
 * 99 the shared one (`./carrera.ts`), run with Palabras' engine and view.
 * The names the routes and tests have always used are kept.
 */

import {
  type Color,
  type Intento,
  type VistaPalabras,
  intentar,
  vistaPalabras,
} from '@/lib/engine/palabras'
import { type MesaCarrera, type ResultadoDeCarrera, arbitroDeCarrera } from './carrera'

export { retirarDeCarrera, type ErrorDeCarrera } from './carrera'

export type MesaPalabras = MesaCarrera<VistaPalabras>
export type ResultadoCarrera = ResultadoDeCarrera<VistaPalabras>

const arbitro = arbitroDeCarrera<Intento, VistaPalabras>({
  id: 'palabras',
  intentar,
  vista: vistaPalabras,
})

/** Read the race — and, being a request, mark it over if it has closed. */
export const leerCarrera = arbitro.leer
/** One try. Refused tries cost nothing and change nothing. */
export const intentarEnCarrera = arbitro.intentar
/** The host ends the race: everybody's standing is final as it is. */
export const cerrarCarrera = arbitro.cerrar

export type { Color }
