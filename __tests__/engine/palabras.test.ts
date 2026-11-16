import { describe, expect, it } from 'vitest'
import {
  type EstadoPalabras,
  INTENTOS_POR_PALABRA,
  LARGOS,
  MS_CASTIGO,
  MS_CUENTA_ATRAS,
  MS_HASTA_CERRAR,
  aceptadasDe,
  cerrada,
  cerrar,
  clasificacion,
  empezarPalabras,
  intentar,
  normalizar,
  puntuar,
  respuestasDe,
  retirarJugador,
  sacarBolsa,
  sumarJugador,
  tiempoDe,
  vistaPalabras,
} from '@/lib/engine/palabras'

/** Phases 82 and 83: the word lists, and the race as a pure state machine. */

const LETRAS = /^[A-ZÑ]+$/

describe('the word lists (Phase 82)', () => {
  it.each(LARGOS)('%i letters: every answer and every guess is that long, of the 27 letters', (largo) => {
    for (const palabra of [...respuestasDe(largo), ...aceptadasDe(largo)]) {
      expect(LETRAS.test(palabra) && [...palabra].length === largo, palabra).toBe(true)
    }
  })

  it.each(LARGOS)('%i letters: no repeats, at least 1,000 answers, every answer accepted', (largo) => {
    const respuestas = respuestasDe(largo)
    expect(new Set(respuestas).size).toBe(respuestas.length)
    expect(respuestas.length).toBeGreaterThanOrEqual(1000)
    const aceptadas = aceptadasDe(largo)
    for (const palabra of respuestas) expect(aceptadas.has(palabra), palabra).toBe(true)
  })

  it('normalises like play: tildes go, Ñ stays', () => {
    expect(normalizar('árbol')).toBe('ARBOL')
    expect(normalizar('niños')).toBe('NIÑOS')
    expect(normalizar(' Pingüino ')).toBe('PINGUINO')
  })
})

describe('scoring a try', () => {
  const c = (s: string) => [...s].map((x) => ({ v: 'verde', a: 'amarillo', g: 'gris' })[x])

  it('greens, yellows and greys', () => {
    expect(puntuar('PODER', 'PODER')).toEqual(c('vvvvv'))
    expect(puntuar('MENTA', 'PODER')).toEqual(c('gaggg'))
    expect(puntuar('DOLER', 'PODER')).toEqual(c('avgvv'))
  })

  it('never colours more copies of a letter than the answer holds', () => {
    // PERRO has two R's: the third R of ERROR is grey.
    expect(puntuar('ERROR', 'PERRO')).toEqual(c('aavag'))
    // One A in the answer, two in the try: only the first is yellow.
    expect(puntuar('CASAS', 'PLAZO')).toEqual(c('gaggg'))
    // A green takes its copy before any yellow does: BARCO's one R is the
    // green one, so the R before it is grey; its one A goes to the first A.
    expect(puntuar('ARRAS', 'BARCO')).toEqual(c('agvgg'))
  })
})

const AHORA = 1_000_000
const EN_CARRERA = AHORA + MS_CUENTA_ATRAS

function carrera(palabras = 3, asientos = [0, 1]): EstadoPalabras {
  return empezarPalabras({ seed: 'prueba', palabras, asientos, ahora: AHORA })
}

/** Five wrong but real words, none of them the answer. */
function errados(respuesta: string): string[] {
  return ['MENTA', 'CUIDO', 'DOLER', 'PLAZO', 'CIELO', 'FRUTA', 'NIEVE'].filter((p) => p !== respuesta)
}

