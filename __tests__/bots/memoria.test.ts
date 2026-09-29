import { describe, expect, it } from 'vitest'
import { leerCarta, leerMemoria } from '@/lib/bots'
import type { Relato } from '@/lib/relato'

/**
 * Phase 55: la memoria de la mesa. The relatos, read back into what each
 * other seat has shown — taken, let pass, thrown.
 */

describe('leerCarta', () => {
  it('reads a card as a relato names it', () => {
    expect(leerCarta('7♥')).toEqual({ rank: '7', suit: 'hearts' })
    expect(leerCarta('10♣')).toEqual({ rank: '10', suit: 'clubs' })
    expect(leerCarta('comodin')).toBeNull()
  })
})

describe('leerMemoria', () => {
  const relatos: Relato[] = [
    { tipo: 'mazo', seat: 0 },
    { tipo: 'bota', seat: 0, carta: '9♠' },
    // Seat 1 lets the 9♠ pass, and throws a K♦.
    { tipo: 'mazo', seat: 1 },
    { tipo: 'bota', seat: 1, carta: 'K♦' },
    // Seat 2 takes the K♦, and throws a 4♣.
    { tipo: 'descarte', seat: 2, carta: 'K♦' },
    { tipo: 'bota', seat: 2, carta: '4♣' },
    // Seat 0 — the reader — lets the 4♣ pass: nothing to remember about itself.
    { tipo: 'mazo', seat: 0 },
    { tipo: 'bota', seat: 0, carta: '2♥' },
  ]

  it('remembers what each other seat took, let pass and threw', () => {
    const memoria = leerMemoria(relatos, 3, 0)
    expect(memoria[1]).toEqual({
      tomadas: [],
      dejadas: [{ rank: '9', suit: 'spades' }],
      botadas: [{ rank: 'K', suit: 'diamonds' }],
    })
    expect(memoria[2]).toEqual({
      tomadas: [{ rank: 'K', suit: 'diamonds' }],
      dejadas: [],
      botadas: [{ rank: '4', suit: 'clubs' }],
    })
  })

  it('leaves its own seat blank', () => {
    expect(leerMemoria(relatos, 3, 0)[0]).toEqual({ tomadas: [], dejadas: [], botadas: [] })
  })

  it('infers nothing when the top of the pile is unknown', () => {
    // The reparto's first face-up card is not in the relatos.
    const memoria = leerMemoria([{ tipo: 'mazo', seat: 1 }], 2, 0)
    expect(memoria[1].dejadas).toEqual([])
  })
})
