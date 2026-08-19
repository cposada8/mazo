import { describe, expect, it } from 'vitest'
import {
  CATALOGO,
  CONFIG_POR_DEFECTO,
  type PartidaState,
  aplicarEnPartida,
  startPartida,
} from '@/lib/engine'
import { makeRonda, n } from './helpers'

/**
 * Phase 42: the mesa the ronda was won on is kept, not caught.
 *
 * Closing a ronda deals the next one in the same move, so by the time anybody
 * hears the ronda ended, the table worth looking at has been swept. The
 * marcador carries a picture of it, and of what the closing move put there.
 */

const CUATRO_TRIOS = CATALOGO[3]

const partidaCon = (ronda: PartidaState['ronda']): PartidaState => ({
  ...startPartida({
    players: 2,
    seed: 'cierre',
    config: { ...CONFIG_POR_DEFECTO, contratos: [CUATRO_TRIOS, CATALOGO[0]] },
  }),
  ronda,
})

/** Seat 0 is bajado with one trío down and one card left in hand. */
const aPuntoDeSalir = (ultima = n('7', 'diamonds')) =>
  makeRonda({
    contrato: CUATRO_TRIOS,
    jugadores: [
      {
        hand: [ultima],
        grupos: [
          {
            kind: 'trio',
            rank: '7',
            cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')],
          },
        ],
        bajadoEnTurno: 1,
      },
      { hand: [n('K', 'spades')] },
    ],
    numeroDeTurno: 3,
    fase: 'act',
  })

describe('the marcador remembers the table', () => {
  it('keeps every grupo as it stood when the ronda closed', () => {
    const ultima = n('7', 'diamonds')
    const resultado = aplicarEnPartida(partidaCon(aPuntoDeSalir(ultima)), {
      type: 'agregar',
      seat: 0,
      grupoIndex: 0,
      cardIds: [ultima.id],
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const marcador = resultado.state.historial[0]
    expect(marcador.mesa).toBeDefined()
    // Four sevens: the three that were down, and the one that closed it.
    expect(marcador.mesa![0][0].cards).toHaveLength(4)
    expect(marcador.mesa![1]).toEqual([])

    // And the picture is of the ronda that ended, not of the one already
    // dealt behind it.
    expect(resultado.state.ronda!.jugadores[0].grupos).toEqual([])
  })

  it('names the cards the closing move put there — what it was won with', () => {
    const ultima = n('7', 'diamonds')
    const resultado = aplicarEnPartida(partidaCon(aPuntoDeSalir(ultima)), {
      type: 'agregar',
      seat: 0,
      grupoIndex: 0,
      cardIds: [ultima.id],
    })
    if (!resultado.ok) return

    expect(resultado.state.historial[0].cierre).toEqual([ultima.id])
  })

  it('names the whole winning turn — bajarse and then botar', () => {
    // The case that matters, and the one a first attempt got wrong by
    // measuring the closing *move*: going out is usually laying the contract
    // down and throwing what is left, and the move that ends the ronda
    // touches nothing at all.
    const trios = [
      [n('4', 'spades'), n('4', 'hearts'), n('4', 'clubs')],
      [n('9', 'spades'), n('9', 'hearts'), n('9', 'clubs')],
      [n('J', 'spades'), n('J', 'hearts'), n('J', 'clubs')],
    ]
    const sobra = n('2', 'clubs')
    const ronda = makeRonda({
      contrato: CUATRO_TRIOS,
      jugadores: [
        { hand: [...trios.flat(), sobra] },
        { hand: [n('K', 'spades')] },
      ],
      numeroDeTurno: 7,
      fase: 'act',
    })

    const bajada = aplicarEnPartida(partidaCon(ronda), {
      type: 'bajarse',
      propuestas: trios.map((cards) => ({
        kind: 'trio' as const,
        rank: cards[0].rank,
        cardIds: cards.map((card) => card.id),
      })),
    })
    expect(bajada.ok).toBe(true)
    if (!bajada.ok) return

    const cierre = aplicarEnPartida(bajada.state, {
      type: 'descartar',
      cardId: sobra.id,
    })
    expect(cierre.ok).toBe(true)
    if (!cierre.ok) return

    const marcador = cierre.state.historial[0]
    expect(marcador.ganador).toBe(0)
    // All nine, not the nothing the discard added.
    expect([...(marcador.cierre ?? [])].sort()).toEqual(
      trios.flat().map((card) => card.id).sort(),
    )
    // And never the card that went to the descarte: this is the mesa's story.
    expect(marcador.cierre).not.toContain(sobra.id)
  })

  it('names nothing when the winning turn put nothing on the mesa', () => {
    // Bajado on an earlier turn, and this one was only a discard.
    const ultima = n('2', 'clubs')
    const resultado = aplicarEnPartida(partidaCon(aPuntoDeSalir(ultima)), {
      type: 'descartar',
      cardId: ultima.id,
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const marcador = resultado.state.historial[0]
    expect(marcador.cierre).toEqual([])
    // The mesa is still kept: it is the table that was won, however it ended.
    expect(marcador.mesa![0][0].cards).toHaveLength(3)
  })

  it('photographs the mesa and nothing else — no hand rides in a marcador', () => {
    // The snapshot is read from `grupos`, never from `hand`, so the losing
    // cards it would be cheating to see are structurally absent rather than
    // filtered out. Every reader gets the same picture, which is the only
    // reason it can be sent to all of them.
    const ultima = n('7', 'diamonds')
    const partida = partidaCon(aPuntoDeSalir(ultima))
    const perdedor = partida.ronda!.jugadores[1].hand

    const resultado = aplicarEnPartida(partida, {
      type: 'agregar',
      seat: 0,
      grupoIndex: 0,
      cardIds: [ultima.id],
    })
    if (!resultado.ok) return

    const foto = JSON.stringify(resultado.state.historial[0])
    for (const card of perdedor) expect(foto).not.toContain(card.id)
  })

  it('survives the round trip a stored partida makes', () => {
    const ultima = n('7', 'diamonds')
    const resultado = aplicarEnPartida(partidaCon(aPuntoDeSalir(ultima)), {
      type: 'agregar',
      seat: 0,
      grupoIndex: 0,
      cardIds: [ultima.id],
    })
    if (!resultado.ok) return

    // Both homes keep the partida as JSON — localStorage in the browser, a
    // column on the server — so the snapshot has to be plain data.
    const ida = JSON.parse(JSON.stringify(resultado.state)) as PartidaState
    expect(ida.historial[0].mesa).toEqual(resultado.state.historial[0].mesa)
    expect(ida.historial[0].cierre).toEqual([ultima.id])
  })
})
