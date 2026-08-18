/**
 * El Memorioso — the bot that notices what is not coming back.
 *
 * Two copies of every card are in play. A seat can see its own hand, the whole
 * descarte, and every grupo on the mesa; everything else is either in the stock
 * or in somebody's hand, and from a seat those are the same thing — unseen.
 * So "how many sixes of diamonds are still out there" is not a guess, it is
 * arithmetic, and it is arithmetic the other two never do.
 *
 * What it buys is the difference between a promising card and a promise that
 * cannot be kept. A pair of fours with both remaining fours already face up in
 * the descarte is not two thirds of a trío — it is two cards of dead weight
 * dressed as progress. El Codicioso will hold that pair to the end of the
 * ronda. This one throws it and moves on, which is what makes it visibly
 * different at the table: it lets go of things early, and it is right to.
 *
 * Honest about its own limits. This is counting, not reading: it knows what is
 * gone, never who has it. A rebarajada folds the descarte back into the stock
 * and those cards become unseen again — correctly, because from a seat with no
 * memory between turns they *are*. The bot that remembers who took what needs
 * the relatos, and is written up in the roadmap under the stronger bot nobody
 * has built yet.
 */

import {
  ESCALA_MIN_SIZE,
  RANKS,
  TRIO_MIN_SIZE,
  type Card,
  type Move,
  type Rank,
  type VistaDeAsiento,
  isComodin,
  rankAfter,
} from '@/lib/engine'
import { largoDeLaCadena, rutasDeCarta } from './agrupar'
import { type Bot } from './bot'
import { type Conteo, caminoHastaLaEscala, conteoDeCartas } from './evaluar'
import { type Perfil, decidirConPerfil } from './perfil'

/** Same bar as El Codicioso — but it will not pay it for a promise already broken. */
const MITAD_DEL_CAMINO = 0.5

/**
 * Live copies per card still missing at which a route stops worrying.
 *
 * Not a probability — a slope. Two chances at every card you still need is
 * comfortable; one is thin; none is dead. Grading it rather than asking a
 * yes-or-no is what makes this bot differ on ordinary turns instead of only on
 * the rare rango that has been exhausted outright.
 */
const COPIAS_QUE_TRANQUILIZAN = 3

const PERFIL: Perfil = {
  /**
   * The baseline's bar, asked of a promise that can still be kept. El Codicioso
   * reaches for anything halfway to a grupo; this one first checks that the
   * other half is still in play.
   */
  quiereElDescarte: (arriba, vista) =>
    promesa(arriba, { ...vista, mano: [...vista.mano, arriba] }) >= MITAD_DEL_CAMINO,

  // Patience is El Paciente's idea. This one's edge is in what it keeps.
  seBaja: () => true,

  /**
   * Before bajarse, what the hand can still become; after bajarse, what the
   * mesa can still reach — and counting has something to say about both. A card
   * two steps from an escala's end is only two steps away while the card in
   * between is still out there.
   */
  valorEnMano: (card, vista) =>
    vista.jugadores[vista.asiento].bajadoEnTurno === null
      ? promesa(card, vista)
      : alcanceVivoEnMesa(card, vista),
}

/**
 * What this card is worth once the cards it is waiting for are counted.
 *
 * The two roads out of a card — a trío of its rango, an escala in its suit —
 * are valued and *discounted separately*, and only then compared. Discounting
 * the better of the two by the better of the liveness figures is the mistake
 * that made the first version of this bot indistinguishable from the baseline:
 * an escala route is almost always alive, since a run can grow in either
 * direction, so it rescued every dead pair on the table. A card waiting for a
 * trío has to be judged on that trío's chances, not on a road it is not taking.
 */
