'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { armarGrupo, movesDelTurno, tiemposDeMoves } from '@/lib/bots'
import {
  type Acomodo,
  type Bloque,
  acomodar,
  aplanar,
  bloquear,
  distribuir,
  moverSeleccion,
  soltarBloque,
} from '@/lib/mano'
import {
  type Card,
  type Marcador,
  type Move,
  type PartidaConfig,
  type PartidaState,
  type Propuesta,
  aplicarEnPartida,
  isComodin,
  puntosDeMano,
  startPartida,
} from '@/lib/engine'
import { type Relato, type Viaje, relatar } from '@/lib/relato'

/** How long a bot's whole turn takes if the setup screen said nothing. */
const SEGUNDOS_DEL_BOT = 2

export const TU_ASIENTO = 0

export function usePartida(options: {
  jugadores: number
  seed: string
  config?: PartidaConfig
  /** Seconds a bot spends on its whole turn — draw, unload and discard. */
  segundosBot?: number
}) {
  const { jugadores, seed, config, segundosBot = SEGUNDOS_DEL_BOT } = options

  const [partida, setPartida] = useState<PartidaState>(() =>
    startPartida({ players: jugadores, seed, config }),
  )
  const [seleccion, setSeleccion] = useState<readonly string[]>([])
  const [propuestas, setPropuestas] = useState<readonly Propuesta[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  /** How you have arranged the loose cards. Untouched ones keep dealing order. */
  const [orden, setOrden] = useState<readonly string[]>([])
  /** Cards you have pinned together so sorting leaves them alone. */
  const [bloques, setBloques] = useState<readonly Bloque[]>([])
  /**
   * The ronda that just ended, held on screen until you move on.
   *
   * The engine closes a ronda and deals the next one in the same move, which is
   * right for a program and wrong for a person: whoever went out disappeared
   * before anyone could see it. This is the pause, and nothing but `siguiente`
   * ends it.
   */
  const [resumen, setResumen] = useState<Marcador | null>(null)
  /** The last public thing that happened, for the line under the piles. */
  const [relato, setRelato] = useState<Relato | null>(null)
  /** Everything public that has happened this ronda, in order. */
  const [historia, setHistoria] = useState<readonly Relato[]>([])
  /** The card currently travelling across the table, if any. */
  const [viaje, setViaje] = useState<Viaje | null>(null)
  const proximoViaje = useRef(1)
  /**
   * The card you drew this turn, so the hand can mark it. With a sort
   * latched, a drawn card files itself into place — which is the point of
   * the latch, and also how you lose track of what you just drew. The mark
   * lasts until the turn ends with your discard.
   */
  const [recienRobada, setRecienRobada] = useState<string | null>(null)

  /**
   * A new reparto starts with nothing arranged and nothing pinned.
   *
   * Not merely tidy: card ids repeat from one deal to the next — `7-s#0` is the
   * same string in every ronda — so a bloque left over from the last hand
   * silently pins cards it was never made from, and the player is handed a hand
   * that arrived pre-locked. The arrangement belongs to the ronda it was made
   * in, so it is dropped the moment the ronda changes rather than wherever it
   * happens to be convenient to clear it.
   */
  const [rondaVista, setRondaVista] = useState(partida.indiceContrato)
  if (rondaVista !== partida.indiceContrato) {
    setRondaVista(partida.indiceContrato)
    setOrden([])
    setBloques([])
    setSeleccion([])
    setPropuestas([])
    // The log belongs to the ronda it narrated; the summary screen tells the
    // ending better than a stale line could.
    setRelato(null)
    setHistoria([])
    setViaje(null)
    setRecienRobada(null)
  }

  const ronda = partida.ronda
  const enPausa = resumen !== null
  const enJuego = ronda !== null && ronda.ganador === null && !enPausa
  const esTuTurno = enJuego && ronda.turno === TU_ASIENTO
  // Derived rather than stored: a bot is thinking exactly when it is a bot's
  // turn. Keeping it as state would just be a second copy that can go stale.
  const esperando = enJuego && !esTuTurno

  /**
   * Whether you may put cards on the mesa at all right now. Bajado, and not on
   * the turn you bajaste — on that turn nothing is open, your own grupos
   * included.
   */
  const mesaAbierta =
    ronda !== null &&
    ronda.jugadores[TU_ASIENTO].bajadoEnTurno !== null &&
    ronda.jugadores[TU_ASIENTO].bajadoEnTurno < ronda.numeroDeTurno

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

  /**
   * The sort that is currently latched, if any. While it is down, the loose
   * cards re-sort themselves on every change — the card you draw files itself
   * into place. It is a preference, not an arrangement, so unlike `orden` and
   * `bloques` it survives a new reparto: the next hand arrives already sorted.
   */
  const [acomodoActivo, setAcomodoActivo] = useState<Acomodo | null>(null)

  /** Your hand laid out: pinned bloques first, then the loose cards. */
  const secciones = useMemo(() => {
    if (!ronda) return []
    const hand = ronda.jugadores[TU_ASIENTO].hand
    if (!acomodoActivo) return distribuir(hand, orden, bloques)

    // Latched: the order is computed, not remembered.
    const fijadas = new Set(bloques.flat())
    const sueltas = hand.filter((card) => !fijadas.has(card.id))
    const ordenadas = acomodar(sueltas, acomodoActivo).map((card) => card.id)
    return distribuir(hand, ordenadas, bloques)
  }, [ronda, orden, bloques, acomodoActivo])

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
        const sueltas =
          secciones.find((seccion) => !seccion.bloqueada)?.cards ?? []
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
      setAviso('Escoge las cartas que quieres dejar fijas.')
      return
    }
    // Pin them in the order they are sitting in, not the order they were tapped.
    const enOrden = mano
      .filter((card) => seleccion.includes(card.id))
      .map((card) => card.id)
    setBloques((actual) => bloquear(actual, enOrden))
    setSeleccion([])
    setAviso(null)
  }, [mano, seleccion])

  const soltar = useCallback(
    (indice: number) => setBloques((actual) => soltarBloque(actual, indice)),
    [],
  )

  /**
   * Slide everything currently selected one place, gathering it into a block.
   *
   * Always works from the hand **as displayed**, never from the stored order.
   * The stored order does not know about the card just drawn — that one is
   * appended when the hand is laid out — and moving from a stale order silently
   * did nothing to it.
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

  const seleccionadas = useMemo(
    () => disponibles.filter((card) => seleccion.includes(card.id)),
    [disponibles, seleccion],
  )

  /**
   * The public record of a move that just landed: the line under the piles,
   * for a draw the card that travels across the table, and for *your* draw
   * the mark on the card that arrived. Called from inside the state updaters,
   * right where both sides of the move are at hand.
   */
  const anotar = useCallback(
    (antes: PartidaState, move: Move, despues: PartidaState) => {
      const ronda = antes.ronda
      if (!ronda) return

      const cuento = relatar(move, ronda)
      if (cuento) {
        setRelato(cuento)
        setHistoria((antes) => [...antes, cuento])
      }

      // A robar that closed the ronda en tablas moved no card: nothing
      // travels, and nothing in the hand gets marked as drawn.
      if (move.type === 'robar' && cuento?.tipo !== 'tablas') {
        setViaje({
          clave: proximoViaje.current++,
          desde: { pila: move.de },
          hasta: { seat: ronda.turno },
          // Only the descarte card was face up; a stock draw travels face down.
          carta: move.de === 'descarte' ? (ronda.discard.at(-1) ?? null) : null,
        })

        // Your own draw gets marked in the hand. Found by diffing the hands
        // rather than peeking at the stock, so a reshuffle cannot confuse it.
        if (ronda.turno === TU_ASIENTO && despues.ronda) {
          const habia = new Set(
            ronda.jugadores[TU_ASIENTO].hand.map((card) => card.id),
          )
          const nueva = despues.ronda.jugadores[TU_ASIENTO].hand.find(
            (card) => !habia.has(card.id),
          )
          setRecienRobada(nueva?.id ?? null)
        }
      }

      if (move.type === 'descartar') {
        const carta = ronda.jugadores[ronda.turno].hand.find(
          (card) => card.id === move.cardId,
        )
        setViaje({
          clave: proximoViaje.current++,
          desde: { seat: ronda.turno },
          hasta: { pila: 'descarte' },
          // A discard lands face up: everybody sees it, so the trip shows it.
          carta: carta ?? null,
        })

        // Your discard ends your turn, and the mark belongs to the turn.
        if (ronda.turno === TU_ASIENTO) setRecienRobada(null)
      }
    },
    [],
  )

  /**
   * Everything that follows an accepted move: the public record, and the
   * pause on a ronda the move closed. One place on purpose — a ligada onto
   * the mesa ends a ronda as surely as a discard does (Phase 26), and the
   * first version of `agregarA` recorded the move without checking, so
   * going out by ligando dealt straight past the who-won screen.
   */
  const asentar = useCallback(
    (antes: PartidaState, move: Move, despues: PartidaState) => {
      anotar(antes, move, despues)
      const cerrada = rondaCerrada(antes, despues)
      if (cerrada) setResumen(cerrada)
    },
    [anotar],
  )

  const jugar = useCallback(
    (move: Move) => {
      setPartida((actual) => {
        const result = aplicarEnPartida(actual, move)
        if (!result.ok) {
          setAviso(mensajeDeError(result.code, result.detail))
          return actual
        }
        setAviso(null)
        asentar(actual, move, result.state)
        return result.state
      })
    },
    [asentar],
  )

  /**
   * Move on to the next reparto. The cards were dealt when the ronda closed —
   * what this ends is the pause. Clearing the arrangement is not this
   * function's job: it happens when the ronda changes, whether or not anyone
   * passed through here.
   */
  const siguiente = useCallback(() => {
    setResumen(null)
    setAviso(null)
  }, [])

  /**
   * One string that changes exactly when a new turn starts — and not while a
   * turn is being played out. It keys both the bot scheduler below and the
   * draining ring on the ficha, so the clock and the moves share a start line.
   */
  const claveDeTurno =
    ronda && ronda.ganador === null
      ? `${partida.indiceContrato}:${ronda.numeroDeTurno}:${ronda.turno}`
      : 'nada'

  /**
   * Bots play their whole turn inside their allotted seconds (Phase 21).
   *
   * The moves are planned up front — deciding is pure, so the plan and the
   * play walk identical states — and spread across the clock, the last one
   * landing when the time runs out. The effect is keyed by the turn, not by
   * the state: the intermediate moves it applies must not reschedule it.
   */
  const partidaRef = useRef(partida)
  useEffect(() => {
    partidaRef.current = partida
  }, [partida])

  useEffect(() => {
    const estado = partidaRef.current
    const actual = estado.ronda
    if (!actual || actual.ganador !== null) return
    if (actual.turno === TU_ASIENTO) return
    // A ronda waiting to be acknowledged is not a ronda in progress: the next
    // one is already dealt, and a bot playing into it behind the summary would
    // mean coming back to a table that had moved on without you.
    if (resumen) return

    const moves = movesDelTurno(estado)
    const tiempos = tiemposDeMoves(moves.length, segundosBot * 1000)

    const ids = moves.map((move, i) =>
      setTimeout(() => {
        setPartida((antes) => {
          const result = aplicarEnPartida(antes, move)
          if (!result.ok) return antes
          asentar(antes, move, result.state)
          return result.state
        })
      }, tiempos[i]),
    )

    return () => ids.forEach(clearTimeout)
  }, [claveDeTurno, resumen, segundosBot, asentar])

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
            asentar(actual, move, result.state)
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
    [esTuTurno, ronda?.fase, seleccionadas, asentar],
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
    resumen,
    /** For the draining ring: how long a bot turn lasts, and its start line. */
    reloj: { segundos: segundosBot, clave: claveDeTurno },
    /** The last public thing that happened. */
    relato,
    /** Everything public that happened this ronda, oldest first. */
    historia,
    /** The card travelling across the table right now, if any. */
    viaje,
    /** Which sort is latched, if any. */
    acomodoActivo,
    /** The card you drew this turn, marked until your discard ends it. */
    recienRobada,
    /** True once the last contract has been played and scored. */
    seAcabo: partida.ronda === null,
    siguiente,
    esTuTurno,
    esperando,
    aviso,
    seleccion,
    seleccionadas,
    mano,
    secciones: seccionesDisponibles,
    puntos,
    disponibles,
    acomodarMano,
    moverCartas,
    fijarSeleccion,
    soltar,
    propuestas: propuestasVigentes,
    contratoCompleto,
    yaBajado: ronda ? ronda.jugadores[TU_ASIENTO].bajadoEnTurno !== null : false,
    mesaAbierta,
    alternarCarta,
    limpiarSeleccion,
    robar,
    apartarGrupo,
    soltarGrupo,
    bajarse,
    agregarA,
    descartar,
  }
}

/**
 * The ronda a move just closed, if it closed one.
 *
 * Read from the historial rather than from the ronda, because by the time
 * `aplicarEnPartida` returns, the finished ronda is gone and the next one is
 * dealt. The historial is what is left of it — and it is also what the
 * scoreboard shows, so the two can never disagree.
 */
function rondaCerrada(antes: PartidaState, despues: PartidaState): Marcador | null {
  if (despues.historial.length === antes.historial.length) return null
  return despues.historial[despues.historial.length - 1]
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
    case 'NO_SE_HA_BAJADO':
      return 'No puedes tocar la mesa hasta que te bajes.'
    case 'MESA_BLOQUEADA_MISMO_TURNO':
      return 'En el turno que te bajas no puedes poner nada en la mesa, ni en tus propios grupos.'
    case 'YA_SE_BAJO':
      return 'Ya te bajaste en esta ronda.'
    default:
      return detail
  }
}
