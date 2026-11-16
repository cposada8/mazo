import { describe, expect, it } from 'vitest'
import { tablaDeLlegada } from '@/components/palabras/tabla-datos'
import {
  type EstadoPalabras,
  MS_CUENTA_ATRAS,
  empezarPalabras,
  intentar,
  vistaPalabras,
} from '@/lib/engine/palabras'

/** Phase 92: the finish table — players as columns by standing, words as rows. */

const AHORA = 1_000_000
const T = AHORA + MS_CUENTA_ATRAS
const MALAS = ['MENTA', 'CUIDO', 'DOLER', 'PLAZO', 'CIELO', 'FRUTA', 'NIEVE']

function jugar(estado: EstadoPalabras, asiento: number, palabra: string, t: number) {
  const r = intentar(estado, asiento, palabra, T + t)
  if (!r.ok) throw new Error(r.code)
  return r.estado
}
function fallar(estado: EstadoPalabras, asiento: number, t: number) {
  const respuesta = estado.bolsa[estado.tableros.find((x) => x.asiento === asiento)!.terminadas.length]
  for (const p of MALAS.filter((m) => m !== respuesta).slice(0, 6)) estado = jugar(estado, asiento, p, t)
  return estado
}

describe('the finish table', () => {
  it('columns go by the race standing, rows are the words, cells say how each did', () => {
    let e = empezarPalabras({ seed: 'tabla', palabras: 2, asientos: [0, 1, 2], ahora: AHORA })
    const [a, b] = e.bolsa
    // Seat 2 fastest; seat 0 second with a miss; seat 1 still on word 2.
    e = jugar(e, 2, a, 1000)
    e = jugar(e, 2, b, 2000)
    e = jugar(e, 0, a, 3000)
    e = fallar(e, 0, 4000)
    e = jugar(e, 1, a, 5000)

    const { columnas, filas } = tablaDeLlegada(vistaPalabras(e, 0, T + 6000))
    expect(columnas.map((c) => c.asiento)).toEqual([2, 0, 1])
    expect(columnas.map((c) => c.puesto.lugar)).toEqual([1, 2, 3])
    expect(filas.map((f) => f.palabra)).toEqual([a, b])
    expect(filas[0].celdas.map((c) => c?.acertada)).toEqual([true, true, true])
    expect(filas[1].celdas.map((c) => (c ? c.acertada : null))).toEqual([true, false, null])
    // The open row has everyone's tries, letters and all.
    expect(filas[1].celdas[1]!.intentos).toHaveLength(6)
  })

  it('a player still racing gets only their own column filled', () => {
    let e = empezarPalabras({ seed: 'tabla', palabras: 2, asientos: [0, 1], ahora: AHORA })
    e = jugar(e, 1, e.bolsa[0], 1000)
    e = jugar(e, 0, e.bolsa[0], 2000)
    const { columnas, filas } = tablaDeLlegada(vistaPalabras(e, 0, T + 3000))
    const rival = columnas.find((c) => c.asiento === 1)!
    expect(rival.palabras).toBeNull()
    expect(filas).toHaveLength(1)
    expect(filas[0].celdas[columnas.indexOf(rival)]).toBeNull()
  })

  it('against the clock: by words solved, as many rows as the furthest got', () => {
    let e = empezarPalabras({ seed: 'reloj', palabras: 10, asientos: [0, 1], ahora: AHORA, modo: 'tiempo', minutos: 1 })
    e = jugar(e, 1, e.bolsa[0], 1000)
    e = jugar(e, 1, e.bolsa[1], 2000)
    e = jugar(e, 1, e.bolsa[2], 3000)
    e = jugar(e, 0, e.bolsa[0], 4000)
    // The minute is up for everyone.
    const { columnas, filas } = tablaDeLlegada(vistaPalabras(e, 0, T + 60_000))
    expect(columnas.map((c) => c.asiento)).toEqual([1, 0])
    expect(filas).toHaveLength(3)
    expect(filas[2].celdas.map((c) => c?.acertada ?? null)).toEqual([true, null])
  })
})
