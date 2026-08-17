/**
 * The alias list is a file: `public/candidatos/alias.txt`, one name per line,
 * curated exactly like the comodín gallery (Phase 29's lesson) — add or delete
 * lines, push, and the deploy serves the new list. This is the parser; reading
 * the file belongs to whoever is on the server.
 */

/** One name per line. Blank lines and `#` comments are ignored, dupes folded. */
export function parsearAlias(texto: string): string[] {
  const vistos = new Map<string, string>()
  for (const linea of texto.split('\n')) {
    const alias = linea.trim()
    if (!alias || alias.startsWith('#')) continue
    const clave = alias.toLowerCase()
    if (!vistos.has(clave)) vistos.set(clave, alias)
  }
  return [...vistos.values()]
}

/** The stand-in when the file is missing or empty. */
export const ALIAS_DE_EMERGENCIA = 'Jugador'
