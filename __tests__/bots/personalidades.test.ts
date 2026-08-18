import { describe, expect, it } from 'vitest'
import {
  type Move,
  type RondaState,
  contratoPorId,
  crearEscenario,
  describeCard,
  vistaDeAsiento,
} from '@/lib/engine'
import {
  BOTS,
  botPorId,
  codicioso,
  decidirCodicioso,
  decidirMemorioso,
  decidirPaciente,
  jugarPartida,
  memorioso,
  paciente,
} from '@/lib/bots'

const DOS_TRIOS = contratoPorId('c1')!

const decide = (bot: (v: ReturnType<typeof vistaDeAsiento>) => Move) => (
  state: RondaState,
): Move => bot(vistaDeAsiento(state, state.turno))

describe('the catalogue', () => {
  it('gives every bot a distinct id', () => {
    expect(new Set(BOTS.map((bot) => bot.id)).size).toBe(BOTS.length)
  })

  it('seats El Codicioso rather than an empty chair when the id is unknown', () => {
    // A partida saved with a bot that no longer exists still has to be playable.
    expect(botPorId('un-bot-que-ya-no-existe')).toBe(codicioso)
    expect(botPorId(null)).toBe(codicioso)
    expect(botPorId('memorioso')).toBe(memorioso)
  })

  it('names and describes each one for the lobby', () => {
    for (const bot of BOTS) {
      expect(bot.nombre.length).toBeGreaterThan(0)
      expect(bot.descripcion.length).toBeGreaterThan(0)
    }
  })
})

describe('El Paciente', () => {
  /**
   * A hand that satisfies the contrato with a great deal left over: two trios,
   * and six loose cards behind them that no grupo on this table would take.
   * El Codicioso lays it down anyway. El Paciente does not.
   */
  const listoPeroCargado = (): RondaState => {
    const state = crearEscenario({
      manos: [
        ['7♠', '7♥', '7♣', 'Q♠', 'Q♥', 'Q♣', '2♦', '4♣', '9♥', 'J♠', 'K♦', '5♣'],
        ['A♦', '3♣'],
      ],
      descarte: ['8♦'],
      contrato: DOS_TRIOS,
      seed: 'paciencia',
    })
    return { ...state, fase: 'act' }
  }

  it('holds back a bajada that would leave it loaded', () => {
    const state = listoPeroCargado()

    expect(decide(decidirCodicioso)(state).type).toBe('bajarse')
    expect(decide(decidirPaciente)(state).type).toBe('descartar')
  })

  it('lays down the moment somebody bajado is nearly out', () => {
    const cargado = listoPeroCargado()
    // Seat 1 is down to three cards with its contrato on the mesa: this ronda
    // ends on their turn, not ours.
    const enPeligro: RondaState = {
      ...cargado,
      numeroDeTurno: 6,
      jugadores: cargado.jugadores.map((jugador, seat) =>
        seat === 1
          ? {
              ...jugador,
              hand: jugador.hand.slice(0, 3),
              bajadoEnTurno: 4,
              grupos: [
                {
                  kind: 'trio' as const,
                  rank: '3' as const,
                  cards: [
                    { id: '3-s#80', kind: 'normal' as const, rank: '3' as const, suit: 'spades' as const },
                    { id: '3-h#81', kind: 'normal' as const, rank: '3' as const, suit: 'hearts' as const },
                    { id: '3-d#82', kind: 'normal' as const, rank: '3' as const, suit: 'diamonds' as const },
                  ],
                },
              ],
            }
          : jugador,
      ),
    }

    expect(decide(decidirPaciente)(enPeligro).type).toBe('bajarse')
  })
})

describe('El Memorioso', () => {
  /**
   * A pair of fours with every other four already face up in the descarte. It
   * looks like two thirds of a trío and it is two cards of nothing — a trío of
   * fours cannot happen any more, and only this bot is counting.
   */
  const parMuerto = (): RondaState => {
    const state = crearEscenario({
      manos: [['4♣', '4♥', '9♠', '2♦', 'J♥', 'K♣'], ['A♦', '3♣']],
      descarte: ['4♠', '4♠', '4♦', '4♦', '4♣', '4♥'],
      contrato: DOS_TRIOS,
      seed: 'muerto',
    })
    return { ...state, fase: 'act' }
  }

  it('throws the pair whose partners are all accounted for', () => {
    const state = parMuerto()
    const move = decide(decidirMemorioso)(state)

    expect(move.type).toBe('descartar')
    if (move.type === 'descartar') {
      const card = state.jugadores[0].hand.find((c) => c.id === move.cardId)!
      expect(describeCard(card)).toMatch(/^4/)
    }
  })

  it('and the baseline goes on protecting it', () => {
    const state = parMuerto()
    const move = decide(decidirCodicioso)(state)

    expect(move.type).toBe('descartar')
    if (move.type === 'descartar') {
      const card = state.jugadores[0].hand.find((c) => c.id === move.cardId)!
      expect(describeCard(card)).not.toMatch(/^4/)
    }
  })
})

/**
 * The phase's done-when: three bots at one table that play differently and do
 * not finish level.
 *
 * Kept small — the soak is the exhaustive run, this only has to show the
 * difference — and seated on a rotation so no personality inherits the
 * opener's advantage.
 */
describe('a tournament', () => {
  const PARTIDAS = 240
  const elenco = [codicioso, paciente, memorioso]

  const resultados = Array.from({ length: PARTIDAS }, (_, i) => {
    const rot = i % 3
    const bots = [0, 1, 2, 3].map((k) => elenco[(rot + k) % 3])
    return { bots, ...jugarPartida({ bots, seed: `torneo-${i}` }) }
  })

  it('never has a move refused, whoever is sitting', () => {
    const rechazados = resultados.filter((r) => r.motivo === 'MOVIMIENTO_RECHAZADO')
    expect(rechazados.map((r) => r.rechazo?.detail)).toEqual([])
  })

  it('finishes every partida', () => {
    expect(resultados.filter((r) => r.motivo !== 'TERMINADA')).toHaveLength(0)
  })

  it('does not finish level: patience is paid for', () => {
    const victorias: Record<string, number> = { codicioso: 0, paciente: 0, memorioso: 0 }
    for (const r of resultados) {
      for (const ganador of r.partida.ganadores ?? []) victorias[r.bots[ganador].id] += 1
    }

    // The gap measured over 1,500 partidas is 931 to 574 against El Paciente;
    // a quarter of that sample keeps the sign with room to spare.
    expect(victorias.paciente).toBeLessThan(victorias.codicioso)
    expect(victorias.paciente).toBeLessThan(victorias.memorioso)
  })

  it('plays differently: El Paciente lays down later than the rest', () => {
    const bajadas: Record<string, number[]> = { codicioso: [], paciente: [], memorioso: [] }

    for (let i = 0; i < 60; i++) {
      const rot = i % 3
      const elencoDeMesa = [0, 1, 2, 3].map((k) => elenco[(rot + k) % 3])
      const espias = elencoDeMesa.map((bot) => ({
        ...bot,
        decidir(vista: ReturnType<typeof vistaDeAsiento>) {
          const move = bot.decidir(vista)
          if (move.type === 'bajarse') bajadas[bot.id].push(vista.numeroDeTurno)
          return move
        },
      }))
      jugarPartida({ bots: espias, seed: `ritmo-${i}` })
    }

    const medio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(medio(bajadas.paciente)).toBeGreaterThan(medio(bajadas.codicioso) + 2)
  })
})
