import { describe, expect, it } from 'vitest'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Rank,
  type Suit,
  ORDEN_DE_ESCALERA,
  apply,
  contratoPorId,
  cubiertasDeEscalera,
  isComodin,
  ordenarEscalera,
} from '@/lib/engine'
import { BOTS, jugarPartida } from '@/lib/bots'
import { c, ids, makeRonda, n } from './helpers'

/**
 * Phase 48: las escaleras, as the owner defined them.
 *
 * The thirteen rangos, 2 through A, none repeated, laid down whole to win.
 * Sucia: pinta does not matter. Pintada: red and black alternate along 2 → A,
 * either colour first. Color: all red or all black. Real: one pinta. Any
 * number of comodines, each standing for a missing rango in whatever colour
 * its place needs.
 */

const ROJO: readonly Suit[] = ['hearts', 'diamonds']
const NEGRO: readonly Suit[] = ['spades', 'clubs']

/** One card per rango, 2 → A, each pinta chosen by position. */
const escalera = (pinta: (posicion: number, rank: Rank) => Suit): Card[] =>
  ORDEN_DE_ESCALERA.map((rank, posicion) => n(rank, pinta(posicion, rank)))

/** Shuffled the way a real hand would be: order in must not matter. */
const barajar = (cards: Card[]): Card[] => [...cards].reverse().sort((a, b) =>
  a.id.localeCompare(b.id) * (a.id.length % 2 ? 1 : -1),
)

/** Replace the card at `posicion` with a comodín. */
const conComodin = (cards: Card[], posicion: number): Card[] =>
  cards.map((card, i) => (i === posicion ? c() : card))

describe('escalera sucia', () => {
  const mezclada = escalera((p) => (['spades', 'hearts', 'diamonds', 'clubs'] as const)[p % 4])

  it('takes the thirteen rangos in any pintas and any order', () => {
    const check = ordenarEscalera(barajar(mezclada), 'sucia')
    expect(check.ok).toBe(true)
    if (check.ok) {
      expect(check.cards.map((card) => (isComodin(card) ? '★' : card.rank))).toEqual(
        ORDEN_DE_ESCALERA,
      )
    }
  })

  it('refuses a repeated rango and a missing one', () => {
    const repetida = [...mezclada.slice(0, 12), n('2', 'clubs')]
    const check = ordenarEscalera(repetida, 'sucia')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.code).toBe('RANGO_REPETIDO')
  })

  it('refuses twelve cards: an escalera is thirteen', () => {
    const check = ordenarEscalera(mezclada.slice(0, 12), 'sucia')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.code).toBe('LARGO')
  })

  it('lets one comodín stand for the missing rango, in its place', () => {
    const check = ordenarEscalera(barajar(conComodin(mezclada, 5)), 'sucia')
    expect(check.ok).toBe(true)
    if (check.ok) expect(isComodin(check.cards[5])).toBe(true)
  })

  it('takes as many comodines as there are gaps — not only one', () => {
    // The owner's rule for escaleras: every comodín in hand may play.
    const dos = conComodin(conComodin(mezclada, 5), 9)
    const check = ordenarEscalera(barajar(dos), 'sucia')
    expect(check.ok).toBe(true)
    if (check.ok) {
      expect(isComodin(check.cards[5])).toBe(true)
      expect(isComodin(check.cards[9])).toBe(true)
    }
    expect(ordenarEscalera(conComodin(conComodin(conComodin(mezclada, 0), 6), 12), 'sucia').ok).toBe(true)
  })
})

describe('escalera pintada', () => {
  const empiezaRojo = escalera((p) => (p % 2 === 0 ? ROJO[p % 4 === 0 ? 0 : 1] : NEGRO[p % 3 === 0 ? 0 : 1]))
  const empiezaNegro = escalera((p) => (p % 2 === 0 ? NEGRO[0] : ROJO[1]))

  it('takes 2 red, 3 black, 4 red… and 2 black, 3 red, 4 black…', () => {
    expect(ordenarEscalera(barajar(empiezaRojo), 'pintada').ok).toBe(true)
    expect(ordenarEscalera(barajar(empiezaNegro), 'pintada').ok).toBe(true)
  })

  it('refuses two reds side by side', () => {
    // The 3 turns red, next to a red 2 and a red 4.
    const rota = empiezaRojo.map((card, p) => (p === 1 ? n('3', 'hearts') : card))
    const check = ordenarEscalera(rota, 'pintada')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.code).toBe('NO_INTERCALA')
  })

  it('lets each comodín be whatever colour its place needs', () => {
    expect(ordenarEscalera(conComodin(empiezaRojo, 0), 'pintada').ok).toBe(true)
    expect(ordenarEscalera(conComodin(empiezaNegro, 7), 'pintada').ok).toBe(true)
    // Two, side by side: one red place and one black place.
    expect(ordenarEscalera(conComodin(conComodin(empiezaRojo, 3), 4), 'pintada').ok).toBe(true)
  })

  it('is not a sucia: mixed colours without alternation fail', () => {
    const mezclada = escalera((p) => (['spades', 'clubs', 'hearts'] as const)[p % 3])
    expect(ordenarEscalera(mezclada, 'sucia').ok).toBe(true)
    expect(ordenarEscalera(mezclada, 'pintada').ok).toBe(false)
  })
})

