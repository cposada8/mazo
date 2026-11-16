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

  it('closes when everyone racing has finished, when the host closes it, or 30 minutes after the first finish', () => {
    let estado = carrera(1, [0, 1])
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
