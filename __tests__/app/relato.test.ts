import { describe, expect, it } from 'vitest'
import { contarRelato, relatar } from '@/lib/relato'
import { contratoPorId, describeCard, startRonda } from '@/lib/engine'

/**
 * The one rule that shapes the log: it may only say what everybody can see.
 * A stock draw is secret, a descarte draw was face up, a discard lands face
 * up. These tests are the rehearsal for Phase 29's structural discipline.
 */

const NOMBRES = ['Ana', 'Beto', 'Carla']

const ronda = () =>
  startRonda({
    contrato: contratoPorId('c1')!,
    players: 3,
    seed: 'relato',
  })

describe('relatar', () => {
  it('never names the card drawn from the mazo — by construction', () => {
    const antes = ronda()
    const relato = relatar({ type: 'robar', de: 'stock' }, antes)!

    expect(relato).toEqual({ tipo: 'mazo', seat: antes.turno })

    const linea = contarRelato(relato, NOMBRES)
    // No suit symbol — and therefore no card — can appear in the line.
    expect(linea).not.toMatch(/[♠♥♦♣]/)
    expect(linea).toBe('Ana robó del mazo')
  })

  it('names the descarte card, because it was face up for everyone', () => {
    const antes = ronda()
    const arriba = antes.discard.at(-1)!
    const relato = relatar({ type: 'robar', de: 'descarte' }, antes)!

    expect(relato).toEqual({
      tipo: 'descarte',
      seat: antes.turno,
      carta: describeCard(arriba),
    })
    expect(contarRelato(relato, NOMBRES)).toBe(
      `Ana tomó ${describeCard(arriba)} del descarte`,
    )
  })

  it('names a discard: it lands face up', () => {
    const antes = ronda()
    const carta = antes.jugadores[antes.turno].hand[0]
    const relato = relatar({ type: 'descartar', cardId: carta.id }, antes)!

    expect(relato.tipo).toBe('bota')
    expect(contarRelato(relato, NOMBRES)).toBe(
      `Ana botó ${describeCard(carta)}`,
    )
  })

  it('counts a bajada without listing the hand it came from', () => {
    const antes = ronda()
    const relato = relatar(
      { type: 'bajarse', propuestas: [{}, {}] as never },
      antes,
    )!

    expect(relato).toEqual({ tipo: 'bajada', seat: antes.turno, grupos: 2 })
    expect(contarRelato(relato, NOMBRES)).toBe('Ana se bajó con 2 grupos')
  })

  it('speaks to you in second person about your own moves', () => {
    const antes = ronda()
    const relato = relatar({ type: 'robar', de: 'stock' }, antes)!
    expect(contarRelato(relato, NOMBRES, antes.turno)).toBe('Robaste del mazo')
  })

  it('falls back to seat numbers when a name is missing', () => {
    const antes = ronda()
    const relato = relatar({ type: 'robar', de: 'stock' }, antes)!
    expect(contarRelato(relato, [])).toBe(
      `Jugador ${antes.turno + 1} robó del mazo`,
    )
  })
})
