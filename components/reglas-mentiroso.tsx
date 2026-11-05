'use client'

/**
 * Cómo se juega, el Mentiroso (Phase 81) — Carioca's `ComoSeJuega` for the
 * second game: one screen, a heading and two or three sentences a section,
 * real cards where a shape needs showing. One component, two entrances: the
 * page at `/como-se-juega/mentiroso`, and an overlay from the table.
 *
 * A summary. `specs/mentiroso-rules.md` is the authority, and anything
 * settled there and contradicted here is a bug here.
 */

import type { Card, Rank, Suit } from '@/lib/engine'
import { Carta, CartaBocaAbajo } from '@/components/carta'
import { cn } from '@/lib/utils'

const n = (rank: Rank, suit: Suit, marca = ''): Card => ({
  id: `mentiroso-${rank}${suit}${marca}`,
  kind: 'normal',
  rank,
  suit,
})

export function ComoSeJuegaMentiroso({ cartasOscuras = true }: { cartasOscuras?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-7', cartasOscuras && 'cartas-oscuras')}>
      <Seccion titulo="De qué se trata">
        <p>
          Se reparte el mazo entero entre todos, de <b>3 a 6 jugadores</b>, sin
          comodines. <b>Gana el primero que se queda sin cartas</b>. Una partida
          es una sola mano: dura unos minutos.
        </p>
      </Seccion>

      <Seccion titulo="Tu turno">
        <p>
          Pones de <b>1 a 4 cartas boca abajo</b> en la pila y dices qué son. No
          eliges el número: va en orden, <b>A, 2, 3… hasta K</b>, y vuelve al A.
          Si toca el siete, lo que pongas son «sietes».
        </p>
        <p>
          Puedes decir la verdad o <b>mentir</b>: nadie ve tus cartas. Lo que sí
          ve todo el mundo es cuántas pusiste.
        </p>
        <Ejemplo pie="«Dos sietes». Pueden ser dos sietes… o no.">
          <CartaBocaAbajo size="sm" />
          <CartaBocaAbajo size="sm" className="-ml-[calc(var(--carta-sm,3.5rem)*0.45)]" />
        </Ejemplo>
      </Seccion>

      <Seccion titulo="«¡Mentiroso!»">
        <p>
          Cualquiera, menos quien jugó, puede decir <b>¡Mentiroso!</b> — hasta
          que juega el siguiente. Quien sigue elige: acusar, o jugar sus cartas,
          y en cuanto las pone, la jugada anterior ya no se puede acusar.
        </p>
        <p>
          Se dan vuelta <b>solo las cartas de esa jugada</b>. Basta una que no
          sea del número dicho para que sea mentira.
        </p>
        <Ejemplo pie="¡Mentira! Dijo dos sietes y puso un siete y un nueve: se lleva la pila.">
          <Carta card={n('7', 'spades')} size="sm" />
          <Carta card={n('9', 'hearts')} size="sm" className="ring-2 ring-red-500" />
        </Ejemplo>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Si <b>mintió</b>, la pila entera es para quien mintió.
          </li>
          <li>
            Si <b>era verdad</b>, la pila entera es para quien acusó.
          </li>
        </ul>
        <Ejemplo pie="Era verdad: dos sietes. Quien acusó se lleva la pila.">
          <Carta card={n('7', 'diamonds', 'b')} size="sm" />
          <Carta card={n('7', 'clubs', 'b')} size="sm" />
        </Ejemplo>
        <p className="text-muted-foreground">
          Después de una acusación se sigue con el número que venía: la pila
          cambia de dueño, el orden no.
        </p>
      </Seccion>

      <Seccion titulo="Las balas">
        <p>
          Cada uno empieza con <b>balas</b> — 3, o las que haya escogido la mesa.
          Decir «¡Mentiroso!» <b>gasta una</b>: si era mentira la recuperas, si
          era verdad la pierdes, además de llevarte la pila.
        </p>
        <p>
          <b>Sin balas ya no puedes acusar.</b> Sigues jugando tus cartas, y a
          una jugada que deja a alguien sin cartas solo le puedes decir «Le creo».
        </p>
      </Seccion>

      <Seccion titulo="Salir">
        <p>
          Te vas cuando te quedas sin cartas <b>y tu última jugada sobrevive</b>:
          quien sigue te cree, o te acusa y era verdad. Si te acusan y mentías,
          te llevas la pila y sigues jugando.
        </p>
        <p>
          A una jugada que dejó a alguien sin cartas no se le juega encima: el
          siguiente la acusa o dice <b>«Le creo»</b>.
        </p>
      </Seccion>

      <Seccion titulo="En Mazo">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cada jugada tiene su <b>tiempo</b>. Si se te acaba, se juega una carta
            al azar por ti; a una última jugada, se le cree.
          </li>
          <li>
            Si dos dicen «¡Mentiroso!» a la vez, cuenta <b>el primero que llega</b>.
          </li>
          <li>
            Si alguien se va, sus cartas salen del juego y el turno lo salta.
          </li>
        </ul>
      </Seccion>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {titulo}
      </h2>
      <div className="flex flex-col gap-2.5 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

/** A few cards on the game's felt, and one line under them. */
function Ejemplo({ pie, children }: { pie: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2 rounded-xl bg-[radial-gradient(ellipse_at_center,oklch(0.42_0.08_158),oklch(0.3_0.065_160))] p-4">
      <div className="flex gap-1">{children}</div>
      <figcaption className="text-center text-xs text-white/85">{pie}</figcaption>
    </figure>
  )
}
