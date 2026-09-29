import { describe, expect, it } from 'vitest'
import { type Card, type Grupo, type Move, type RondaState, apply, contratoPorId, vistaDeAsiento } from '@/lib/engine'
import { BOTS, ampliarBajada, decidirCalculador, jugarTorneo, todasLasAgrupaciones } from '@/lib/bots'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 54: El Calculador, the first bot above the Fácil level. The three
 * things it does that the Fácil bots do not, each pinned on a hand small
 * enough to read.
 */

const DOS_TRIOS = contratoPorId('c1')!

const decidir = (state: RondaState): Move => decidirCalculador(vistaDeAsiento(state, state.turno))

const trio = (rank: '7' | 'K' | '9', cards: Card[]): Grupo => ({ kind: 'trio', rank, cards })

describe('the bajada', () => {
  it('grows its grupos under the libre bajada, and goes out when the hand runs out', () => {
    const mano = [
      n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'), n('7', 'diamonds'),
      n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs'),
    ]
    const state = makeRonda({
      jugadores: [{ hand: mano }, { hand: [n('2', 'clubs')] }],
      contrato: DOS_TRIOS,
      fase: 'act',
    })
    const move = decidir(state)
    expect(move.type).toBe('bajarse')
    if (move.type !== 'bajarse') return
    expect(move.propuestas.flatMap((p) => p.cardIds)).toHaveLength(7)

    const resultado = apply(state, move)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.state.ganador).toBe(0)
  })

  it('lays down exactly the contract under the strict bajada', () => {
    const mano = [
      n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'), n('7', 'diamonds'),
      n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs'), n('2', 'clubs'),
    ]
    const state = { ...makeRonda({
      jugadores: [{ hand: mano }, { hand: [n('2', 'clubs')] }],
      contrato: DOS_TRIOS,
      fase: 'act',
    }), bajadaEstricta: true }
    const move = decidir(state)
    expect(move.type).toBe('bajarse')
    if (move.type === 'bajarse') {
      expect(move.propuestas.map((p) => p.cardIds.length)).toEqual([3, 3])
      expect(apply(state, move).ok).toBe(true)
    }
  })

  it('finds every grouping, not just the first, and grows only what fits', () => {
    const mano = [
      n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'), n('7', 'diamonds'),
      n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs'), n('K', 'clubs'),
    ]
    const todas = todasLasAgrupaciones(mano, DOS_TRIOS)
    // Four ways to pick three of the four 7s, one way for the 9s.
    expect(todas).toHaveLength(4)
    const ampliada = ampliarBajada(todas[0], mano)
    expect(ampliada.flatMap((p) => p.cardIds)).toHaveLength(7)
  })
})

describe('the discard', () => {
  it('throws the king before the three when neither is any use', () => {
    const state = makeRonda({
      jugadores: [
        { hand: [n('K', 'clubs'), n('3', 'diamonds'), n('7', 'spades'), n('7', 'hearts')] },
        { hand: [n('2', 'clubs')] },
      ],
      contrato: DOS_TRIOS,
      fase: 'act',
    })
    expect(decidir(state)).toEqual({ type: 'descartar', cardId: state.jugadores[0].hand[0].id })
  })

  it('keeps the king when the next seat, bajado, has a trío of kings to put it on', () => {
    const reyes = trio('K', [n('K', 'spades'), n('K', 'hearts'), n('K', 'diamonds')])
    const state = makeRonda({
      jugadores: [
        { hand: [n('K', 'clubs'), n('3', 'diamonds'), n('7', 'spades'), n('7', 'hearts')] },
        { hand: [n('2', 'clubs'), n('4', 'clubs')], grupos: [reyes], bajadoEnTurno: 1 },
      ],
      contrato: DOS_TRIOS,
      fase: 'act',
      numeroDeTurno: 3,
    })
    expect(decidir(state)).toEqual({ type: 'descartar', cardId: state.jugadores[0].hand[1].id })
  })
})

describe('at the table', () => {
  it('plays whole partidas with the Fácil bots without a single falta', () => {
    const reporte = jugarTorneo({ bots: BOTS, partidas: 16, asientos: 4, semilla: 'calculador' })
    expect(reporte.terminadas).toBe(16)
    expect(reporte.faltas).toEqual([])
  })
})
