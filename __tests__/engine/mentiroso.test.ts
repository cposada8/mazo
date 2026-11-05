import { describe, expect, it } from 'vitest'
import { type Card, type Rank, RANKS, describeCard, parseCardSpecs } from '@/lib/engine'
import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  empezarMentiroso,
  vistaMentiroso,
} from '@/lib/engine/mentiroso'

/**
 * Phase 76: el Mentiroso's rules, every one of `specs/mentiroso-rules.md`,
 * as scripted partidas.
 */

/** Cards from notation, with ids unique within the test. */
let siguienteId = 0
function cartas(notacion: string): Card[] {
  return parseCardSpecs(notacion.split(/\s+/).filter(Boolean)).map((spec) => {
    const id = `t${siguienteId++}`
    return spec.kind === 'comodin'
      ? { id, kind: 'comodin' }
      : { id, kind: 'normal', rank: spec.rank, suit: spec.suit }
  })
}

/** A partida in a chosen position: hands named, everything else defaulted. */
function mesa(spec: {
  manos: string[]
  turno?: number
  rangoEnTurno?: Rank
  pila?: string
}): EstadoMentiroso {
  return {
    jugadores: spec.manos.length,
    seed: 'test',
    manos: spec.manos.map(cartas),
    pila: spec.pila ? cartas(spec.pila) : [],
    ultimaJugada: null,
    rangoEnTurno: spec.rangoEnTurno ?? 'A',
    turno: spec.turno ?? 0,
    fase: 'jugar',
    ultimaAcusacion: null,
    numeroDeJugada: 0,
    ganador: null,
  }
}

function aplicar(estado: EstadoMentiroso, move: MoveMentiroso): EstadoMentiroso {
  const resultado = aplicarMentiroso(estado, move)
  if (!resultado.ok) throw new Error(`${resultado.code}: ${resultado.detail}`)
  return resultado.estado
}

const rechazo = (estado: EstadoMentiroso, move: MoveMentiroso) => {
  const resultado = aplicarMentiroso(estado, move)
  return resultado.ok ? null : resultado.code
}

/** The ids of the first `n` cards in a seat's hand. */
const primeras = (estado: EstadoMentiroso, asiento: number, n: number) =>
  estado.manos[asiento].slice(0, n).map((carta) => carta.id)

const jugar = (estado: EstadoMentiroso, asiento: number, n: number) =>
  aplicar(estado, { type: 'jugar', asiento, cartaIds: primeras(estado, asiento, n) })

describe('the deal', () => {
  it('deals the whole single deck, no comodines, one card at a time', () => {
    for (const jugadores of [3, 4, 5, 6]) {
      const estado = empezarMentiroso({ jugadores, seed: `reparto-${jugadores}` })
      const todas = estado.manos.flat()
      expect(todas).toHaveLength(52)
      expect(new Set(todas.map((c) => c.id)).size).toBe(52)
      expect(todas.every((c) => c.kind === 'normal')).toBe(true)
      const tamanos = estado.manos.map((m) => m.length)
      expect(Math.max(...tamanos) - Math.min(...tamanos)).toBeLessThanOrEqual(1)
      // The seat that opens was dealt first, so it never holds fewer.
      expect(estado.manos[estado.turno].length).toBe(Math.max(...tamanos))
    }
  })

  it('opens on aces, in the play phase, with an empty pile', () => {
    const estado = empezarMentiroso({ jugadores: 4, seed: 'abre' })
    expect(estado.rangoEnTurno).toBe('A')
    expect(estado.fase).toBe('jugar')
    expect(estado.pila).toEqual([])
    expect(estado.ganador).toBeNull()
  })

  it('the same seed deals the same partida', () => {
    const a = empezarMentiroso({ jugadores: 5, seed: 'igual' })
    const b = empezarMentiroso({ jugadores: 5, seed: 'igual' })
    const c = empezarMentiroso({ jugadores: 5, seed: 'otra' })
    const forma = (e: EstadoMentiroso) => [e.turno, e.manos.map((m) => m.map(describeCard))]
    expect(forma(a)).toEqual(forma(b))
    expect(forma(a)).not.toEqual(forma(c))
  })

  it('takes 3 to 6 players', () => {
    expect(() => empezarMentiroso({ jugadores: 2, seed: 's' })).toThrow()
    expect(() => empezarMentiroso({ jugadores: 7, seed: 's' })).toThrow()
  })
})

