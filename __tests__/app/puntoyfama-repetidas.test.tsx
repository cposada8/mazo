import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { escribir, escrituraVacia } from '@/components/palabras/escritura'
import { FilaEscrita, repetidas } from '@/components/puntoyfama/tablero'

describe('Punto y Fama — cifras repetidas (Phase 108)', () => {
  afterEach(cleanup)

  it('names every position holding a repeated digit, and none otherwise', () => {
    expect([...repetidas(['1', '1', '2', '3'])]).toEqual([0, 1])
    expect([...repetidas(['1', null, '2', '1'])]).toEqual([0, 3])
    expect(repetidas(['1', '2', '3', '4']).size).toBe(0)
    expect(repetidas([null, null, null]).size).toBe(0)
  })

  it('a repeat can be typed, and its slots are marked as repeated', () => {
    let e = escrituraVacia(4)
    for (const c of '1123') e = escribir(e, c)
    render(<FilaEscrita digitos={4} escritura={e} conCursor sacudida={null} onTocar={() => {}} />)
    expect(screen.getByLabelText('Cifra 1, 1, repetida')).toBeTruthy()
    expect(screen.getByLabelText('Cifra 2, 1, repetida')).toBeTruthy()
    expect(screen.getByLabelText('Cifra 3, 2')).toBeTruthy()
  })

  it('the marks go once the repeat is changed', () => {
    function Fila() {
      const [e, setE] = useState(() => '1123'.split('').reduce(escribir, escrituraVacia(4)))
      return (
        <>
          <FilaEscrita digitos={4} escritura={e} conCursor sacudida={null} onTocar={() => {}} />
          <button onClick={() => setE((x) => escribir({ ...x, cursor: 1 }, '5'))}>cambiar</button>
        </>
      )
    }
    render(<Fila />)
    fireEvent.click(screen.getByText('cambiar'))
    expect(screen.queryByLabelText(/repetida/)).toBeNull()
  })
})