describe('the race (Phase 83)', () => {
  it('the same seed always draws the same bag, without repeats', () => {
    expect(sacarBolsa('x', 20)).toEqual(sacarBolsa('x', 20))
    expect(new Set(sacarBolsa('x', 20)).size).toBe(20)
    expect(sacarBolsa('x', 20)).not.toEqual(sacarBolsa('y', 20))
  })

  it.each([6, 7, 8])('a race of %i-letter words draws, takes and refuses by that length', (largo) => {
    const estado = empezarPalabras({ seed: 's', palabras: 5, largo, asientos: [0], ahora: AHORA })
    for (const palabra of estado.bolsa) expect([...palabra]).toHaveLength(largo)
    expect(intentar(estado, 0, 'MENTA', EN_CARRERA)).toEqual({ ok: false, code: 'LARGO' })
    const r = intentar(estado, 0, estado.bolsa[0], EN_CARRERA)
    expect(r.ok && r.termino?.acertada).toBe(true)
    expect(vistaPalabras(estado, 0, EN_CARRERA).largo).toBe(largo)
  })

  it('five letters keeps drawing exactly as before lengths existed', () => {
    expect(sacarBolsa('x', 3)).toEqual(sacarBolsa('x', 3, 5))
  })

  it('nobody plays before the 3-2-1 is over', () => {
    const estado = carrera()
    expect(intentar(estado, 0, 'MENTA', AHORA + 100)).toEqual({ ok: false, code: 'NO_EMPEZO' })
  })

  it('a try that is not a word, or not five letters, is refused at no cost', () => {
    const estado = carrera()
    expect(intentar(estado, 0, 'QQQQQ', EN_CARRERA)).toEqual({ ok: false, code: 'NO_ES_PALABRA' })
    expect(intentar(estado, 0, 'CASA', EN_CARRERA)).toEqual({ ok: false, code: 'LARGO' })
    expect(intentar(estado, 9, 'MENTA', EN_CARRERA)).toEqual({ ok: false, code: 'NO_JUEGAS' })
  })

  it('a solved word opens the next; a missed word is revealed and costs two minutes', () => {
    let estado = carrera(2)
    const [primera, segunda] = estado.bolsa

    const r1 = intentar(estado, 0, primera.toLowerCase(), EN_CARRERA + 1000)
    if (!r1.ok) throw new Error(r1.code)
    expect(r1.termino).toMatchObject({ palabra: primera, acertada: true })
    estado = r1.estado

    let ultimo
    for (const p of errados(segunda).slice(0, INTENTOS_POR_PALABRA)) {
      ultimo = intentar(estado, 0, p, EN_CARRERA + 5000)
      if (!ultimo.ok) throw new Error(ultimo.code)
      estado = ultimo.estado
    }
    expect(ultimo!.ok && ultimo!.termino).toMatchObject({ palabra: segunda, acertada: false })
    const tablero = estado.tableros[0]
    expect(tablero.terminoEn).toBe(5000)
    expect(tiempoDe(tablero)).toBe(5000 + MS_CASTIGO)
    expect(intentar(estado, 0, 'MENTA', EN_CARRERA + 6000)).toEqual({ ok: false, code: 'YA_TERMINASTE' })
  })

  it('ranks by time with penalties, ties to fewer tries, then the unfinished by words solved', () => {
    let estado = carrera(1, [0, 1, 2, 3])
    const [respuesta] = estado.bolsa
    const jugar = (asiento: number, palabra: string, t: number) => {
      const r = intentar(estado, asiento, palabra, EN_CARRERA + t)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    // Seat 1 misses fast (6 s + 2 min); seat 2 solves in 60 s; seat 0 in 60 s with one more try.
    for (const p of errados(respuesta).slice(0, 6)) jugar(1, p, 6000)
    jugar(2, respuesta, 60_000)
    jugar(0, errados(respuesta)[0], 10_000)
    jugar(0, respuesta, 60_000)
    const puestos = clasificacion(estado)
    expect(puestos.map((p) => p.asiento)).toEqual([2, 0, 1, 3])
    expect(puestos[3]).toMatchObject({ termino: false, tiempo: null })
  })

  it('closes when everyone racing has finished, when the host closes it, or the wait after the first finish', () => {
    let estado = empezarPalabras({ seed: 'prueba', palabras: 1, asientos: [0, 1], ahora: AHORA, espera: 30 })
    const [respuesta] = estado.bolsa
    const r = intentar(estado, 0, respuesta, EN_CARRERA + 1000)
    if (!r.ok) throw new Error(r.code)
    estado = r.estado
    expect(cerrada(estado, EN_CARRERA + 2000)).toBe(false)
    expect(cerrada(estado, EN_CARRERA + 1000 + MS_HASTA_CERRAR)).toBe(true)
    expect(cerrada(retirarJugador(estado, 1), EN_CARRERA + 2000)).toBe(true)
    expect(cerrada(cerrar(estado, EN_CARRERA + 2000), EN_CARRERA + 2000)).toBe(true)
    expect(intentar(cerrar(estado, EN_CARRERA), 1, respuesta, EN_CARRERA + 1)).toEqual({
      ok: false,
      code: 'CERRADA',
    })
  })

  it('a late joiner races on the same clock and the same words', () => {
    let estado = carrera(1, [0])
    estado = sumarJugador(estado, 1)
    expect(sumarJugador(estado, 1)).toBe(estado)
    const r = intentar(estado, 1, estado.bolsa[0], EN_CARRERA + 90_000)
    expect(r.ok && r.estado.tableros[1].terminoEn).toBe(90_000)
  })

  it('once you finish, the rivals\' ended words come with their letters, never the one in play (Phase 88)', () => {
    let estado = carrera(2, [0, 1])
    const jugar = (asiento: number, palabra: string) => {
      const r = intentar(estado, asiento, palabra, EN_CARRERA + 1000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    // Seat 1 solves the first word and tries the second; seat 0 is still racing.
    jugar(1, estado.bolsa[0])
    const tanteo = errados(estado.bolsa[1])[0]
    jugar(1, tanteo)
    expect(vistaPalabras(estado, 0, EN_CARRERA + 2000).rivales[0].palabras).toBeNull()

    // Seat 0 finishes: now it sees seat 1's ended word, letters and all.
    jugar(0, estado.bolsa[0])
    jugar(0, estado.bolsa[1])
    const vista = vistaPalabras(estado, 0, EN_CARRERA + 2000)
    expect(vista.rivales[0].palabras).toEqual([
      { palabra: estado.bolsa[0], acertada: true, en: 1000, intentos: [expect.objectContaining({ palabra: estado.bolsa[0] })] },
    ])
    // Seat 1's word in play stays colours only.
    expect(JSON.stringify(vista.rivales[0].palabras)).not.toContain(tanteo)
    expect(vista.rivales[0].colores).toHaveLength(1)

    // And seat 1, still racing, sees none of seat 0's letters.
    const suya = vistaPalabras(estado, 1, EN_CARRERA + 2000)
    expect(suya.rivales[0].palabras).toBeNull()
  })

  it('a view never holds a word its player has not ended, nor a rival letter', () => {
    let estado = carrera(5, [0, 1])
    // Seat 1 solves two words and tries the third.
    for (const palabra of estado.bolsa.slice(0, 2)) {
      const r = intentar(estado, 1, palabra, EN_CARRERA + 1000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    const r = intentar(estado, 1, errados(estado.bolsa[2])[0], EN_CARRERA + 2000)
    if (!r.ok) throw new Error(r.code)
    estado = r.estado

    const texto = JSON.stringify(vistaPalabras(estado, 0, EN_CARRERA + 3000))
    for (const palabra of estado.bolsa) expect(texto).not.toContain(palabra)
    expect(texto).not.toContain(errados(estado.bolsa[2])[0])

    const propia = JSON.stringify(vistaPalabras(estado, 1, EN_CARRERA + 3000))
    for (const palabra of estado.bolsa.slice(2)) expect(propia).not.toContain(palabra)
  })
})

describe('the time limit (Phase 89)', () => {
  const MINUTO = 60_000
  function contraReloj(asientos = [0, 1], minutos = 3) {
    return empezarPalabras({ seed: 'reloj', palabras: 10, asientos, ahora: AHORA, modo: 'tiempo', minutos })
  }

  it('deals every answer, the same order for everyone, and stops everyone when the minutes are up', () => {
    const estado = contraReloj()
    expect(estado.bolsa).toHaveLength(respuestasDe(5).length)
    expect(estado.bolsa).toEqual(sacarBolsa('reloj', respuestasDe(5).length))
    expect(cerrada(estado, EN_CARRERA + 3 * MINUTO - 1)).toBe(false)
    expect(cerrada(estado, EN_CARRERA + 3 * MINUTO)).toBe(true)
    expect(intentar(estado, 0, estado.bolsa[0], EN_CARRERA + 3 * MINUTO)).toEqual({
      ok: false,
      code: 'CERRADA',
    })
    const vista = vistaPalabras(estado, 0, EN_CARRERA)
    expect(vista.modo).toBe('tiempo')
    expect(vista.fin).toBe(EN_CARRERA + 3 * MINUTO)
  })

  it('a missed word adds no time, and the ranking is by words solved, then who solved the last one first', () => {
    let estado = contraReloj([0, 1, 2])
    const jugar = (asiento: number, palabra: string, t: number) => {
      const r = intentar(estado, asiento, palabra, EN_CARRERA + t)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    const [a, b] = estado.bolsa
    // Seat 0 solves two words, the second at 50 s; seat 1 two, the second at 40 s.
    jugar(0, a, 10_000)
    jugar(0, b, 50_000)
    jugar(1, a, 20_000)
    jugar(1, b, 40_000)
    // Seat 2 misses the first word and solves nothing.
    for (const p of errados(a).slice(0, 6)) jugar(2, p, 5_000)
    const puestos = clasificacion(estado)
    expect(puestos.map((p) => p.asiento)).toEqual([1, 0, 2])
    expect(puestos[0]).toMatchObject({ acertadas: 2, tiempo: 40_000 })
    expect(puestos[2]).toMatchObject({ acertadas: 0, tiempo: null, fallos: 1 })
    expect(cerrada(estado, EN_CARRERA + 60_000)).toBe(false)
  })

  it('a race dealt before the modes is still n words', () => {
    const viejo = carrera(2)
    expect(vistaPalabras(viejo, 0, EN_CARRERA).modo).toBe('palabras')
    expect(vistaPalabras(viejo, 0, EN_CARRERA).fin).toBeNull()
  })
})


describe('lives (Phase 90)', () => {
  function conVidas(vidas: number, asientos = [0, 1]) {
    return empezarPalabras({ seed: 'vidas', palabras: 10, asientos, ahora: AHORA, modo: 'tiempo', minutos: 5, vidas })
  }
  function fallar(estado: EstadoPalabras, asiento: number, t: number) {
    const palabra = estado.bolsa[estado.tableros.find((x) => x.asiento === asiento)!.terminadas.length]
    for (const p of errados(palabra).slice(0, 6)) {
      const r = intentar(estado, asiento, p, EN_CARRERA + t)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    return estado
  }

  it('each missed word costs a life; with none left that player stops, keeping what they solved', () => {
    let estado = conVidas(3)
    const r = intentar(estado, 0, estado.bolsa[0], EN_CARRERA + 1000)
    if (!r.ok) throw new Error(r.code)
    estado = r.estado
    expect(vistaPalabras(estado, 0, EN_CARRERA).propio!.vidas).toBe(3)
    estado = fallar(estado, 0, 2000)
    estado = fallar(estado, 0, 3000)
    expect(vistaPalabras(estado, 0, EN_CARRERA).propio!.vidas).toBe(1)
    expect(vistaPalabras(estado, 1, EN_CARRERA).rivales[0].vidas).toBe(1)
    estado = fallar(estado, 0, 4000)
    const tablero = estado.tableros[0]
    expect(tablero.terminoEn).toBe(4000)
    expect(intentar(estado, 0, 'MENTA', EN_CARRERA + 5000)).toEqual({ ok: false, code: 'YA_TERMINASTE' })
    // The other plays on until the time is up.
    expect(cerrada(estado, EN_CARRERA + 5000)).toBe(false)
    expect(clasificacion(estado).find((p) => p.asiento === 0)).toMatchObject({ acertadas: 1, fallos: 3 })
    // Out of lives is finished: the rivals' ended words may be seen.
    expect(vistaPalabras(estado, 0, EN_CARRERA + 5000).rivales[0].palabras).toEqual([])
  })

  it('when everyone is out of lives the race is over before the time', () => {
    let estado = conVidas(1)
    estado = fallar(estado, 0, 1000)
    estado = fallar(estado, 1, 2000)
    expect(cerrada(estado, EN_CARRERA + 3000)).toBe(true)
  })

  it('«sin vidas» never stops anyone early, and n-words races have no lives', () => {
    let estado = conVidas(0)
    for (let i = 0; i < 5; i++) estado = fallar(estado, 0, 1000 + i)
    expect(estado.tableros[0].terminoEn).toBeNull()
    expect(vistaPalabras(estado, 0, EN_CARRERA).propio!.vidas).toBeNull()
    expect(vistaPalabras(carrera(3), 0, EN_CARRERA).vidasIniciales).toBeNull()
  })
})

describe('the penalty, chosen by the host (Phase 94)', () => {
  const MINUTO = 60_000
  function conCastigo(castigo: number | undefined) {
    return empezarPalabras({ seed: 'castigo', palabras: 1, asientos: [0], ahora: AHORA, castigo })
  }
  function fallarYTerminar(estado: EstadoPalabras) {
    for (const p of errados(estado.bolsa[0]).slice(0, 6)) {
      const r = intentar(estado, 0, p, EN_CARRERA + 10_000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    return estado
  }

  it('a missed word adds what the host chose, nothing at all included', () => {
    expect(vistaPalabras(fallarYTerminar(conCastigo(5)), 0, EN_CARRERA).propio!.tiempo).toBe(10_000 + 5 * MINUTO)
    expect(vistaPalabras(fallarYTerminar(conCastigo(0)), 0, EN_CARRERA).propio!.tiempo).toBe(10_000)
    expect(vistaPalabras(conCastigo(5), 0, EN_CARRERA).msCastigo).toBe(5 * MINUTO)
  })

  it('a new race defaults to two minutes, and a race dealt before keeps two', () => {
    expect(conCastigo(undefined).msCastigo).toBe(2 * MINUTO)
    const viejo = { ...conCastigo(undefined) }
    delete (viejo as { msCastigo?: number }).msCastigo
    expect(vistaPalabras(fallarYTerminar(viejo), 0, EN_CARRERA).propio!.tiempo).toBe(10_000 + 2 * MINUTO)
  })
})

describe('the wait after the first finish, chosen by the host (Phase 95)', () => {
  const MINUTO = 60_000
  function primeroLlega(espera: number | undefined) {
    let estado = empezarPalabras({ seed: 'espera', palabras: 1, asientos: [0, 1], ahora: AHORA, espera })
    const r = intentar(estado, 0, estado.bolsa[0], EN_CARRERA + 1000)
    if (!r.ok) throw new Error(r.code)
    estado = r.estado
    return estado
  }

  it('by default there is no limit: everyone may keep arriving', () => {
    const estado = primeroLlega(undefined)
    expect(estado.msEspera).toBeNull()
    expect(cerrada(estado, EN_CARRERA + 1000 + 12 * 60 * MINUTO)).toBe(false)
    const r = intentar(estado, 1, estado.bolsa[0], EN_CARRERA + 1000 + 12 * 60 * MINUTO)
    expect(r.ok && cerrada(r.estado, EN_CARRERA + 2 * MINUTO)).toBe(true)
  })

  it('with a limit it closes that long after the first finish', () => {
    const estado = primeroLlega(10)
    expect(cerrada(estado, EN_CARRERA + 1000 + 10 * MINUTO - 1)).toBe(false)
    expect(cerrada(estado, EN_CARRERA + 1000 + 10 * MINUTO)).toBe(true)
  })

  it('a race dealt before keeps the old half hour', () => {
    const viejo = { ...primeroLlega(undefined) }
    delete (viejo as { msEspera?: number | null }).msEspera
    expect(cerrada(viejo, EN_CARRERA + 1000 + 30 * MINUTO - 1)).toBe(false)
    expect(cerrada(viejo, EN_CARRERA + 1000 + 30 * MINUTO)).toBe(true)
  })
})

describe('chained words (Phase 96)', () => {
  function encadenada(modo?: 'tiempo') {
    return empezarPalabras({
      seed: 'cadena', palabras: 3, asientos: [0], ahora: AHORA, encadenadas: true,
      ...(modo ? { modo, minutos: 5 } : {}),
    })
  }

  it.each([undefined, 'tiempo' as const])('every word after the first opens with the one before (%s)', (modo) => {
    let estado = encadenada(modo)
    const [a, b] = estado.bolsa
    expect(estado.tableros[0].intentos).toEqual([])
    const r = intentar(estado, 0, a, EN_CARRERA + 1000)
    if (!r.ok) throw new Error(r.code)
    estado = r.estado
    const abierta = estado.tableros[0].intentos
    expect(abierta).toEqual([{ palabra: a, colores: puntuar(a, b), encadenado: true }])
    // Five of the player's own left: the chained one counts.
    for (const p of errados(b).slice(0, 4)) {
      const x = intentar(estado, 0, p, EN_CARRERA + 2000)
      if (!x.ok) throw new Error(x.code)
      estado = x.estado
    }
    expect(estado.tableros[0].intentos).toHaveLength(5)
    const sexto = intentar(estado, 0, errados(b)[4], EN_CARRERA + 3000)
    expect(sexto.ok && sexto.termino).toMatchObject({ palabra: b, acertada: false })
  })

  it('after a miss, the next word still opens with the answer, not the last try', () => {
    let estado = encadenada()
    const [a, b] = estado.bolsa
    for (const p of errados(a).slice(0, 6)) {
      const r = intentar(estado, 0, p, EN_CARRERA + 1000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    expect(estado.tableros[0].intentos[0]).toMatchObject({ palabra: a, encadenado: true })
    expect(estado.tableros[0].intentos[0].colores).toEqual(puntuar(a, b))
  })

  it('nothing is chained after the last word, nor without the switch', () => {
    let estado = encadenada()
    for (const p of estado.bolsa) {
      const r = intentar(estado, 0, p, EN_CARRERA + 1000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    expect(estado.tableros[0].intentos).toEqual([])
    expect(estado.tableros[0].terminoEn).not.toBeNull()
    const suelta = carrera(2, [0])
    const r = intentar(suelta, 0, suelta.bolsa[0], EN_CARRERA + 1000)
    expect(r.ok && r.estado.tableros[0].intentos).toEqual([])
  })
})

describe('the sum of tries (Phase 97)', () => {
  it('adds up every try, the word in play and a chained one included, for everyone from the start', () => {
    let estado = empezarPalabras({ seed: 'suma', palabras: 3, asientos: [0, 1], ahora: AHORA, encadenadas: true })
    const jugar = (asiento: number, palabra: string) => {
      const r = intentar(estado, asiento, palabra, EN_CARRERA + 1000)
      if (!r.ok) throw new Error(r.code)
      estado = r.estado
    }
    const [a, b] = estado.bolsa
    // Three on the first word, then the chained one and two more on the second.
    jugar(1, errados(a)[0])
    jugar(1, errados(a)[1])
    jugar(1, a)
    jugar(1, errados(b)[0])
    jugar(1, errados(b)[1])
    const desde0 = vistaPalabras(estado, 0, EN_CARRERA + 2000)
    expect(desde0.rivales[0].intentos).toBe(6)
    expect(desde0.rivales[0].palabras).toBeNull()
    expect(clasificacion(estado).find((p) => p.asiento === 1)!.intentos).toBe(6)
  })
})