function promesa(card: Card, vista: VistaDeAsiento): number {
  if (isComodin(card)) return Number.MAX_SAFE_INTEGER

  const rutas = rutasDeCarta(card, vista.mano, vista.contrato)
  const conteo = conteoDeCartas(vista)
  // Only one comodín may stand in a grupo as it is laid down, so a live one is
  // worth exactly one missing card, however many are unseen.
  const comodinDisponible = Math.min(1, conteo.comodines())

  const enMano = vista.mano.filter(
    (otra) => !isComodin(otra) && otra.rank === card.rank,
  ).length
  const faltanParaElTrio = Math.max(0, TRIO_MIN_SIZE - enMano)
  const vivezaDelTrio = viveza(
    conteo.delRango(card.rank) + comodinDisponible,
    faltanParaElTrio,
  )

  const faltanParaLaEscala = Math.max(
    0,
    ESCALA_MIN_SIZE - largoDeLaCadena(card, vista.mano),
  )
  const vivezaDeLaEscala = viveza(
    vivasJuntoALaCadena(card, vista, conteo, faltanParaLaEscala) + comodinDisponible,
    faltanParaLaEscala,
  )

  return Math.max(rutas.trio * vivezaDelTrio, rutas.escala * vivezaDeLaEscala)
}

/**
 * How healthy a road is, from 0 to 1: how many live copies there are per card
 * still missing, capped once there are enough to stop worrying. A road with
 * nothing left to want is already home.
 */
function viveza(vivas: number, faltan: number): number {
  if (faltan <= 0) return 1
  return Math.min(1, vivas / (faltan * COPIAS_QUE_TRANQUILIZAN))
}

/**
 * Reach on the mesa, discounted by whether the ground between is still walkable.
 *
 * `alcanceEnMesa` asks how far a card is from an open end and stops there. This
 * asks the second question: are the ranks in between still out there to be
 * drawn? A 10♦ two steps from an escala that needs a 9♦ is worth nothing at all
 * once both nines of diamonds are lying face up — and it is exactly the card
 * the other two will keep protecting.
 */
function alcanceVivoEnMesa(card: Card, vista: VistaDeAsiento): number {
  if (isComodin(card)) return Number.MAX_SAFE_INTEGER

  const conteo = conteoDeCartas(vista)
  const comodinDisponible = Math.min(1, conteo.comodines())
  let mejor = 0

  for (const jugador of vista.jugadores) {
    for (const grupo of jugador.grupos) {
      if (grupo.kind !== 'escala') continue
      if (grupo.suit !== card.suit) continue

      const camino = caminoHastaLaEscala(grupo, card.rank)
      if (!camino) continue

      const vivas =
        camino.filter((rank) => conteo.deLaCarta(rank, card.suit) > 0).length +
        comodinDisponible
      const transitable = camino.length === 0 ? 1 : Math.min(1, vivas / camino.length)

      mejor = Math.max(mejor, transitable / (camino.length + 1))
    }
  }

  return mejor
}

/**
 * Copies still unseen of the cards that would extend this card's run, walking
 * out from it in both directions and stepping over the ranks already in hand.
 *
 * Only as far as the escala still needs — a run one card short does not care
 * whether the rank three places away is alive.
 */
function vivasJuntoALaCadena(
  card: Card,
  vista: VistaDeAsiento,
  conteo: Conteo,
  pasos: number,
): number {
  if (isComodin(card)) return 0

  const propias = new Set<Rank>()
  for (const otra of vista.mano) {
    if (!isComodin(otra) && otra.suit === card.suit) propias.add(otra.rank)
  }

  let vivas = 0

  for (const direccion of [1, -1]) {
    let porMirar = pasos
    for (let paso = 1; paso < RANKS.length && porMirar > 0; paso++) {
      const rank = rankAfter(card.rank, direccion * paso)
      // A rank already in hand costs no step: the run simply continues past it.
      if (propias.has(rank)) continue
      vivas += conteo.deLaCarta(rank, card.suit)
      porMirar--
    }
  }

  return vivas
}

export const memorioso: Bot = {
  id: 'memorioso',
  nombre: 'El Memorioso',
  descripcion: 'Cuenta lo que ya salió y suelta lo que nunca va a completar.',
  decidir: decidirMemorioso,
}

export function decidirMemorioso(vista: VistaDeAsiento): Move {
  return decidirConPerfil(vista, PERFIL)
}
