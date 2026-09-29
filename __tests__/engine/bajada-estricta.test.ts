import { describe, expect, it } from 'vitest'
import {
  CATALOGO,
  CONFIG_POR_DEFECTO,
  type Propuesta,
  type RondaState,
  aplicarEnPartida,
  apply,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { BOTS, jugarPartida } from '@/lib/bots'
import { guiar } from '@/lib/guia'
import { c, ids, makeRonda, n } from './helpers'

/**
 * Phase 47: la bajada estricta.
 *
 * Some tables lay down exactly the contract and not a card more: three cards
 * per trío, four per escala. Only the bajada — adding to grupos afterwards is
 * as free as it always was — and a comodín counts toward the size like any
 * card. Settled with the owner in roadmap.md.
 */

const DOS_TRIOS = CATALOGO[0]
const TRIO_Y_ESCALA = CATALOGO[1]

/** A ronda in the act phase, strict or not, with this hand for seat 0. */
function lista(
  hand: Parameters<typeof makeRonda>[0]['jugadores'][number]['hand'],
  opciones: { estricta: boolean; contrato?: typeof DOS_TRIOS },
): RondaState {
  const ronda = makeRonda({
    jugadores: [{ hand }, { hand: [n('K', 'hearts')] }],
    contrato: opciones.contrato ?? DOS_TRIOS,
    fase: 'act',
  })
  return opciones.estricta ? { ...ronda, bajadaEstricta: true } : ronda
}

describe('the strict bajada', () => {
  const sietes = [n('7', 'hearts'), n('7', 'spades'), n('7', 'clubs'), n('7', 'diamonds')]
  const nueves = [n('9', 'hearts'), n('9', 'spades'), n('9', 'clubs')]
  const resto = [n('2', 'hearts'), n('K', 'spades')]
  const mano = [...sietes, ...nueves, ...resto]

  const trio = (cartas: typeof sietes, rank: '7' | '9'): Propuesta => ({
    kind: 'trio',
    rank,
    cardIds: ids(cartas),
  })

  it('refuses a trío of four', () => {
    const resultado = apply(lista(mano, { estricta: true }), {
      type: 'bajarse',
      propuestas: [trio(sietes, '7'), trio(nueves, '9')],
    })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.code).toBe('BAJADA_ESTRICTA')
  })

  it('takes the same trío at exactly three', () => {
    const resultado = apply(lista(mano, { estricta: true }), {
      type: 'bajarse',
      propuestas: [trio(sietes.slice(0, 3), '7'), trio(nueves, '9')],
    })
    expect(resultado.ok).toBe(true)
    // The fourth seven stays in hand, to be added on a later turn.
    if (resultado.ok) expect(resultado.state.jugadores[0].hand).toHaveLength(3)
  })

  it('leaves the libre bajada exactly as it was', () => {
    const resultado = apply(lista(mano, { estricta: false }), {
      type: 'bajarse',
      propuestas: [trio(sietes, '7'), trio(nueves, '9')],
    })
    expect(resultado.ok).toBe(true)
  })

  it('refuses an escala of five and takes one of four', () => {
    const corazones = (['3', '4', '5', '6', '7'] as const).map((r) => n(r, 'hearts'))
    const reyes = [n('K', 'spades'), n('K', 'clubs'), n('K', 'diamonds')]
    const hand = [...corazones, ...reyes, n('2', 'clubs')]
    const escala = (cartas: typeof corazones): Propuesta => ({
      kind: 'escala',
      suit: 'hearts',
      start: '3',
      cardIds: ids(cartas),
    })
    const trioDeReyes: Propuesta = { kind: 'trio', rank: 'K', cardIds: ids(reyes) }

    const cinco = apply(lista(hand, { estricta: true, contrato: TRIO_Y_ESCALA }), {
      type: 'bajarse',
      propuestas: [trioDeReyes, escala(corazones)],
    })
    expect(cinco.ok).toBe(false)
    if (!cinco.ok) expect(cinco.code).toBe('BAJADA_ESTRICTA')

    const cuatro = apply(lista(hand, { estricta: true, contrato: TRIO_Y_ESCALA }), {
      type: 'bajarse',
      propuestas: [trioDeReyes, escala(corazones.slice(0, 4))],
    })
    expect(cuatro.ok).toBe(true)
  })

  it('counts a comodín toward the three', () => {
    const comodin = c()
    const hand = [n('7', 'hearts'), n('7', 'spades'), comodin, ...nueves, ...resto]
    const resultado = apply(lista(hand, { estricta: true }), {
      type: 'bajarse',
      propuestas: [
        { kind: 'trio', rank: '7', cardIds: ids([hand[0], hand[1], comodin]) },
        trio(nueves, '9'),
      ],
    })
    expect(resultado.ok).toBe(true)
  })

  it('leaves adding to grupos free on a later turn', () => {
    // Down at exactly three on turn 1; on turn 3 the fourth seven joins.
    const septimo = n('7', 'diamonds')
    const ronda: RondaState = {
      ...makeRonda({
        jugadores: [
          {
            hand: [septimo, n('2', 'hearts')],
            grupos: [
              { kind: 'trio', rank: '7', cards: sietes.slice(0, 3) },
              { kind: 'trio', rank: '9', cards: nueves },
            ],
            bajadoEnTurno: 1,
          },
          { hand: [n('K', 'hearts')] },
        ],
        fase: 'act',
        numeroDeTurno: 3,
      }),
      bajadaEstricta: true,
    }

    const resultado = apply(ronda, {
      type: 'agregar',
      seat: 0,
      grupoIndex: 0,
      cardIds: [septimo.id],
    })
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.state.jugadores[0].grupos[0].cards).toHaveLength(4)
  })
})

