import { describe, expect, it } from 'vitest'
import {
  type Card,
  contratoPorId,
  crearEscenario,
  describeCard,
  validateGrupo,
} from '@/lib/engine'
import { buscarAgrupacion, puedeBajarse, utilidadDeCarta } from '@/lib/bots'

const DOS_TRIOS = contratoPorId('c1')!
const TRIO_Y_ESCALA = contratoPorId('c2')!
const DOS_ESCALAS = contratoPorId('c3')!
const TRES_ESCALAS = contratoPorId('c7')!
const CUATRO_TRIOS = contratoPorId('c8')!

/** A hand built from written cards, so tests read like a table. */
const mano = (cartas: string[]): Card[] =>
  crearEscenario({ manos: [cartas, []], seed: 'agrupar' }).jugadores[0].hand.slice(
    0,
    cartas.length,
  )

/**
 * A hand of thirteen — twelve dealt plus the card just drawn, which is what a
 * player actually holds when deciding whether to lay down.
 */
const manoDeTrece: Card[] = (() => {
  const state = crearEscenario({
    manos: [
      ['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', 'K♠', 'K♥', 'K♦', '4♠', '4♥', '4♣'],
      [],
    ],
    stock: ['9♦'],
    seed: 'trece',
  })
  return [...state.jugadores[0].hand, state.stock.at(-1)!]
})()

