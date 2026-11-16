import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { siguienteMarca, useApuntes } from '@/components/puntoyfama/apuntes'
import { TecladoNumerico } from '@/components/puntoyfama/tablero'

describe('Punto y Fama — apuntes (Phase 110)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('a tap with the pencil goes está → no está → sin marca', () => {
    expect(siguienteMarca(undefined)).toBe('esta')
    expect(siguienteMarca('esta')).toBe('noesta')
    expect(siguienteMarca('noesta')).toBeUndefined()
  })

  it('marks and the note survive a reload of the same number', () => {
    const primero = renderHook(() => useApuntes('ABCDE:0'))
    act(() => {
      primero.result.current.marcar('1')
      primero.result.current.marcar('7')
      primero.result.current.marcar('7')
      primero.result.current.escribirNota('1 o 2\n3 o 4')
    })
    primero.unmount()
    const otraVez = renderHook(() => useApuntes('ABCDE:0'))
    expect(otraVez.result.current.marcas).toEqual({ '1': 'esta', '7': 'noesta' })
    expect(otraVez.result.current.nota).toBe('1 o 2\n3 o 4')
  })

  it('the next number starts clean, and the last one is let go', () => {
    const { result, rerender } = renderHook(({ clave }) => useApuntes(clave), { initialProps: { clave: 'ABCDE:0' } })
    act(() => {
      result.current.marcar('4')
      result.current.escribirNota('algo')
    })
    rerender({ clave: 'ABCDE:1' })
    expect(result.current.marcas).toEqual({})
    expect(result.current.nota).toBe('')
    act(() => result.current.marcar('5'))
    expect(window.localStorage.getItem('mazo:pyf:apuntes:ABCDE:0')).toBeNull()
  })

  it('the pad wears the marks, and its pencil says whether it is marking', () => {
    let lapiz = 0
    render(<TecladoNumerico activo onTecla={() => {}} marcas={{ '1': 'esta', '7': 'noesta' }} lapiz onLapiz={() => lapiz++} />)
    expect(screen.getByLabelText('1, está')).toBeTruthy()
    expect(screen.getByLabelText('7, no está')).toBeTruthy()
    expect(screen.getByLabelText('2')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Dejar de marcar'))
    expect(lapiz).toBe(1)
  })
})
