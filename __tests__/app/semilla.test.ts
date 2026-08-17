import { describe, expect, it } from 'vitest'
import { limpiarSemilla, semillaAleatoria } from '@/lib/semilla'

describe('semillaAleatoria', () => {
  it('is different every time', () => {
    // The whole point: before this existed, every first partida was the same
    // partida, because the seed was fixed to keep the prerendered HTML honest.
    const semillas = new Set(Array.from({ length: 500 }, () => semillaAleatoria()))
    expect(semillas.size).toBeGreaterThan(495)
  })

  it('is short enough to say out loud', () => {
    expect(semillaAleatoria()).toHaveLength(6)
  })

  it('avoids characters that get misread', () => {
    const muchas = Array.from({ length: 200 }, () => semillaAleatoria()).join('')
    for (const confusa of ['l', 'o', '0', '1']) {
      expect(muchas).not.toContain(confusa)
    }
  })
})

describe('limpiarSemilla', () => {
  it('trims what a person typed', () => {
    expect(limpiarSemilla('  carioca  ')).toBe('carioca')
  })

  it('leaves an empty field empty, so a random one can take over', () => {
    expect(limpiarSemilla('   ')).toBe('')
  })

  it('caps something absurd', () => {
    expect(limpiarSemilla('x'.repeat(500))).toHaveLength(40)
  })

  it('accepts anything else — any string is a valid seed', () => {
    expect(limpiarSemilla('la de anoche 🎴')).toBe('la de anoche 🎴')
  })
})
