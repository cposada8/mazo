import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the project's single most important constraint, from
 * specs/tech-stack.md: lib/engine/ imports nothing from the rest of the
 * project and nothing from a framework. Bots, the UI and the online server are
 * clients of the engine — never the other way round.
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

const engineFiles = readdirSync(ENGINE_DIR).filter((file) => file.endsWith('.ts'))

const importsOf = (file: string): string[] => {
  const source = readFileSync(path.join(ENGINE_DIR, file), 'utf8')
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('engine purity', () => {
  it('has files to check', () => {
    expect(engineFiles.length).toBeGreaterThan(0)
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
})
