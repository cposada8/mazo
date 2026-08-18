'use client'

/**
 * The table, wherever the partida lives (Phase 34).
 *
 * There is one implementation of playing Carioca on screen. What differs
 * between a bots-only table in this browser and a table on the server is
 * only the **transport**: where the view comes from and where a move goes.
 * Everything else — the pause on a finished ronda, the card that travels, the
 * mark on what you just drew, what you may do to the mesa right now — is
 * derived here, from the view and the public log, and derived identically.
 *
 * Deriving rather than recording is what makes that possible. The log is the
 * same log in both homes (it obeys one rule: it may only say what everybody
 * saw), so the animation it drives is the same animation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Card,
  type Marcador,
  type Move,
  type VistaDeAsiento,
  type VistaDePartida,
  aplicarEnVista,
  isComodin,
} from '@/lib/engine'
import type { Relato, Viaje } from '@/lib/relato'
import { useMano } from './useMano'

/** One empty hand, so an absent ronda does not look like a changed one. */
const VACIA: readonly Card[] = []

/** How long a line of the story holds the strip before the next one is told. */
const MS_POR_RELATO = 750
/** With a queue behind it, briskly — the point is order, not ceremony. */
const MS_AL_ALCANZAR = 300
/**
 * Past this many waiting, it is not a turn being watched: it is a reload or a
 * tab that was away, and replaying it would be telling a story about a table
 * that has moved on.
 */
const MAXIMO_EN_COLA = 5

/**
 * Every move that tapping a grupo could sensibly mean, in the order to try
 * them. Extending comes first because it changes the least; substituting a
 * comodín comes after — the `5 ** 7 8` case, where the 6 the comodín stands
 * for fits on neither end and belongs in its place. Freeing a comodín is paid
 * for with one real card, so it is only offered for a single non-comodín
 * selection.
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

export type Transporte = {
  /** What this seat may see, or null before anything has loaded. */
  vista: VistaDePartida | null
  /** Everything public that has happened this ronda, oldest first. */
  relatos: readonly Relato[]
  /** How long the seat in play has for its turn, for the draining ring. */
  segundosDelTurno: number
  /** Seconds of that turn already gone, when the clock is the server's. */
  transcurrido?: number
  /** Whether the reader's own turn is timed too (server tables only). */
  relojPropio?: boolean
  aviso: string | null
  limpiarAviso: () => void
  jugar: (move: Move) => void
}

