import { describe, expect, it } from 'vitest'
import { type Card, type Escala, apply, isComodin } from '@/lib/engine'
import { jugadasParaGrupo } from '@/app/jugar/usePartida'
import { c, ids, makeRonda, n } from '../engine/helpers'

/**
 * What tapping a grupo means.
 *
 * A card can join a grupo in more than one way, and the player should not have
 * to say which — tapping means "this belongs here". These check that every
 * sensible reading is offered, and that the engine settles which one is legal.
 */

const primeraQueFunciona = (
  state: ReturnType<typeof makeRonda>,
  seleccionadas: Card[],
  seat: number,
  grupoIndex: number,
) => {
  for (const move of jugadasParaGrupo(seleccionadas, seat, grupoIndex)) {
    const result = apply(state, move)
    if (result.ok) return { move, state: result.state }
  }
  return null
}

const describeGrupo = (cards: readonly Card[]) =>
  cards.map((card) => (isComodin(card) ? '★' : card.rank)).join(' ')

describe('jugadasParaGrupo', () => {
  const carta = n('6', 'hearts')

  it('offers both ends first — extending changes the least', () => {
    const jugadas = jugadasParaGrupo([carta], 1, 0)
    expect(jugadas[0]).toMatchObject({ type: 'agregar', end: 'tail' })
    expect(jugadas[1]).toMatchObject({ type: 'agregar', end: 'head' })
  })

  it('then offers freeing a comodín', () => {
    const jugadas = jugadasParaGrupo([carta], 1, 0)
    expect(jugadas.slice(2)).toEqual([
      { type: 'moverComodin', seat: 1, grupoIndex: 0, cardId: carta.id, to: 'tail' },
      { type: 'moverComodin', seat: 1, grupoIndex: 0, cardId: carta.id, to: 'head' },
    ])
  })

  it('never offers to free a comodín with another comodín', () => {
    const jugadas = jugadasParaGrupo([c()], 1, 0)
    expect(jugadas.every((move) => move.type === 'agregar')).toBe(true)
  })

  it('never offers it for several cards at once — one card pays for one comodín', () => {
    const jugadas = jugadasParaGrupo([carta, n('7', 'hearts')], 1, 0)
    expect(jugadas.every((move) => move.type === 'agregar')).toBe(true)
  })

  it('offers nothing when nothing is selected', () => {
    expect(jugadasParaGrupo([], 1, 0)).toEqual([])
  })
})

describe('tapping a grupo, end to end', () => {
  /** The reported case: 5♥ comodín(6♥) 7♥ 8♥ on the mesa, the 6♥ in hand. */
  const conComodinEnMedio = () => {
    const comodin = c()
    const seis = n('6', 'hearts')
    const escala: Escala = {
      kind: 'escala',
      suit: 'hearts',
      start: '5',
      cards: [n('5', 'hearts'), comodin, n('7', 'hearts'), n('8', 'hearts')],
    }

    return {
      seis,
      comodin,
      state: makeRonda({
        jugadores: [
          { hand: [seis, n('2', 'spades')], bajadoEnTurno: 1 },
          { hand: [], grupos: [escala], bajadoEnTurno: 1 },
        ],
        numeroDeTurno: 3,
        fase: 'act',
      }),
    }
  }

  it('plays the 6♥ into the comodín’s place', () => {
    const { state, seis, comodin } = conComodinEnMedio()

    const resultado = primeraQueFunciona(state, [seis], 1, 0)

    expect(resultado).not.toBeNull()
    expect(resultado!.move.type).toBe('moverComodin')
    expect(describeGrupo(resultado!.state.jugadores[1].grupos[0].cards)).toBe(
      '5 6 7 8 ★',
    )
    // The comodín stayed in the grupo; the 6♥ left the hand.
    expect(ids(resultado!.state.jugadores[1].grupos[0].cards)).toContain(comodin.id)
    expect(ids(resultado!.state.jugadores[0].hand)).not.toContain(seis.id)
  })

  it('still extends normally when the card goes on an end', () => {
    const { state } = conComodinEnMedio()
    const nueve = n('9', 'hearts')
    const conNueve = {
      ...state,
      jugadores: state.jugadores.map((jugador, seat) =>
        seat === 0 ? { ...jugador, hand: [...jugador.hand, nueve] } : jugador,
      ),
    }

    const resultado = primeraQueFunciona(conNueve, [nueve], 1, 0)

    expect(resultado!.move.type).toBe('agregar')
    expect(describeGrupo(resultado!.state.jugadores[1].grupos[0].cards)).toBe(
      '5 ★ 7 8 9',
    )
  })

  it('refuses a card that belongs nowhere in the grupo', () => {
    const { state } = conComodinEnMedio()
    const intruso = n('2', 'spades')
    expect(primeraQueFunciona(state, [intruso], 1, 0)).toBeNull()
  })
})
