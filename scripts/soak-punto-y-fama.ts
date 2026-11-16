/**
 * The solver's soak (Phase 100): the bot guesses every number of n digits
 * and reports the average and the worst — the owner measured 5.5 and 8 for
 * four digits.
 *
 *   npx tsx scripts/soak-punto-y-fama.ts [digitos]
 */

import { adivino, empezarBot, puntuarNumero, responder, siguienteIntento, todosLosNumeros } from '@/lib/engine/puntoyfama'

const digitos = Number(process.argv[2] ?? 4)
const inicio = Date.now()
let suma = 0
let peor = 0
const cuantos = new Map<number, number>()
const todos = todosLosNumeros(digitos)
todos.forEach((secreto, i) => {
  let bot = empezarBot(digitos, `soak-${i}`)
  while (!adivino(bot)) {
    const intento = siguienteIntento(bot)!
    bot = responder(bot, puntuarNumero(intento, secreto))
  }
  suma += bot.pasos.length
  peor = Math.max(peor, bot.pasos.length)
  cuantos.set(bot.pasos.length, (cuantos.get(bot.pasos.length) ?? 0) + 1)
})
console.log([...cuantos].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}: ${c}`).join(' · '))
console.log(`${digitos} cifras: ${todos.length} números, promedio ${(suma / todos.length).toFixed(2)}, máximo ${peor}, ${((Date.now() - inicio) / 1000).toFixed(1)} s`)
