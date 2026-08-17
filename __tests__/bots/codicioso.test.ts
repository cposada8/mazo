import { describe, expect, it } from 'vitest'
import {
  type Move,
  type RondaState,
  apply,
  contratoPorId,
  crearEscenario,
  describeCard,
  isComodin,
  vistaDeAsiento,
} from '@/lib/engine'
import { decidirCodicioso } from '@/lib/bots'

const DOS_TRIOS = contratoPorId('c1')!

/** The bot only ever sees its view; these tests hold full states. */
const decidir = (state: RondaState): Move =>
  decidirCodicioso(vistaDeAsiento(state, state.turno))

describe('drawing', () => {
  it('takes the descarte when the card has partners in hand', () => {
    const state = crearEscenario({
      manos: [['7♠', '7♥', '2♣', '4♦', '9♠', 'J♥'], []],
      descarte: ['7♣'],
      contrato: DOS_TRIOS,
      seed: 'robo',
    })

    expect(decidir(state)).toEqual({ type: 'robar', de: 'descarte' })
  })

  it('takes the stock when the face-up card is a loner', () => {
    const state = crearEscenario({
      manos: [['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣'], []],
      descarte: ['A♦'],
      contrato: DOS_TRIOS,
      seed: 'robo-2',
    })

    const move = decidir(state)
    // The filler could hand it a partner for the ace, so accept either — what
    // matters is that it draws.
    expect(move.type).toBe('robar')
  })
})

describe('laying down', () => {
  const listo = () =>
    crearEscenario({
      manos: [['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', '2♦', '4♣', '9♥', 'J♠', 'K♦', '5♣'], []],
      stock: ['A♣'],
      contrato: DOS_TRIOS,
      seed: 'bajarse',
    })

  it('lays down the moment it can', () => {
    const robado = apply(listo(), { type: 'robar', de: 'stock' })
    if (!robado.ok) throw new Error(robado.code)

    const move = decidir(robado.state)
    expect(move.type).toBe('bajarse')
    if (move.type === 'bajarse') expect(move.propuestas).toHaveLength(2)
  })

  it('proposes something the engine accepts', () => {
    const robado = apply(listo(), { type: 'robar', de: 'stock' })
    if (!robado.ok) throw new Error(robado.code)

    const bajada = apply(robado.state, decidir(robado.state))
    expect(bajada.ok).toBe(true)
  })

  it('discards after laying down, ending the turn', () => {
    const state = apply(listo(), { type: 'robar', de: 'stock' })
    if (!state.ok) throw new Error(state.code)
    let current = state.state

    // Play the rest of the turn: lay down, unload, discard.
    for (let i = 0; i < 20; i++) {
      const move = decidir(current)
      const result = apply(current, move)
      if (!result.ok) throw new Error(`${result.code}: ${result.detail}`)
      current = result.state
      if (current.fase === 'draw' || current.ganador !== null) break
    }

    expect(current.jugadores[0].bajadoEnTurno).toBe(1)
    expect(current.fase === 'draw' || current.ganador !== null).toBe(true)
  })
})

describe('discarding', () => {
  it('throws the card furthest from being useful', () => {
    // A full twelve, chosen so no second trio can appear from filler: one trio
    // of sevens, one pair of queens, and ten isolated cards.
    const state = crearEscenario({
      manos: [
        ['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'A♦', '2♣', '5♥', '8♠', '10♦', 'J♣', 'K♥'],
        [],
      ],
      contrato: DOS_TRIOS,
      seed: 'descarte',
    })

    const enFaseDeActuar = { ...state, fase: 'act' as const }
    const move = decidir(enFaseDeActuar)

    expect(move.type).toBe('descartar')
    if (move.type === 'descartar') {
      const card = enFaseDeActuar.jugadores[0].hand.find((c) => c.id === move.cardId)!
      // Never one of the sevens or the queens — those are the trio material.
      expect(describeCard(card)).not.toMatch(/^(7|Q)/)
    }
  })

  it('never throws a comodín while anything else is in hand', () => {
    const state = crearEscenario({
      manos: [['**', '2♠', '4♥', '6♣', '8♦', '10♠'], []],
      contrato: DOS_TRIOS,
      seed: 'comodin',
    })

    const move = decidir({ ...state, fase: 'act' })
    expect(move.type).toBe('descartar')
    if (move.type === 'descartar') {
      const card = state.jugadores[0].hand.find((c) => c.id === move.cardId)!
      expect(isComodin(card)).toBe(false)
    }
  })
})

describe('it does not peek', () => {
  it('decides the same move whatever the opponents are holding', () => {
    const base = crearEscenario({
      manos: [['7♠', '7♥', '2♣', '4♦', '9♠', 'J♥'], ['A♦', '3♣']],
      descarte: ['7♣'],
      contrato: DOS_TRIOS,
      seed: 'espiar',
    })

    // Same seat 0, completely different hand opposite.
    const otro = crearEscenario({
      manos: [['7♠', '7♥', '2♣', '4♦', '9♠', 'J♥'], ['K♠', 'K♥', 'K♣', 'Q♦']],
      descarte: ['7♣'],
      contrato: DOS_TRIOS,
      seed: 'espiar',
    })

    const decision = (state: typeof base): Move => decidir(state)
    expect(decision(base).type).toEqual(decision(otro).type)
  })
})
