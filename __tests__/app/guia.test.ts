import { describe, expect, it } from 'vitest'
import { type EstadoDeGuia, guiar } from '@/lib/guia'

/**
 * Phase 45: the guide.
 *
 * What is being pinned is not the wording — that will be re-tuned by whoever
 * watches a real beginner play. It is the contract the guide has with the
 * table: **it never names a control that is disabled**, and it never points
 * at the mesa while the mesa is shut. A hint that tells a new player to press
 * something that will not respond is worse than no hint, because now the
 * screen and the guide disagree and neither can be trusted.
 */

const EN_TURNO: EstadoDeGuia = {
  esTuTurno: true,
  fase: 'act',
  yaBajado: false,
  mesaAbierta: false,
  seleccionadas: 0,
  apartadas: 0,
  contratoCompleto: false,
  hayMesa: false,
}

const guia = (cambios: Partial<EstadoDeGuia> = {}) =>
  guiar({ ...EN_TURNO, ...cambios })

describe('la guía', () => {
  it('says nothing on somebody else’s turn: the strip is the relato’s', () => {
    expect(guia({ esTuTurno: false })).toBeNull()
    // Not even when there would obviously be something to say.
    expect(guia({ esTuTurno: false, fase: 'draw' })).toBeNull()
  })

  it('opens the turn on the one move the rules allow: drawing', () => {
    expect(guia({ fase: 'draw' })).toContain('Roba')
    // And it stays on drawing whatever the hand happens to hold — nothing
    // else is legal yet, so nothing else may be suggested.
    expect(guia({ fase: 'draw', seleccionadas: 3, contratoCompleto: true })).toContain(
      'Roba',
    )
  })

  describe('before the contract is down', () => {
    it('asks for Armar only once three cards are picked up', () => {
      // Armar is disabled under three: the button says so and so does this.
      expect(guia({ seleccionadas: 2 })).toContain('3 o más')
      expect(guia({ seleccionadas: 3 })).toContain('Armar')
    })

    it('offers Bajarme exactly when the contract is complete', () => {
      expect(guia({ contratoCompleto: false, apartadas: 1 })).not.toContain('Bajarme')
      expect(guia({ contratoCompleto: true, apartadas: 2 })).toContain('Bajarme')
    })

    it('says the discard is a legitimate turn, for the player who is stuck', () => {
      // The thing a beginner does not know is allowed: a turn where nothing
      // gets built is a normal turn.
      expect(guia({ seleccionadas: 0 })).toContain('bota')
      expect(guia({ seleccionadas: 1 })).toContain('Botar')
    })
  })

  describe('once you are down', () => {
    const bajado = { yaBajado: true, hayMesa: true } as const

    it('never points at a mesa that is still shut on the turn you bajaste', () => {
      const linea = guia({ ...bajado, mesaAbierta: false, seleccionadas: 2 })
      expect(linea).toContain('próximo turno')
      expect(linea).not.toContain('Toca un grupo')
    })

    it('points at the mesa once it is open, and at Botar to end', () => {
      expect(guia({ ...bajado, mesaAbierta: true, seleccionadas: 2 })).toContain(
        'Toca un grupo',
      )
      expect(guia({ ...bajado, mesaAbierta: true, seleccionadas: 0 })).toContain(
        'grupo de la mesa',
      )
    })

    it('does not offer an empty mesa to ligar onto', () => {
      const linea = guia({
        yaBajado: true,
        mesaAbierta: true,
        hayMesa: false,
        seleccionadas: 1,
      })
      expect(linea).toContain('Bota')
      expect(linea).not.toContain('grupo')
    })
  })

  it('always has something to say while it is your turn', () => {
    // Every reachable combination produces a line: a guide that goes blank
    // mid-turn reads as a bug, and the strip would sit empty.
    for (const fase of ['draw', 'act'] as const)
      for (const yaBajado of [false, true])
        for (const mesaAbierta of [false, true])
          for (const seleccionadas of [0, 1, 3])
            for (const apartadas of [0, 1])
              for (const contratoCompleto of [false, true])
                for (const hayMesa of [false, true])
                  expect(
                    guia({
                      fase,
                      yaBajado,
                      mesaAbierta,
                      seleccionadas,
                      apartadas,
                      contratoCompleto,
                      hayMesa,
                    }),
                  ).toBeTruthy()
  })
})
