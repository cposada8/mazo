import { describe, expect, it } from 'vitest'
import {
  CARDS_PER_HAND,
  type Card,
  apply,
  contratoPorId,
  crearEscenario,
  describeCard,
  isComodin,
  parseCardSpec,
} from '@/lib/engine'

const written = (cards: readonly Card[]) => cards.map(describeCard)

describe('card notation', () => {
  it.each([
    ['7♠', '7', 'spades'],
    ['7s', '7', 'spades'],
    ['7S', '7', 'spades'],
    ['10♥', '10', 'hearts'],
    ['10h', '10', 'hearts'],
    ['A♦', 'A', 'diamonds'],
    ['ad', 'A', 'diamonds'],
    ['K♣', 'K', 'clubs'],
    ['kc', 'K', 'clubs'],
  ])('reads %s', (input, rank, suit) => {
    expect(parseCardSpec(input)).toEqual({ kind: 'normal', rank, suit })
  })

  it.each(['**', 'comodin', 'comodín', 'COMODIN'])('reads %s as a comodín', (input) => {
    expect(parseCardSpec(input)).toEqual({ kind: 'comodin' })
  })

  it('ignores surrounding spaces', () => {
    expect(parseCardSpec('  Qh ')).toEqual({ kind: 'normal', rank: 'Q', suit: 'hearts' })
  })

  it.each(['7x', 'Z♠', '', '11h', '♠'])('refuses %s', (input) => {
    expect(() => parseCardSpec(input)).toThrow(/is not a card/)
  })
})

describe('crearEscenario', () => {
  it('deals exactly the hand it was given', () => {
    const state = crearEscenario({
      manos: [
        ['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', 'K♠', 'K♥', 'K♦', '4♠', '4♥', '4♣'],
        ['A♦'],
      ],
    })

    expect(written(state.jugadores[0].hand)).toEqual([
      '7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', 'K♠', 'K♥', 'K♦', '4♠', '4♥', '4♣',
    ])
  })

  it('fills the rest of a hand up to twelve', () => {
    const state = crearEscenario({ manos: [['7♠', '7♥'], ['A♦']] })

    expect(state.jugadores[0].hand).toHaveLength(CARDS_PER_HAND)
    expect(state.jugadores[1].hand).toHaveLength(CARDS_PER_HAND)
    expect(written(state.jugadores[0].hand).slice(0, 2)).toEqual(['7♠', '7♥'])
  })

  it('hands out the stock in the order it was written', () => {
    const state = crearEscenario({
      manos: [['7♠'], ['A♦']],
      stock: ['9♦', '3♣', 'K♥'],
    })

    let current = state
    const drawn: string[] = []
    for (let i = 0; i < 3; i++) {
      const result = apply(current, { type: 'robar', de: 'stock' })
      if (!result.ok) throw new Error(result.code)
      const hand = result.state.jugadores[current.turno].hand
      drawn.push(describeCard(hand[hand.length - 1]))
      // Discard so the turn passes, then it comes back around.
      const discarded = apply(result.state, {
        type: 'descartar',
        cardId: hand[0].id,
      })
      if (!discarded.ok) throw new Error(discarded.code)
      current = discarded.state
    }

    expect(drawn).toEqual(['9♦', '3♣', 'K♥'])
  })

  it('puts the named descarte on top', () => {
    const state = crearEscenario({
      manos: [['7♠'], ['A♦']],
      descarte: ['2♣', 'J♠'],
    })

    expect(written(state.discard)).toEqual(['2♣', 'J♠'])
    expect(describeCard(state.discard.at(-1)!)).toBe('J♠')
  })

  it('turns one filler card up when no descarte is named', () => {
    const state = crearEscenario({ manos: [['7♠'], ['A♦']] })
    expect(state.discard).toHaveLength(1)
  })

  it('is the same scenario every time, for a given seed', () => {
    const build = () => crearEscenario({ manos: [['7♠'], ['A♦']], seed: 'igual' })
    expect(written(build().jugadores[0].hand)).toEqual(
      written(build().jugadores[0].hand),
    )
  })

  it('fills differently for a different seed', () => {
    const a = crearEscenario({ manos: [['7♠'], ['A♦']], seed: 'uno' })
    const b = crearEscenario({ manos: [['7♠'], ['A♦']], seed: 'dos' })
    expect(written(a.jugadores[0].hand)).not.toEqual(written(b.jugadores[0].hand))
  })

  it('never lets the filler duplicate a named card', () => {
    const state = crearEscenario({ manos: [['7♠', '7♠'], []], seed: 'copias' })
    const todos = [
      ...state.jugadores.flatMap((jugador) => jugador.hand),
      ...state.stock,
      ...state.discard,
    ]
    const sietesDePicas = todos.filter(
      (card) => !isComodin(card) && card.rank === '7' && card.suit === 'spades',
    )
    expect(sietesDePicas).toHaveLength(2)
    expect(new Set(todos.map((card) => card.id)).size).toBe(todos.length)
  })

  it('accepts both copies of a card', () => {
    const state = crearEscenario({ manos: [['7♠', '7♠'], ['A♦']] })
    expect(written(state.jugadores[0].hand).slice(0, 2)).toEqual(['7♠', '7♠'])
  })

  it('refuses a third copy, exactly like a real table', () => {
    expect(() => crearEscenario({ manos: [['7♠', '7♠', '7♠'], []] })).toThrow(
      /no 7♠ left in the deck/,
    )
  })

  it('refuses a comodín when the partida is being played without them', () => {
    expect(() =>
      crearEscenario({ manos: [['**'], []], comodines: false }),
    ).toThrow(/no comodín left/)
  })

  it('refuses a hand of more than twelve', () => {
    const trece = Array.from({ length: 13 }, () => '2♠')
    expect(() => crearEscenario({ manos: [trece, []] })).toThrow(/more than the 12/)
  })

  it('refuses an impossible table', () => {
    expect(() => crearEscenario({ manos: [['7♠']] })).toThrow(/2 to 6 seats/)
  })

  it('takes the contrato and the opening seat it is given', () => {
    const state = crearEscenario({
      manos: [[], [], []],
      contrato: contratoPorId('c8')!,
      empieza: 2,
    })
    expect(state.contrato.id).toBe('c8')
    expect(state.turno).toBe(2)
  })
})

