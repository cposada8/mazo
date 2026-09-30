'use client'

/**
 * Picking a card up and carrying it along the hand (Phase 63).
 *
 * The state it writes is small — one card lands in front of another — so
 * this is all gesture. Three things share the same finger on the same row,
 * and each has to keep working:
 *
 * - **A tap selects.** A press that is let go without travelling is a tap,
 *   even a slow one, and the click goes through.
 * - **A swipe scrolls.** The row scrolls sideways when the hand is wider than
 *   the screen. So a finger only picks a card up after it has **held still**
 *   for a moment; one that moves first is scrolling, and is left to it. A
 *   mouse has a scrollbar and a wheel for that, and picks up on moving.
 * - **A drag carries.** Once held, the row stops scrolling under the finger
 *   and the card follows it until it is let go.
 *
 * Where it will land is worked out against where the cards sat **when it was
 * picked up**, not where they are drawn now, so nothing on screen can move
 * the target out from under the finger.
 */

import { useEffect, useRef, useState } from 'react'

/** How long a finger holds a card still before it lifts. */
export const MS_PARA_LEVANTAR = 250
/** How far a finger may wander while holding and still be holding. */
const TOLERANCIA_DEDO = 8
/** How far a mouse moves before a press becomes a drag. */
const TOLERANCIA_RATON = 5
/** Close to an edge of the row, the row scrolls along with the drag. */
const BORDE_QUE_DESPLAZA = 28
const PASO_DE_DESPLAZAMIENTO = 12

/** Where a loose card sat, in the row's own coordinates (scroll included). */
type Puesto = {
  id: string
  /** Left edge of the card. */
  inicio: number
  /** Where the next card covers it: the end of the slice you can see. */
  fin: number
  ancho: number
}

export type Arrastre = {
  /** The card under the finger. */
  cardId: string
  /** Every card being carried, in the order they sat. */
  llevadas: readonly string[]
  /** The card they would land in front of; null is the end of the run. */
  antesDe: string | null
  /** Where the mark of the landing goes, in the row's coordinates. */
  marca: number
  /** Where the carried cards are drawn, in the viewport. */
  x: number
  y: number
  /** How far apart the carried cards are drawn: the fan's own step. */
  paso: number
}

type Gesto = {
  cardId: string
  pointerId: number
  raton: boolean
  x0: number
  y0: number
  reloj: ReturnType<typeof setTimeout> | null
  levantada: boolean
  movida: boolean
  puestos: Puesto[]
  llevadas: string[]
  agarre: { dx: number; dy: number }
  paso: number
  antesDe: string | null
}

