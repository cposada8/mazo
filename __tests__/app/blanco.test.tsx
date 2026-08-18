import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BLANCO_MAXIMO,
  BLANCO_MINIMO,
  BLANCO_POR_DEFECTO,
  ControlDeBlanco,
  GUION_DEL_BLANCO,
  acotarBlanco,
  fijarBlanco,
} from '@/components/blanco'

/**
 * Phase 43: the white you choose.
 *
 * One number reaches every white, it lives on `<html>` where the CSS reads
 * it, and it survives the tab. What these pin is the contract around that
 * number — that it is bounded, that it lands where the stylesheet looks for
 * it, and that a stored value is honoured before the page paints.
 */

const leerVariable = () =>
  document.documentElement.style.getPropertyValue('--blanco')

describe('the white is one bounded number', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--blanco')
    fijarBlanco(BLANCO_POR_DEFECTO)
  })
  afterEach(cleanup)

  it('lands on the element the stylesheet reads it from', () => {
    fijarBlanco(0.9)
    expect(leerVariable()).toBe('0.9')
  })

  it('survives the tab', () => {
    fijarBlanco(0.88)
    expect(localStorage.getItem('mazo:blanco')).toBe('0.88')
  })

  it('refuses the ends that would ruin it', () => {
    // Pure white on the felt is the lamp the whole palette was tuned to
    // avoid; far below the floor, the dimmest ink stops being readable.
    expect(acotarBlanco(1)).toBe(BLANCO_MAXIMO)
    expect(acotarBlanco(0.1)).toBe(BLANCO_MINIMO)
    expect(acotarBlanco(Number.NaN)).toBe(BLANCO_POR_DEFECTO)
  })

  it('moves the whole family from the one control', () => {
    render(<ControlDeBlanco />)
    const barra = screen.getByLabelText('Brillo del blanco')

    fireEvent.change(barra, { target: { value: '0.92' } })
    expect(leerVariable()).toBe('0.92')

    // Every other white is written as a distance from it, so nothing else
    // needs saying here: the stylesheet does the rest.
    expect(barra).toHaveAttribute('min', String(BLANCO_MINIMO))
    expect(barra).toHaveAttribute('max', String(BLANCO_MAXIMO))
  })

  it('two controls on screen cannot disagree', () => {
    render(
      <>
        <ControlDeBlanco etiqueta="En el menú" />
        <ControlDeBlanco etiqueta="En el encabezado" />
      </>,
    )

    fireEvent.change(screen.getByLabelText('En el menú'), {
      target: { value: '0.86' },
    })
    expect(screen.getByLabelText('En el encabezado')).toHaveValue('0.86')
  })
})

describe('the value arrives before the first paint', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--blanco')
  })

  /** What the layout runs at the top of the body, run here the same way. */
  const correrGuion = () => new Function(GUION_DEL_BLANCO)()

  it('applies what was stored, without a frame of the default', () => {
    localStorage.setItem('mazo:blanco', '0.9')
    correrGuion()
    expect(leerVariable()).toBe('0.9')
  })

  it('leaves the stylesheet default alone when nothing was stored', () => {
    correrGuion()
    expect(leerVariable()).toBe('')
  })

  it('ignores a stored value outside the ends', () => {
    localStorage.setItem('mazo:blanco', '3')
    correrGuion()
    expect(leerVariable()).toBe('')
  })
})