export function useMesa(transporte: Transporte) {
  const { vista, relatos, aviso } = transporte
  const ronda = vista?.ronda ?? null
  const asiento = vista?.asiento ?? 0

  /**
   * The ronda that just ended, held on screen until you move on.
   *
   * The engine closes a ronda and deals the next one in the same move, which
   * is right for a program and wrong for a person: whoever went out
   * disappeared before anyone could see it. This is the pause, and nothing
   * but `siguiente` ends it. It stays per-browser in both homes — the next
   * reparto is already dealt either way, and holding it on screen is
   * presentation.
   */
  const [resumen, setResumen] = useState<Marcador | null>(null)
  const cerradas = vista?.historial.length ?? 0
  // Derived during render on purpose: the summary must be up on the very
  // frame the closed ronda arrives, or the next reparto flashes past first.
  const [cerradasVistas, setCerradasVistas] = useState(cerradas)
  if (cerradasVistas !== cerradas) {
    setCerradasVistas(cerradas)
    if (cerradas > cerradasVistas && vista) {
      setResumen(vista.historial[cerradas - 1])
    }
  }

  const enPausa = resumen !== null
  const enJuego = ronda !== null && ronda.ganador === null && !enPausa
  const esTuTurno = enJuego && ronda.turno === asiento
  // Derived rather than stored: somebody else is thinking exactly when it is
  // somebody else's turn.
  const esperando = enJuego && !esTuTurno

  /**
   * The story, told one line at a time (Phase 41).
   *
   * The log can grow by several at once — a poll that spanned three of a
   * bot's moves, or a turn that timed out and played itself — and it used to
   * show only the newest, which is how a turn arrived as *ya botó y cogió*.
   * So what has been told is counted, and the rest is a queue: one line, then
   * the next, at a pace a person can follow.
   *
   * The queue paces the *telling*, not the game. The view it belongs to has
   * already moved — the engine had applied every one of these before the
   * browser heard about them — so the mesa can be a beat ahead of the line
   * naming the move that changed it. That beat is the price of a story told
   * in order, and it is cheaper than no story at all.
   */
  const [contados, setContados] = useState(relatos.length)
  /** Which line the card in flight belongs to; see the journey below. */
  const [ultimoContado, setUltimoContado] = useState(relatos.length)
  /** When the last line was told, so a lone one is not made to wait for a beat. */
  const contadoEn = useRef(0)

  // Skipping ahead — both cases below — is not narration, so it takes the
  // journey counter with it: nothing travels for a line nobody was told.
  if (contados > relatos.length) {
    // A new reparto empties the log. Nothing is left to tell: whatever was
    // still queued belonged to a ronda that is over.
    setContados(relatos.length)
    setUltimoContado(relatos.length)
  } else if (relatos.length - contados > MAXIMO_EN_COLA) {
    // And a backlog this size is not a turn being played in front of you. It
    // is a reload, a tab that was away, or a stretch of the game that ran
    // while nobody was asking — Phase 22's instinct, kept for the case it was
    // right about: land where the table is now rather than replaying it.
    setContados(relatos.length)
    setUltimoContado(relatos.length)
  }

  const porContar = relatos.length - contados

  useEffect(() => {
    if (porContar <= 0) return

    // Told at once when the table is quiet, briskly when there is a queue:
    // waiting out a full beat before the first line would put a lag on your
    // own moves, which land the instant you make them.
    const ritmo = porContar > 1 ? MS_AL_ALCANZAR : MS_POR_RELATO
    const espera = Math.max(0, ritmo - (Date.now() - contadoEn.current))

    const cuenta = setTimeout(() => {
      contadoEn.current = Date.now()
      setContados((contadas) => contadas + 1)
    }, espera)

    return () => clearTimeout(cuenta)
  }, [porContar])

  /** The line under the piles: the last one told, not the last one to arrive. */
  const relato = contados > 0 ? (relatos[contados - 1] ?? null) : null

  /**
   * The card travelling across the table right now.
   *
   * Fired by a line being *told* rather than by the log growing, so it keeps
   * step with the story even when three moves arrived together. Derived
   * during render for the same reason the pause is: the card must be in
   * flight on the very frame its line goes up.
   */
  const [viaje, setViaje] = useState<Viaje | null>(null)
  const [viajes, setViajes] = useState(0)
  if (ultimoContado !== contados) {
    setUltimoContado(contados)
    // Only forward: a log that shrank took its journeys with it.
    const dicho = contados > ultimoContado ? relatos[contados - 1] : undefined
    const trip = dicho ? viajeDeRelato(dicho, viajes + 1) : null
    if (trip) {
      setViajes(viajes + 1)
      setViaje(trip)
    }
  }

  /**
   * The card you drew this turn, so the hand can mark it. Found by diffing
   * your own hand rather than by peeking at the stock, so a reshuffle cannot
   * mislabel it — and so it works the same whether the card came from the
   * engine next door or off the wire.
   */
  const [recienRobada, setRecienRobada] = useState<string | null>(null)
  const manoAhora = ronda?.mano ?? VACIA
  const [manoAntes, setManoAntes] = useState<readonly Card[]>(manoAhora)
  if (manoAhora !== manoAntes) {
    setManoAntes(manoAhora)
    if (manoAhora.length === manoAntes.length + 1) {
      const habia = new Set(manoAntes.map((card) => card.id))
      const nueva = manoAhora.find((card) => !habia.has(card.id))
      if (nueva) setRecienRobada(nueva.id)
    } else if (manoAhora.length < manoAntes.length && ronda?.fase === 'draw') {
      // Your discard ends your turn, and the mark belongs to the turn.
      setRecienRobada(null)
    }
  }

  /**
   * What this turn has put on the mesa, for the table to mark in gold
   * (Phase 41).
   *
   * Derived from the mesa and not from the log: `agrega` names its cards the
   * way a person says them — «J♥» — and `bajada` does not name them at all,
   * while a grupo's cards carry ids and the view carries the grupos. It is
   * public information either way, so both homes derive it identically and
   * nothing is revealed that watching would not have shown.
   *
   * The base it is measured against is the mesa **as it stood at the previous
   * look**, taken at each turn change rather than at each view. Usually those
   * are the same thing and the marks simply clear when the turn passes. They
   * differ in exactly the case worth caring about: when a whole turn arrives
   * in one poll, the turn number and the new cards land together, and taking
   * the base from the look before keeps that turn's work visible instead of
   * erasing it in the same frame it appeared.
   */
  const enMesa = useMemo(() => idsEnMesa(ronda), [ronda])
  /**
   * The mesa as one comparable value. A poll hands over a freshly parsed view
   * every time, so two identical mesas arrive as different objects — kept as
   * a key rather than a reference, what is remembered is what changed rather
   * than what was re-read.
   */
  const claveDeMesa = useMemo(() => [...enMesa].sort().join('|'), [enMesa])
  const claveDeTurno =
    ronda && ronda.ganador === null
      ? `${vista?.indiceContrato}:${ronda.numeroDeTurno}`
      : 'nada'

  const [marca, setMarca] = useState({
    turno: claveDeTurno,
    base: claveDeMesa,
    antes: claveDeMesa,
  })
  if (marca.turno !== claveDeTurno) {
    setMarca({ turno: claveDeTurno, base: marca.antes, antes: claveDeMesa })
  } else if (marca.antes !== claveDeMesa) {
    setMarca({ ...marca, antes: claveDeMesa })
  }

  const doradas = useMemo(() => {
    const base = new Set(marca.base ? marca.base.split('|') : [])
    return new Set([...enMesa].filter((id) => !base.has(id)))
  }, [enMesa, marca.base])

  /**
   * Whether you may put cards on the mesa at all right now. Bajado, and not
   * on the turn you bajaste — on that turn nothing is open, your own grupos
   * included.
   */
  const mesaAbierta =
    ronda !== null &&
    ronda.jugadores[asiento].bajadoEnTurno !== null &&
    ronda.jugadores[asiento].bajadoEnTurno! < ronda.numeroDeTurno

  const hand = useMano({
    vista: ronda,
    reparto: vista?.indiceContrato ?? 0,
    onAviso: (mensaje) => {
      if (mensaje === null) transporte.limpiarAviso()
      else setAvisoLocal(mensaje)
    },
  })

  /** Avisos the hand raises about itself, versus refusals from the referee. */
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null)
  const avisoVisible = avisoLocal ?? aviso

  const limpiar = useCallback(() => {
    setAvisoLocal(null)
    transporte.limpiarAviso()
  }, [transporte])

  // ---------------------------------------------------------------- actions

  const robar = useCallback(
    (de: 'stock' | 'descarte') => {
      if (!esTuTurno || ronda?.fase !== 'draw') return
      limpiar()
      transporte.jugar({ type: 'robar', de })
    },
    [esTuTurno, ronda?.fase, transporte, limpiar],
  )

  const bajarse = useCallback(() => {
    if (!ronda) return
    limpiar()
    transporte.jugar({ type: 'bajarse', propuestas: [...hand.propuestas] })
    hand.terminarTurno()
  }, [ronda, hand, transporte, limpiar])

  /**
   * Put the selected cards on a grupo already on the mesa.
   *
   * There is more than one way a card can join a grupo, and the player should
   * not have to say which: tapping means "this belongs here". So the sensible
   * readings are tried against **your own view** — extend the tail, extend the
   * head, then free the comodín — and only the one that holds up is sent.
   *
   * Trying them locally is not a shortcut around the referee: a mesa move
   * depends on public information plus your own hand, both of which the view
   * holds, so `aplicarEnVista` runs the real `apply` and gets the real answer.
   * The server still judges what arrives.
   */
  const agregarA = useCallback(
    (seat: number, grupoIndex: number) => {
      if (!esTuTurno || !ronda || ronda.fase !== 'act') return
      if (hand.seleccionadas.length === 0) {
        setAvisoLocal('Escoge primero las cartas que quieres poner.')
        return
      }

      const candidatos = jugadasParaGrupo(hand.seleccionadas, seat, grupoIndex)
      const legal = candidatos.find((move) => aplicarEnVista(ronda, move).ok)
      if (!legal) {
        setAvisoLocal(
          hand.seleccionadas.length > 1
            ? 'Esas cartas no caben en ese grupo. Prueba de a una.'
            : 'Esa carta no cabe en ese grupo.',
        )
        return
      }

      limpiar()
      transporte.jugar(legal)
      hand.limpiarSeleccion()
    },
    [esTuTurno, ronda, hand, transporte, limpiar],
  )

  const descartar = useCallback(() => {
    if (hand.seleccionadas.length !== 1) {
      setAvisoLocal('Escoge exactamente una carta para botar.')
      return
    }
    limpiar()
    transporte.jugar({ type: 'descartar', cardId: hand.seleccionadas[0].id })
    hand.terminarTurno()
  }, [hand, transporte, limpiar])

  /**
   * Move on to the next reparto. The cards were dealt when the ronda closed —
   * what this ends is the pause.
   */
  const siguiente = useCallback(() => {
    setResumen(null)
    limpiar()
  }, [limpiar])

  const alternarCarta = useCallback(
    (cardId: string) => {
      setAvisoLocal(null)
      hand.alternarCarta(cardId)
    },
    [hand],
  )

  return {
    ...hand,
    alternarCarta,
    vista: ronda,
    partida: vista,
    asiento,
    resumen,
    relato,
    historia: relatos,
    viaje,
    recienRobada,
    doradas,
    reloj: {
      segundos: transporte.segundosDelTurno,
      transcurrido: transporte.transcurrido,
      propio: transporte.relojPropio,
      clave:
        ronda && ronda.ganador === null
          ? `${vista?.indiceContrato}:${ronda.numeroDeTurno}:${ronda.turno}`
          : 'nada',
    },
    seAcabo: vista !== null && vista.ronda === null,
    esTuTurno,
    esperando,
    aviso: avisoVisible,
    yaBajado: ronda ? ronda.jugadores[asiento].bajadoEnTurno !== null : false,
    mesaAbierta,
    siguiente,
    robar,
    bajarse,
    agregarA,
    descartar,
  }
}

