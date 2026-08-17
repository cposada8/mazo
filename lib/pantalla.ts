'use client'

import { useSyncExternalStore } from 'react'

/**
 * The Fullscreen API, wrapped small.
 *
 * A phone lying down has no height to spare, and the browser's own bar takes a
 * fifth of it before the game gets any. Fullscreen gives that strip back — but
 * only when asked from a user gesture, so these helpers are called from
 * buttons and never on a timer.
 *
 * Not every browser offers it (iOS Safari does not, outside of video), so
 * support is a question with an answer, not an assumption.
 */

export function hayPantallaCompleta(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function'
  )
}

/** Enter or leave fullscreen. Failure is ignored: the game works either way. */
export function alternarPantallaCompleta(): void {
  if (!hayPantallaCompleta()) return
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {})
  } else {
    void document.documentElement.requestFullscreen().catch(() => {})
  }
}

/** Ask for fullscreen without leaving it if it is already on. */
export function pedirPantallaCompleta(): void {
  if (!hayPantallaCompleta() || document.fullscreenElement) return
  void document.documentElement.requestFullscreen().catch(() => {})
}

const suscribir = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

/** Whether the page is fullscreen right now. False on the server, always. */
export function usePantallaCompleta(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => Boolean(document.fullscreenElement),
    () => false,
  )
}
