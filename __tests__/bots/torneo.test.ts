import { describe, expect, it } from 'vitest'
import { type Bot, BOTS, codicioso, jugarTorneo } from '@/lib/bots'
import type { VistaDeAsiento } from '@/lib/engine'

/**
 * Phase 53: the bench. It has to be repeatable, add up, and catch the
 * mistakes found by hand so far.
 */

describe('jugarTorneo', () => {
  // The quick bots: El Tahúr is measured on the command line, not in the suite.
  const rapidos = BOTS.filter((bot) => bot.nivel !== 'dificil')
  const opciones = { bots: rapidos, partidas: 12, asientos: 4, semilla: 'banco' }

  it('is repeatable: same options, same report', () => {
    expect(jugarTorneo(opciones)).toEqual(jugarTorneo(opciones))
  })

  it('rotates every contender through the seats and splits every win', () => {
    const reporte = jugarTorneo(opciones)
    expect(reporte.terminadas).toBe(12)
    expect(reporte.faltas).toEqual([])
    const asientos = reporte.bots.map((bot) => bot.asientos)
    expect(asientos.reduce((a, b) => a + b)).toBe(48)
    expect(asientos).toHaveLength(rapidos.length)
    expect(Math.max(...asientos) - Math.min(...asientos)).toBeLessThanOrEqual(1)
    const victorias = reporte.bots.reduce((total, bot) => total + bot.victorias, 0)
    expect(victorias).toBeCloseTo(12)
  })

  it('counts a bot that is seated twice as one contender', () => {
    const reporte = jugarTorneo({ ...opciones, bots: [codicioso, codicioso] })
    expect(reporte.bots).toHaveLength(1)
    expect(reporte.bots[0].tasaDeVictoria).toBeCloseTo(1 / 4)
  })

  it('catches a bajado bot that takes the face-up card and keeps it', () => {
    // El Codicioso, except that once down it always takes the descarte.
    const goloso: Bot = {
      id: 'goloso',
      nombre: 'Goloso',
      nivel: 'facil',
      descripcion: 'Un bot de prueba.',
      decidir: (vista: VistaDeAsiento) =>
        vista.fase === 'draw' &&
        vista.jugadores[vista.asiento].bajadoEnTurno !== null &&
        vista.descarte.length > 0
          ? { type: 'robar', de: 'descarte' }
          : codicioso.decidir(vista),
    }
    const reporte = jugarTorneo({ ...opciones, bots: [goloso, codicioso] })
    expect(reporte.faltas.some((falta) => falta.tipo === 'DESCARTE_INUTIL')).toBe(true)
  })

  it('reports a refused move instead of hanging', () => {
    const tramposo: Bot = {
      id: 'tramposo',
      nombre: 'Tramposo',
      nivel: 'facil',
      descripcion: 'Un bot de prueba.',
      decidir: () => ({ type: 'descartar', cardId: 'no-existe' }),
    }
    const reporte = jugarTorneo({ ...opciones, partidas: 2, bots: [tramposo] })
    expect(reporte.terminadas).toBe(0)
    expect(reporte.faltas.every((falta) => falta.tipo === 'RECHAZO')).toBe(true)
  })
})
