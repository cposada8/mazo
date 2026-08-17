import { describe, expect, it } from 'vitest'
import {
  type Escala,
  type Grupo,
  type Trio,
  addToTrio,
  apply,
  contratoPorId,
  extendEscala,
  repositionComodin,
  validateGrupo,
} from '@/lib/engine'
import { c, ids, makeRonda, n } from './helpers'

const DOS_TRIOS = contratoPorId('c1')!

const expectFail = (result: ReturnType<typeof apply>, code: string) => {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe(code)
}

const unwrap = (result: ReturnType<typeof apply>) => {
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`)
  return result.state
}

const describeGrupo = (grupo: Grupo): string =>
  grupo.cards
    .map((card) => (card.kind === 'comodin' ? '★' : `${card.rank}`))
    .join(' ')

// ------------------------------------------------------- reshaping a grupo

describe('addToTrio', () => {
  const base: Trio = {
    kind: 'trio',
    rank: '7',
    cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
  }

  it('appends a matching card', () => {
    const result = addToTrio(base, [n('7', 'diamonds')])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.grupo.cards).toHaveLength(4)
  })

  it('appends any number of comodines — a trio has no cap on the mesa', () => {
    const result = addToTrio(base, [c(), c(), c()])
    expect(result.ok).toBe(true)
  })

  it('refuses a card of another rank', () => {
    const result = addToTrio(base, [n('8', 'diamonds')])
    expect(result).toMatchObject({ ok: false, code: 'INVALID_RESULT' })
  })
})

describe('extendEscala', () => {
  const base: Escala = {
    kind: 'escala',
    suit: 'spades',
    start: '5',
    cards: [n('5', 'spades'), n('6', 'spades'), n('7', 'spades'), n('8', 'spades')],
  }

  it('extends the tail', () => {
    const result = extendEscala(base, [n('9', 'spades')], 'tail')
    expect(result.ok).toBe(true)
    if (result.ok) expect(describeGrupo(result.grupo)).toBe('5 6 7 8 9')
  })

  it('extends the head and moves the start back', () => {
    const result = extendEscala(base, [n('4', 'spades')], 'head')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.grupo as Escala).start).toBe('4')
      expect(describeGrupo(result.grupo)).toBe('4 5 6 7 8')
    }
  })

  it('extends the head by several cards at once', () => {
    const result = extendEscala(
      base,
      [n('3', 'spades'), n('4', 'spades')],
      'head',
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.grupo as Escala).start).toBe('3')
  })

  it('wraps around the ring: an escala starting on A extends back to K', () => {
    const desdeAs: Escala = {
      kind: 'escala',
      suit: 'hearts',
      start: 'A',
      cards: [n('A', 'hearts'), n('2', 'hearts'), n('3', 'hearts'), n('4', 'hearts')],
    }
    const result = extendEscala(desdeAs, [n('K', 'hearts')], 'head')
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.grupo as Escala).start).toBe('K')
  })

  it('refuses a card that does not continue the escala', () => {
    expect(extendEscala(base, [n('J', 'spades')], 'tail')).toMatchObject({
      ok: false,
      code: 'INVALID_RESULT',
    })
  })

  it('refuses a card of another suit', () => {
    expect(extendEscala(base, [n('9', 'hearts')], 'tail')).toMatchObject({
      ok: false,
      code: 'INVALID_RESULT',
    })
  })

  it('refuses a comodin that would sit next to another', () => {
    const conComodin: Escala = {
      kind: 'escala',
      suit: 'spades',
      start: '5',
      cards: [n('5', 'spades'), n('6', 'spades'), n('7', 'spades'), c()],
    }
    expect(extendEscala(conComodin, [c()], 'tail')).toMatchObject({
      ok: false,
      code: 'INVALID_RESULT',
    })
  })

  // The bug from the first real game: Q K A comodín(2) on the mesa, a 10 in
  // hand. Both readings of an end comodín are the same escala, so the 10 must
  // land, the comodín passing from 2 to J.
  describe('sliding an end comodín to the other extreme, for free', () => {
    const quinaAlta = (): Escala => ({
      kind: 'escala',
      suit: 'spades',
      start: 'Q',
      cards: [n('Q', 'spades'), n('K', 'spades'), n('A', 'spades'), c()],
    })

    it('lets a 10 extend Q K A comodín(2) at the head', () => {
      const result = extendEscala(quinaAlta(), [n('10', 'spades')], 'head')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(describeGrupo(result.grupo)).toBe('10 ★ Q K A')
        expect((result.grupo as Escala).start).toBe('10')
      }
    })

    it('mirrors: a 2 extends comodín(10) J Q K at the tail', () => {
      const conComodinAlFrente: Escala = {
        kind: 'escala',
        suit: 'hearts',
        start: '10',
        cards: [c(), n('J', 'hearts'), n('Q', 'hearts'), n('K', 'hearts')],
      }
      const result = extendEscala(conComodinAlFrente, [n('2', 'hearts')], 'tail')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(describeGrupo(result.grupo)).toBe('J Q K ★ 2')
        expect((result.grupo as Escala).start).toBe('J')
      }
    })

    it('prefers the plain extension when it fits', () => {
      // J extends the head directly; the comodín must stay put as the 2.
      const result = extendEscala(quinaAlta(), [n('J', 'spades')], 'head')
      expect(result.ok).toBe(true)
      if (result.ok) expect(describeGrupo(result.grupo)).toBe('J Q K A ★')
    })

    it('never slides a comodín into adjacency with another', () => {
      // comodín(J) Q K A comodín(2): sliding either way stacks the two.
      const dosExtremos: Escala = {
        kind: 'escala',
        suit: 'clubs',
        start: 'J',
        cards: [c(), n('Q', 'clubs'), n('K', 'clubs'), n('A', 'clubs'), c()],
      }
      expect(extendEscala(dosExtremos, [n('9', 'clubs')], 'head')).toMatchObject({
        ok: false,
        code: 'INVALID_RESULT',
      })
    })

    it('still refuses a card that fits neither reading', () => {
      expect(extendEscala(quinaAlta(), [n('5', 'spades')], 'head')).toMatchObject({
        ok: false,
        code: 'INVALID_RESULT',
      })
    })
  })
})

describe('repositionComodin — the worked example from the rules', () => {
  // The mesa holds 2♦ comodin(3♦) 4♦ 5♦.
  const comodin = c()
  const base: Escala = {
    kind: 'escala',
    suit: 'diamonds',
    start: '2',
    cards: [n('2', 'diamonds'), comodin, n('4', 'diamonds'), n('5', 'diamonds')],
  }

  it('takes the 3♦, frees the comodin to 6♦, and then takes the 7♦', () => {
    const paso1 = repositionComodin(base, n('3', 'diamonds'), 'tail')
    expect(paso1.ok).toBe(true)
    if (!paso1.ok) return

    expect(describeGrupo(paso1.grupo)).toBe('2 3 4 5 ★')
    expect(validateGrupo(paso1.grupo, 'mesa').ok).toBe(true)

    const paso2 = extendEscala(
      paso1.grupo as Escala,
      [n('7', 'diamonds')],
      'tail',
    )
    expect(paso2.ok).toBe(true)
    if (!paso2.ok) return

    // 2♦ 3♦ 4♦ 5♦ comodin(6♦) 7♦ — six cards, and the comodin never left.
    expect(describeGrupo(paso2.grupo)).toBe('2 3 4 5 ★ 7')
    expect(paso2.grupo.cards).toHaveLength(6)
    expect(ids(paso2.grupo.cards)).toContain(comodin.id)
  })

  it('can send the freed comodin to the head instead', () => {
    const result = repositionComodin(base, n('3', 'diamonds'), 'head')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.grupo as Escala).start).toBe('A')
      expect(describeGrupo(result.grupo)).toBe('★ 2 3 4 5')
    }
  })

  it('refuses a card of the wrong suit', () => {
    expect(repositionComodin(base, n('3', 'hearts'), 'tail')).toMatchObject({
      ok: false,
      code: 'WRONG_SUIT',
    })
  })

  it('refuses a card whose position is not held by a comodin', () => {
    expect(repositionComodin(base, n('4', 'diamonds'), 'tail')).toMatchObject({
      ok: false,
      code: 'NOT_A_COMODIN_POSITION',
    })
  })

  it('refuses a card outside the escala altogether', () => {
    expect(repositionComodin(base, n('9', 'diamonds'), 'tail')).toMatchObject({
      ok: false,
      code: 'NOT_A_COMODIN_POSITION',
    })
  })

  it('refuses a move that would leave two comodines adjacent', () => {
    const dos: Escala = {
      kind: 'escala',
      suit: 'diamonds',
      start: '2',
      cards: [n('2', 'diamonds'), c(), n('4', 'diamonds'), n('5', 'diamonds'), c()],
    }
    // Freeing the comodin at 3♦ and sending it to the tail would put it right
    // beside the one already standing for 6♦.
    expect(repositionComodin(dos, n('3', 'diamonds'), 'tail')).toMatchObject({
      ok: false,
      code: 'INVALID_RESULT',
    })
  })
})

// ------------------------------------------------------- who may touch it

describe('touching the mesa', () => {
  const trioAjeno: Trio = {
    kind: 'trio',
    rank: 'K',
    cards: [n('K', 'spades'), n('K', 'hearts'), n('K', 'clubs')],
  }

  const carta = n('K', 'diamonds')
  const nuevePropio = n('9', 'diamonds')

  const mesa = (overrides: {
    bajadoEnTurno?: number | null
    numeroDeTurno?: number
  }) =>
    makeRonda({
      contrato: DOS_TRIOS,
      jugadores: [
        {
          hand: [carta, nuevePropio, n('2', 'spades')],
          bajadoEnTurno: overrides.bajadoEnTurno ?? null,
          grupos: [
            {
              kind: 'trio',
              rank: '9',
              cards: [n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs')],
            },
          ],
        },
        { hand: [], grupos: [trioAjeno], bajadoEnTurno: 1 },
      ],
      numeroDeTurno: overrides.numeroDeTurno ?? 1,
      fase: 'act',
    })

  it('refuses everything before bajarse', () => {
    const state = mesa({ bajadoEnTurno: null })
    expectFail(
      apply(state, { type: 'agregar', seat: 1, grupoIndex: 0, cardIds: [carta.id] }),
      'NO_SE_HA_BAJADO',
    )
    expectFail(
      apply(state, { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [carta.id] }),
      'NO_SE_HA_BAJADO',
    )
  })

  it('keeps your own grupos shut on the very turn you bajaste', () => {
    const state = mesa({ bajadoEnTurno: 3, numeroDeTurno: 3 })
    expectFail(
      apply(state, {
        type: 'agregar',
        seat: 0,
        grupoIndex: 0,
        cardIds: [nuevePropio.id],
      }),
      'MESA_BLOQUEADA_MISMO_TURNO',
    )
  })

  it('opens your own grupos from the next turn on', () => {
    const state = mesa({ bajadoEnTurno: 3, numeroDeTurno: 5 })
    const after = unwrap(
      apply(state, {
        type: 'agregar',
        seat: 0,
        grupoIndex: 0,
        cardIds: [nuevePropio.id],
      }),
    )
    expect(after.jugadores[0].grupos[0].cards).toHaveLength(4)
    expect(ids(after.jugadores[0].hand)).not.toContain(nuevePropio.id)
  })

  /**
   * The bug that closed the same turn for good.
   *
   * Bajarse with `K ★(A) 2 3` — legal, one comodín — and then, that same turn,
   * play a second comodín as the `4` and the `5` behind it. Lay-down validation
   * would never have accepted the resulting escala, and the mesa was the way
   * around it.
   */
  it('does not let a second comodín in through your own grupo on the lay-down turn', () => {
    const sietes = [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')]
    const escala = [n('K', 'spades'), c(), n('2', 'spades'), n('3', 'spades')]
    const segundoComodin = c()
    const cinco = n('5', 'spades')
    const sobra = n('9', 'hearts')

    const bajado = unwrap(
      apply(
        makeRonda({
          contrato: contratoPorId('c2')!, // un trío y una escala
          jugadores: [
            { hand: [...sietes, ...escala, segundoComodin, cinco, sobra] },
            { hand: [n('4', 'hearts')] },
          ],
          fase: 'act',
        }),
        {
          type: 'bajarse',
          propuestas: [
            { kind: 'trio', rank: '7', cardIds: ids(sietes) },
            { kind: 'escala', suit: 'spades', start: 'K', cardIds: ids(escala) },
          ],
        },
      ),
    )

    expectFail(
      apply(bajado, {
        type: 'agregar',
        seat: 0,
        grupoIndex: 1,
        cardIds: [segundoComodin.id],
        end: 'tail',
      }),
      'MESA_BLOQUEADA_MISMO_TURNO',
    )

    // Not forbidden forever, only on the turn it lands: a turn later the same
    // comodín is a legal `4`, since it is not adjacent to the one standing for
    // the ace.
    const masTarde = { ...bajado, numeroDeTurno: bajado.numeroDeTurno + 2 }
    const conCuatro = unwrap(
      apply(masTarde, {
        type: 'agregar',
        seat: 0,
        grupoIndex: 1,
        cardIds: [segundoComodin.id],
        end: 'tail',
      }),
    )
    const conCinco = unwrap(
      apply(conCuatro, {
        type: 'agregar',
        seat: 0,
        grupoIndex: 1,
        cardIds: [cinco.id],
        end: 'tail',
      }),
    )
    expect(describeGrupo(conCinco.jugadores[0].grupos[1])).toBe('K ★ 2 3 ★ 5')
  })

  it("keeps another player's grupos shut on that same turn", () => {
    const state = mesa({ bajadoEnTurno: 3, numeroDeTurno: 3 })
    expectFail(
      apply(state, { type: 'agregar', seat: 1, grupoIndex: 0, cardIds: [carta.id] }),
      'MESA_BLOQUEADA_MISMO_TURNO',
    )
  })

  it("opens another player's grupos from the next turn on", () => {
    const state = mesa({ bajadoEnTurno: 3, numeroDeTurno: 5 })
    const after = unwrap(
      apply(state, { type: 'agregar', seat: 1, grupoIndex: 0, cardIds: [carta.id] }),
    )
    expect(after.jugadores[1].grupos[0].cards).toHaveLength(4)
    expect(ids(after.jugadores[0].hand)).not.toContain(carta.id)
  })

  it('refuses before the card for the turn has been drawn', () => {
    const state = makeRonda({
      jugadores: [
        { hand: [carta], bajadoEnTurno: 1, grupos: [trioAjeno] },
        { hand: [] },
      ],
      numeroDeTurno: 3,
      fase: 'draw',
    })
    expectFail(
      apply(state, { type: 'agregar', seat: 0, grupoIndex: 0, cardIds: [carta.id] }),
      'FASE_EQUIVOCADA',
    )
  })

  it('refuses a grupo that does not exist', () => {
    const state = mesa({ bajadoEnTurno: 1, numeroDeTurno: 5 })
    expectFail(
      apply(state, { type: 'agregar', seat: 1, grupoIndex: 9, cardIds: [carta.id] }),
      'NO_EXISTE_EL_GRUPO',
    )
  })

  it('refuses to move a comodin in a trio, which has no order', () => {
    const state = mesa({ bajadoEnTurno: 1, numeroDeTurno: 5 })
    expectFail(
      apply(state, {
        type: 'moverComodin',
        seat: 1,
        grupoIndex: 0,
        cardId: carta.id,
        to: 'tail',
      }),
      'NO_ES_UNA_ESCALA',
    )
  })
})

describe('moving a comodin through a ronda', () => {
  it("reshapes an opponent's escala and unloads two cards", () => {
    const comodin = c()
    const escalaAjena: Escala = {
      kind: 'escala',
      suit: 'diamonds',
      start: '2',
      cards: [n('2', 'diamonds'), comodin, n('4', 'diamonds'), n('5', 'diamonds')],
    }

    const tres = n('3', 'diamonds')
    const siete = n('7', 'diamonds')

    const state = makeRonda({
      jugadores: [
        { hand: [tres, siete, n('2', 'spades')], bajadoEnTurno: 1 },
        { hand: [], grupos: [escalaAjena], bajadoEnTurno: 1 },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })

    const conTres = unwrap(
      apply(state, {
        type: 'moverComodin',
        seat: 1,
        grupoIndex: 0,
        cardId: tres.id,
        to: 'tail',
      }),
    )
    expect(describeGrupo(conTres.jugadores[1].grupos[0])).toBe('2 3 4 5 ★')

    const conSiete = unwrap(
      apply(conTres, {
        type: 'agregar',
        seat: 1,
        grupoIndex: 0,
        cardIds: [siete.id],
      }),
    )

    expect(describeGrupo(conSiete.jugadores[1].grupos[0])).toBe('2 3 4 5 ★ 7')
    expect(conSiete.jugadores[0].hand).toHaveLength(1)
    // The comodin stayed where it was laid — it never entered a hand.
    expect(ids(conSiete.jugadores[1].grupos[0].cards)).toContain(comodin.id)
  })

  it('refuses to pay for a comodin with another comodin', () => {
    const escalaAjena: Escala = {
      kind: 'escala',
      suit: 'diamonds',
      start: '2',
      cards: [n('2', 'diamonds'), c(), n('4', 'diamonds'), n('5', 'diamonds')],
    }
    const otro = c()

    const state = makeRonda({
      jugadores: [
        { hand: [otro, n('2', 'spades')], bajadoEnTurno: 1 },
        { hand: [], grupos: [escalaAjena], bajadoEnTurno: 1 },
      ],
      numeroDeTurno: 3,
      fase: 'act',
    })

    expectFail(
      apply(state, {
        type: 'moverComodin',
        seat: 1,
        grupoIndex: 0,
        cardId: otro.id,
        to: 'tail',
      }),
      'COMODIN_NO_SE_PUEDE_MOVER',
    )
  })
})

describe('the 5 ** 7 8 case', () => {
  /**
   * Reported from a real game: an opponent had 5♥ comodín 7♥ 8♥ on the mesa,
   * the player held the 6♥ that the comodín was standing for, and tapping the
   * grupo was refused.
   *
   * The move is legal — it is a comodín reposition, not an extension — so this
   * pins down that the engine accepts it and that plain `agregar` does not,
   * which is the whole reason the interface has to try both.
   */
  const escenario = () => {
    const comodin = c()
    const seis = n('6', 'hearts')

    return {
      comodin,
      seis,
      state: makeRonda({
        jugadores: [
          { hand: [seis, n('2', 'spades'), n('9', 'clubs')], bajadoEnTurno: 1 },
          {
            hand: [],
            bajadoEnTurno: 1,
            grupos: [
              {
                kind: 'escala',
                suit: 'hearts',
                start: '5',
                cards: [n('5', 'hearts'), comodin, n('7', 'hearts'), n('8', 'hearts')],
              },
            ],
          },
        ],
        numeroDeTurno: 3,
        fase: 'act',
      }),
    }
  }

  it('refuses it as a plain add — the 6 does not go on either end', () => {
    const { state, seis } = escenario()

    for (const end of ['tail', 'head'] as const) {
      expectFail(
        apply(state, { type: 'agregar', seat: 1, grupoIndex: 0, cardIds: [seis.id], end }),
        'EDICION_INVALIDA',
      )
    }
  })

  it('accepts it as a comodín reposition', () => {
    const { state, seis, comodin } = escenario()

    const after = unwrap(
      apply(state, {
        type: 'moverComodin',
        seat: 1,
        grupoIndex: 0,
        cardId: seis.id,
        to: 'tail',
      }),
    )

    expect(describeGrupo(after.jugadores[1].grupos[0])).toBe('5 6 7 8 ★')
    expect(ids(after.jugadores[0].hand)).not.toContain(seis.id)
    expect(ids(after.jugadores[1].grupos[0].cards)).toContain(comodin.id)
  })
})

describe('immutability', () => {
  it('never changes the state it was given', () => {
    const carta = n('2', 'hearts')
    const state = makeRonda({
      jugadores: [{ hand: [carta, n('3', 'hearts')] }, { hand: [] }],
      fase: 'act',
    })
    const before = JSON.stringify(state)

    apply(state, { type: 'descartar', cardId: carta.id })

    expect(JSON.stringify(state)).toBe(before)
  })
})