describe('a scenario played out', () => {
  it('lets a dictated hand win the ronda on cue', () => {
    // Seat 0 holds four trios and draws the card it will discard.
    const state = crearEscenario({
      manos: [
        ['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', 'K♠', 'K♥', 'K♦', '4♠', '4♥', '4♣'],
        [],
      ],
      stock: ['9♦'],
      contrato: contratoPorId('c8')!,
    })

    const hand = state.jugadores[0].hand
    const byRank = (rank: string) =>
      hand.filter((card) => !isComodin(card) && card.rank === rank).map((c) => c.id)

    const robado = apply(state, { type: 'robar', de: 'stock' })
    if (!robado.ok) throw new Error(robado.code)

    const bajado = apply(robado.state, {
      type: 'bajarse',
      propuestas: [
        { kind: 'trio', rank: '7', cardIds: byRank('7') },
        { kind: 'trio', rank: 'Q', cardIds: byRank('Q') },
        { kind: 'trio', rank: 'K', cardIds: byRank('K') },
        { kind: 'trio', rank: '4', cardIds: byRank('4') },
      ],
    })
    if (!bajado.ok) throw new Error(`${bajado.code}: ${bajado.detail}`)

    const restante = bajado.state.jugadores[0].hand
    expect(written(restante)).toEqual(['9♦'])

    const final = apply(bajado.state, {
      type: 'descartar',
      cardId: restante[0].id,
    })
    if (!final.ok) throw new Error(final.code)

    expect(final.state.ganador).toBe(0)
  })
})
