import { describe, expect, it } from 'vitest'
import {
  CARDS_PER_HAND,
  apply,
  contratoPorId,
  startRonda,
} from '@/lib/engine'
import { c, ids, makeRonda, n, play } from './helpers'

const DOS_TRIOS = contratoPorId('c1')!
const CUATRO_TRIOS = contratoPorId('c8')!

const expectFail = (result: ReturnType<typeof apply>, code: string) => {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe(code)
}

const unwrap = (result: ReturnType<typeof apply>) => {
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`)
  return result.state
}

describe('startRonda', () => {
  const state = startRonda({ contrato: DOS_TRIOS, players: 4, seed: 'inicio' })

  it('deals twelve to everyone and turns one card up', () => {
    expect(state.jugadores).toHaveLength(4)
    for (const jugador of state.jugadores) {
      expect(jugador.hand).toHaveLength(CARDS_PER_HAND)
      expect(jugador.grupos).toEqual([])
      expect(jugador.bajadoEnTurno).toBeNull()
    }
    expect(state.discard).toHaveLength(1)
  })

  it('starts on seat 0, turn 1, waiting for a draw', () => {
    expect(state.turno).toBe(0)
    expect(state.numeroDeTurno).toBe(1)
    expect(state.fase).toBe('draw')
    expect(state.ganador).toBeNull()
  })

  it('is repeatable from its seed', () => {
    const again = startRonda({ contrato: DOS_TRIOS, players: 4, seed: 'inicio' })
    expect(again.jugadores.map((j) => ids(j.hand))).toEqual(
      state.jugadores.map((j) => ids(j.hand)),
    )
  })
})

describe('drawing', () => {
  it('takes the top of the stock and moves to the acting phase', () => {
    const top = n('K', 'spades')
    const state = makeRonda({
      jugadores: [{ hand: [n('2', 'hearts')] }, { hand: [] }],
      stock: [n('4', 'clubs'), top],
    })

    const after = unwrap(apply(state, { type: 'robar', de: 'stock' }))
    expect(ids(after.jugadores[0].hand)).toContain(top.id)
    expect(after.stock).toHaveLength(1)
    expect(after.fase).toBe('act')
  })

  it('takes the top of the descarte instead', () => {
    const top = n('K', 'spades')
    const state = makeRonda({
      jugadores: [{ hand: [] }, { hand: [] }],
      discard: [n('3', 'hearts'), top],
    })

    const after = unwrap(apply(state, { type: 'robar', de: 'descarte' }))
    expect(ids(after.jugadores[0].hand)).toEqual([top.id])
    expect(after.discard).toHaveLength(1)
  })

  it('refuses a second draw in the same turn', () => {
    const state = makeRonda({ jugadores: [{ hand: [] }, { hand: [] }] })
    const after = unwrap(apply(state, { type: 'robar', de: 'stock' }))
    expectFail(apply(after, { type: 'robar', de: 'stock' }), 'FASE_EQUIVOCADA')
  })

  it('refuses to discard or lay down before drawing', () => {
    const card = n('2', 'hearts')
    const state = makeRonda({ jugadores: [{ hand: [card] }, { hand: [] }] })
    expectFail(
      apply(state, { type: 'descartar', cardId: card.id }),
      'FASE_EQUIVOCADA',
    )
    expectFail(apply(state, { type: 'bajarse', propuestas: [] }), 'FASE_EQUIVOCADA')
  })
})

describe('when the stock runs out', () => {
  const buried = [n('4', 'clubs'), n('5', 'clubs'), n('6', 'clubs')]
  const top = n('7', 'clubs')

  const empty = () =>
    makeRonda({
      jugadores: [{ hand: [] }, { hand: [] }],
      stock: [],
      discard: [...buried, top],
    })

  it('shuffles the descarte back in and keeps playing', () => {
    const after = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))

    // Three cards were buried; one is now in hand, two remain as the stock.
    expect(after.jugadores[0].hand).toHaveLength(1)
    expect(after.stock).toHaveLength(2)
    expect(after.fase).toBe('act')
  })

  it('leaves the top card face up, so the pile is never empty', () => {
    const after = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))
    expect(ids(after.discard)).toEqual([top.id])
  })

  it('never reshuffles the top card back into the stock', () => {
    const after = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))
    expect(ids(after.stock)).not.toContain(top.id)
    expect(ids(after.jugadores[0].hand)).not.toContain(top.id)
  })

  it('advances the random stream, so a later reshuffle differs', () => {
    const after = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))
    expect(after.rngState).not.toBe(empty().rngState)
  })

  it('is deterministic', () => {
    const a = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))
    const b = unwrap(apply(empty(), { type: 'robar', de: 'stock' }))
    expect(ids(a.stock)).toEqual(ids(b.stock))
  })

  it('gives up only when there is genuinely nothing left', () => {
    const state = makeRonda({
      jugadores: [{ hand: [] }, { hand: [] }],
      stock: [],
      discard: [top],
    })
    expectFail(apply(state, { type: 'robar', de: 'stock' }), 'SIN_CARTAS')
  })
})

describe('bajarse', () => {
  const sietes = [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')]
  const reinas = [n('Q', 'spades'), n('Q', 'hearts'), n('Q', 'clubs')]
  const extra = [n('2', 'diamonds'), n('3', 'diamonds')]

  const ready = (contrato = DOS_TRIOS) =>
    unwrap(
      apply(
        makeRonda({
          contrato,
          jugadores: [{ hand: [...sietes, ...reinas, ...extra] }, { hand: [] }],
        }),
        { type: 'robar', de: 'stock' },
      ),
    )

  const dosTrios = [
    { kind: 'trio' as const, rank: '7' as const, cardIds: ids(sietes) },
    { kind: 'trio' as const, rank: 'Q' as const, cardIds: ids(reinas) },
  ]

  it('accepts a proposal that matches the contract', () => {
    const after = unwrap(apply(ready(), { type: 'bajarse', propuestas: dosTrios }))
    expect(after.jugadores[0].grupos).toHaveLength(2)
    expect(after.jugadores[0].bajadoEnTurno).toBe(1)
    expect(after.jugadores[0].hand).toHaveLength(3) // 9 - 6, plus the drawn card
  })

  it('refuses the wrong number of grupos', () => {
    expectFail(
      apply(ready(), { type: 'bajarse', propuestas: [dosTrios[0]] }),
      'CONTRATO_NO_COINCIDE',
    )
  })

  it('refuses the right count of the wrong kind', () => {
    expectFail(
      apply(ready(contratoPorId('c3')!), { type: 'bajarse', propuestas: dosTrios }),
      'CONTRATO_NO_COINCIDE',
    )
  })

  it('refuses an invalid grupo', () => {
    expectFail(
      apply(ready(), {
        type: 'bajarse',
        propuestas: [
          { kind: 'trio', rank: '7', cardIds: [sietes[0].id, sietes[1].id, extra[0].id] },
          dosTrios[1],
        ],
      }),
      'GRUPO_INVALIDO',
    )
  })

  it('refuses cards that are not in the hand', () => {
    const stranger = n('7', 'diamonds')
    expectFail(
      apply(ready(), {
        type: 'bajarse',
        propuestas: [
          { kind: 'trio', rank: '7', cardIds: [sietes[0].id, sietes[1].id, stranger.id] },
          dosTrios[1],
        ],
      }),
      'CARTA_NO_ESTA_EN_LA_MANO',
    )
  })

  it('refuses to lay down twice', () => {
    const after = unwrap(apply(ready(), { type: 'bajarse', propuestas: dosTrios }))
    expectFail(apply(after, { type: 'bajarse', propuestas: dosTrios }), 'YA_SE_BAJO')
  })

  it('goes out on the spot when the bajada consumes the whole hand', () => {
    // Four trios is twelve cards; laid from a hand of exactly twelve there is
    // nothing left to discard — and an empty hand wins, however it was emptied.
    const cuatro = [
      ...sietes,
      ...reinas,
      n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs'),
      n('4', 'spades'), n('4', 'hearts'), n('4', 'clubs'),
    ]
    const state = makeRonda({
      contrato: CUATRO_TRIOS,
      jugadores: [{ hand: cuatro }, { hand: [] }],
      fase: 'act',
    })

    const after = unwrap(
      apply(state, {
        type: 'bajarse',
        propuestas: [
          { kind: 'trio', rank: '7', cardIds: ids(cuatro.slice(0, 3)) },
          { kind: 'trio', rank: 'Q', cardIds: ids(cuatro.slice(3, 6)) },
          { kind: 'trio', rank: 'K', cardIds: ids(cuatro.slice(6, 9)) },
          { kind: 'trio', rank: '4', cardIds: ids(cuatro.slice(9, 12)) },
        ],
      }),
    )
    expect(after.ganador).toBe(0)
    expect(after.jugadores[0].hand).toEqual([])
    expect(after.jugadores[0].grupos).toHaveLength(4)
  })
})

describe('discarding and turn order', () => {
  it('passes the turn and asks the next player to draw', () => {
    const card = n('2', 'hearts')
    const state = makeRonda({
      jugadores: [{ hand: [card, n('5', 'spades')] }, { hand: [] }, { hand: [] }],
      fase: 'act',
    })

    const after = unwrap(apply(state, { type: 'descartar', cardId: card.id }))
    expect(after.turno).toBe(1)
    expect(after.numeroDeTurno).toBe(2)
    expect(after.fase).toBe('draw')
    expect(after.discard.at(-1)!.id).toBe(card.id)
  })

  it('wraps around the table', () => {
    const cards = [n('2', 'hearts'), n('3', 'hearts')]
    const state = makeRonda({
      jugadores: [{ hand: [] }, { hand: [] }, { hand: cards }],
      turno: 2,
      fase: 'act',
    })
    const after = unwrap(apply(state, { type: 'descartar', cardId: cards[0].id }))
    expect(after.turno).toBe(0)
  })

  it('refuses a card that is not in hand', () => {
    const state = makeRonda({
      jugadores: [{ hand: [n('2', 'hearts')] }, { hand: [] }],
      fase: 'act',
    })
    expectFail(
      apply(state, { type: 'descartar', cardId: 'nope' }),
      'CARTA_NO_ESTA_EN_LA_MANO',
    )
  })
})

describe('going out', () => {
  it('ends the ronda when the last card is discarded', () => {
    const last = n('2', 'hearts')
    const state = makeRonda({
      jugadores: [{ hand: [last], bajadoEnTurno: 1 }, { hand: [] }],
      fase: 'act',
    })

    const after = unwrap(apply(state, { type: 'descartar', cardId: last.id }))
    expect(after.ganador).toBe(0)
    expect(after.jugadores[0].hand).toEqual([])
  })

  it('ends the ronda when the last card is ligada onto a grupo', () => {
    // The exact freeze from the bug report: every card unloaded onto the mesa,
    // and a turn that could not end because there was nothing left to discard.
    const ultima = n('7', 'diamonds')
    const state = makeRonda({
      jugadores: [
        {
          hand: [ultima],
          grupos: [
            {
              kind: 'trio',
              rank: '7',
              cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
            },
          ],
          bajadoEnTurno: 1,
        },
        { hand: [n('2', 'spades')] },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })

    const after = unwrap(
      apply(state, { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [ultima.id] }),
    )
    expect(after.ganador).toBe(0)
    expect(after.jugadores[0].hand).toEqual([])
    // The last card lies on the mesa, not on the descarte.
    expect(ids(after.jugadores[0].grupos[0].cards)).toContain(ultima.id)
    expect(ids(after.discard)).not.toContain(ultima.id)
  })

  it('ends the ronda when the last card frees a comodín', () => {
    const seis = n('6', 'hearts')
    const state = makeRonda({
      jugadores: [
        {
          hand: [seis],
          grupos: [
            {
              kind: 'escala',
              suit: 'hearts',
              start: '5',
              cards: [n('5', 'hearts'), c(), n('7', 'hearts'), n('8', 'hearts')],
            },
          ],
          bajadoEnTurno: 1,
        },
        { hand: [n('2', 'spades')] },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })

    const after = unwrap(
      apply(state, {
        type: 'moverComodin',
        seat: 0,
        grupoIndex: 0,
        cardId: seis.id,
        to: 'tail',
      }),
    )
    expect(after.ganador).toBe(0)
    expect(after.jugadores[0].hand).toEqual([])
  })

  it('refuses every move once a ligada closed the ronda', () => {
    const ultima = n('7', 'diamonds')
    const state = makeRonda({
      jugadores: [
        {
          hand: [ultima],
          grupos: [
            {
              kind: 'trio',
              rank: '7',
              cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
            },
          ],
          bajadoEnTurno: 1,
        },
        { hand: [n('2', 'spades')] },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })
    const cerrada = unwrap(
      apply(state, { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [ultima.id] }),
    )
    expectFail(apply(cerrada, { type: 'robar', de: 'stock' }), 'RONDA_TERMINADA')
  })

  it('refuses every move once the ronda is over', () => {
    const last = n('2', 'hearts')
    const state = makeRonda({
      jugadores: [{ hand: [last], bajadoEnTurno: 1 }, { hand: [] }],
      fase: 'act',
    })
    const finished = unwrap(apply(state, { type: 'descartar', cardId: last.id }))
    expectFail(apply(finished, { type: 'robar', de: 'stock' }), 'RONDA_TERMINADA')
  })
})

describe('a ronda played to the end', () => {
  it('is won in one turn under cuatro tríos, where bajarse is going out', () => {
    const doce = [
      n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'),
      n('Q', 'spades'), n('Q', 'hearts'), n('Q', 'clubs'),
      n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs'),
      n('4', 'spades'), n('4', 'hearts'), n('4', 'clubs'),
    ]
    const drawn = n('9', 'diamonds')

    const state = makeRonda({
      contrato: CUATRO_TRIOS,
      jugadores: [{ hand: doce }, { hand: [n('2', 'spades')] }],
      stock: [n('8', 'clubs'), drawn],
    })

    const end = play(state, [
      { type: 'robar', de: 'stock' },
      {
        type: 'bajarse',
        propuestas: [
          { kind: 'trio', rank: '7', cardIds: ids(doce.slice(0, 3)) },
          { kind: 'trio', rank: 'Q', cardIds: ids(doce.slice(3, 6)) },
          { kind: 'trio', rank: 'K', cardIds: ids(doce.slice(6, 9)) },
          { kind: 'trio', rank: '4', cardIds: ids(doce.slice(9, 12)) },
        ],
      },
      { type: 'descartar', cardId: drawn.id },
    ])

    expect(end.ganador).toBe(0)
    expect(end.jugadores[0].grupos).toHaveLength(4)
    expect(end.jugadores[1].hand).toHaveLength(1)
  })

  it('takes three turns when there are cards left to unload', () => {
    const sietes = [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')]
    const reinas = [n('Q', 'spades'), n('Q', 'hearts'), n('Q', 'clubs')]
    const septimo = n('7', 'diamonds')
    const reinaExtra = n('Q', 'diamonds')
    const septimoTardio = n('7', 'spades') // the second 7♠ — two decks are in play

    const primera = n('9', 'spades') // drawn on turn 1
    const delRival = n('6', 'clubs') // drawn on turn 2
    const ultima = n('10', 'spades') // drawn on turn 3

    const rival = [n('2', 'hearts'), n('5', 'hearts')]

    const state = makeRonda({
      contrato: DOS_TRIOS,
      jugadores: [
        { hand: [...sietes, ...reinas, septimo, reinaExtra, septimoTardio] },
        { hand: rival },
      ],
      // Drawn from the end, so: primera, then delRival, then ultima.
      stock: [n('8', 'clubs'), ultima, delRival, primera],
    })

    const end = play(state, [
      // Turn 1 — seat 0 lays the contract down. The spare seventh and queen
      // stay in hand: the mesa is shut on the turn you bajarte.
      { type: 'robar', de: 'stock' },
      {
        type: 'bajarse',
        propuestas: [
          { kind: 'trio', rank: '7', cardIds: ids(sietes) },
          { kind: 'trio', rank: 'Q', cardIds: ids(reinas) },
        ],
      },
      { type: 'descartar', cardId: primera.id },

      // Turn 2 — seat 1 draws and discards.
      { type: 'robar', de: 'stock' },
      { type: 'descartar', cardId: rival[0].id },

      // Turn 3 — the mesa is open now. Seat 0 unloads everything and goes out.
      { type: 'robar', de: 'stock' },
      { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [septimo.id] },
      { type: 'agregar', seat: 0, grupoIndex: 1, cardIds: [reinaExtra.id] },
      { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [septimoTardio.id] },
      { type: 'descartar', cardId: ultima.id },
    ])

    expect(end.ganador).toBe(0)
    expect(end.numeroDeTurno).toBe(3)
    expect(end.jugadores[0].hand).toEqual([])
    expect(end.jugadores[0].grupos[0].cards).toHaveLength(5)
    expect(end.jugadores[0].grupos[1].cards).toHaveLength(4)
    expect(end.jugadores[1].hand).toHaveLength(2)
  })
})