describe('the partida carries the choice', () => {
  const estricta = { ...CONFIG_POR_DEFECTO, bajada: 'estricta' as const }

  it('into every ronda, and into every seat’s view', () => {
    let partida = startPartida({ players: 3, seed: 'estricta', config: estricta })
    expect(partida.ronda?.bajadaEstricta).toBe(true)
    expect(vistaDeAsiento(partida.ronda!, 1).bajadaEstricta).toBe(true)

    // Play the first ronda out with bots and look at the second one.
    const primera = partida.indiceContrato
    for (let i = 0; i < 5000 && partida.indiceContrato === primera; i++) {
      const actual = partida.ronda!
      const bot = BOTS[0]
      const r = aplicarEnPartida(partida, bot.decidir(vistaDeAsiento(actual, actual.turno)))
      if (!r.ok) throw new Error(`${r.code}: ${r.detail}`)
      partida = r.state
    }
    expect(partida.indiceContrato).toBe(primera + 1)
    expect(partida.ronda?.bajadaEstricta).toBe(true)
  })

  it('is libre by default, and for a partida saved before the option', () => {
    const porDefecto = startPartida({ players: 3, seed: 'libre' })
    expect(porDefecto.ronda?.bajadaEstricta).toBeUndefined()

    const vieja = { ...CONFIG_POR_DEFECTO }
    delete (vieja as { bajada?: string }).bajada
    const antigua = startPartida({ players: 3, seed: 'vieja', config: vieja })
    expect(vistaDeAsiento(antigua.ronda!, 0).bajadaEstricta).toBe(false)
  })
})

describe('bots under the strict bajada', () => {
  // Every quick bot at one table, a hundred partidas: not one move refused.
  // El Tahúr thinks too long for a hundred; it has its own strict partida.
  const rapidos = BOTS.filter((bot) => bot.nivel !== 'dificil')
  const resultados = Array.from({ length: 100 }, (_, i) =>
    jugarPartida({
      bots: [...rapidos, rapidos[0]],
      seed: `estricta-${i}`,
      config: { ...CONFIG_POR_DEFECTO, bajada: 'estricta' },
    }),
  )

  it('never has a move refused', () => {
    const rechazados = resultados.filter((r) => r.motivo === 'MOVIMIENTO_RECHAZADO')
    expect(rechazados.map((r) => `${r.rechazo?.code}: ${r.rechazo?.detail}`)).toEqual([])
  })

  it('finishes every partida, and people actually get down', () => {
    // The referee refuses any bajada off the strict sizes (above), so every
    // grupo on these tables went down at exactly 3 or 4. What is left to show
    // is that the rule does not strand the bots: partidas end, and rondas are
    // won by going out rather than only closing en tablas.
    expect(resultados.every((r) => r.motivo === 'TERMINADA')).toBe(true)
    const ganadas = resultados.flatMap((r) =>
      r.partida.historial.filter((m) => m.ganador !== 'nadie'),
    )
    expect(ganadas.length).toBeGreaterThan(resultados.length)
  })
})

describe('the guía under the strict bajada', () => {
  const base = {
    esTuTurno: true,
    fase: 'act' as const,
    yaBajado: false,
    mesaAbierta: false,
    seleccionadas: 0,
    apartadas: 0,
    contratoCompleto: false,
    hayMesa: false,
  }

  it('asks for exact sizes, never «3 o más»', () => {
    expect(guiar({ ...base, bajadaEstricta: true })).toMatch(/trío de 3 cartas o una escala de 4/)
    expect(guiar({ ...base, bajadaEstricta: true })).not.toMatch(/o más/)
    expect(guiar(base)).toMatch(/3 o más/)
  })
})
