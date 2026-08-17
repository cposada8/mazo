/**
 * The grupo examples from specs/carioca-rules.md, as data.
 *
 * Every one of these appears in the rules document. The page runs the real
 * validator over them, so if a rule ever changes the page changes with it.
 */

import type { Card, Rank, Suit } from '@/lib/engine'
import type { Grupo } from '@/lib/engine'

let counter = 0
const card = (rank: Rank, suit: Suit): Card => ({
  id: `ej-${rank}-${suit}-${counter++}`,
  kind: 'normal',
  rank,
  suit,
})
const comodin = (): Card => ({ id: `ej-comodin-${counter++}`, kind: 'comodin' })

export type Ejemplo = {
  titulo: string
  nota: string
  grupo: Grupo
}

export const EJEMPLOS: Ejemplo[] = [
  {
    titulo: 'Tres del mismo rango',
    nota: 'El trío mínimo.',
    grupo: {
      kind: 'trio',
      rank: '7',
      cards: [card('7', 'spades'), card('7', 'hearts'), card('7', 'clubs')],
    },
  },
  {
    titulo: 'Trío con un comodín',
    nota: 'Legal al bajarse: un solo comodín.',
    grupo: {
      kind: 'trio',
      rank: '7',
      cards: [card('7', 'spades'), card('7', 'hearts'), comodin()],
    },
  },
  {
    titulo: 'Trío con tres comodines',
    nota: 'Ilegal al bajarse, legal en la mesa: el trío no tiene límite.',
    grupo: {
      kind: 'trio',
      rank: '7',
      cards: [
        card('7', 'spades'),
        card('7', 'hearts'),
        comodin(),
        comodin(),
        comodin(),
      ],
    },
  },
  {
    titulo: 'Trío con una carta intrusa',
    nota: 'Ilegal siempre: el 8 no pertenece a un trío de 7.',
    grupo: {
      kind: 'trio',
      rank: '7',
      cards: [card('7', 'spades'), card('7', 'hearts'), card('8', 'clubs')],
    },
  },
  {
    titulo: 'Escala de cuatro',
    nota: 'Cuatro consecutivas de la misma pinta.',
    grupo: {
      kind: 'escala',
      suit: 'spades',
      start: 'A',
      cards: [
        card('A', 'spades'),
        card('2', 'spades'),
        card('3', 'spades'),
        card('4', 'spades'),
      ],
    },
  },
  {
    titulo: 'Escala terminada en as',
    nota: 'El as sirve arriba: J Q K A.',
    grupo: {
      kind: 'escala',
      suit: 'hearts',
      start: 'J',
      cards: [
        card('J', 'hearts'),
        card('Q', 'hearts'),
        card('K', 'hearts'),
        card('A', 'hearts'),
      ],
    },
  },
  {
    titulo: 'Escala cíclica',
    nota: 'K A 2 3 — el rango da la vuelta.',
    grupo: {
      kind: 'escala',
      suit: 'diamonds',
      start: 'K',
      cards: [
        card('K', 'diamonds'),
        card('A', 'diamonds'),
        card('2', 'diamonds'),
        card('3', 'diamonds'),
      ],
    },
  },
  {
    titulo: 'Escala con dos comodines separados',
    nota: 'Los comodines valen 2 y 6. Ilegal al bajarse, legal en la mesa.',
    grupo: {
      kind: 'escala',
      suit: 'hearts',
      start: '2',
      cards: [
        comodin(),
        card('3', 'hearts'),
        card('4', 'hearts'),
        card('5', 'hearts'),
        comodin(),
        card('7', 'hearts'),
      ],
    },
  },
  {
    titulo: 'Escala con dos comodines seguidos',
    nota: 'Ilegal siempre: valdrían 5 y 6, que son consecutivos.',
    grupo: {
      kind: 'escala',
      suit: 'hearts',
      start: '2',
      cards: [
        card('2', 'hearts'),
        card('3', 'hearts'),
        card('4', 'hearts'),
        comodin(),
        comodin(),
        card('7', 'hearts'),
      ],
    },
  },
  {
    titulo: 'Escala con pinta mezclada',
    nota: 'Ilegal siempre: el 2 es de corazones.',
    grupo: {
      kind: 'escala',
      suit: 'spades',
      start: 'A',
      cards: [
        card('A', 'spades'),
        card('2', 'hearts'),
        card('3', 'spades'),
        card('4', 'spades'),
      ],
    },
  },
  {
    titulo: 'Escala con un hueco',
    nota: 'Ilegal siempre: falta el 3.',
    grupo: {
      kind: 'escala',
      suit: 'spades',
      start: 'A',
      cards: [
        card('A', 'spades'),
        card('2', 'spades'),
        card('4', 'spades'),
        card('5', 'spades'),
      ],
    },
  },
]
