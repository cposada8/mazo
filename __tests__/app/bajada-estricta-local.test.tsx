import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMemo } from 'react'
import { Juego, Tablero } from '@/app/jugar/juego'
import { useMesa } from '@/app/jugar/useMesa'
import {
  CATALOGO,
  CONFIG_POR_DEFECTO,
  type VistaDePartida,
  vistaDeAsiento,
} from '@/lib/engine'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 47, on the path that first dropped it.
 *
 * A table with one person and bots is played in the browser, not on the
 * server (Phase 34), and that path builds its own config from the lobby's
 * fields one by one. The strict bajada reached the server and was lost here:
 * the partida dealt libre, and the guía said «3 o más». This pins that the
 * local table plays the rule the lobby chose.
 */

function montar(bajada?: 'libre' | 'estricta') {
  return render(
    <Juego
      jugadores={2}
      seed="estricta-local"
      contratos={CATALOGO.slice(0, 7)}
      comodines
      bajada={bajada}
      segundosBot={600}
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      bots={[null, null]}
      onSalir={() => {}}
    />,
  )
}

const leyendaDelMenu = () => {
  fireEvent.click(screen.getByLabelText(/^Menú de la partida/))
  return screen.getByText(/con comodines/).textContent ?? ''
}

describe('the strict bajada at a table played in this browser', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('plays the rule the lobby chose', () => {
    montar('estricta')
    expect(leyendaDelMenu()).toMatch(/bajada estricta/)
  })

  it('stays libre when the lobby said nothing', () => {
    montar()
    expect(leyendaDelMenu()).toMatch(/bajada libre/)
  })
})

/* --------------------------------------------- setting a grupo aside */


/** Your turn, cards drawn, holding four sevens. */
function ConCuatroSietes({ estricta }: { estricta: boolean }) {
  const vista = useMemo<VistaDePartida>(() => {
    const ronda = makeRonda({
      jugadores: [
        {
          hand: [
            n('7', 'spades'),
            n('7', 'hearts'),
            n('7', 'clubs'),
            n('7', 'diamonds'),
            n('K', 'clubs'),
          ],
        },
        { hand: [n('9', 'clubs')] },
      ],
      fase: 'act',
    })
    return {
      asiento: 0,
      config: { ...CONFIG_POR_DEFECTO, bajada: estricta ? 'estricta' : 'libre' },
      players: 2,
      seed: 'sietes',
      indiceContrato: 0,
      ronda: vistaDeAsiento(estricta ? { ...ronda, bajadaEstricta: true } : ronda, 0),
      historial: [],
      totales: [0, 0],
      ganadores: null,
    }
  }, [estricta])

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
      seed="sietes"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

function armarLosCuatroSietes() {
  for (const titulo of ['7♠', '7♥', '7♣', '7♦']) {
    fireEvent.click(screen.getByTitle(titulo).closest('button')!)
  }
  fireEvent.click(screen.getByRole('button', { name: /^Armar/ }))
}

describe('setting a grupo aside under the strict bajada', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('says a trío goes down at exactly three, instead of setting four aside', () => {
    render(<ConCuatroSietes estricta />)
    armarLosCuatroSietes()
    expect(screen.getByText(/Bajada estricta: el trío va con 3 cartas exactas/)).toBeTruthy()
    expect(screen.queryByText(/Vas a bajar/i)).toBeNull()
  })

  it('sets the same four aside at a libre table', () => {
    render(<ConCuatroSietes estricta={false} />)
    armarLosCuatroSietes()
    expect(screen.queryByText(/Bajada estricta/)).toBeNull()
    expect(screen.getByText(/Vas a bajar/i)).toBeTruthy()
  })
})
