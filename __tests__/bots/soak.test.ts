import { describe, expect, it } from 'vitest'
import { CONFIG_POR_DEFECTO, contratoPorId } from '@/lib/engine'
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
   * Stalls are measured, not asserted away.
   *
   * Carioca has no stalemate rule, so a ronda in which nobody can complete the
   * contrato genuinely never ends. These bots hit that on a small fraction of
   * seeds. The threshold is a regression guard: if a change makes the bots
   * dumber, this is where it shows.
   */
  const estancadas = resultados.filter((r) => r.motivo === 'TOPE_DE_TURNOS')
  const terminadas = resultados.filter((r) => r.motivo === 'TERMINADA')

  it('finishes the overwhelming majority of partidas', () => {
    const tasa = estancadas.length / PARTIDAS
    console.log(
      `soak: ${terminadas.length}/${PARTIDAS} terminadas, ` +
        `${estancadas.length} estancadas (${(tasa * 100).toFixed(1)}%)`,
    )
    expect(tasa).toBeLessThan(0.05)
  })

  it('stalls only for want of a contrato, never mid-ronda nonsense', () => {
    for (const resultado of estancadas) {
      // A stalled partida is still a legal one: it is simply unfinished.
      expect(resultado.partida.ronda).not.toBeNull()
      expect(resultado.partida.ronda!.ganador).toBeNull()
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

  it('finishes without comodines', () => {
    const resultado = jugarPartida({
      bots: [codicioso, codicioso],
      seed: 'sin-comodines',
      config: { ...CONFIG_POR_DEFECTO, comodines: false },
    })

    expect(resultado.motivo).toBe('TERMINADA')
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
      expect(marcador.puntos[marcador.ganador]).toBe(-10)
    }
  })
})