describe('buscarAgrupacion', () => {
  it('finds two trios when they are there', () => {
    const hand = mano(['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', '2♦'])
    const agrupacion = buscarAgrupacion(hand, DOS_TRIOS)

    expect(agrupacion).not.toBeNull()
    expect(agrupacion).toHaveLength(2)
    expect(agrupacion!.every((p) => p.kind === 'trio')).toBe(true)
  })

  it('finds a trio and an escala', () => {
    const hand = mano(['7♠', '7♥', '7♣', '4♦', '5♦', '6♦', '7♦', '2♣'])
    const agrupacion = buscarAgrupacion(hand, TRIO_Y_ESCALA)

    expect(agrupacion).not.toBeNull()
    expect(agrupacion!.filter((p) => p.kind === 'trio')).toHaveLength(1)
    expect(agrupacion!.filter((p) => p.kind === 'escala')).toHaveLength(1)
  })

  it('finds an escala that wraps around the ring', () => {
    const hand = mano(['K♠', 'A♠', '2♠', '3♠', 'K♥', 'A♥', '2♥', '3♥', '9♣'])
    const agrupacion = buscarAgrupacion(hand, DOS_ESCALAS)

    expect(agrupacion).not.toBeNull()
    const starts = agrupacion!.map((p) => (p.kind === 'escala' ? p.start : null))
    expect(starts).toContain('K')
  })

  it('uses a comodín to fill a gap', () => {
    const hand = mano(['4♦', '5♦', '7♦', '**', '4♠', '5♠', '6♠', '7♠', '2♣'])
    const agrupacion = buscarAgrupacion(hand, DOS_ESCALAS)

    expect(agrupacion).not.toBeNull()
    const conComodin = agrupacion!.some((p) => p.cardIds.length === 4)
    expect(conComodin).toBe(true)
  })

  it('never puts the same card in two grupos', () => {
    // The 7♠ could serve either the trio of sevens or the escala of spades.
    const hand = mano(['7♠', '7♥', '7♣', '4♠', '5♠', '6♠', '7♠', '2♦'])
    const agrupacion = buscarAgrupacion(hand, TRIO_Y_ESCALA)

    expect(agrupacion).not.toBeNull()
    const todos = agrupacion!.flatMap((p) => p.cardIds)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('produces grupos the engine accepts', () => {
    const hand = mano(['7♠', '7♥', '7♣', '4♦', '5♦', '6♦', '7♦', '2♣'])
    const agrupacion = buscarAgrupacion(hand, TRIO_Y_ESCALA)!
    const porId = new Map(hand.map((card) => [card.id, card]))

    for (const propuesta of agrupacion) {
      const cards = propuesta.cardIds.map((id) => porId.get(id)!)
      const grupo =
        propuesta.kind === 'trio'
          ? ({ kind: 'trio', rank: propuesta.rank, cards } as const)
          : ({
              kind: 'escala',
              suit: propuesta.suit,
              start: propuesta.start,
              cards,
            } as const)

      const check = validateGrupo(grupo, 'layDown')
      expect(check.ok, `${describeCard(cards[0])}…: ${JSON.stringify(check)}`).toBe(true)
    }
  })

  it('returns null when the hand cannot do it', () => {
    const hand = mano(['2♠', '4♥', '6♣', '8♦', '10♠', 'Q♥', 'A♣', '3♦'])
    expect(buscarAgrupacion(hand, DOS_TRIOS)).toBeNull()
    expect(buscarAgrupacion(hand, TRES_ESCALAS)).toBeNull()
  })

  it('refuses a grouping that would leave nothing to discard', () => {
    // Exactly four trios and nothing else: laying them all down would empty the
    // hand, and a turn has to end in a discard.
    const hand = mano([
      '7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', 'K♠', 'K♥', 'K♦', '4♠', '4♥', '4♣',
    ])
    expect(buscarAgrupacion(hand, CUATRO_TRIOS)).toBeNull()

    // With the thirteenth card in hand — the one just drawn — it becomes
    // possible: twelve go down and that one is the discard.
    expect(buscarAgrupacion(manoDeTrece, CUATRO_TRIOS)).not.toBeNull()
  })

  it('agrees with puedeBajarse', () => {
    const buena = mano(['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', '2♦'])
    const mala = mano(['2♠', '4♥', '6♣', '8♦'])
    expect(puedeBajarse(buena, DOS_TRIOS)).toBe(true)
    expect(puedeBajarse(mala, DOS_TRIOS)).toBe(false)
  })
})

describe('utilidadDeCarta', () => {
  const contrato = DOS_TRIOS

  it('rates a comodín above everything', () => {
    const hand = mano(['**', '7♠', '7♥'])
    const comodin = hand[0]
    expect(utilidadDeCarta(comodin, hand, contrato)).toBeGreaterThan(
      utilidadDeCarta(hand[1], hand, contrato),
    )
  })

  it('rates a card with partners above a loner', () => {
    const hand = mano(['7♠', '7♥', '7♣', 'A♦'])
    expect(utilidadDeCarta(hand[0], hand, contrato)).toBeGreaterThan(
      utilidadDeCarta(hand[3], hand, contrato),
    )
  })

  it('rates a card inside a run above an isolated one', () => {
    const hand = mano(['4♦', '5♦', '6♦', 'A♣'])
    expect(utilidadDeCarta(hand[1], hand, DOS_ESCALAS)).toBeGreaterThan(
      utilidadDeCarta(hand[3], hand, DOS_ESCALAS),
    )
  })

  it('counts the run, not merely nearby cards of the same suit', () => {
    // 4♦ and 7♦ are close but do not form anything; 4♦ 5♦ 6♦ do.
    const sueltas = mano(['4♦', '7♦', 'A♣', 'K♥'])
    const seguidas = mano(['4♦', '5♦', '6♦', 'K♥'])

    expect(utilidadDeCarta(seguidas[0], seguidas, DOS_ESCALAS)).toBeGreaterThan(
      utilidadDeCarta(sueltas[0], sueltas, DOS_ESCALAS),
    )
  })

  it('weighs by what the contrato is asking for', () => {
    const hand = mano(['7♠', '7♥', '4♦', '5♦'])
    const sieteEnContratoDeTrios = utilidadDeCarta(hand[0], hand, DOS_TRIOS)
    const sieteEnContratoDeEscalas = utilidadDeCarta(hand[0], hand, DOS_ESCALAS)
    expect(sieteEnContratoDeTrios).toBeGreaterThan(sieteEnContratoDeEscalas)
  })
})