describe('a play', () => {
  it('goes face down on the pile, announced as the rank in turn, and opens a window', () => {
    const estado = jugar(mesa({ manos: ['7s 8h 9d', 'Kc', 'Qc'] }), 0, 2)
    expect(estado.manos[0]).toHaveLength(1)
    expect(estado.pila).toHaveLength(2)
    expect(estado.ultimaJugada).toEqual({ asiento: 0, cantidad: 2, rango: 'A' })
    expect(estado.fase).toBe('ventana')
    expect(estado.rangoEnTurno).toBe('2')
    expect(estado.turno).toBe(1)
  })

  it('holds 1 to 4 cards: 0 and 5 are refused', () => {
    const estado = mesa({ manos: ['As Ah Ad Ac 2s', 'Kc', 'Qc'] })
    expect(rechazo(estado, { type: 'jugar', asiento: 0, cartaIds: [] })).toBe(
      'cantidad-invalida',
    )
    expect(rechazo(estado, { type: 'jugar', asiento: 0, cartaIds: primeras(estado, 0, 5) })).toBe(
      'cantidad-invalida',
    )
    expect(jugar(estado, 0, 4).pila).toHaveLength(4)
  })

  it('is refused out of turn, with a card not held, or with a card twice', () => {
    const estado = mesa({ manos: ['As Ah', 'Kc', 'Qc'] })
    expect(rechazo(estado, { type: 'jugar', asiento: 1, cartaIds: primeras(estado, 1, 1) })).toBe(
      'no-es-tu-turno',
    )
    expect(
      rechazo(estado, { type: 'jugar', asiento: 0, cartaIds: primeras(estado, 1, 1) }),
    ).toBe('carta-que-no-tienes')
    const [a] = primeras(estado, 0, 1)
    expect(rechazo(estado, { type: 'jugar', asiento: 0, cartaIds: [a, a] })).toBe(
      'carta-repetida',
    )
  })

  it('nobody plays while a window is open', () => {
    const estado = jugar(mesa({ manos: ['As Ah', 'Kc 2c', 'Qc'] }), 0, 1)
    expect(rechazo(estado, { type: 'jugar', asiento: 1, cartaIds: primeras(estado, 1, 1) })).toBe(
      'fase-equivocada',
    )
  })
})

describe('the sequence', () => {
  it('runs A to K and wraps back to A', () => {
    let estado = mesa({ manos: ['2s 3s', '2h 3h', '2d 3d'], rangoEnTurno: 'Q' })
    estado = aplicar(jugar(estado, 0, 1), { type: 'cerrarVentana' })
    expect(estado.rangoEnTurno).toBe('K')
    estado = aplicar(jugar(estado, 1, 1), { type: 'cerrarVentana' })
    expect(estado.rangoEnTurno).toBe('A')
    estado = aplicar(jugar(estado, 2, 1), { type: 'cerrarVentana' })
    expect(estado.rangoEnTurno).toBe('2')
  })

  it('all thirteen ranks come round in order', () => {
    let estado = mesa({
      manos: ['2s 3s 4s 5s 6s 7s 8s', '2h 3h 4h 5h 6h 7h 8h', '9c 9d 9h 9s 10c 10d 10h'],
    })
    const anunciados: Rank[] = []
    for (let i = 0; i < 13; i++) {
      anunciados.push(estado.rangoEnTurno)
      estado = aplicar(jugar(estado, estado.turno, 1), { type: 'cerrarVentana' })
      if (estado.ganador !== null) break
    }
    expect(anunciados).toEqual([...RANKS].slice(0, anunciados.length))
  })

  it('carries on after a call: a call changes who holds the pile, not the rank', () => {
    let estado = jugar(mesa({ manos: ['7s 8s', 'Kc Kd', 'Qc Qd'] }), 0, 1) // "un as", a lie
    estado = aplicar(estado, { type: 'mentiroso', asiento: 2 })
    expect(estado.rangoEnTurno).toBe('2')
    expect(estado.turno).toBe(1)
    expect(estado.fase).toBe('jugar')
  })
})

