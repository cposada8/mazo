'use client'

/**
 * Picking a card up and carrying it along the hand (Phases 63, 65 and 66).
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
 * its own bloque, in another one, or among the loose cards. Or it can be
 * taken **up to the lock** that appears over the hand while a card is up,
 * and dropped there to become a bloque of its own (Phase 66). The lock is
 * above the row, not in it: a place in the row would widen the hand, and a
 * hand that has fanned itself to fit cannot take the width.
 *
 * Where it will land is worked out against where the cards sat **when it was
 * picked up**, not where they are drawn now, so nothing on screen can move
 * the target out from under the finger.
 */

import { useEffect, useRef, useState } from 'react'
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
/** How high over the row the lock sits, in card heights. */
const ALTURA_DEL_CANDADO = 0.85
/** The lock's size, and how close counts as on it, in card heights. */
const TAMANO_DEL_CANDADO = 0.55
const ALCANCE_DEL_CANDADO = 0.6

const A_UN_BLOQUE_NUEVO: Destino = { nuevoBloqueAntesDe: null }

/**
 * A seam cards can land at, in the row's own coordinates (scroll included):
 * in front of each card that stays put, and after the last one of each run.
 */
type Costura = { x: number; destino: Destino }

/** The lock over the hand, in the viewport: its centre and its size. */
export type Candado = { x: number; y: number; tamano: number }

export type Arrastre = {
  /** The card under the finger. */
  cardId: string
  /** Every card being carried, in the order they sat. */
  llevadas: readonly string[]
  /** Where they would land. */
  destino: Destino
  /** Where the mark of a seam goes, in the row's coordinates. */
  marca: number | null
  /** Where the carried cards are drawn, in the viewport. */
  x: number
  y: number
  /** How far apart the carried cards are drawn: the fan's own step. */
  paso: number
  candado: Candado
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
  candado: Candado & { alcance: number }
  destino: Destino | null
}

export function useArrastre({
  fila,
  llevadasDe,
  onSoltar,
}: {
  /**
   * The scrolling row. Each card in it carries `data-arrastrable={id}` and
   * sits inside an element with `data-seccion`: one per bloque, and one for
   * the loose run.
   */
  fila: React.RefObject<HTMLElement | null>
  /** What picking up this card carries, in the order they sit. */
  llevadasDe: (cardId: string) => string[]
  onSoltar?: (cardId: string, destino: Destino) => void
}) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const gesto = useRef<Gesto | null>(null)
  const quitar = useRef<(() => void) | null>(null)

  // The latest of each, for listeners that outlive a render.
  const llevadasDeRef = useRef(llevadasDe)
  const onSoltarRef = useRef(onSoltar)
  useEffect(() => {
    llevadasDeRef.current = llevadasDe
    onSoltarRef.current = onSoltar
  })

  /** On the lock, or else the seam nearest the finger. */
  const apuntada = (
    g: Gesto,
    clientX: number,
    clientY: number,
  ): { destino: Destino; marca: number | null } | null => {
    const { candado } = g
    if (Math.hypot(clientX - candado.x, clientY - candado.y) <= candado.alcance) {
      return { destino: A_UN_BLOQUE_NUEVO, marca: null }
    }

    const el = fila.current
    if (!el || g.costuras.length === 0) return null
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft
    const costura = g.costuras.reduce((mejor, costura) =>
      Math.abs(costura.x - x) < Math.abs(mejor.x - x) ? costura : mejor,
    )
    return { destino: costura.destino, marca: costura.x }
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
    const x = (r: DOMRect) => r.left - caja.left + el.scrollLeft
    const llevadas = llevadasDeRef.current(g.cardId)
    const elegidas = new Set(llevadas)

    const secciones = Array.from(el.querySelectorAll<HTMLElement>('[data-seccion]')).map(
      (seccion) =>
        Array.from(seccion.querySelectorAll<HTMLElement>('[data-arrastrable]')).map(
          (carta) => ({ id: carta.dataset.arrastrable ?? '', r: carta.getBoundingClientRect() }),
        ),
    )
    const propia = secciones.flat().find((carta) => carta.id === g.cardId)
    if (!propia) return

    // In front of every card that stays, and after the last of each run.
    // A run the drag empties offers no seam: nothing would be left to say
    // where in it they went.
    g.costuras = secciones.flatMap((cartas) => {
      const quedan = cartas.filter((carta) => !elegidas.has(carta.id))
      const ultima = quedan.at(-1)
      if (!ultima) return []
      return [
        ...quedan.map((carta) => ({ x: x(carta.r), destino: { antesDe: carta.id } })),
        { x: x(ultima.r) + ultima.r.width, destino: { despuesDe: ultima.id } },
      ]
    })
    const vecinas = secciones.find((cartas) => cartas.length > 1)
    g.paso = vecinas ? vecinas[1].r.left - vecinas[0].r.left : propia.r.width
    g.llevadas = llevadas
    // Held where it was grabbed, and the rest of what it carries fanned
    // after it — so the card under the finger stays under the finger.
    g.agarre = {
      dx: g.x0 - propia.r.left + llevadas.indexOf(g.cardId) * g.paso,
      dy: g.y0 - propia.r.top,
    }

    // Straight up from the card that was picked up — a drag up is all it
    // asks — but never out past the ends of the row.
    const alto = propia.r.height
    const tamano = alto * TAMANO_DEL_CANDADO
    const centro = propia.r.left + propia.r.width / 2
    g.candado = {
      x: Math.min(Math.max(centro, caja.left + tamano), caja.right - tamano),
      y: caja.top - alto * ALTURA_DEL_CANDADO,
      tamano,
      alcance: alto * ALCANCE_DEL_CANDADO,
    }

    const inicial = apuntada(g, g.x0, g.y0)
    g.destino = inicial?.destino ?? A_UN_BLOQUE_NUEVO
    g.levantada = true

    // A small knock under the finger: it has been picked up.
    if (!g.raton) navigator.vibrate?.(8)
    setArrastre({
      cardId: g.cardId,
      llevadas,
      destino: g.destino,
      marca: inicial?.marca ?? null,
      x: g.x0 - g.agarre.dx,
      y: g.y0 - g.agarre.dy,
      paso: g.paso,
      candado: { x: g.candado.x, y: g.candado.y, tamano },
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
      costuras: [],
      llevadas: [],
      agarre: { dx: 0, dy: 0 },
      paso: 0,
      candado: { x: 0, y: 0, tamano: 0, alcance: 0 },
      destino: null,
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

      const objetivo = apuntada(g, e.clientX, e.clientY)
      if (objetivo) g.destino = objetivo.destino
      setArrastre((actual) =>
        actual && {
          ...actual,
          destino: objetivo?.destino ?? actual.destino,
          marca: objetivo ? objetivo.marca : actual.marca,
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
