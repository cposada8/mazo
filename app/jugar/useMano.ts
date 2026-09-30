'use client'

/**
 * Holding your cards — the half of playing that is the same wherever the
 * partida lives (Phase 34).
 *
 * Arranging, pinning, selecting and setting grupos aside are decisions about
 * *your own hand* and nothing else. They need no engine, no server and no
 * network: they work off the seat's view, which both homes hand over in the
 * identical shape. Extracted so the local table and the server table cannot
 * grow two different ideas of what a selected card is.
 *
 * What is *not* here is anything that changes the game: proposing a move
 * belongs to the controller that knows who referees it.
 */

import { useCallback, useMemo, useState } from 'react'
import { armarGrupo } from '@/lib/bots'
import {
  type Acomodo,
  type Bloque,
  type Destino,
  acomodar,
  aplanar,
  bloquear,
  distribuir,
  llevar,
  moverSeleccion,
  soltarBloque,
} from '@/lib/mano'
import {
  type Card,
  type Propuesta,
  type VistaDeAsiento,
  puntosDeMano,
  tamanoEstricto,
} from '@/lib/engine'

export function useMano(options: {
  vista: VistaDeAsiento | null
  /** Changes when a new reparto is dealt, which resets the arrangement. */
  reparto: number
  onAviso: (aviso: string | null) => void
}) {
  const { vista, reparto, onAviso } = options

  const [seleccion, setSeleccion] = useState<readonly string[]>([])
  const [propuestas, setPropuestas] = useState<readonly Propuesta[]>([])
  /** How you have arranged the loose cards. Untouched ones keep dealing order. */
  const [orden, setOrden] = useState<readonly string[]>([])
  /** Cards you have pinned together so sorting leaves them alone. */
  const [bloques, setBloques] = useState<readonly Bloque[]>([])
  /**
   * The sort that is currently latched, if any. While it is down, the loose
   * cards re-sort themselves on every change — the card you draw files itself
   * into place. It is a preference, not an arrangement, so unlike `orden` and
   * `bloques` it survives a new reparto: the next hand arrives already sorted.
   */
  const [acomodoActivo, setAcomodoActivo] = useState<Acomodo | null>(null)

  /**
   * A new reparto starts with nothing arranged and nothing pinned.
   *
   * Not merely tidy: card ids repeat from one deal to the next — `7-s#0` is the
   * same string in every ronda — so a bloque left over from the last hand
   * silently pins cards it was never made from, and the player is handed a hand
   * that arrived pre-locked.
   */
  const [repartoVisto, setRepartoVisto] = useState(reparto)
  if (repartoVisto !== reparto) {
    setRepartoVisto(reparto)
    setOrden([])
    setBloques([])
    setSeleccion([])
    setPropuestas([])
  }

  /**
   * Grupos set aside are only meaningful while every one of their cards is
   * still in hand. Deriving that here means a ronda ending, or a card leaving
   * some other way, cannot leave a stale grupo sitting on screen.
   */
  const propuestasVigentes = useMemo(() => {
    const ids = new Set((vista?.mano ?? []).map((card) => card.id))
    return propuestas.filter((p) => p.cardIds.every((id) => ids.has(id)))
  }, [vista, propuestas])

  /** Your hand laid out: pinned bloques first, then the loose cards. */
  const secciones = useMemo(() => {
    if (!vista) return []
    if (!acomodoActivo) return distribuir(vista.mano, orden, bloques)

    // Latched: the order is computed, not remembered.
    const fijadas = new Set(bloques.flat())
    const sueltas = vista.mano.filter((card) => !fijadas.has(card.id))
    const ordenadas = acomodar(sueltas, acomodoActivo).map((card) => card.id)
    return distribuir(vista.mano, ordenadas, bloques)
  }, [vista, orden, bloques, acomodoActivo])

  const mano = useMemo<Card[]>(() => aplanar(secciones), [secciones])

  /** What the hand would cost if the ronda ended now. Low is good. */
  const puntos = useMemo(() => puntosDeMano(mano), [mano])

  /** The layout minus whatever is set aside for a bajada, empty runs dropped. */
  const seccionesDisponibles = useMemo(() => {
    const apartadas = new Set(propuestasVigentes.flatMap((p) => p.cardIds))
    if (apartadas.size === 0) return secciones

    return secciones
      .map((seccion) => ({
        ...seccion,
        cards: seccion.cards.filter((card) => !apartadas.has(card.id)),
      }))
      .filter((seccion) => seccion.cards.length > 0)
  }, [secciones, propuestasVigentes])

  /** Cards still in hand and not already set aside for a grupo, in your order. */
  const disponibles = useMemo<Card[]>(
    () => aplanar(seccionesDisponibles),
    [seccionesDisponibles],
  )

  const seleccionadas = useMemo(
    () => disponibles.filter((card) => seleccion.includes(card.id)),
    [disponibles, seleccion],
  )

  /**
   * Latch or release a sort. Pinned bloques are exactly the cards you have
   * said you want left alone, so neither state ever touches them.
   *
   * Releasing freezes the hand exactly as it lies — the sorted order is
   * written into `orden`, so nothing moves — and newly drawn cards go back to
   * arriving at the end, where they are easy to notice.
   */
  const acomodarMano = useCallback(
    (como: Acomodo) => {
      if (acomodoActivo === como) {
        const sueltas = secciones.find((seccion) => !seccion.bloqueada)?.cards ?? []
        setOrden(sueltas.map((card) => card.id))
        setAcomodoActivo(null)
        return
      }
      setAcomodoActivo(como)
    },
    [acomodoActivo, secciones],
  )

  const fijarSeleccion = useCallback(() => {
    if (seleccion.length === 0) {
      onAviso('Escoge las cartas que quieres dejar fijas.')
      return
    }
    // Pin them in the order they are sitting in, not the order they were tapped.
    const enOrden = mano
      .filter((card) => seleccion.includes(card.id))
      .map((card) => card.id)
    setBloques((actual) => bloquear(actual, enOrden))
    setSeleccion([])
    onAviso(null)
  }, [mano, seleccion, onAviso])

  const soltar = useCallback(
    (indice: number) => setBloques((actual) => soltarBloque(actual, indice)),
    [],
  )

  /**
   * Slide everything currently selected one place, gathering it into a block.
   *
   * Always works from the hand **as displayed**, never from the stored order:
   * the stored order does not know about the card just drawn, and moving from
   * a stale order silently did nothing to it.
   */
  const moverCartas = useCallback(
    (hacia: 'izquierda' | 'derecha') => {
      const sueltas = secciones.find((seccion) => !seccion.bloqueada)?.cards ?? []
      setOrden(
        moverSeleccion(
          sueltas.map((card) => card.id),
          seleccion,
          hacia,
        ),
      )
      // Moving cards by hand is a claim about where they go; a latched sort
      // would put them right back, so the move releases it.
      setAcomodoActivo(null)
    },
    [secciones, seleccion],
  )

  /**
   * Drop dragged cards at a seam (Phases 63 and 65), loose or pinned: a card
   * can be carried within its bloque, from one bloque to another, into a
   * bloque from the loose run and back out. A selected card brings the whole
   * selection with it, wherever each card sits; any other card travels alone
   * and leaves the selection as it was.
   *
   * Like the arrows, it works from the hand as displayed. A drop among the
   * loose cards releases a latched sort — it is a claim about where they go —
   * but a drop into a bloque does not: the sort only ever ordered the loose
   * run, and still can. A drop that changed nothing changes nothing.
   *
   * What was carried is let go of (Phase 68): the drag was the thing it was
   * selected for, and a card left selected looks like a card about to be
   * thrown. Where it landed is marked green by the hand instead.
   */
  const llevarCartas = useCallback(
    (cardId: string, destino: Destino) => {
      const enMano = mano.map((card) => card.id)
      if (!enMano.includes(cardId)) return
      const sueltas = (secciones.find((seccion) => !seccion.bloqueada)?.cards ?? []).map(
        (card) => card.id,
      )

      const llevadas = seleccion.includes(cardId)
        ? enMano.filter((id) => seleccion.includes(id))
        : [cardId]
      const nuevo = llevar(sueltas, bloques, llevadas, destino)
      const igual = (a: readonly (readonly string[])[], b: readonly (readonly string[])[]) =>
        JSON.stringify(a) === JSON.stringify(b)
      setSeleccion((actual) => actual.filter((id) => !llevadas.includes(id)))
      if (igual([nuevo.orden, ...nuevo.bloques], [sueltas, ...bloques])) return

      setOrden(nuevo.orden)
      setBloques(nuevo.bloques)
      // A new bloque leaves the loose run's order alone, so the sort stays.
      const ancla =
        'antesDe' in destino ? destino.antesDe : 'despuesDe' in destino ? destino.despuesDe : null
      if (ancla !== null && sueltas.includes(ancla)) setAcomodoActivo(null)
    },
    [mano, secciones, bloques, seleccion],
  )

  const alternarCarta = useCallback(
    (cardId: string) => {
      onAviso(null)
      setSeleccion((actual) =>
        actual.includes(cardId)
          ? actual.filter((id) => id !== cardId)
          : [...actual, cardId],
      )
    },
    [onAviso],
  )

  const limpiarSeleccion = useCallback(() => setSeleccion([]), [])

  /** Set the current selection aside as one grupo of the bajada. */
  const apartarGrupo = useCallback(() => {
    const propuesta = armarGrupo(seleccionadas, 'layDown')
    if (!propuesta) {
      onAviso(
        seleccionadas.length < 3
          ? 'Un grupo necesita al menos tres cartas.'
          : 'Esas cartas no forman un trío ni una escala.',
      )
      return
    }
    // The strict bajada (Phase 47), said here and not only by the referee:
    // a grupo that cannot go down should not be set aside as if it could.
    if (vista?.bajadaEstricta && propuesta.cardIds.length !== tamanoEstricto(propuesta.kind)) {
      onAviso(
        propuesta.kind === 'trio'
          ? 'Bajada estricta: el trío va con 3 cartas exactas. Las demás se ponen después.'
          : 'Bajada estricta: la escala va con 4 cartas exactas. Las demás se ponen después.',
      )
      return
    }
    setPropuestas((actual) => [...actual, propuesta])
    setSeleccion([])
    onAviso(null)
  }, [seleccionadas, onAviso, vista])

  const soltarGrupo = useCallback(
    (index: number) => {
      setPropuestas((actual) => actual.filter((_, i) => i !== index))
      onAviso(null)
    },
    [onAviso],
  )

  /** The turn is over: anything set aside belonged to it. */
  const terminarTurno = useCallback(() => {
    setSeleccion([])
    setPropuestas([])
  }, [])

  const contratoCompleto = useMemo(() => {
    if (!vista) return false
    const trios = propuestasVigentes.filter((p) => p.kind === 'trio').length
    const escalas = propuestasVigentes.filter((p) => p.kind === 'escala').length
    return trios === vista.contrato.trios && escalas === vista.contrato.escalas
  }, [vista, propuestasVigentes])

  return {
    seleccion,
    seleccionadas,
    mano,
    secciones: seccionesDisponibles,
    puntos,
    disponibles,
    propuestas: propuestasVigentes,
    contratoCompleto,
    acomodoActivo,
    acomodarMano,
    moverCartas,
    llevarCartas,
    fijarSeleccion,
    soltar,
    alternarCarta,
    limpiarSeleccion,
    apartarGrupo,
    soltarGrupo,
    terminarTurno,
  }
}