describe('«¡Mentiroso!»', () => {
  it('a lie called: the liar takes the whole pile', () => {
    let estado = mesa({ manos: ['7s 8s', 'Kc Kd', 'Qc Qd'], pila: '5h 5d 5c' })
    estado = jugar(estado, 0, 1) // announced as an ace: a seven
    estado = aplicar(estado, { type: 'mentiroso', asiento: 1 })
    expect(estado.ultimaAcusacion).toMatchObject({
      acusador: 1,
      acusado: 0,
      rango: 'A',
      eraMentira: true,
      seLlevo: 0,
      cartasDeLaPila: 4,
    })
    expect(estado.ultimaAcusacion!.cartas.map(describeCard)).toEqual(['7♠'])
    expect(estado.manos[0]).toHaveLength(5)
    expect(estado.pila).toEqual([])
  })

  it('the truth called: the one who doubted takes the whole pile', () => {
    let estado = mesa({ manos: ['As Ah 9c', 'Kc Kd', 'Qc'], pila: '5h' })
    estado = jugar(estado, 0, 2) // two aces, truly
    estado = aplicar(estado, { type: 'mentiroso', asiento: 2 })
    expect(estado.ultimaAcusacion).toMatchObject({ eraMentira: false, seLlevo: 2 })
    expect(estado.manos[2]).toHaveLength(4)
    expect(estado.manos[0]).toHaveLength(1)
    expect(estado.ganador).toBeNull()
  })

  it('one wrong card makes the whole play a lie', () => {
    let estado = jugar(mesa({ manos: ['As Ah 7d', 'Kc', 'Qc'] }), 0, 3)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 1 })
    expect(estado.ultimaAcusacion!.eraMentira).toBe(true)
  })

  it('turns over only the called play, never the pile beneath it', () => {
    let estado = mesa({ manos: ['As', 'Kc Kd', 'Qc'], pila: '9h 9d 9s' })
    estado = jugar(estado, 0, 1)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 1 })
    expect(estado.ultimaAcusacion!.cartas.map(describeCard)).toEqual(['A♠'])
  })

  it('anyone may call, but not the player who made the play', () => {
    const estado = jugar(mesa({ manos: ['7s 8s', 'Kc', 'Qc', 'Jc'] }), 0, 1)
    expect(rechazo(estado, { type: 'mentiroso', asiento: 0 })).toBe('jugada-propia')
    // Not only the next seat: the one two seats on may call too.
    expect(aplicar(estado, { type: 'mentiroso', asiento: 2 }).ultimaAcusacion!.acusador).toBe(2)
  })

  it('only while the window is open — after it closes, the play is safe', () => {
    let estado = mesa({ manos: ['7s 8s', 'Kc', 'Qc'] })
    expect(rechazo(estado, { type: 'mentiroso', asiento: 1 })).toBe('fase-equivocada')
    estado = aplicar(jugar(estado, 0, 1), { type: 'cerrarVentana' })
    expect(rechazo(estado, { type: 'mentiroso', asiento: 1 })).toBe('fase-equivocada')
  })

  it('of two calls, the first counts; the second is too late', () => {
    let estado = jugar(mesa({ manos: ['7s 8s', 'Kc', 'Qc'] }), 0, 1)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 2 })
    expect(rechazo(estado, { type: 'mentiroso', asiento: 1 })).toBe('fase-equivocada')
    expect(estado.ultimaAcusacion!.acusador).toBe(2)
  })

  it('refuses a seat that does not exist', () => {
    const estado = jugar(mesa({ manos: ['7s 8s', 'Kc', 'Qc'] }), 0, 1)
    expect(rechazo(estado, { type: 'mentiroso', asiento: 5 })).toBe('asiento-invalido')
  })
})

