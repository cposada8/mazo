import { describe, expect, it } from 'vitest'
import {
  type Card,
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
import { c, makeRonda, n } from '../engine/helpers'

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

describe('drawing once bajado', () => {
  // Bajado on turn 1; it is now turn 3, so the mesa is open.
  const bajado = (descarte: string) => {
    const state = crearEscenario({
      manos: [['9♠', '2♣'], ['A♦', '3♣', '4♥', '6♠']],
      descarte: [descarte],
      contrato: DOS_TRIOS,
      seed: 'bajado',
    })
    return {
      ...state,
      numeroDeTurno: 3,
      jugadores: state.jugadores.map((jugador, seat) =>
        seat === 0
          ? {
              ...jugador,
              bajadoEnTurno: 1,
              grupos: [
                {
                  kind: 'trio' as const,
                  rank: '7' as const,
                  cards: [
                    { id: '7-s#90', kind: 'normal' as const, rank: '7' as const, suit: 'spades' as const },
                    { id: '7-h#91', kind: 'normal' as const, rank: '7' as const, suit: 'hearts' as const },
                    { id: '7-c#92', kind: 'normal' as const, rank: '7' as const, suit: 'clubs' as const },
                  ],
                },
              ],
            }
          : jugador,
      ),
    }
  }

  it('ignores a "useful" descarte card it cannot ligar — the loop that stalled seed soak-204', () => {
    // 9♥ pairs the 9♠ in hand, which is contract-utility — but the player is
    // already bajado, so utility means nothing and it does not ligar anywhere.
    expect(decidir(bajado('9♥'))).toEqual({ type: 'robar', de: 'stock' })
  })

  it('takes the descarte card that ligadoes right now', () => {
    // The fourth 7 lands straight on the trio of 7s.
    expect(decidir(bajado('7♦'))).toEqual({ type: 'robar', de: 'descarte' })
  })
})

describe('the mesa has two doors', () => {
  /**
   * A table where seat 1's escala of hearts runs 5-6-7-8 with a **comodín**
   * standing in for the 6. Nothing can be added at either end without a 4♥ or
   * a 9♥, so the only way a 6♥ gets onto this mesa is by taking the slot the
   * comodín is holding — `moverComodin`, the door the bot used not to know.
   */
  const conComodinEnLaEscala = (mano: Card[], fase: 'draw' | 'act', descarte: Card[]) => {
    const escala = {
      kind: 'escala' as const,
      suit: 'hearts' as const,
      start: '5' as const,
      cards: [n('5', 'hearts'), c(), n('7', 'hearts'), n('8', 'hearts')],
    }
    const trioDeReyes = {
      kind: 'trio' as const,
      rank: 'K' as const,
      cards: [n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs')],
    }

    return makeRonda({
      jugadores: [
        { hand: mano, grupos: [trioDeReyes], bajadoEnTurno: 1 },
        { hand: [n('A', 'spades'), n('3', 'clubs')], grupos: [escala], bajadoEnTurno: 1 },
      ],
      // Bajado on turn 1, and it is turn 3: the mesa is open again.
      numeroDeTurno: 3,
      fase,
      discard: descarte,
    })
  }

  it('takes the descarte card that only a comodín swap can place', () => {
    const state = conComodinEnLaEscala(
      [n('9', 'spades'), n('2', 'clubs')],
      'draw',
      [n('6', 'hearts')],
    )

    expect(decidir(state)).toEqual({ type: 'robar', de: 'descarte' })
  })

  it('still draws blind when the same card has nowhere to go', () => {
    // The 6♠ is the same rank in the wrong suit: no escala of spades, no trio
    // of sixes, and a comodín only ever stands for one exact card.
    const state = conComodinEnLaEscala(
      [n('9', 'spades'), n('2', 'clubs')],
      'draw',
      [n('6', 'spades')],
    )

    expect(decidir(state)).toEqual({ type: 'robar', de: 'stock' })
  })

  it('frees the comodín, and the engine takes the move', () => {
    const seis = n('6', 'hearts')
    const state = conComodinEnLaEscala(
      [seis, n('9', 'spades'), n('2', 'clubs')],
      'act',
      [n('A', 'diamonds')],
    )

    const move = decidir(state)
    expect(move).toEqual({
      type: 'moverComodin',
      seat: 1,
      grupoIndex: 0,
      cardId: seis.id,
      to: 'tail',
    })
    expect(apply(state, move).ok).toBe(true)
  })
})

describe('discarding once bajado', () => {
  /**
   * The bug this fixes: bajado, the bot went on scoring its hand by progress
   * toward a contrato it had already laid down — so a pair of fours, worth
   * nothing to anybody now, outranked the card that had a home waiting on
   * somebody's escala.
   */
  const bajadoConUnaEscalaAjena = () => {
    const escalaDeDiamantes = {
      kind: 'escala' as const,
      suit: 'diamonds' as const,
      start: '5' as const,
      cards: [
        n('5', 'diamonds'),
        n('6', 'diamonds'),
        n('7', 'diamonds'),
        n('8', 'diamonds'),
      ],
    }
    const trioDeReyes = {
      kind: 'trio' as const,
      rank: 'K' as const,
      cards: [n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs')],
    }

    return makeRonda({
      // 10♦ ligadoes nowhere today — the escala needs a 9♦ first — but it is
      // two steps from a real end. The fours are two steps from nothing.
      jugadores: [
        {
          hand: [n('10', 'diamonds'), n('4', 'clubs'), n('4', 'hearts')],
          grupos: [trioDeReyes],
          bajadoEnTurno: 1,
        },
        { hand: [n('A', 'spades'), n('3', 'clubs')], grupos: [escalaDeDiamantes], bajadoEnTurno: 1 },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })
  }

  it('keeps the card the mesa can still grow to take', () => {
    const state = bajadoConUnaEscalaAjena()
    const move = decidir(state)

    expect(move.type).toBe('descartar')
    if (move.type === 'descartar') {
      const card = state.jugadores[0].hand.find((carta) => carta.id === move.cardId)!
      expect(describeCard(card)).toMatch(/^4/)
    }
  })
})
