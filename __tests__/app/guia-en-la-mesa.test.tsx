import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Tablero } from '@/app/jugar/juego'
import { useMesa } from '@/app/jugar/useMesa'
import {
  CONFIG_POR_DEFECTO,
  type VistaDePartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { apagarGuiaSiNadieLaEligio, leerGuia, recordarGuia } from '@/lib/guia'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 45: the guide, on the table it is for.
 *
 * `guia.test.ts` pins the sentences. This pins the two things that only the
 * screen can answer — that a brand-new browser gets the guide without asking,
 * and that the switch in the menu is the last word on it.
 */

const ronda = (turno: number) =>
  makeRonda({
    jugadores: [{ hand: [n('7', 'spades'), n('7', 'hearts')] }, { hand: [n('9', 'clubs')] }],
    turno,
    fase: 'draw',
  })

const vistaCon = (turno: number): VistaDePartida => ({
  asiento: 0,
  config: CONFIG_POR_DEFECTO,
  players: 2,
  seed: 'guia',
  indiceContrato: 0,
  ronda: vistaDeAsiento(ronda(turno), 0),
  historial: [],
  totales: [0, 0],
  ganadores: null,
})

function Pantalla({ turno = 0 }: { turno?: number }) {
  const vista = useMemo(() => vistaCon(turno), [turno])
  const juego = useMesa({
    vista,
    relatos: [],
    segundosDelTurno: 45,
    aviso: null,
    limpiarAviso: () => {},
    jugar: () => {},
  })

  return (
    <Tablero
      juego={juego}
      jugadores={2}
      seed="guia"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

describe('la guía en la mesa', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('is there on a first visit, without being asked for', () => {
    render(<Pantalla />)
    expect(screen.getByText('Roba: toca el mazo o el descarte.')).toBeTruthy()
  })

  it('gives the strip back to the relato when it is not your turn', () => {
    render(<Pantalla turno={1} />)
    expect(screen.queryByText(/^Roba:/)).toBeNull()
  })

  it('goes away for good from the menu, and the table obeys at once', () => {
    render(<Pantalla />)

    fireEvent.click(screen.getByLabelText('Menú de la partida'))
    fireEvent.click(screen.getByRole('checkbox', { name: /Mostrar la guía/ }))

    expect(screen.queryByText(/^Roba:/)).toBeNull()
    expect(leerGuia()).toBe(false)
  })

  it('opens the rules over the felt, and closes back onto it', () => {
    render(<Pantalla />)

    fireEvent.click(screen.getByLabelText('Menú de la partida'))
    fireEvent.click(screen.getByText('Cómo se juega'))

    // A fact from the rules screen that appears nowhere else on the table.
    expect(screen.getByText(/Cuatro cartas o más/)).toBeTruthy()

    fireEvent.click(screen.getByText('Volver a la mesa'))
    expect(screen.queryByText(/Cuatro cartas o más/)).toBeNull()
    // Back onto the menu it was opened from, not out of it.
    expect(screen.getByText('Seguir jugando')).toBeTruthy()
  })
})

describe('la guía se apaga sola', () => {
  beforeEach(() => localStorage.clear())

  it('after a partida, when nobody ever touched the switch', () => {
    expect(leerGuia()).toBe(true)
    apagarGuiaSiNadieLaEligio()
    expect(leerGuia()).toBe(false)
  })

  it('but never over a choice somebody made — either way', () => {
    recordarGuia(true)
    apagarGuiaSiNadieLaEligio()
    expect(leerGuia()).toBe(true)

    // And the reverse is not undone by a second partida either.
    recordarGuia(false)
    apagarGuiaSiNadieLaEligio()
    expect(leerGuia()).toBe(false)
  })
})