describe('escalera color', () => {
  it('takes all red or all black, pintas mixed within the colour', () => {
    expect(ordenarEscalera(escalera((p) => ROJO[p % 2]), 'color').ok).toBe(true)
    expect(ordenarEscalera(escalera((p) => NEGRO[p % 2]), 'color').ok).toBe(true)
  })

  it('refuses one card of the other colour', () => {
    const casi = escalera((p) => (p === 6 ? 'spades' : ROJO[p % 2]))
    const check = ordenarEscalera(casi, 'color')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.code).toBe('COLOR_MEZCLADO')
  })
})

describe('escalera real', () => {
  it('takes thirteen of one pinta, and a comodín for one of them', () => {
    const corazones = escalera(() => 'hearts')
    expect(ordenarEscalera(corazones, 'real').ok).toBe(true)
    expect(ordenarEscalera(conComodin(corazones, 12), 'real').ok).toBe(true)
  })

  it('refuses a second pinta, even of the same colour', () => {
    const casi = escalera((p) => (p === 3 ? 'diamonds' : 'hearts'))
    const check = ordenarEscalera(casi, 'real')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.code).toBe('PINTA_MEZCLADA')
  })
})

describe('laying an escalera down', () => {
  const sucia = contratoPorId('c9')!
  const mano = escalera((p) => (['spades', 'hearts', 'diamonds', 'clubs'] as const)[p % 4])

  const lista = (hand: Card[], contrato = sucia) =>
    makeRonda({
      jugadores: [{ hand }, { hand: [n('K', 'hearts')] }],
      contrato,
      fase: 'act',
    })

  it('takes the whole hand and wins the ronda in the same move', () => {
    const resultado = apply(lista(barajar(mano)), {
      type: 'bajarse',
      propuestas: [{ kind: 'escalera', tipo: 'sucia', cardIds: ids(mano) }],
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.state.ganador).toBe(0)
    expect(resultado.state.jugadores[0].hand).toHaveLength(0)
    const [grupo] = resultado.state.jugadores[0].grupos
    expect(grupo.kind).toBe('escalera')
    expect(grupo.cards.map((card) => (isComodin(card) ? '★' : card.rank))).toEqual(
      ORDEN_DE_ESCALERA,
    )
  })

  it('is refused while a card of the hand is left out', () => {
    const conSobra = [...mano, n('7', 'clubs')]
    const resultado = apply(lista(conSobra), {
      type: 'bajarse',
      propuestas: [{ kind: 'escalera', tipo: 'sucia', cardIds: ids(mano) }],
    })
    expect(resultado.ok).toBe(false)
  })

  it('is refused as the wrong tipo, and trios are refused in an escalera ronda', () => {
    const comoReal = apply(lista(mano), {
      type: 'bajarse',
      propuestas: [{ kind: 'escalera', tipo: 'real', cardIds: ids(mano) }],
    })
    expect(comoReal.ok).toBe(false)

    const trio = apply(lista(mano), {
      type: 'bajarse',
      propuestas: [{ kind: 'trio', rank: '2', cardIds: ids(mano.slice(0, 3)) }],
    })
    expect(trio.ok).toBe(false)
  })

  it('cannot be laid down in a contract that is not an escalera', () => {
    const resultado = apply(lista(mano, contratoPorId('c1')!), {
      type: 'bajarse',
      propuestas: [{ kind: 'escalera', tipo: 'sucia', cardIds: ids(mano) }],
    })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.code).toBe('CONTRATO_NO_COINCIDE')
  })
})

describe('cubiertasDeEscalera', () => {
  it('counts the places a hand covers for its best escalera', () => {
    const doce = escalera(() => 'hearts').slice(0, 12)
    expect(cubiertasDeEscalera(doce, 'real')).toBe(12)
    expect(cubiertasDeEscalera([...doce, c()], 'real')).toBe(13)
    expect(cubiertasDeEscalera([...doce.slice(0, 11), c(), c()], 'real')).toBe(13)
    // Two of the same rango cover one place.
    expect(cubiertasDeEscalera([n('7', 'hearts'), n('7', 'spades')], 'sucia')).toBe(1)
  })
})

describe('bots in escalera rondas', () => {
  const escaleras = ['c9', 'c10', 'c11', 'c12'].map((id) => contratoPorId(id)!)

  const resultados = Array.from({ length: 60 }, (_, i) =>
    jugarPartida({
      bots: [...BOTS, BOTS[0]],
      seed: `escaleras-${i}`,
      config: { ...CONFIG_POR_DEFECTO, contratos: escaleras },
    }),
  )

  it('never has a move refused, and every partida ends', () => {
    const rechazados = resultados.filter((r) => r.motivo === 'MOVIMIENTO_RECHAZADO')
    expect(rechazados.map((r) => `${r.rechazo?.code}: ${r.rechazo?.detail}`)).toEqual([])
    expect(resultados.every((r) => r.motivo === 'TERMINADA')).toBe(true)
  })

  it('actually lays escaleras down, not only closing rondas en tablas', () => {
    const ganadasPorTipo = escaleras.map(
      (contrato) =>
        resultados.filter((r) =>
          r.partida.historial.some(
            (m) => m.contrato.id === contrato.id && m.ganador !== 'nadie',
          ),
        ).length,
    )
    // The sucia is the easiest by far; every level is won somewhere.
    expect(ganadasPorTipo[0]).toBeGreaterThan(resultados.length / 2)
    for (const ganadas of ganadasPorTipo) expect(ganadas).toBeGreaterThan(0)
  })
})
