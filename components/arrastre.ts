'use client'

/**
 * Picking a card up and carrying it along the hand (Phases 63 and 65).
 *
 * The state it writes is small — cards land at a seam — so this is all
 * gesture. Three things share the same finger on the same row, and each has
 * to keep working:
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
 * Any card can be carried, pinned or loose, and dropped at any seam: inside
 * its own bloque, in another one, or among the loose cards — or into one of
 * the empty places that open between the runs while a card is up, which
 * makes a bloque of its own (Phase 66).
 *
 * Where it will land is worked out against where everything sat **once the
 * card was up** and those places had opened — measured once, not while
 * dragging, so nothing on screen can move the target out from under the
 * finger.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Destino } from '@/lib/mano'

/** How long a finger holds a card still before it lifts. */
export const MS_PARA_LEVANTAR = 250
/** How far a finger may wander while holding and still be holding. */
const TOLERANCIA_DEDO = 8
/** How far a mouse moves before a press becomes a drag. */
const TOLERANCIA_RATON = 5
/** Close to an edge of the row, the row scrolls along with the drag. */
const BORDE_QUE_DESPLAZA = 28
const PASO_DE_DESPLAZAMIENTO = 12

/**
 * A seam cards can land at, in the row's own coordinates (scroll included):
 * in front of each card that stays put, and after the last one of each run.
 */
type Costura = { x: number; destino: Destino }

export type Arrastre = {
  /** The card under the finger. */
  cardId: string
  /** Every card being carried, in the order they sat. */
  llevadas: readonly string[]
  /** Where they would land; null until the row has been measured. */
  destino: Destino | null
  /** Where the mark of the landing goes, in the row's coordinates. */
  marca: number | null
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
  costuras: Costura[]
  llevadas: string[]
  agarre: { dx: number; dy: number }
  paso: number
  destino: Destino | null
  /** The finger's last position across the row, for the first measure. */
  ultimaX: number
}

