/**
 * The rebarajada limit in words (Phase 74), for the lobby, its summary and
 * the partida's menu — one place, so the three never disagree.
 */

import type { LimiteDeRebarajadas } from '@/lib/engine'

/** Short: what a button or a summary line says. */
export function textoDeRebarajadas(limite: LimiteDeRebarajadas): string {
  if (limite === 'sinLimite') return 'el mazo se revuelve sin límite'
  if (limite === 0) return 'el mazo no se revuelve'
  return limite === 1 ? 'el mazo se revuelve 1 vez' : `el mazo se revuelve ${limite} veces`
}

/** Long: what the lobby explains under the choice. */
export function detalleDeRebarajadas(limite: LimiteDeRebarajadas): string {
  if (limite === 'sinLimite') {
    return 'Cuando el mazo se acaba, el descarte se revuelve siempre. Una ronda que nadie puede ganar no termina sola: hay que abandonar.'
  }
  if (limite === 0) {
    return 'La primera vez que se acaba el mazo, la ronda queda en tablas.'
  }
  const veces = limite === 1 ? 'una vez' : `${limite} veces`
  return `Cuando el mazo se acaba, el descarte se revuelve ${veces}. La siguiente vez, la ronda queda en tablas.`
}
