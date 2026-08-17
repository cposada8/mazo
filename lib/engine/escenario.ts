/**
 * Scenarios: a ronda dealt from cards you name, instead of from a shuffle.
 *
 * This exists to make bots comparable. Two bots given the identical hand and
 * the identical draw order differ only in what they decide; without that, the
 * one with better cards looks like the better bot.
 *
 * Anything left unspecified is filled from the rest of the deck, shuffled by
 * seed — so a scenario can name the six cards that matter and stay realistic
 * about the others.
 */

import { type Card, isComodin } from './cards'
import { CATALOGO, type Contrato } from './contratos'
import {
  CARDS_PER_HAND,
  MAX_PLAYERS,
  MIN_PLAYERS,
  buildDeck,
} from './deck'
import { type CardSpec, describeSpec, parseCardSpecs } from './notacion'
import { createRng, shuffle } from './random'
import { type RondaState } from './ronda'

export type EscenarioSpec = {
  /** One entry per seat. Fewer than twelve cards is fine — the rest is filled. */
  readonly manos: readonly (readonly string[])[]
  /** Cards that will come off the stock, **in the order they are drawn**. */
  readonly stock?: readonly string[]
  /** The face-up pile. The last entry is the top card. */
  readonly descarte?: readonly string[]
  readonly contrato?: Contrato
  readonly comodines?: boolean
  /** Seeds the filler, so a scenario is the same every time it is built. */
  readonly seed?: string
  readonly empieza?: number
}

export function crearEscenario(spec: EscenarioSpec): RondaState {
  const {
    manos,
    stock: stockSpec = [],
    descarte: descarteSpec,
    contrato = CATALOGO[0],
    comodines = true,
    seed = 'escenario',
    empieza = 0,
  } = spec

  const players = manos.length
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) {
    return failWith(
      `a scenario needs ${MIN_PLAYERS} to ${MAX_PLAYERS} seats, got ${players}`,
    )
  }

  for (const [seat, mano] of manos.entries()) {
    if (mano.length > CARDS_PER_HAND) {
      return failWith(
        `seat ${seat} was dealt ${mano.length} cards, more than the ${CARDS_PER_HAND} a hand holds`,
      )
    }
  }

  const repartidor = crearRepartidor(buildDeck({ comodines }))

  // Named cards come out of the deck first, so the filler can never duplicate
  // one of them.
  const manosDictadas = manos.map((mano) => repartidor.tomar(parseCardSpecs(mano)))
  const stockDictado = repartidor.tomar(parseCardSpecs(stockSpec))
  const descarteDictado = descarteSpec
    ? repartidor.tomar(parseCardSpecs(descarteSpec))
    : null

  const relleno = shuffle(repartidor.restantes(), createRng(seed))
  const tomarDelRelleno = (cuantas: number): Card[] => {
    if (relleno.length < cuantas) {
      return failWith('the deck ran out while filling this scenario')
    }
    return relleno.splice(0, cuantas)
  }

  const hands = manosDictadas.map((mano) => [
    ...mano,
    ...tomarDelRelleno(CARDS_PER_HAND - mano.length),
  ])

  const discard = descarteDictado ?? tomarDelRelleno(1)

  // The engine draws from the end of the stock, so the dictated cards go last,
  // reversed: the first one named is the first one drawn.
  const stock = [...relleno, ...[...stockDictado].reverse()]

  return {
    contrato,
    jugadores: hands.map((hand) => ({ hand, grupos: [], bajadoEnTurno: null })),
    stock,
    discard,
    turno: ((empieza % players) + players) % players,
    numeroDeTurno: 1,
    fase: 'draw',
    rngState: createRng(`${seed}#ronda`).state(),
    ganador: null,
  }
}

/**
 * Hands out the physical cards a spec asks for, and refuses to invent any.
 *
 * Two of every card exist, so asking for two 7♠ is fine and asking for three is
 * not — the same limit a real table has.
 */
function crearRepartidor(deck: readonly Card[]) {
  const pools = new Map<string, Card[]>()
  for (const card of deck) {
    const key = claveDe(card)
    const pool = pools.get(key)
    if (pool) pool.push(card)
    else pools.set(key, [card])
  }

  return {
    tomar(specs: readonly CardSpec[]): Card[] {
      return specs.map((spec) => {
        const key = claveDeSpec(spec)
        const pool = pools.get(key)
        const card = pool?.pop()
        if (!card) {
          return failWith(
            `no ${describeSpec(spec)} left in the deck — a scenario cannot use more copies than exist`,
          )
        }
        return card
      })
    },
    restantes(): Card[] {
      return [...pools.values()].flat()
    },
  }
}

const claveDe = (card: Card): string =>
  isComodin(card) ? 'comodin' : `${card.rank}|${card.suit}`

const claveDeSpec = (spec: CardSpec): string =>
  spec.kind === 'comodin' ? 'comodin' : `${spec.rank}|${spec.suit}`

function failWith(message: string): never {
  throw new Error(message)
}
