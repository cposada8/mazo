import { describe, expect, it } from 'vitest'
import { BOTS, BOT_POR_DEFECTO, NOMBRE_DE_NIVEL } from '@/lib/bots'

/**
 * Phase 57: niveles en la sala. The owner's decision — the first three bots
 * stay as they were, as Fácil, and stronger play comes as new bots.
 */

describe('the levels', () => {
  it('keeps the original three as Fácil', () => {
    const faciles = BOTS.filter((bot) => bot.nivel === 'facil').map((bot) => bot.id)
    expect(faciles).toEqual(['codicioso', 'paciente', 'memorioso'])
  })

  it('offers El Calculador as Normal', () => {
    expect(BOTS.find((bot) => bot.id === 'calculador')?.nivel).toBe('normal')
  })

  it('gives every bot a level with a name, and a distinct id', () => {
    for (const bot of BOTS) expect(NOMBRE_DE_NIVEL[bot.nivel]).toBeTruthy()
    expect(new Set(BOTS.map((bot) => bot.id)).size).toBe(BOTS.length)
  })

  it('seats a Fácil bot by default until the owner says otherwise', () => {
    expect(BOT_POR_DEFECTO.nivel).toBe('facil')
  })
})
