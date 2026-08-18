import { describe, expect, it } from 'vitest'
import { nombres } from '@/app/jugar/juego'

/**
 * Found at a real table: kimberly hosted, lucifer joined, and on *lucifer's*
 * screen the other player was also called «lucifer».
 *
 * The cause was one constant. The table was built when the only human was
 * whoever opened the page, so seat 0 was "you" everywhere — a fact that
 * stopped being true the moment somebody else sat down. Every "is this me?"
 * now asks the seat the server gave this browser.
 */
describe('the table is drawn from your own seat', () => {
  const enLaMesa = ['kimberly', 'lucifer']

  it('the host sees themselves in their chair and the guest in theirs', () => {
    expect(nombres(2, 0, 'kimberly', enLaMesa)).toEqual(['kimberly', 'lucifer'])
  })

  it('and the guest sees the same table, not a copy of themselves', () => {
    // The bug: seat 0 wore the reader's own alias, so lucifer saw
    // ['lucifer', 'lucifer'] and could not tell who was who.
    expect(nombres(2, 1, 'lucifer', enLaMesa)).toEqual(['kimberly', 'lucifer'])
  })

  it('holds for a seat in the middle of a full table', () => {
    const mesa = ['ana', 'beto', 'cami', 'dani', 'eva', 'fabio']
    expect(nombres(6, 3, 'dani', mesa)).toEqual(mesa)
    expect(nombres(6, 0, 'ana', mesa)).toEqual(mesa)
  })

  it('falls back to «Jugador n» where no lobby named the seats', () => {
    expect(nombres(3, 2, 'yo')).toEqual(['Jugador 1', 'Jugador 2', 'yo'])
  })

  it('uses your own alias for your chair even when the lobby disagrees', () => {
    // You renamed yourself and the poll has not caught up: your own screen
    // should say what you just chose.
    expect(nombres(2, 1, 'nuevo', enLaMesa)).toEqual(['kimberly', 'nuevo'])
  })
})
