'use client'

/**
 * The faces the comodines wear, offered to every card below.
 *
 * A context rather than a prop because a comodín can surface anywhere — the
 * hand, a grupo on the mesa, the descarte and its overlay — and every one of
 * those would otherwise have to thread a map it does not care about. Screens
 * that never provide it (/mesa, /pruebas) simply render the drawn ★ comodín,
 * which is also the fallback while an image loads or when the gallery is
 * empty.
 */

import { createContext, useContext } from 'react'

const CarasDeComodin = createContext<ReadonlyMap<string, string> | null>(null)

export const CarasDeComodinProvider = CarasDeComodin.Provider

/** The image this comodín wears, or null for the drawn design. */
export function useCaraDeComodin(cardId: string): string | null {
  return useContext(CarasDeComodin)?.get(cardId) ?? null
}
