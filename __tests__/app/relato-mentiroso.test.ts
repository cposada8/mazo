import { describe, expect, it } from 'vitest'
import { describeCard } from '@/lib/engine'
import {
  type EstadoMentiroso,
  type MoveMentiroso,
  aplicarMentiroso,
  empezarMentiroso,
} from '@/lib/engine/mentiroso'
import {
  type EventoMentiroso,
  cantidadDeRango,
  relatarMentiroso,
  textoDeEvento,
} from '@/lib/relato-mentiroso'

/** Phase 79: el Mentiroso told in words — public information only. */

const NOMBRES = ['Ana', 'Beto', 'Carla', 'Dani']

function paso(estado: EstadoMentiroso, move: MoveMentiroso) {
  const r = aplicarMentiroso(estado, move)
  if (!r.ok) throw new Error(r.code)
  return { despues: r.estado, eventos: relatarMentiroso(move, estado, r.estado) }
}

describe('relatarMentiroso', () => {
  const inicio = empezarMentiroso({ jugadores: 4, seed: 'relato' })
  const abre = inicio.turno
  const puestas = inicio.manos[abre].slice(0, 2)
  const jugada: MoveMentiroso = {
    type: 'jugar',
    asiento: abre,
    cartaIds: puestas.map((c) => c.id),
  }

  it('a play is told by its size and announced rank, never by its cards', () => {
    const { eventos } = paso(inicio, jugada)
    expect(eventos).toEqual([{ tipo: 'jugada', asiento: abre, cantidad: 2, rango: 'A', numero: 1 }])
    const texto = textoDeEvento(eventos[0], NOMBRES)
    expect(texto).toBe(`${NOMBRES[abre]} pone dos ases.`)
    for (const carta of puestas) {
      expect(texto).not.toContain(describeCard(carta))
      expect(JSON.stringify(eventos)).not.toContain(carta.id)
    }
  })

  it('a call carries what it turned over, and who took the pile', () => {
    const { despues } = paso(inicio, jugada)
    const { eventos } = paso(despues, { type: 'mentiroso', asiento: (abre + 1) % 4 })
    expect(eventos).toHaveLength(1)
    const e = eventos[0] as Extract<EventoMentiroso, { tipo: 'acusacion' }>
    expect(e.tipo).toBe('acusacion')
    expect(e.cartas.map((c) => c.id)).toEqual(puestas.map((c) => c.id))
    const texto = textoDeEvento(e, NOMBRES)
    expect(texto).toMatch(/grita ¡Mentiroso!/)
    expect(texto).toContain('se lleva la pila (2 cartas)')
  })

  it('a window that closes on a last play tells the close and the win', () => {
    const fin: EstadoMentiroso = {
      ...inicio,
      manos: inicio.manos.map((m, i) => (i === abre ? m.slice(0, 1) : m)),
    }
    const { despues } = paso(fin, {
      type: 'jugar',
      asiento: abre,
      cartaIds: [fin.manos[abre][0].id],
    })
    const { eventos } = paso(despues, { type: 'cerrarVentana' })
    expect(eventos.map((e) => e.tipo)).toEqual(['ventanaCerrada', 'gano'])
  })

  it('tells the reader their own moves in second person', () => {
    const { eventos } = paso(inicio, jugada)
    expect(textoDeEvento(eventos[0], NOMBRES, abre)).toBe('Pusiste dos ases.')
    const mentira: EventoMentiroso = {
      tipo: 'acusacion',
      acusador: 1,
      acusado: 0,
      rango: '7',
      cartas: [],
      eraMentira: true,
      seLlevo: 0,
      cartasDeLaPila: 5,
      gastoBala: false,
    }
    expect(textoDeEvento(mentira, NOMBRES, 0)).toBe(
      'Beto grita ¡Mentiroso! Mentías y te llevas la pila (5 cartas).',
    )
    expect(textoDeEvento(mentira, NOMBRES)).toBe(
      'Beto grita ¡Mentiroso! Ana mentía y se lleva la pila (5 cartas).',
    )
    expect(
      textoDeEvento({ ...mentira, eraMentira: false, seLlevo: 1, gastoBala: true }, NOMBRES, 1),
    ).toBe('Gritaste ¡Mentiroso! Era verdad: te llevas la pila (5 cartas) y pierdes una bala.')
  })

  it('a window, and a win, in words', () => {
    expect(textoDeEvento({ tipo: 'ventanaCerrada', asiento: 2 }, NOMBRES)).toBe(
      'Nadie dudó de Carla.',
    )
    expect(textoDeEvento({ tipo: 'gano', asiento: 3 }, NOMBRES)).toBe(
      'Dani se quedó sin cartas y gana.',
    )
    expect(textoDeEvento({ tipo: 'gano', asiento: 3 }, NOMBRES, 3)).toBe(
      '¡Te quedaste sin cartas: ganaste!',
    )
  })

  it('says a claim as a person would', () => {
    expect(cantidadDeRango(1, 'A')).toBe('un as')
    expect(cantidadDeRango(1, 'Q')).toBe('una reina')
    expect(cantidadDeRango(1, 'J')).toBe('una jota')
    expect(cantidadDeRango(3, 'K')).toBe('tres reyes')
    expect(cantidadDeRango(4, '10')).toBe('cuatro dieces')
  })
})
