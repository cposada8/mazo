import { describe, expect, it } from 'vitest'
import {
  type Move,
  type PartidaState,
  type RondaState,
  aplicarEnPartida,
  apply,
  probarEnMesa,
  startPartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { codicioso } from '@/lib/bots'
import { c, makeRonda, n, play } from './helpers'

/**
 * The Phase 30 guarantee: a view carries nothing its seat is not entitled to.
 *
 * The type already has no field for another hand — these tests check the
 * *values*: walk real partidas and assert that no card id from any other hand
 * appears anywhere in a serialized view, whatever shape it hides in.
 */
describe('a view leaks no hidden card', () => {
  /*
   * Three seeds, four hundred moves each, and a full leak check between every
   * one of them: comfortably the slowest assertion in the suite, and close
   * enough to the default five seconds that a busy machine used to fail it
   * (Phase 44). What it measures is coverage, not speed.
   */
  it('holds across whole bot partidas, every seat, every state', () => {
    for (const seed of ['vista-1', 'vista-2', 'vista-3']) {
      let partida: PartidaState = startPartida({ players: 3, seed })

      for (let paso = 0; paso < 400 && partida.ronda; paso++) {
        const ronda = partida.ronda
        assertSinFugas(ronda)

        const move = codicioso.decidir(vistaDeAsiento(ronda, ronda.turno))
        const result = aplicarEnPartida(partida, move)
        if (!result.ok) throw new Error(`${result.code}: ${result.detail}`)
        partida = result.state
      }
    }
  }, 30_000)

  it('never carries the rng state, which predicts the stock', () => {
    const ronda = makeRonda({ jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }] })
    const vista = vistaDeAsiento(ronda, 0)

    expect('rngState' in vista).toBe(false)
    expect(JSON.stringify(vista)).not.toContain('rngState')
  })

  it('reduces the stock to a count', () => {
    const ronda = makeRonda({
      jugadores: [{ hand: [n('7', 'spades')] }, { hand: [] }],
      stock: [n('2', 'clubs'), n('K', 'hearts')],
    })

    const vista = vistaDeAsiento(ronda, 0)
    expect(vista.stock).toBe(2)
    expect(JSON.stringify(vista)).not.toContain('K-hearts')
  })
})

/** Every card id visible in `vista` must be one the seat is entitled to see. */
function assertSinFugas(ronda: RondaState) {
  for (let asiento = 0; asiento < ronda.jugadores.length; asiento++) {
    const vista = vistaDeAsiento(ronda, asiento)
    const serializada = JSON.stringify(vista)

    for (let otro = 0; otro < ronda.jugadores.length; otro++) {
      if (otro === asiento) continue
      for (const card of ronda.jugadores[otro].hand) {
        if (serializada.includes(`"${card.id}"`)) {
          throw new Error(
            `seat ${asiento}'s view contains ${card.id} from seat ${otro}'s hand`,
          )
        }
      }
    }

    for (const card of ronda.stock) {
      if (serializada.includes(`"${card.id}"`)) {
        throw new Error(`seat ${asiento}'s view contains ${card.id} from the stock`)
      }
    }
  }
}

/**
 * `probarEnMesa` must agree with the real referee: same acceptances, same
 * refusals, same codes — it *is* the real referee, run over an imagined ronda,
 * and these pin that the imagination never changes the answer.
 */
describe('probarEnMesa agrees with apply', () => {
  const escalaConMesa = () => {
    const escala = [n('2', 'diamonds'), n('3', 'diamonds'), n('4', 'diamonds'), n('5', 'diamonds')]
    const trioA = [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')]
    const trioB = [n('Q', 'spades'), n('Q', 'hearts'), n('Q', 'clubs')]
    const seis = n('6', 'diamonds')

    // Seat 0 bajó on turn 1 with contrato c2 (trio + escala); it is now a later
    // turn, so the mesa is open.
    return makeRonda({
      jugadores: [
        {
          hand: [seis, n('10', 'spades'), n('J', 'hearts')],
          grupos: [
            { kind: 'trio', rank: '7', cards: trioA },
            { kind: 'escala', suit: 'diamonds', start: '2', cards: escala },
          ],
          bajadoEnTurno: 1,
        },
        { hand: [n('A', 'clubs'), n('2', 'hearts')], grupos: [{ kind: 'trio', rank: 'Q', cards: trioB }] },
      ],
      turno: 0,
      numeroDeTurno: 3,
      fase: 'act',
    })
  }

  it('accepts what apply accepts, on any seat’s grupo', () => {
    const ronda = escalaConMesa()
    const vista = vistaDeAsiento(ronda, 0)
    const move: Move = {
      type: 'agregar',
      seat: 0,
      grupoIndex: 1,
      cardIds: [ronda.jugadores[0].hand[0].id],
      end: 'tail',
    }

    expect(probarEnMesa(vista, move).ok).toBe(true)
    expect(apply(ronda, move).ok).toBe(true)
  })

  it('refuses what apply refuses, with the same code', () => {
    const ronda = escalaConMesa()
    const vista = vistaDeAsiento(ronda, 0)
    // The 10♠ extends nothing on the mesa.
    const move: Move = {
      type: 'agregar',
      seat: 0,
      grupoIndex: 1,
      cardIds: [ronda.jugadores[0].hand[1].id],
      end: 'tail',
    }

    const ensayo = probarEnMesa(vista, move)
    const real = apply(ronda, move)
    expect(ensayo.ok).toBe(false)
    expect(real.ok).toBe(false)
    if (!ensayo.ok && !real.ok) expect(ensayo.code).toBe(real.code)
  })

  it('enforces the same-turn lock from the view alone', () => {
    const base = escalaConMesa()
    const ronda: RondaState = {
      ...base,
      jugadores: base.jugadores.map((j, i) =>
        i === 0 ? { ...j, bajadoEnTurno: base.numeroDeTurno } : j,
      ),
    }
    const vista = vistaDeAsiento(ronda, 0)
    const move: Move = {
      type: 'agregar',
      seat: 0,
      grupoIndex: 1,
      cardIds: [ronda.jugadores[0].hand[0].id],
      end: 'tail',
    }

    const ensayo = probarEnMesa(vista, move)
    expect(ensayo.ok).toBe(false)
    if (!ensayo.ok) expect(ensayo.code).toBe('MESA_BLOQUEADA_MISMO_TURNO')
  })

  it('handles moverComodin: the trial and the referee stay in step', () => {
    const comodin = c()
    const cinco = n('5', 'hearts')
    const ronda = play(
      makeRonda({
        jugadores: [
          {
            hand: [cinco, n('9', 'clubs'), n('10', 'clubs')],
            grupos: [
              {
                kind: 'escala',
                suit: 'hearts',
                start: '5',
                cards: [comodin, n('6', 'hearts'), n('7', 'hearts'), n('8', 'hearts')],
              },
            ],
            bajadoEnTurno: 1,
          },
          { hand: [n('A', 'spades'), n('2', 'spades')] },
        ],
        turno: 0,
        numeroDeTurno: 3,
        fase: 'act',
      }),
      [],
    )

    const vista = vistaDeAsiento(ronda, 0)
    const move: Move = {
      type: 'moverComodin',
      seat: 0,
      grupoIndex: 0,
      cardId: cinco.id,
      to: 'tail',
    }

    expect(probarEnMesa(vista, move).ok).toBe(apply(ronda, move).ok)
    expect(probarEnMesa(vista, move).ok).toBe(true)
  })
})