describe('going out', () => {
  it('a last play nobody calls goes out, and wins', () => {
    let estado = jugar(mesa({ manos: ['7s', 'Kc', 'Qc'] }), 0, 1)
    expect(estado.ganador).toBeNull() // not yet: the window is open
    estado = aplicar(estado, { type: 'cerrarVentana' })
    expect(estado.ganador).toBe(0)
  })

  it('a last play called and true goes out, and the caller takes the pile', () => {
    let estado = jugar(mesa({ manos: ['As', 'Kc', 'Qc'], pila: '3h' }), 0, 1)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 1 })
    expect(estado.ganador).toBe(0)
    expect(estado.manos[1]).toHaveLength(3)
  })

  it('a last play called and a lie takes the pile and plays on', () => {
    let estado = jugar(mesa({ manos: ['7s', 'Kc', 'Qc'], pila: '3h' }), 0, 1)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 1 })
    expect(estado.ganador).toBeNull()
    expect(estado.manos[0]).toHaveLength(2)
  })

  it('nothing is accepted once somebody has won', () => {
    const estado = aplicar(jugar(mesa({ manos: ['7s', 'Kc', 'Qc'] }), 0, 1), {
      type: 'cerrarVentana',
    })
    expect(rechazo(estado, { type: 'jugar', asiento: 1, cartaIds: primeras(estado, 1, 1) })).toBe(
      'partida-terminada',
    )
  })
})

describe("the seat's view", () => {
  it('shows its own hand only, and the pile as a count', () => {
    let estado = mesa({ manos: ['7s 8s', 'Kc Kd', 'Qc'], pila: '5h 5d' })
    estado = jugar(estado, 0, 1)
    const vista = vistaMentiroso(estado, 1)
    expect(vista.mano.map(describeCard)).toEqual(['K♣', 'K♦'])
    expect(vista.cartasPorAsiento).toEqual([1, 2, 1])
    expect(vista.pila).toBe(3)
    expect(vista.ultimaJugada).toEqual({ asiento: 0, cantidad: 1, rango: 'A' })
    // No other hand and no pile card anywhere in it.
    const texto = JSON.stringify(vista)
    for (const carta of [...estado.manos[0], ...estado.manos[2], ...estado.pila]) {
      expect(texto).not.toContain(`"${carta.id}"`)
    }
  })

  it('shows what a call turned over — it was turned face up for everybody', () => {
    let estado = jugar(mesa({ manos: ['7s 8s', 'Kc', 'Qc'] }), 0, 1)
    estado = aplicar(estado, { type: 'mentiroso', asiento: 2 })
    expect(vistaMentiroso(estado, 1).ultimaAcusacion!.cartas.map(describeCard)).toEqual(['7♠'])
  })
})

describe('a whole partida, played blind', () => {
  it('ends with one winner, every card accounted for at every step', () => {
    // Every seat plays one card it holds; the next seat calls every third play.
    let estado = empezarMentiroso({ jugadores: 4, seed: 'entera' })
    for (let paso = 0; paso < 10_000 && estado.ganador === null; paso++) {
      if (estado.fase === 'jugar') {
        estado = jugar(estado, estado.turno, 1)
      } else if (estado.numeroDeJugada % 3 === 0) {
        estado = aplicar(estado, { type: 'mentiroso', asiento: estado.turno })
      } else {
        estado = aplicar(estado, { type: 'cerrarVentana' })
      }
      expect(estado.manos.flat().length + estado.pila.length).toBe(52)
    }
    expect(estado.ganador).not.toBeNull()
  })
})

describe("the player's clock (Phase 80)", () => {
  it('plays one card of the hand in turn, the same one every time', async () => {
    const { jugadaDelReloj } = await import('@/lib/engine/mentiroso')
    const estado = empezarMentiroso({ jugadores: 4, seed: 'reloj' })
    const una = jugadaDelReloj(estado)!
    expect(jugadaDelReloj(estado)).toEqual(una)
    expect(una.type === 'jugar' && una.cartaIds).toHaveLength(1)
    expect(aplicarMentiroso(estado, una).ok).toBe(true)
  })

  it('has nothing to play during a window', async () => {
    const { jugadaDelReloj } = await import('@/lib/engine/mentiroso')
    expect(jugadaDelReloj(jugar(mesa({ manos: ['7s 8s', 'Kc', 'Qc'] }), 0, 1))).toBeNull()
  })
})
