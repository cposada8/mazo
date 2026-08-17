import { describe, expect, it } from 'vitest'
import { type Card, crearEscenario, describeCard } from '@/lib/engine'
import { armarGrupo } from '@/lib/bots'

/**
 * `armarGrupo` reads a *selection* as a grupo. It is the interface's job, not
 * the engine's: the player has already chosen these exact cards, and this only
 * works out whether they form a trío or an escala and where a comodín has to
 * sit. The result still goes to the engine to be accepted or refused.
 */

const seleccion = (cartas: string[]): Card[] =>
  crearEscenario({ manos: [cartas, []], seed: 'armar' }).jugadores[0].hand.slice(
    0,
    cartas.length,
  )

const escrito = (cards: readonly Card[], ids: readonly string[]) => {
  const porId = new Map(cards.map((card) => [card.id, card]))
  return ids.map((id) => describeCard(porId.get(id)!))
}

describe('armarGrupo', () => {
  it('reads three of a rango as a trío', () => {
    const cards = seleccion(['7♠', '7♥', '7♣'])
    expect(armarGrupo(cards)).toMatchObject({ kind: 'trio', rank: '7' })
  })

  it('reads more than three of a rango as one trío', () => {
    const cards = seleccion(['7♠', '7♥', '7♣', '7♦'])
    const propuesta = armarGrupo(cards)
    expect(propuesta).toMatchObject({ kind: 'trio', rank: '7' })
    expect(propuesta!.cardIds).toHaveLength(4)
  })

  it('reads a trío with one comodín', () => {
    const cards = seleccion(['7♠', '7♥', '**'])
    expect(armarGrupo(cards)).toMatchObject({ kind: 'trio', rank: '7' })
  })

  it('reads four consecutive of a suit as an escala', () => {
    const cards = seleccion(['4♦', '5♦', '6♦', '7♦'])
    expect(armarGrupo(cards)).toMatchObject({
      kind: 'escala',
      suit: 'diamonds',
      start: '4',
    })
  })

  it('does not care what order they were tapped in', () => {
    const cards = seleccion(['6♦', '4♦', '7♦', '5♦'])
    const propuesta = armarGrupo(cards)
    expect(propuesta).toMatchObject({ kind: 'escala', start: '4' })
    expect(escrito(cards, propuesta!.cardIds)).toEqual(['4♦', '5♦', '6♦', '7♦'])
  })

  it('reads an escala that wraps: K A 2 3', () => {
    const cards = seleccion(['A♠', '2♠', 'K♠', '3♠'])
    const propuesta = armarGrupo(cards)
    expect(propuesta).toMatchObject({ kind: 'escala', start: 'K' })
    expect(escrito(cards, propuesta!.cardIds)).toEqual(['K♠', 'A♠', '2♠', '3♠'])
  })

  it('works out where the comodín has to sit', () => {
    // 4♦ 5♦ 7♦ plus a comodín: the only way this is an escala is with the
    // comodín standing for the 6♦, in the middle.
    const cards = seleccion(['4♦', '5♦', '7♦', '**'])
    const propuesta = armarGrupo(cards)
    expect(propuesta).toMatchObject({ kind: 'escala', start: '4' })
    expect(escrito(cards, propuesta!.cardIds)).toEqual([
      '4♦',
      '5♦',
      'comodin',
      '7♦',
    ])
  })

  it('puts the comodín on an end when that is the only fit', () => {
    const cards = seleccion(['5♦', '6♦', '7♦', '**'])
    const propuesta = armarGrupo(cards)
    expect(propuesta).toMatchObject({ kind: 'escala' })
    expect(propuesta!.cardIds).toHaveLength(4)
  })

  it('refuses a selection that is neither', () => {
    expect(armarGrupo(seleccion(['7♠', '8♥', 'K♣']))).toBeNull()
    expect(armarGrupo(seleccion(['4♦', '5♦', '7♦']))).toBeNull()
    expect(armarGrupo(seleccion(['4♦', '5♥', '6♦', '7♦']))).toBeNull()
  })

  it('refuses anything too short', () => {
    expect(armarGrupo(seleccion(['7♠', '7♥']))).toBeNull()
    expect(armarGrupo(seleccion(['4♦', '5♦', '6♦']))).toBeNull()
  })

  it('refuses a selection of comodines alone', () => {
    expect(armarGrupo(seleccion(['**', '**', '**']))).toBeNull()
  })

  it('honours the lay-down limit of one comodín', () => {
    const cards = seleccion(['7♠', '7♥', '**', '**'])
    expect(armarGrupo(cards, 'layDown')).toBeNull()
    expect(armarGrupo(cards, 'mesa')).toMatchObject({ kind: 'trio' })
  })

  it('refuses two comodines side by side in an escala, in either phase', () => {
    const cards = seleccion(['2♥', '3♥', '4♥', '**', '**', '7♥'])
    expect(armarGrupo(cards, 'layDown')).toBeNull()
    expect(armarGrupo(cards, 'mesa')).toBeNull()
  })

  it('accepts two comodines apart in an escala once on the mesa', () => {
    const cards = seleccion(['3♥', '4♥', '5♥', '7♥', '**', '**'])
    expect(armarGrupo(cards, 'layDown')).toBeNull()
    const propuesta = armarGrupo(cards, 'mesa')
    expect(propuesta).toMatchObject({ kind: 'escala', start: '2' })
    expect(escrito(cards, propuesta!.cardIds)).toEqual([
      'comodin',
      '3♥',
      '4♥',
      '5♥',
      'comodin',
      '7♥',
    ])
  })
})
