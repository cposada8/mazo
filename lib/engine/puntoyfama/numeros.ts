/**
 * Numbers, puntos and famas (Phase 100) — the game itself, as the owner's
 * `punto-y-fama` repository plays it: n digits from 0–9, none repeated, 0
 * allowed first.
 */

import { type Rng, createRng, shuffle } from '../comun/random'

const CIFRAS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export type Respuesta = { readonly puntos: number; readonly famas: number }

/** A number of exactly n digits, none repeated. */
export function esNumeroValido(texto: string, digitos: number): boolean {
  return texto.length === digitos && /^\d+$/.test(texto) && new Set(texto).size === texto.length
}

/**
 * Famas: a digit in the number and in its place. Puntos: in the number,
 * elsewhere. With no digit repeated, each digit is at most one of the two.
 * 1325 against 1234 is one fama (the 1) and two puntos (the 3 and the 2).
 */
export function puntuarNumero(intento: string, secreto: string): Respuesta {
  let puntos = 0
  let famas = 0
  for (let i = 0; i < secreto.length; i++) {
    if (intento[i] === secreto[i]) famas++
    else if (secreto.includes(intento[i])) puntos++
  }
  return { puntos, famas }
}

/** One number of n digits from a stream. */
export function numeroAlAzar(rng: Rng, digitos: number): string {
  return shuffle(CIFRAS, rng).slice(0, digitos).join('')
}

/** k numbers of n digits from the seed, none twice, in the order they are played. */
export function sacarNumeros(seed: string, cuantos: number, digitos: number): string[] {
  const posibles = cuantosNumeros(digitos)
  const n = Math.max(1, Math.min(cuantos, posibles))
  const rng = createRng(`puntoyfama:${digitos}:${seed}`)
  const vistos = new Set<string>()
  const lista: string[] = []
  while (lista.length < n) {
    const numero = numeroAlAzar(rng, digitos)
    if (vistos.has(numero)) continue
    vistos.add(numero)
    lista.push(numero)
  }
  return lista
}

/** How many numbers of n digits there are: 10 × 9 × … */
export function cuantosNumeros(digitos: number): number {
  let total = 1
  for (let i = 0; i < digitos; i++) total *= 10 - i
  return total
}

/** Every number of n digits without repeats, in order (the owner's combinations files). */
export function todosLosNumeros(digitos: number): string[] {
  const salida: string[] = []
  const usada = new Array<boolean>(10).fill(false)
  const actual: string[] = []
  const recorrer = () => {
    if (actual.length === digitos) {
      salida.push(actual.join(''))
      return
    }
    for (let d = 0; d < 10; d++) {
      if (usada[d]) continue
      usada[d] = true
      actual.push(String(d))
      recorrer()
      actual.pop()
      usada[d] = false
    }
  }
  recorrer()
  return salida
}