export function useArrastre({
  fila,
  llevadasDe,
  onSoltar,
}: {
  /** The scrolling row. Loose cards inside it carry `data-suelta={id}`. */
  fila: React.RefObject<HTMLElement | null>
  /** What picking up this card carries, in the order they sit. */
  llevadasDe: (cardId: string) => string[]
  onSoltar?: (cardId: string, antesDe: string | null) => void
}) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const gesto = useRef<Gesto | null>(null)
  /** A drag ends in a click on the card it started on; that click is not a tap. */
  const tragarHasta = useRef(0)
  const quitar = useRef<(() => void) | null>(null)

  // The latest of each, for listeners that outlive a render.
  const llevadasDeRef = useRef(llevadasDe)
  const onSoltarRef = useRef(onSoltar)
  useEffect(() => {
    llevadasDeRef.current = llevadasDe
    onSoltarRef.current = onSoltar
  })

  const destino = (g: Gesto, clientX: number): { antesDe: string | null; marca: number } => {
    const el = fila.current
    if (!el) return { antesDe: g.antesDe, marca: 0 }
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft

    const resto = g.puestos.filter((p) => !g.llevadas.includes(p.id))
    for (const puesto of resto) {
      if (x < (puesto.inicio + puesto.fin) / 2) {
        return { antesDe: puesto.id, marca: puesto.inicio }
      }
    }
    const ultimo = resto.at(-1)
    return { antesDe: null, marca: ultimo ? ultimo.inicio + ultimo.ancho : 0 }
  }

  const terminar = () => {
    const g = gesto.current
    if (g?.reloj) clearTimeout(g.reloj)
    gesto.current = null
    quitar.current?.()
    quitar.current = null
    setArrastre(null)
  }

  const levantar = () => {
    const g = gesto.current
    const el = fila.current
    if (!g || !el || g.levantada) return
    g.reloj = null

    const caja = el.getBoundingClientRect()
    const cartas = Array.from(el.querySelectorAll<HTMLElement>('[data-suelta]')).map(
      (carta) => ({ id: carta.dataset.suelta ?? '', r: carta.getBoundingClientRect() }),
    )
    const propia = cartas.find((carta) => carta.id === g.cardId)
    if (!propia) return

    const x = (r: DOMRect) => r.left - caja.left + el.scrollLeft
    g.puestos = cartas.map((carta, i) => ({
      id: carta.id,
      inicio: x(carta.r),
      fin: i + 1 < cartas.length ? x(cartas[i + 1].r) : x(carta.r) + carta.r.width,
      ancho: carta.r.width,
    }))
    g.paso =
      cartas.length > 1 ? cartas[1].r.left - cartas[0].r.left : propia.r.width
    g.llevadas = llevadasDeRef.current(g.cardId)
    // Held where it was grabbed, and the rest of what it carries fanned
    // after it — so the card under the finger stays under the finger.
    g.agarre = {
      dx: g.x0 - propia.r.left + g.llevadas.indexOf(g.cardId) * g.paso,
      dy: g.y0 - propia.r.top,
    }
    g.levantada = true

    const { antesDe, marca } = destino(g, g.x0)
    g.antesDe = antesDe
    // A small knock under the finger: it has been picked up.
    if (!g.raton) navigator.vibrate?.(8)
    setArrastre({
      cardId: g.cardId,
      llevadas: g.llevadas,
      antesDe,
      marca,
      x: g.x0 - g.agarre.dx,
      y: g.y0 - g.agarre.dy,
      paso: g.paso,
    })
  }

  const empezar = (evento: React.PointerEvent<HTMLElement>, cardId: string) => {
    if (!onSoltarRef.current || gesto.current) return
    const raton = evento.pointerType === 'mouse'
    if (raton && evento.button !== 0) return

    const g: Gesto = {
      cardId,
      pointerId: evento.pointerId,
      raton,
      x0: evento.clientX,
      y0: evento.clientY,
      reloj: null,
      levantada: false,
      movida: false,
      puestos: [],
      llevadas: [],
      agarre: { dx: 0, dy: 0 },
      paso: 0,
      antesDe: null,
    }
    gesto.current = g
    if (!raton) g.reloj = setTimeout(levantar, MS_PARA_LEVANTAR)

    const alMover = (e: PointerEvent) => {
      if (e.pointerId !== g.pointerId || gesto.current !== g) return
      const recorrido = Math.hypot(e.clientX - g.x0, e.clientY - g.y0)
      const tolerancia = g.raton ? TOLERANCIA_RATON : TOLERANCIA_DEDO

      if (!g.levantada) {
        if (recorrido <= tolerancia) return
        // A finger that moves before it has held still is scrolling.
        if (!g.raton) return terminar()
        levantar()
        if (!g.levantada) return terminar()
      }

      if (recorrido > tolerancia) g.movida = true

      const el = fila.current
      if (el) {
        const caja = el.getBoundingClientRect()
        if (e.clientX < caja.left + BORDE_QUE_DESPLAZA) el.scrollLeft -= PASO_DE_DESPLAZAMIENTO
        else if (e.clientX > caja.right - BORDE_QUE_DESPLAZA) el.scrollLeft += PASO_DE_DESPLAZAMIENTO
      }

      const { antesDe, marca } = destino(g, e.clientX)
      g.antesDe = antesDe
      setArrastre((actual) =>
        actual && {
          ...actual,
          antesDe,
          marca,
          x: e.clientX - g.agarre.dx,
          y: e.clientY - g.agarre.dy,
        },
      )
    }

    const alSoltar = (e: PointerEvent) => {
      if (e.pointerId !== g.pointerId || gesto.current !== g) return
      if (g.levantada && g.movida) {
        tragarHasta.current = performance.now() + 500
        onSoltarRef.current?.(g.cardId, g.antesDe)
      }
      terminar()
    }

    const alCancelar = (e: PointerEvent) => {
      if (e.pointerId === g.pointerId) terminar()
    }

    window.addEventListener('pointermove', alMover)
    window.addEventListener('pointerup', alSoltar)
    window.addEventListener('pointercancel', alCancelar)
    quitar.current = () => {
      window.removeEventListener('pointermove', alMover)
      window.removeEventListener('pointerup', alSoltar)
      window.removeEventListener('pointercancel', alCancelar)
    }
  }

  // Once a card is up, the row must not scroll under the finger. Only a
  // listener that is not passive may say so, and React's are.
  useEffect(() => {
    const el = fila.current
    if (!el) return
    const quieto = (e: TouchEvent) => {
      if (gesto.current?.levantada && e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchmove', quieto, { passive: false })
    return () => el.removeEventListener('touchmove', quieto)
  }, [fila])

  // Unmounted mid-drag: nothing may keep listening.
  useEffect(
    () => () => {
      const g = gesto.current
      if (g?.reloj) clearTimeout(g.reloj)
      quitar.current?.()
    },
    [],
  )

  /** True for the click that closes a drag, which must not select anything. */
  const tragarClick = () => performance.now() < tragarHasta.current

  return { arrastre, empezar, tragarClick }
}
