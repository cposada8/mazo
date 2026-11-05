// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tipoDeImagen } from '@/lib/server/comodines'

/** Phase 72: the server tells a photo by its bytes, not by its name. */
describe('tipoDeImagen', () => {
  it('knows a jpeg by its header', () => {
    expect(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('image/jpeg')
  })

  it('knows png, webp and avif by their headers', () => {
    expect(tipoDeImagen(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe('image/png')
    const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
    expect(tipoDeImagen(new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]))).toBe(
      'image/webp',
    )
    expect(tipoDeImagen(new Uint8Array([0, 0, 0, 0, ...ascii('ftypavif')]))).toBe('image/avif')
  })

  it('refuses text named .jpg', () => {
    expect(tipoDeImagen(new TextEncoder().encode('no soy una foto'))).toBeNull()
  })
})
