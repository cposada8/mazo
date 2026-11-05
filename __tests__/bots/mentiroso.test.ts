import { describe, expect, it } from 'vitest'
import { type Card, type Rank, describeCard, parseCardSpecs } from '@/lib/engine'
import { type VistaMentiroso } from '@/lib/engine/mentiroso'
import {
  BOTS_MENTIROSO,
  EL_EMBUSTERO,
  jugarMentirosoConBots,
} from '@/lib/bots/mentiroso'

/** Phase 77: El Embustero, and a soak that proves every partida ends. */

let siguienteId = 0
const cartas = (notacion: string): Card[] =>
  parseCardSpecs(notacion.split(/\s+/).filter(Boolean)).map((spec) => {
    const id = `b${siguienteId++}`
    return spec.kind === 'comodin'
      ? { id, kind: 'comodin' }
      : { id, kind: 'normal', rank: spec.rank, suit: spec.suit }
  })

function vista(spec: {
  mano: string
  rangoEnTurno?: Rank
  cartasPorAsiento?: number[]
  ventana?: { asiento: number; cantidad: number; rango: Rank }
  asiento?: number
}): VistaMentiroso {
  const mano = cartas(spec.mano)
  return {
    asiento: spec.asiento ?? 0,
    mano,
    cartasPorAsiento: spec.cartasPorAsiento ?? [mano.length, 10, 10, 10],
    pila: 5,
    ultimaJugada: spec.ventana ?? null,
    rangoEnTurno: spec.rangoEnTurno ?? 'A',
    turno: 0,
    fase: spec.ventana ? 'ventana' : 'jugar',
    ultimaAcusacion: null,
    numeroDeJugada: 3,
    ganador: null,
  }
}

const jugadas = (v: VistaMentiroso) =>
  EL_EMBUSTERO.jugar(v).map((id) => describeCard(v.mano.find((c) => c.id === id)!))

describe('El Embustero plays', () => {
  it('every copy of the rank in turn, truthfully, when it has them', () => {
    expect(jugadas(vista({ mano: '7s 7h 9d 7c', rangoEnTurno: '7' }))).toEqual(['7♠', '7♥', '7♣'])
  })

  it('one card when it must lie: the one it will be asked for last', () => {
    // Four seats, playing the 5s now: its own next turns announce 9, K, 4, 8…
    // so a 9 is wanted next turn and a 3 is the furthest off.
    expect(jugadas(vista({ mano: '9s 3h K♦', rangoEnTurno: '5' }))).toEqual(['3♥'])
  })
})

describe('El Embustero calls', () => {
  it('a claim its own hand makes impossible', () => {
    // It holds two queens; three more were claimed. Five queens do not exist.
    const v = vista({ mano: 'Qs Qh 2c', asiento: 1, ventana: { asiento: 0, cantidad: 3, rango: 'Q' } })
    expect(EL_EMBUSTERO.acusar(v)).toBe(true)
  })

  it('a play that would take the player out', () => {
    const v = vista({
      mano: '2c',
      asiento: 1,
      cartasPorAsiento: [0, 1, 10, 10],
      ventana: { asiento: 0, cantidad: 1, rango: 'Q' },
    })
    expect(EL_EMBUSTERO.acusar(v)).toBe(true)
  })

  it('nothing else — a possible claim with cards left passes', () => {
    const v = vista({ mano: 'Qs 2c', asiento: 1, ventana: { asiento: 0, cantidad: 3, rango: 'Q' } })
    expect(EL_EMBUSTERO.acusar(v)).toBe(false)
  })

  it('never its own play', () => {
    const v = vista({ mano: 'Qs Qh', asiento: 0, ventana: { asiento: 0, cantidad: 4, rango: 'Q' } })
    expect(EL_EMBUSTERO.acusar(v)).toBe(false)
  })
})

describe('the soak', () => {
  it('1,000 bot partidas at 3 to 6 seats: every one ends, no move refused', () => {
    const terminadas: number[] = []
    for (const asientos of [3, 4, 5, 6]) {
      for (let i = 0; i < 250; i++) {
        const resultado = jugarMentirosoConBots({
          bots: Array(asientos).fill(EL_EMBUSTERO),
          seed: `soak-${asientos}-${i}`,
        })
        expect(resultado.sinTerminar, `seed soak-${asientos}-${i}`).toBe(false)
        terminadas.push(resultado.jugadas)
      }
    }
    expect(terminadas).toHaveLength(1000)
  })

  it('a bots-only partida replays exactly from its seed', () => {
    const una = jugarMentirosoConBots({ bots: Array(4).fill(EL_EMBUSTERO), seed: 'replay' })
    const otra = jugarMentirosoConBots({ bots: Array(4).fill(EL_EMBUSTERO), seed: 'replay' })
    expect([otra.estado.ganador, otra.jugadas, otra.acusaciones]).toEqual([
      una.estado.ganador,
      una.jugadas,
      una.acusaciones,
    ])
  })

  it('the catalog seats El Embustero', () => {
    expect(BOTS_MENTIROSO.map((bot) => bot.id)).toEqual(['embustero'])
  })
})

describe('El Embustero and its bullets', () => {
  it('never calls with none left — not even a claim it can prove false', () => {
    const v = {
      ...vista({ mano: 'Qs Qh 2c', asiento: 1, ventana: { asiento: 0, cantidad: 3, rango: 'Q' } }),
      balas: [3, 0, 3, 3],
    }
    expect(EL_EMBUSTERO.acusar(v)).toBe(false)
  })
})
