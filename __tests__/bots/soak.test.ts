import { describe, expect, it } from 'vitest'
import {
  CONFIG_POR_DEFECTO,
  vistaDeAsiento,
  type PartidaState,
  aplicarEnPartida,
  contratoPorId,
  isComodin,
  startPartida,
} from '@/lib/engine'
import { codicioso, jugarPartida } from '@/lib/bots'

/**
 * The soak: bots playing a thousand partidas end to end.
 *
 * This is the real deliverable of the bot phase. Unit tests check rules one at
 * a time; this drives the whole engine through every contract, every reshuffle,
 * and every unloading move, looking for the one combination nobody thought to
 * write a test for.
 *
 * Two failures are distinguished on purpose:
 *
 * - **A refused move is always a bug** — either the bot proposed something
 *   illegal or the engine refused something legal. Never acceptable.
 * - **A stalled ronda is not.** Carioca has no stalemate rule: if nobody can
 *   complete the contrato, the ronda genuinely never ends. It is reported, not
 *   asserted away.
 */

const PARTIDAS = 1000
const bots = [codicioso, codicioso, codicioso, codicioso]

describe('four bots, a thousand partidas', () => {
  const resultados = Array.from({ length: PARTIDAS }, (_, i) =>
    jugarPartida({ bots, seed: `soak-${i}` }),
  )

  it('never has a move refused by the engine', () => {
    const rechazados = resultados.filter((r) => r.motivo === 'MOVIMIENTO_RECHAZADO')

    expect(
      rechazados.map((r) => `${r.rechazo?.code}: ${r.rechazo?.detail}`).slice(0, 5),
    ).toEqual([])
    expect(rechazados).toHaveLength(0)
  })

  it('never runs a turn away with itself', () => {
    expect(resultados.filter((r) => r.motivo === 'TOPE_DE_MOVIMIENTOS')).toHaveLength(0)
  })

  /**
   * Since Phase 31 there is no such thing as a stall: a ronda whose stock can
   * no longer be served or rebuilt closes en tablas, so every partida ends.
   * Before the rule, these bots stalled on ~1.3% of seeds.
   */
  const estancadas = resultados.filter((r) => r.motivo === 'TOPE_DE_TURNOS')
  const terminadas = resultados.filter((r) => r.motivo === 'TERMINADA')
  const enTablas = resultados.filter((r) =>
    r.partida.historial.some((marcador) => marcador.ganador === 'nadie'),
  )

  it('finishes every single partida — tablas killed the stall', () => {
    console.log(
      `soak: ${terminadas.length}/${PARTIDAS} terminadas, ` +
        `${enTablas.length} con al menos una ronda en tablas`,
    )
    expect(estancadas).toHaveLength(0)
    expect(terminadas).toHaveLength(PARTIDAS)
  })

  it('a ronda en tablas scores everybody and pays no bonus', () => {
    expect(enTablas.length).toBeGreaterThan(0)
    for (const resultado of enTablas) {
      for (const marcador of resultado.partida.historial) {
        if (marcador.ganador !== 'nadie') continue
        for (const puntos of marcador.puntos) {
          expect(puntos).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('plays every contract when it does finish', () => {
    for (const resultado of terminadas) {
      expect(resultado.partida.historial).toHaveLength(
        CONFIG_POR_DEFECTO.contratos.length,
      )
      expect(resultado.partida.ronda).toBeNull()
    }
  })

  it('always produces at least one winner', () => {
    for (const resultado of terminadas) {
      expect(resultado.partida.ganadores!.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('gives the win to a lowest total, every time', () => {
    for (const resultado of terminadas) {
      const { totales, ganadores } = resultado.partida
      const menor = Math.min(...totales)
      for (const seat of ganadores!) expect(totales[seat]).toBe(menor)
    }
  })

  it('scores every seat in every ronda played', () => {
    for (const resultado of resultados) {
      for (const marcador of resultado.partida.historial) {
        expect(marcador.puntos).toHaveLength(bots.length)
      }
    }
  })

  it('is repeatable — the same seed plays the same partida', () => {
    const a = jugarPartida({ bots, seed: 'repetible' })
    const b = jugarPartida({ bots, seed: 'repetible' })
    expect(a.partida.totales).toEqual(b.partida.totales)
    expect(a.turnos).toBe(b.turnos)
  })

  it('reports what the bots actually do', () => {
    const turnos = terminadas.map((r) => r.turnos)
    const promedio = turnos.reduce((a, b) => a + b, 0) / turnos.length
    const ganadas = [0, 0, 0, 0]
    for (const resultado of terminadas) {
      for (const seat of resultado.partida.ganadores!) ganadas[seat]++
    }

    // Not an assertion about quality — the bots are identical, so this is a
    // fairness check on the engine: no seat should be winning far more often.
    console.log(
      `soak: ${promedio.toFixed(1)} turnos de media, ` +
        `victorias por asiento ${ganadas.join('/')}`,
    )

    const total = ganadas.reduce((a, b) => a + b, 0)
    for (const victorias of ganadas) {
      expect(victorias / total).toBeGreaterThan(0.1)
    }
  })
})

describe('two bots, every contract on', () => {
  it('finishes with the full catalogue enabled', () => {
    const config = {
      ...CONFIG_POR_DEFECTO,
      contratos: [...CONFIG_POR_DEFECTO.contratos, contratoPorId('c8')!],
    }
    const resultado = jugarPartida({
      bots: [codicioso, codicioso],
      seed: 'catalogo',
      config,
    })

    expect(resultado.motivo).toBe('TERMINADA')
    expect(resultado.partida.historial).toHaveLength(8)
  })

  it('finishes without comodines, and none ever appears anywhere', () => {
    // Not just the deal: the whole partida — every hand, the stock and the
    // descarte through every reshuffle — is played move by move and checked.
    let partida = startPartida({
      players: 2,
      seed: 'sin-comodines',
      config: { ...CONFIG_POR_DEFECTO, comodines: false },
    })

    const sinComodines = (ronda: NonNullable<PartidaState['ronda']>) => {
      const cartas = [
        ...ronda.stock,
        ...ronda.discard,
        ...ronda.jugadores.flatMap((jugador) => [
          ...jugador.hand,
          ...jugador.grupos.flatMap((grupo) => grupo.cards),
        ]),
      ]
      return cartas.every((carta) => !isComodin(carta))
    }

    let movimientos = 0
    while (partida.ronda && movimientos < 20_000) {
      expect(sinComodines(partida.ronda)).toBe(true)
      const result = aplicarEnPartida(partida, codicioso.decidir(vistaDeAsiento(partida.ronda, partida.ronda.turno)))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      partida = result.state
      movimientos++
    }

    expect(partida.ronda).toBeNull()
    expect(partida.ganadores).not.toBeNull()
  })

  it('finishes with a ronda-winner bonus', () => {
    const resultado = jugarPartida({
      bots: [codicioso, codicioso, codicioso],
      seed: 'bonus',
      config: { ...CONFIG_POR_DEFECTO, bonusGanadorRonda: 10 },
    })

    expect(resultado.motivo).toBe('TERMINADA')
    // Every ronda's winner is charged −10 instead of 0.
    for (const marcador of resultado.partida.historial) {
      expect(marcador.ganador).not.toBe('nadie')
      expect(marcador.puntos[marcador.ganador as number]).toBe(-10)
    }
  })
})
