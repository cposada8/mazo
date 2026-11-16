import { describe, expect, it } from 'vitest'
import { MS_CUENTA_ATRAS, cerrada, clasificacion } from '@/lib/engine/comun/carrera'
import {
  adivino,
  contradice,
  cuantosNumeros,
  deshacer,
  empezarBot,
  empezarDuelo,
  empezarPuntoYFama,
  esNumeroValido,
  intentarEnDuelo,
  intentarNumero,
  leerIntento,
  ponerSecreto,
  posiblesDe,
  puntuarNumero,
  responder,
  resultadoDelDuelo,
  retirarDelDuelo,
  sacarNumeros,
  siguienteIntento,
  todosLosNumeros,
  vistaDelDuelo,
  vistaPuntoYFama,
} from '@/lib/engine/puntoyfama'

/** Phase 100: Punto y Fama's engine — numbers, both races, the duel, the bot. */

const AHORA = 1_000_000
const T = AHORA + MS_CUENTA_ATRAS

describe('numbers, puntos and famas', () => {
  it('scores as the owner’s app does', () => {
    expect(puntuarNumero('1325', '1234')).toEqual({ famas: 1, puntos: 2 })
    expect(puntuarNumero('1234', '1234')).toEqual({ famas: 4, puntos: 0 })
    expect(puntuarNumero('5678', '1234')).toEqual({ famas: 0, puntos: 0 })
    expect(puntuarNumero('4321', '1234')).toEqual({ famas: 0, puntos: 4 })
  })

  it('a number is n digits, none repeated, and 0 may come first', () => {
    expect(esNumeroValido('0123', 4)).toBe(true)
    expect(esNumeroValido('1123', 4)).toBe(false)
    expect(esNumeroValido('123', 4)).toBe(false)
    expect(leerIntento('12a4', 4)).toEqual({ ok: false, code: 'LARGO' })
    expect(leerIntento('1224', 4)).toEqual({ ok: false, code: 'REPETIDO' })
    expect(leerIntento(' 0987 ', 4)).toEqual({ ok: true, numero: '0987' })
  })

  it('every number exists once, and the list from a seed is the same, without repeats', () => {
    expect(todosLosNumeros(4)).toHaveLength(cuantosNumeros(4))
    expect(cuantosNumeros(4)).toBe(5040)
    const lista = sacarNumeros('x', 30, 4)
    expect(lista).toEqual(sacarNumeros('x', 30, 4))
    expect(new Set(lista).size).toBe(30)
    for (const n of lista) expect(esNumeroValido(n, 4)).toBe(true)
  })
})

describe('the races', () => {
  it('«Números límite»: no try limit, the same numbers for all, fastest wins', () => {
    let e = empezarPuntoYFama({ seed: 'carrera', numeros: 2, digitos: 4, asientos: [0, 1], ahora: AHORA })
    const [a, b] = e.bolsa
    const jugar = (asiento: number, texto: string, t: number) => {
      const r = intentarNumero(e, asiento, texto, T + t)
      if (!r.ok) throw new Error(r.code)
      e = r.estado
      return r
    }
    // Ten wrong guesses do not end a number.
    const otro = todosLosNumeros(4).filter((n) => n !== a)
    for (let i = 0; i < 10; i++) jugar(0, otro[i], 1000)
    expect(e.tableros[0].terminadas).toHaveLength(0)
    expect(jugar(0, a, 2000).intento).toMatchObject({ famas: 4, puntos: 0 })
    jugar(0, b, 3000)
    jugar(1, a, 4000)
    jugar(1, b, 9000)
    expect(clasificacion(e).map((p) => p.asiento)).toEqual([0, 1])
    expect(cerrada(e, T + 9001)).toBe(true)
    expect(intentarNumero(e, 0, '1123', T)).toEqual({ ok: false, code: 'YA_TERMINASTE' })
  })

  it('a repeated digit or a short guess is refused at no cost', () => {
    const e = empezarPuntoYFama({ seed: 'r', numeros: 1, digitos: 4, asientos: [0], ahora: AHORA })
    expect(intentarNumero(e, 0, '1123', T)).toEqual({ ok: false, code: 'REPETIDO' })
    expect(intentarNumero(e, 0, '123', T)).toEqual({ ok: false, code: 'LARGO' })
  })

  it('«Tiempo límite»: a long list, the most numbers in the minutes wins', () => {
    let e = empezarPuntoYFama({ seed: 't', numeros: 3, digitos: 3, asientos: [0, 1], ahora: AHORA, modo: 'tiempo', minutos: 2 })
    expect(e.bolsa.length).toBeGreaterThan(100)
    for (const n of e.bolsa.slice(0, 2)) {
      const r = intentarNumero(e, 1, n, T + 1000)
      if (r.ok) e = r.estado
    }
    const r = intentarNumero(e, 0, e.bolsa[0], T + 500)
    if (r.ok) e = r.estado
    expect(clasificacion(e).map((p) => [p.asiento, p.acertadas])).toEqual([[1, 2], [0, 1]])
    expect(cerrada(e, T + 120_000)).toBe(true)
  })

  it('a view shows rivals’ answers, never their digits, until you have finished', () => {
    let e = empezarPuntoYFama({ seed: 'v', numeros: 2, digitos: 4, asientos: [0, 1], ahora: AHORA })
    const intento = todosLosNumeros(4).find((n) => !e.bolsa.includes(n))!
    const r = intentarNumero(e, 1, intento, T + 100)
    if (!r.ok) throw new Error(r.code)
    e = r.estado
    const vista = vistaPuntoYFama(e, 0, T + 200)
    expect(vista.rivales[0].colores).toEqual([{ puntos: r.intento.puntos, famas: r.intento.famas }])
    const texto = JSON.stringify(vista)
    expect(texto).not.toContain(intento)
    for (const n of e.bolsa) expect(texto).not.toContain(n)
  })
})