export function useArrastre({
  fila,
  llevadasDe,
  onSoltar,
}: {
  /**
   * The scrolling row. Each card in it carries `data-arrastrable={id}` and
   * sits inside an element with `data-seccion`: one per bloque, and one for
   * the loose run. While a card is up, the places for a new bloque carry
   * `data-nuevo` — the first card of the bloque they sit in front of, or
   * empty for after them all.
   */
  fila: React.RefObject<HTMLElement | null>
  /** What picking up this card carries, in the order they sit. */
  llevadasDe: (cardId: string) => string[]
  onSoltar?: (cardId: string, destino: Destino) => void
}) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  /** Counts pick-ups: each one asks for the row to be measured once. */
  const [levantadas, setLevantadas] = useState(0)
  const gesto = useRef<Gesto | null>(null)
  const quitar = useRef<(() => void) | null>(null)

  // The latest of each, for listeners that outlive a render.
  const llevadasDeRef = useRef(llevadasDe)
  const onSoltarRef = useRef(onSoltar)
  useEffect(() => {
    llevadasDeRef.current = llevadasDe
    onSoltarRef.current = onSoltar
  })

  /** The seam nearest the finger. */
  const cercana = (g: Gesto, clientX: number): Costura | null => {
    const el = fila.current
    if (!el || g.costuras.length === 0) return null
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft
    return g.costuras.reduce((mejor, costura) =>
      Math.abs(costura.x - x) < Math.abs(mejor.x - x) ? costura : mejor,
    )
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

    const llevadas = llevadasDeRef.current(g.cardId)
    const secciones = Array.from(el.querySelectorAll<HTMLElement>('[data-seccion]')).map(
      (seccion) =>
        Array.from(seccion.querySelectorAll<HTMLElement>('[data-arrastrable]')).map(
          (carta) => ({ id: carta.dataset.arrastrable ?? '', r: carta.getBoundingClientRect() }),
        ),
    )
    const propia = secciones.flat().find((carta) => carta.id === g.cardId)
    if (!propia) return

    const vecinas = secciones.find((cartas) => cartas.length > 1)
    g.paso = vecinas ? vecinas[1].r.left - vecinas[0].r.left : propia.r.width
    g.llevadas = llevadas
    // Held where it was grabbed, and the rest of what it carries fanned
    // after it — so the card under the finger stays under the finger.
    g.agarre = {
      dx: g.x0 - propia.r.left + llevadas.indexOf(g.cardId) * g.paso,
      dy: g.y0 - propia.r.top,
    }
    g.levantada = true
    g.ultimaX = g.x0

    // A small knock under the finger: it has been picked up.
    if (!g.raton) navigator.vibrate?.(8)
    setArrastre({
      cardId: g.cardId,
      llevadas,
      destino: null,
      marca: null,
      x: g.x0 - g.agarre.dx,
      y: g.y0 - g.agarre.dy,
      paso: g.paso,
    })
    setLevantadas((n) => n + 1)
  }

  /**
   * The seams, measured once the card is up and the places for a new bloque
   * have opened: in front of every card that stays and after the last of each
   * run — a run the drag empties offers none, nothing would be left to say
   * where in it they went — and the middle of each new place.
   */
  useLayoutEffect(() => {
    const g = gesto.current
    const el = fila.current
    if (!g?.levantada || !el) return

    const caja = el.getBoundingClientRect()
    const x = (r: DOMRect) => r.left - caja.left + el.scrollLeft
    const elegidas = new Set(g.llevadas)

    const enCartas = Array.from(el.querySelectorAll<HTMLElement>('[data-seccion]')).flatMap(
      (seccion) => {
        const quedan = Array.from(
          seccion.querySelectorAll<HTMLElement>('[data-arrastrable]'),
        ).filter((carta) => !elegidas.has(carta.dataset.arrastrable ?? ''))
        const ultima = quedan.at(-1)
        if (!ultima) return []
        const r = ultima.getBoundingClientRect()
        return [
          ...quedan.map((carta) => ({
            x: x(carta.getBoundingClientRect()),
            destino: { antesDe: carta.dataset.arrastrable ?? '' },
          })),
          { x: x(r) + r.width, destino: { despuesDe: ultima.dataset.arrastrable ?? '' } },
        ]
      },
    )
    const enNuevos = Array.from(el.querySelectorAll<HTMLElement>('[data-nuevo]')).map(
      (lugar) => {
        const r = lugar.getBoundingClientRect()
        return {
          x: x(r) + r.width / 2,
          destino: { nuevoBloqueAntesDe: lugar.dataset.nuevo || null },
        }
      },
    )
    g.costuras = [...enCartas, ...enNuevos]

    const costura = cercana(g, g.ultimaX)
    if (!costura) return
    g.destino = costura.destino
    setArrastre((actual) => actual && { ...actual, destino: costura.destino, marca: costura.x })
    // Measured on each pick-up, and only then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levantadas])

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
      costuras: [],
      llevadas: [],
      agarre: { dx: 0, dy: 0 },
      paso: 0,
      destino: null,
      ultimaX: evento.clientX,
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
      g.ultimaX = e.clientX

      const el = fila.current
      if (el) {
        const caja = el.getBoundingClientRect()
        if (e.clientX < caja.left + BORDE_QUE_DESPLAZA) el.scrollLeft -= PASO_DE_DESPLAZAMIENTO
        else if (e.clientX > caja.right - BORDE_QUE_DESPLAZA) el.scrollLeft += PASO_DE_DESPLAZAMIENTO
      }

      const costura = cercana(g, e.clientX)
      if (costura) g.destino = costura.destino
      setArrastre((actual) =>
        actual && {
          ...actual,
          destino: costura?.destino ?? actual.destino,
          marca: costura?.x ?? actual.marca,
          x: e.clientX - g.agarre.dx,
          y: e.clientY - g.agarre.dy,
        },
      )
    }

    const alSoltar = (e: PointerEvent) => {
      if (e.pointerId !== g.pointerId || gesto.current !== g) return
      if (g.levantada && g.movida && g.destino) {
        tragarClick()
        onSoltarRef.current?.(g.cardId, g.destino)
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

  return { arrastre, empezar }
}

/**
 * A drag ends in a click, and it is not a tap: not on the card, which would
 * select it, nor on the felt, which would let go of the selection just
 * carried. Which element that click lands on differs between browsers, so
 * it is caught before any of them sees it.
 */
function tragarClick() {
  const tragar = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', tragar, { capture: true, once: true })
  // A release that makes no click must not leave the next real tap eaten.
  setTimeout(() => window.removeEventListener('click', tragar, { capture: true }), 100)
}
