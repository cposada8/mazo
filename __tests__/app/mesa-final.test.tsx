import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useMemo } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Tablero } from '@/app/jugar/juego'
import { useMesa } from '@/app/jugar/useMesa'
import {
  CATALOGO,
  CONFIG_POR_DEFECTO,
  type Grupo,
  type Marcador,
  type VistaDePartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 42: what it was won with.
 *
 * A ronda used to end straight onto the scoreboard, so the table that had
 * just been won was gone before anybody could look at it. The pause has a
 * first step now — the mesa the engine kept — and the score is a tap behind.
 */

const CUATRO_TRIOS = CATALOGO[3]

/** The grupo that closed it: three sevens down, and a fourth that ligó. */
const ganador: Grupo = {
  kind: 'trio',
  rank: '7',
  cards: [n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs'), n('7', 'diamonds')],
}
const ultima = ganador.cards[3]

const MARCADOR: Marcador = {
  contrato: CUATRO_TRIOS,
  puntos: [0, 19],
  ganador: 0,
  mesa: [[ganador], []],
  cierre: [ultima.id],
}

/** The next reparto, already dealt behind the ronda that just ended. */
const siguiente = makeRonda({
  jugadores: [{ hand: [n('4', 'spades'), n('5', 'spades')] }, { hand: [n('9', 'hearts')] }],
})

const vistaCon = (historial: readonly Marcador[]): VistaDePartida => ({
  asiento: 0,
  config: CONFIG_POR_DEFECTO,
  players: 2,
  seed: 'mesa-final',
  indiceContrato: historial.length,
  ronda: vistaDeAsiento(siguiente, 0),
  historial,
  totales: [0, 19],
  ganadores: null,
})

function Pantalla({ historial }: { historial: readonly Marcador[] }) {
  // Both transports hand `useMesa` a view that only changes when something
  // did — the local home memoizes it, the remote one gets one object per
  // answer — so a test that rebuilt it on every render would be testing a
  // table nobody has.
  const vista = useMemo(() => vistaCon(historial), [historial])
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
      seed="mesa-final"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

describe('the pause opens on the table that was won', () => {
  afterEach(cleanup)

  const terminar = () => {
    const vista = render(<Pantalla historial={[]} />)
    vista.rerender(<Pantalla historial={[MARCADOR]} />)
    return vista
  }

  it('shows the mesa first and the score on a tap, and goes back', () => {
    terminar()

    expect(screen.getByText('Ver el puntaje')).toBeTruthy()
    // The scoreboard is behind it, not instead of it.
    expect(screen.queryByText('Siguiente reparto')).toBeNull()

    fireEvent.click(screen.getByText('Ver el puntaje'))
    expect(screen.getByText('Siguiente reparto')).toBeTruthy()
    expect(screen.queryByText('Ver el puntaje')).toBeNull()

    fireEvent.click(screen.getByText('Volver a ver la mesa'))
    expect(screen.getByText('Ver el puntaje')).toBeTruthy()
  })

  it('marks the card it was won with, and only that one', () => {
    const { container } = terminar()

    // Four sevens on the felt, one of them gold.
    expect(container.querySelectorAll('.ring-amber-400')).toHaveLength(1)
    expect(screen.getByText('Salió poniendo lo que está en dorado.')).toBeTruthy()
  })

  it('says so plainly when the win was a discard, and still shows the table', () => {
    const vista = render(<Pantalla historial={[]} />)
    vista.rerender(
      <Pantalla historial={[{ ...MARCADOR, cierre: [] }]} />,
    )

    expect(
      screen.getByText('Salió botando su última carta; la mesa quedó así.'),
    ).toBeTruthy()
    expect(vista.container.querySelectorAll('.ring-amber-400')).toHaveLength(0)
    expect(screen.getByText('Ver el puntaje')).toBeTruthy()
  })

  it('goes straight to the score for a partida saved before the snapshot', () => {
    const vista = render(<Pantalla historial={[]} />)
    vista.rerender(
      <Pantalla
        historial={[{ contrato: CUATRO_TRIOS, puntos: [0, 19], ganador: 0 }]}
      />,
    )

    // An old historial has no mesa to show, and the pause is what it was.
    expect(screen.getByText('Siguiente reparto')).toBeTruthy()
    expect(screen.queryByText('Ver el puntaje')).toBeNull()
    expect(screen.queryByText('Volver a ver la mesa')).toBeNull()
  })
})