describe('the duel', () => {
  function duelo() {
    let e = empezarDuelo({ seed: 'd', digitos: 4, asientos: [0, 1] })
    const a = ponerSecreto(e, 0, '1234', AHORA)
    if (!a.ok) throw new Error(a.code)
    e = a.estado
    expect(e.inicio).toBeNull()
    expect(ponerSecreto(e, 0, '5678', AHORA)).toEqual({ ok: false, code: 'YA_PUSISTE' })
    expect(ponerSecreto(e, 1, '5578', AHORA)).toEqual({ ok: false, code: 'REPETIDO' })
    const b = ponerSecreto(e, 1, '5678', AHORA)
    if (!b.ok) throw new Error(b.code)
    return b.estado
  }
  const jugar = (e: ReturnType<typeof duelo>, asiento: number, texto: string, t: number) => {
    const r = intentarEnDuelo(e, asiento, texto, T + t)
    if (!r.ok) throw new Error(r.code)
    return r.estado
  }

  it('opens after both numbers and a 3-2-1; each guesses the other’s number', () => {
    let e = duelo()
    expect(e.inicio).toBe(T)
    expect(intentarEnDuelo(e, 0, '0123', AHORA)).toEqual({ ok: false, code: 'NO_EMPEZO' })
    e = jugar(e, 0, '5670', 1000)
    expect(e.lados[0].intentos[0]).toMatchObject({ famas: 3, puntos: 0 })
  })

  it('fewer tries wins, whoever finished first; the other gets to finish', () => {
    let e = duelo()
    e = jugar(e, 0, '5670', 1000)
    e = jugar(e, 0, '5678', 2000) // seat 0: two tries
    expect(resultadoDelDuelo(e)).toBeNull()
    expect(intentarEnDuelo(e, 0, '0123', T + 3000)).toEqual({ ok: false, code: 'YA_TERMINASTE' })
    e = jugar(e, 1, '1234', 9000) // seat 1: one try, later
    expect(resultadoDelDuelo(e)).toEqual({ tipo: 'gana', asiento: 1, porque: 'intentos' })
  })

  it('a tie in tries goes to the first; a tie in both is a draw', () => {
    let e = duelo()
    e = jugar(e, 0, '5678', 1000)
    e = jugar(e, 1, '1234', 2000)
    expect(resultadoDelDuelo(e)).toEqual({ tipo: 'gana', asiento: 0, porque: 'tiempo' })
    let f = duelo()
    f = jugar(f, 0, '5678', 1000)
    f = jugar(f, 1, '1234', 1000)
    expect(resultadoDelDuelo(f)).toEqual({ tipo: 'empate' })
  })

  it('leaving loses', () => {
    const e = retirarDelDuelo(duelo(), 1)
    expect(resultadoDelDuelo(e)).toEqual({ tipo: 'gana', asiento: 0, porque: 'retiro' })
  })

  it('a view never holds the other’s number nor their guesses’ digits before the end', () => {
    let e = duelo()
    e = jugar(e, 1, '9012', 1000)
    const mia = vistaDelDuelo(e, 0)
    expect(mia.yo?.secreto).toBe('1234')
    expect(mia.rival).toMatchObject({ puso: true, secreto: null, intentos: null })
    expect(mia.rival?.respuestas).toEqual([{ famas: 0, puntos: 2 }])
    const texto = JSON.stringify(mia)
    expect(texto).not.toContain('5678')
    expect(texto).not.toContain('9012')
    e = jugar(e, 0, '5678', 2000)
    e = jugar(e, 1, '1234', 3000)
    const fin = vistaDelDuelo(e, 0)
    expect(fin.rival?.secreto).toBe('5678')
    expect(fin.rival?.intentos?.map((i) => i.palabra)).toEqual(['9012', '1234'])
  })
})

describe('the bot that guesses your number', () => {
  it('gets a sample of 4-digit numbers in about 5.5 on average and never past 9', () => {
    const todos = todosLosNumeros(4)
    let suma = 0
    let peor = 0
    for (let i = 0; i < todos.length; i += 17) {
      const secreto = todos[i]
      let bot = empezarBot(4, `prueba-${i}`)
      while (!adivino(bot)) bot = responder(bot, puntuarNumero(siguienteIntento(bot)!, secreto))
      suma += bot.pasos.length
      peor = Math.max(peor, bot.pasos.length)
    }
    const n = Math.ceil(todos.length / 17)
    expect(suma / n).toBeLessThan(6)
    expect(peor).toBeLessThanOrEqual(9)
  }, 30_000)

  it('an answer no number fits is caught, and «Deshacer» takes it back', () => {
    const primero = siguienteIntento(empezarBot(4, 'deshacer'))!
    // Nothing in common with the first guess, then one fama on that same
    // guess: no number can answer both, so the bot says so and stops.
    let bot = responder(empezarBot(4, 'deshacer'), { puntos: 0, famas: 0 })
    bot = { ...bot, pasos: [...bot.pasos, { intento: primero, puntos: 0, famas: 1 }] }
    expect(contradice(bot)).toBe(true)
    expect(siguienteIntento(bot)).toBeNull()
    // «Deshacer» takes the wrong answer back, and the bot plays on.
    bot = deshacer(bot)
    expect(contradice(bot)).toBe(false)
    expect(posiblesDe(bot).length).toBeGreaterThan(0)
    expect(deshacer(bot).pasos).toHaveLength(0)
    expect(siguienteIntento(deshacer(bot))).toBe(primero)
  })
})
