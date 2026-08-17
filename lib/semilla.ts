/**
 * Seeds for a partida.
 *
 * A seed is what makes a partida reproducible: the same one always deals the
 * same cards. That is useful for replaying a game and for reporting a bug, so
 * it is worth showing and worth letting a person type — but the default has to
 * be genuinely random, or every first game is the same game.
 *
 * Short and readable on purpose: something you can say out loud or write down.
 */
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789'
const LARGO = 6

export function semillaAleatoria(): string {
  let semilla = ''
  for (let i = 0; i < LARGO; i++) {
    semilla += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return semilla
}

/** Anything a person types is a valid seed; this only tidies it. */
export function limpiarSemilla(entrada: string): string {
  return entrada.trim().slice(0, 40)
}
