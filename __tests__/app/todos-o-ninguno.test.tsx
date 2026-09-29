import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ajustes } from '@/app/partida/[codigo]/lobby'
import { CATALOGO, CONFIG_POR_DEFECTO } from '@/lib/engine'
import type { VistaDeLobby } from '@/lib/lobby'

/**
 * Phase 50: todos o ninguno. One tap turns every reparto on, one turns them
 * all off but the first — a partida needs at least one to be dealt.
 */

afterEach(cleanup)

type Partida = VistaDeLobby['partida']

const partidaCon = (contratos: typeof CATALOGO): Partida =>
  ({
    config: { ...CONFIG_POR_DEFECTO, contratos },
    segundosPorTurno: 45,
    segundosBot: 1,
    verDescarte: true,
    verHistorial: true,
  }) as unknown as Partida

function pintar(contratos: typeof CATALOGO) {
  const onTodos = vi.fn()
  const nada = () => {}
  render(
    <Ajustes
      partida={partidaCon(contratos)}
      onContrato={nada}
      onTodos={onTodos}
      onComodines={nada}
      onBajada={nada}
      onSegundosPorTurno={nada}
      onSegundosBot={nada}
      onVerDescarte={nada}
      onVerHistorial={nada}
    />,
  )
  return {
    onTodos,
    todos: screen.getByRole('button', { name: 'Todos' }) as HTMLButtonElement,
    ninguno: screen.getByRole('button', { name: 'Ninguno' }) as HTMLButtonElement,
  }
}

describe('Todos o ninguno', () => {
  it('asks for every reparto, or for only the first', () => {
    const { onTodos, todos, ninguno } = pintar(CATALOGO.slice(0, 4))
    fireEvent.click(todos)
    expect(onTodos).toHaveBeenLastCalledWith(true)
    fireEvent.click(ninguno)
    expect(onTodos).toHaveBeenLastCalledWith(false)
  })

  it('greys out «Todos» when every reparto is already on', () => {
    const { todos, ninguno } = pintar(CATALOGO)
    expect(todos.disabled).toBe(true)
    expect(ninguno.disabled).toBe(false)
  })

  it('greys out «Ninguno» when only the first is left', () => {
    const { todos, ninguno } = pintar(CATALOGO.slice(0, 1))
    expect(ninguno.disabled).toBe(true)
    expect(todos.disabled).toBe(false)
  })

  it('keeps «Ninguno» live when a single other reparto is on', () => {
    const { ninguno } = pintar(CATALOGO.slice(2, 3))
    expect(ninguno.disabled).toBe(false)
  })
})