/** Every card sitting on the mesa right now, whoever laid it down. */
function idsEnMesa(ronda: VistaDeAsiento | null): ReadonlySet<string> {
  const ids = new Set<string>()
  if (!ronda) return ids
  for (const jugador of ronda.jugadores) {
    for (const grupo of jugador.grupos) {
      for (const card of grupo.cards) ids.add(card.id)
    }
  }
  return ids
}

/** The trip a public move implies, if it moved a card anyone could follow. */
function viajeDeRelato(relato: Relato, clave: number): Viaje | null {
  switch (relato.tipo) {
    case 'mazo':
      // Secret by construction: the card travels face down.
      return { clave, desde: { pila: 'stock' }, hasta: { seat: relato.seat }, carta: null }
    case 'descarte':
      return {
        clave,
        desde: { pila: 'descarte' },
        hasta: { seat: relato.seat },
        carta: cartaDeTexto(relato.carta),
      }
    case 'bota':
      return {
        clave,
        desde: { seat: relato.seat },
        hasta: { pila: 'descarte' },
        carta: cartaDeTexto(relato.carta),
      }
    default:
      return null
  }
}

/**
 * The log names cards the way a person says them — «J♥» — because it is prose
 * first. The travelling card needs a `Card` to draw, so it is read back.
 * Only ever for cards that were face up, so nothing secret is reconstructed.
 */
function cartaDeTexto(texto: string): Card | null {
  if (texto.startsWith('★') || texto === '**') {
    return { id: `viaje-${texto}`, kind: 'comodin' }
  }
  const match = /^(10|[2-9AJQK])([♠♥♦♣])$/.exec(texto)
  if (!match) return null

  const palos = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' } as const
  const carta = {
    id: `viaje-${texto}`,
    kind: 'normal',
    rank: match[1],
    suit: palos[match[2] as keyof typeof palos],
  } as Card
  return isComodin(carta) ? null : carta
}
