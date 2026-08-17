'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { armarGrupo, codicioso } from '@/lib/bots'
import { type Acomodo, acomodar, aplicarOrden, moverSeleccion } from '@/lib/mano'
import {
  type Card,
  type Move,
  type PartidaConfig,
  type PartidaState,
  type Propuesta,
  aplicarEnPartida,
  isComodin,
  startPartida,
} from '@/lib/engine'

/** How long a bot appears to think, so its turn can be followed. */
const PAUSA_DEL_BOT = 550

export const TU_ASIENTO = 0

export function usePartida(options: {
  jugadores: number
  seed: string
  config?: PartidaConfig
}) {
  const { jugadores, seed, config } = options

  const [partida, setPartida] = useState<PartidaState>(() =>
    startPartida({ players: jugadores, seed, config }),
  )
  const [seleccion, setSeleccion] = useState<readonly string[]>([])
  const [propuestas, setPropuestas] = useState<readonly Propuesta[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  /** How you have arranged your hand. Cards you have not touched keep dealing order. */
  const [orden, setOrden] = useState<readonly string[]>([])

  const reiniciar = useCallback(
    (nuevaSemilla: string, cuantos: number) => {
      setPartida(startPartida({ players: cuantos, seed: nuevaSemilla, config }))
      setSeleccion([])
      setPropuestas([])
      setAviso(null)
      setOrden([])
    },
    [config],
  )

  const ronda = partida.ronda
  const enJuego = ronda !== null && ronda.ganador === null
  const esTuTurno = enJuego && ronda.turno === TU_ASIENTO
  // Derived rather than stored: a bot is thinking exactly when it is a bot's
  // turn. Keeping it as state would just be a second copy that can go stale.
  const esperando = enJuego && !esTuTurno

  /**
   * Grupos set aside are only meaningful while every one of their cards is
   * still in hand. Deriving that here means a ronda ending, or a card leaving
   * some other way, cannot leave a stale grupo sitting on screen.
   */
  const propuestasVigentes = useMemo(() => {
    if (!ronda) return []
    const enMano = new Set(ronda.jugadores[TU_ASIENTO].hand.map((card) => card.id))
    return propuestas.filter((p) => p.cardIds.every((id) => enMano.has(id)))
  }, [ronda, propuestas])

  /** Your hand as you have arranged it. */
  const mano = useMemo<Card[]>(() => {
    if (!ronda) return []
    return aplicarOrden(ronda.jugadores[TU_ASIENTO].hand, orden)
  }, [ronda, orden])

  /** Cards still in hand and not already set aside for a grupo, in your order. */
  const disponibles = useMemo<Card[]>(() => {
    const apartadas = new Set(propuestasVigentes.flatMap((p) => p.cardIds))
    return mano.filter((card) => !apartadas.has(card.id))
  }, [mano, propuestasVigentes])

  const acomodarMano = useCallback(
    (como: Acomodo) => setOrden(acomodar(mano, como).map((card) => card.id)),
    [mano],
  )

  /** Slide everything currently selected one place, gathering it into a block. */
  const moverCartas = useCallback(
    (hacia: 'izquierda' | 'derecha') =>
      setOrden((actual) =>
        moverSeleccion(
          actual.length > 0 ? actual : mano.map((card) => card.id),
          seleccion,
          hacia,
        ),
      ),
    [mano, seleccion],
  )

  const seleccionadas = useMemo(
    () => disponibles.filter((card) => seleccion.includes(card.id)),
    [disponibles, seleccion],
  )

  const jugar = useCallback((move: Move) => {
    setPartida((actual) => {
      const result = aplicarEnPartida(actual, move)
      if (!result.ok) {
        setAviso(mensajeDeError(result.code, result.detail))
        return actual
      }
      setAviso(null)
      return result.state
    })
  }, [])

  // Bots take their turns on their own, one move at a time so the table can be
  // watched rather than jumping to your next turn.
  const enCurso = useRef(false)
  useEffect(() => {
    const actual = partida.ronda
    if (!actual || actual.ganador !== null) return
    if (actual.turno === TU_ASIENTO) return
    if (enCurso.current) return

    enCurso.current = true

    const id = setTimeout(() => {
      enCurso.current = false
      setPartida((estado) => {
        const ronda = estado.ronda
        if (!ronda || ronda.turno === TU_ASIENTO || ronda.ganador !== null) return estado
        const result = aplicarEnPartida(estado, codicioso.decidir(ronda))
        return result.ok ? result.state : estado
      })
    }, PAUSA_DEL_BOT)

    return () => {
      clearTimeout(id)
      enCurso.current = false
    }
  }, [partida])

  // --------------------------------------------------------------- actions

  const alternarCarta = useCallback((cardId: string) => {
    setAviso(null)
    setSeleccion((actual) =>
      actual.includes(cardId)
        ? actual.filter((id) => id !== cardId)
        : [...actual, cardId],
    )
  }, [])

  const limpiarSeleccion = useCallback(() => setSeleccion([]), [])

  const robar = useCallback(
    (de: 'stock' | 'descarte') => {
      if (!esTuTurno || ronda?.fase !== 'draw') return
      jugar({ type: 'robar', de })
    },
    [esTuTurno, ronda?.fase, jugar],
  )

  /** Set the current selection aside as one grupo of the bajada. */
  const apartarGrupo = useCallback(() => {
    const propuesta = armarGrupo(seleccionadas, 'layDown')
    if (!propuesta) {
      setAviso(
        seleccionadas.length < 3
          ? 'Un grupo necesita al menos tres cartas.'
          : 'Esas cartas no forman un trío ni una escala.',
      )
      return
    }
    setPropuestas((actual) => [...actual, propuesta])
    setSeleccion([])
    setAviso(null)
  }, [seleccionadas])

  const soltarGrupo = useCallback((index: number) => {
    setPropuestas((actual) => actual.filter((_, i) => i !== index))
    setAviso(null)
  }, [])

  const bajarse = useCallback(() => {
    if (!ronda) return
    jugar({ type: 'bajarse', propuestas: [...propuestasVigentes] })
    setPropuestas([])
    setSeleccion([])
  }, [ronda, propuestasVigentes, jugar])

  /**
   * Put the selected cards on a grupo already on the mesa.
   *
   * There is more than one way a card can join a grupo, and the player should
   * not have to say which: tapping means "this belongs here". So the sensible
   * moves are tried in order and the engine picks the one that is legal.
   *
   * Extending comes first because it changes least. Substituting a comodín is
   * tried after — that is the `5 ** 7 8` case, where the 6 that the comodín
   * stands for fits nowhere on either end and belongs in its place.
   */
  const agregarA = useCallback(
    (seat: number, grupoIndex: number) => {
      if (!esTuTurno || ronda?.fase !== 'act') return
      if (seleccionadas.length === 0) {
        setAviso('Escoge primero las cartas que quieres poner.')
        return
      }

      const candidatos = jugadasParaGrupo(seleccionadas, seat, grupoIndex)

      setPartida((actual) => {
        for (const move of candidatos) {
          const result = aplicarEnPartida(actual, move)
          if (result.ok) {
            setAviso(null)
            setSeleccion([])
            return result.state
          }
        }
        setAviso(
          seleccionadas.length > 1
            ? 'Esas cartas no caben en ese grupo. Prueba de a una.'
            : 'Esa carta no cabe en ese grupo.',
        )
        return actual
      })
    },
    [esTuTurno, ronda?.fase, seleccionadas],
  )

  const descartar = useCallback(() => {
    if (seleccionadas.length !== 1) {
      setAviso('Escoge exactamente una carta para botar.')
      return
    }
    jugar({ type: 'descartar', cardId: seleccionadas[0].id })
    // The turn is over: anything set aside belonged to it.
    setSeleccion([])
    setPropuestas([])
  }, [seleccionadas, jugar])

  const contratoCompleto = useMemo(() => {
    if (!ronda) return false
    const trios = propuestasVigentes.filter((p) => p.kind === 'trio').length
    const escalas = propuestasVigentes.filter((p) => p.kind === 'escala').length
    return trios === ronda.contrato.trios && escalas === ronda.contrato.escalas
  }, [ronda, propuestasVigentes])

  return {
    partida,
    ronda,
    esTuTurno,
    esperando,
    aviso,
    seleccion,
    seleccionadas,
    mano,
    disponibles,
    acomodarMano,
    moverCartas,
    propuestas: propuestasVigentes,
    contratoCompleto,
    yaBajado: ronda ? ronda.jugadores[TU_ASIENTO].bajadoEnTurno !== null : false,
    alternarCarta,
    limpiarSeleccion,
    robar,
    apartarGrupo,
    soltarGrupo,
    bajarse,
    agregarA,
    descartar,
    reiniciar,
  }
}

/**
 * Every move that tapping a grupo could sensibly mean, in the order to try them.
 *
 * Extending comes first because it changes the least. Substituting a comodín
 * comes after: that is the `5 ** 7 8` case, where the 6 the comodín stands for
 * fits on neither end and belongs in its place. Freeing a comodín is paid for
 * with one real card, so it is only offered for a single non-comodín selection.
 */
export function jugadasParaGrupo(
  seleccionadas: readonly Card[],
  seat: number,
  grupoIndex: number,
): Move[] {
  if (seleccionadas.length === 0) return []

  const cardIds = seleccionadas.map((card) => card.id)
  const candidatos: Move[] = [
    { type: 'agregar', seat, grupoIndex, cardIds, end: 'tail' },
    { type: 'agregar', seat, grupoIndex, cardIds, end: 'head' },
  ]

  const unica = seleccionadas.length === 1 ? seleccionadas[0] : null
  if (unica && !isComodin(unica)) {
    candidatos.push(
      { type: 'moverComodin', seat, grupoIndex, cardId: unica.id, to: 'tail' },
      { type: 'moverComodin', seat, grupoIndex, cardId: unica.id, to: 'head' },
    )
  }

  return candidatos
}

/** Engine codes are for programs. These are for the person playing. */
function mensajeDeError(code: string, detail: string): string {
  switch (code) {
    case 'FASE_EQUIVOCADA':
      return 'Todavía no puedes hacer eso en este turno.'
    case 'CONTRATO_NO_COINCIDE':
      return 'Eso no es lo que pide el contrato de esta ronda.'
    case 'GRUPO_INVALIDO':
      return 'Alguno de esos grupos no es válido.'
    case 'SIN_CARTA_PARA_DESCARTAR':
      return 'Te quedarías sin carta para botar. Guarda una.'
    case 'NO_SE_HA_BAJADO':
      return 'No puedes tocar la mesa hasta que te bajes.'
    case 'MESA_BLOQUEADA_MISMO_TURNO':
      return 'A los grupos de los demás solo desde el turno siguiente.'
    case 'YA_SE_BAJO':
      return 'Ya te bajaste en esta ronda.'
    default:
      return detail
  }
}
