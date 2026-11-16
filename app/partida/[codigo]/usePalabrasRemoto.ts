'use client'

/** Palabras on the shared race's remote hook (Phase 102). */

import type { VistaPalabras } from '@/lib/engine/palabras'
import { useCarreraRemota } from './useCarreraRemota'

export { mensajeDeCarrera } from './useCarreraRemota'

export function usePalabrasRemoto(opciones: { codigo: string; secreto: string }) {
  return useCarreraRemota<VistaPalabras>({ ...opciones, juego: 'palabras', campo: 'palabra' })
}
