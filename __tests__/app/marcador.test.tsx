import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Marcador, columnasPorPuesto } from '@/components/marcador'
import { CATALOGO, CONFIG_POR_DEFECTO, type VistaDePartida } from '@/lib/engine'

/**
 * Phase 49: the scoreboard in standing order.
 *
 * Whoever is winning — fewest points — is the first column, so the player in
 * third place is the third column, and the seat looking at it sees its own
 * column picked out.
 */

afterEach(cleanup)

const vista = (totales: number[], asiento = 0): VistaDePartida => ({
  asiento,
  config: CONFIG_POR_DEFECTO,
  players: totales.length,
  seed: 'marcador',
  indiceContrato: 1,
  ronda: null,
  historial: [{ contrato: CATALOGO[0], puntos: totales, ganador: totales.indexOf(0), mesa: [], cierre: [] }],
  totales,
  ganadores: null,
})

const NOMBRES = ['Ana', 'Beto', 'Cata', 'Dani']

const encabezados = () =>
  within(screen.getAllByRole('row')[0])
    .getAllByRole('columnheader')
    .slice(1)
    .map((th) => th.textContent)

describe('columnasPorPuesto', () => {
  it('orders by fewest points, ties in seat order, ties sharing a puesto', () => {
    expect(columnasPorPuesto([30, 0, 12, 12])).toEqual([
      { seat: 1, total: 0, puesto: 1 },
      { seat: 2, total: 12, puesto: 2 },
      { seat: 3, total: 12, puesto: 2 },
      { seat: 0, total: 30, puesto: 4 },
    ])
  })
})

describe('Marcador', () => {
  it('puts the columns in standing order, puntos following their player', () => {
    render(<Marcador partida={vista([30, 0, 12, 45])} nombres={NOMBRES} />)
    expect(encabezados()).toEqual(['1°Beto', '2°Cata', '3°Ana', '4°Dani'])

    const total = screen.getAllByRole('row').at(-1)!
    expect(within(total).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      'Total', '0', '12', '30', '45',
    ])
  })

  it('picks out the column of the seat looking at it', () => {
    render(<Marcador partida={vista([30, 0, 12, 45], 0)} nombres={NOMBRES} yo={0} />)
    const [propio] = screen
      .getAllByRole('columnheader')
      .filter((th) => th.getAttribute('aria-current') === 'true')
    expect(propio.textContent).toBe('3°Ana')
  })

  it('keeps seat order and shows no puestos before any ronda ends', () => {
    render(
      <Marcador
        partida={{ ...vista([0, 0, 0, 0]), historial: [], indiceContrato: 0 }}
        nombres={NOMBRES}
      />,
    )
    expect(encabezados()).toEqual(NOMBRES)
  })
})
