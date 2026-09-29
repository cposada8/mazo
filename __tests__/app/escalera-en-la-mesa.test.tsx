import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Tablero } from '@/app/jugar/juego'
import { useMesa } from '@/app/jugar/useMesa'
import {
  CONFIG_POR_DEFECTO,
  type Card,
  type Move,
  ORDEN_DE_ESCALERA,
  type VistaDePartida,
  contratoPorId,
  vistaDeAsiento,
} from '@/lib/engine'
import { guiar } from '@/lib/guia'
import { makeRonda, n } from '../engine/helpers'

/**
 * Phase 48 on the table: an escalera ronda has no Armar and no Bajarme. The
 * whole hand is the escalera, and one button lays it down once it is one.
 */

const sucia = contratoPorId('c9')!

/** Thirteen rangos in mixed pintas — a complete escalera sucia. */
const completa = (): Card[] =>
  ORDEN_DE_ESCALERA.map((rank, i) =>
    n(rank, (['spades', 'hearts', 'diamonds', 'clubs'] as const)[i % 4]),
  )

function Pantalla({ mano, jugadas }: { mano: Card[]; jugadas: Move[] }) {
  const vista = useMemo<VistaDePartida>(
    () => ({
      asiento: 0,
      config: { ...CONFIG_POR_DEFECTO, contratos: [sucia] },
      players: 2,
      seed: 'escalera',
      indiceContrato: 0,
      ronda: vistaDeAsiento(
        makeRonda({
          jugadores: [{ hand: mano }, { hand: [n('9', 'clubs')] }],
          contrato: sucia,
          fase: 'act',
        }),
        0,
      ),
      historial: [],
      totales: [0, 0],
      ganadores: null,
    }),
    [mano],
  )
  const juego = useMesa({
    vista,
    relatos: [],
    segundosDelTurno: 45,
    aviso: null,
    limpiarAviso: () => {},
    jugar: (move) => jugadas.push(move),
  })

  return (
    <Tablero
      juego={juego}
      jugadores={2}
      seed="escalera"
      verDescarte
      verHistorial
      cartasOscuras
      galeriaDeComodines={[]}
      segundosBot={600}
      onSalir={() => {}}
    />
  )
}

describe('an escalera ronda on the table', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('lays the whole hand down with one button once it is an escalera', () => {
    const jugadas: Move[] = []
    const mano = completa()
    render(<Pantalla mano={mano} jugadas={jugadas} />)

    expect(screen.queryByRole('button', { name: /^Armar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bajarme' })).toBeNull()
    expect(screen.getByText('Ya tienes la escalera: toca Bajar escalera.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Bajar escalera' }))
    expect(jugadas).toEqual([
      {
        type: 'bajarse',
        propuestas: [{ kind: 'escalera', tipo: 'sucia', cardIds: mano.map((c) => c.id) }],
      },
    ])
  })

  it('keeps the button off while a rango is missing', () => {
    const mano = [...completa().slice(0, 12), n('2', 'hearts')]
    render(<Pantalla mano={mano} jugadas={[]} />)
    expect(
      (screen.getByRole('button', { name: 'Bajar escalera' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText(/Junta del 2 a la A/)).toBeTruthy()
  })
})

describe('the guía in an escalera ronda', () => {
  it('never mentions Armar', () => {
    const linea = guiar({
      esTuTurno: true,
      fase: 'act',
      yaBajado: false,
      mesaAbierta: false,
      seleccionadas: 0,
      apartadas: 0,
      contratoCompleto: false,
      hayMesa: false,
      escalera: true,
    })
    expect(linea).not.toMatch(/Armar/)
  })
})
