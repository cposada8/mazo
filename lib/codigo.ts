/**
 * The short invite code (Phase 33).
 *
 * Shared between the door and the server: the alphabet drops 0/O/1/I because
 * a code gets read out loud across a room, and five characters of a
 * 32-letter alphabet is 33 million tables — plenty, and still typable on a
 * phone.
 */

export const ALFABETO_DE_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LARGO_DE_CODIGO = 5

export function codigoAlAzar(): string {
  let codigo = ''
  for (let i = 0; i < LARGO_DE_CODIGO; i++) {
    codigo += ALFABETO_DE_CODIGO[Math.floor(Math.random() * ALFABETO_DE_CODIGO.length)]
  }
  return codigo
}

/** What a typed code means once tidied: upper case, no stray spaces. */
export function limpiarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase()
}
