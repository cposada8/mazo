import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the project's single most important constraint, from
 * specs/tech-stack.md: lib/engine/ imports nothing from the rest of the
 * project and nothing from a framework. Bots, the UI and the online server are
 * clients of the engine — never the other way round.
 *
 * Since Phase 75 the engine has halves, and the rule has a direction too:
 * `comun/` imports nothing from any game, and a game imports only `comun/`
 * and itself — never another game.
 *
 * This is a test rather than a convention because conventions erode quietly.
 */

const ENGINE_DIR = path.resolve(import.meta.dirname, '../../lib/engine')

const FORBIDDEN = [
  'react',
  'react-dom',
  'next',
  'next/',
  '@prisma/client',
  'zustand',
  '@tanstack/react-query',
]

/** Every .ts file under the engine, as a path relative to it. */
const engineFiles = readdirSync(ENGINE_DIR, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.ts'))
  .sort()

const importsOf = (file: string): string[] => {
  const source = readFileSync(path.join(ENGINE_DIR, file), 'utf8')
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
}

/** The engine folder a file lives in: 'comun', a game, or '' for the root. */
const mitadDe = (file: string) => (file.includes(path.sep) ? file.split(path.sep)[0] : '')

/** Where a relative import from `file` lands, as a path under the engine. */
const destino = (file: string, specifier: string) =>
  path.relative(ENGINE_DIR, path.resolve(ENGINE_DIR, path.dirname(file), specifier))

const juegos = [...new Set(engineFiles.map(mitadDe))].filter((m) => m && m !== 'comun')

describe('engine purity', () => {
  it('has a shared half and at least one game', () => {
    expect(engineFiles.some((file) => mitadDe(file) === 'comun')).toBe(true)
    expect(juegos).toContain('carioca')
  })

  it.each(engineFiles)('%s imports nothing from the app', (file) => {
    for (const specifier of importsOf(file)) {
      expect(
        specifier.startsWith('@/') && !specifier.startsWith('@/lib/engine/'),
        `${file} imports ${specifier}`,
      ).toBe(false)
    }
  })

  it.each(engineFiles)('%s imports no framework', (file) => {
    for (const specifier of importsOf(file)) {
      expect(
        FORBIDDEN.some((banned) => specifier === banned || specifier.startsWith(`${banned}/`)),
        `${file} imports ${specifier}`,
      ).toBe(false)
    }
  })

  it.each(engineFiles.filter((file) => mitadDe(file) !== ''))(
    '%s imports only its own half and the shared one',
    (file) => {
      const propia = mitadDe(file)
      for (const specifier of importsOf(file)) {
        expect(specifier.startsWith('@/'), `${file} imports ${specifier} by alias`).toBe(false)
        if (!specifier.startsWith('.')) continue
        const llega = mitadDe(destino(file, specifier))
        const permitida = propia === 'comun' ? ['comun'] : [propia, 'comun']
        expect(permitida, `${file} imports ${specifier}`).toContain(llega)
      }
    },
  )
})
