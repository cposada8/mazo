'use client'

/**
 * Cómo se juega (Phase 45): Carioca on one screen.
 *
 * The reference half of the phase. `lib/guia.ts` carries a first partida by
 * naming the next move; this answers the questions that come after it — *how
 * long is an escala, what does a comodín cost me, why is the mesa refusing my
 * card*. Written to be read mid-game with a hand of cards in the other hand:
 * every section is a heading and two or three sentences, and every shape the
 * game has a word for is shown as actual cards rather than described.
 *
 * One component, two entrances (chosen with the owner): the page at
 * `/como-se-juega`, and an overlay over the felt from the partida's menu. The
 * illustrations are the game's own `<Carta>` on the game's own felt, so what
 * you read here looks like what you are holding.
 *
 * It is a *summary*. `specs/carioca-rules.md` remains the authority, and
 * anything settled there and contradicted here is a bug here.
 */

import type { Card, Rank, Suit } from '@/lib/engine'
import { Carta } from '@/components/carta'
import { CATALOGO, CONTRATOS_POR_DEFECTO } from '@/lib/engine'
import { cn } from '@/lib/utils'

/** A card for an illustration. Ids only have to be unique on this screen. */
const n = (rank: Rank, suit: Suit, marca = ''): Card => ({
  id: `regla-${rank}${suit}${marca}`,
  kind: 'normal',
  rank,
  suit,
})

const comodin = (marca: string): Card => ({
  id: `regla-comodin-${marca}`,
  kind: 'comodin',
})

export function ComoSeJuega({
  /** The deck in use, so the examples are the cards you are actually holding. */
  cartasOscuras = true,
}: {
  cartasOscuras?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-7', cartasOscuras && 'cartas-oscuras')}>
      <Seccion titulo="De qué se trata">
        <p>
          Una partida son varias <b>rondas</b>, y cada ronda tiene un{' '}
          <b>contrato</b>: la combinación que hay que poner en la mesa para
          entrar en juego. Quien se queda sin cartas cierra la ronda; los demás
          suman lo que les quedó en la mano.
        </p>
        <p>
          Los puntos son un castigo, no un premio. <b>Gana quien menos tenga</b>{' '}
          cuando se acaba el último contrato.
        </p>
      </Seccion>

      <Seccion titulo="Tu turno, siempre igual">
        <ol className="flex flex-col gap-2">
          <Paso numero={1} nombre="Robas una carta">
            Del <b>mazo</b>, sin saber cuál es, o la de encima del{' '}
            <b>descarte</b>, que todos vieron. No hay condición para tomar el
            descarte: si te sirve, es tuya.
          </Paso>
          <Paso numero={2} nombre="Haces lo que puedas">
            Bajarte, si tienes el contrato completo. Poner cartas en los grupos
            que ya están en la mesa, si te bajaste antes. O nada.
          </Paso>
          <Paso numero={3} nombre="Botas una carta">
            Y el turno pasa al de tu derecha. Puedes botar la misma carta que
            acabas de robar del descarte: está permitido a propósito.
          </Paso>
        </ol>
      </Seccion>

      <Seccion titulo="Un trío">
        <p>
          Tres cartas o más <b>del mismo rango</b>. La pinta da igual. Tres es
          el mínimo, no el tamaño: cuatro sietes son un trío, no dos cosas.
        </p>
        <Muestra
          cartas={[n('7', 'spades'), n('7', 'hearts'), n('7', 'clubs')]}
          pie="Trío de 7"
        />
      </Seccion>

      <Seccion titulo="Una escala">
        <p>
          Cuatro cartas o más, <b>seguidas y de la misma pinta</b>. Cuatro es el
          mínimo; una escala de seis sigue siendo una sola escala.
        </p>
        <p>
          El as sirve por los dos lados: después de la K viene otra vez el as, y
          después el 2. Así que <b>K A 2 3 es una escala válida</b>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Muestra
            cartas={[
              n('4', 'spades'),
              n('5', 'spades'),
              n('6', 'spades'),
              n('7', 'spades'),
            ]}
            pie="Escala de ♠"
          />
          <Muestra
            cartas={[
              n('K', 'diamonds'),
              n('A', 'diamonds'),
              n('2', 'diamonds'),
              n('3', 'diamonds'),
            ]}
            pie="También vale: da la vuelta"
          />
        </div>
      </Seccion>

      <Seccion titulo="Bajarte">
        <p>
          Cuando tienes el contrato de la ronda completo, lo pones todo en la
          mesa de una vez. Selecciona las cartas de un grupo, toca{' '}
          <b>Armar</b>, repite con el siguiente, y cuando esté completo toca{' '}
          <b>Bajarme</b>.
        </p>
        <p>
          Al bajarte, cada grupo lleva <b>un comodín como máximo</b>. Los grupos
          pueden ser más grandes que el mínimo — bajarte con un trío de cuatro
          es legal y descarga una carta más.
        </p>
        <p className="text-muted-foreground">
          Ojo con esto: <b>el turno en que te bajas, la mesa queda cerrada</b>,
          incluso la tuya. Si te sobra una carta que cabía en tu propio grupo,
          se queda en la mano hasta tu siguiente turno.
        </p>
      </Seccion>

      <Seccion titulo="Ligar">
        <p>
          Desde el turno siguiente al que te bajaste, puedes poner cartas en{' '}
          <b>cualquier grupo de la mesa</b>, sea de quien sea. Un grupo bajado
          ya no es de nadie.
        </p>
        <p>
          Se hace seleccionando las cartas en tu mano y tocando el grupo. Es la
          forma de descargarse rápido — y quien no se ha bajado no puede tocar
          la mesa para nada.
        </p>
      </Seccion>

      <Seccion titulo="Los comodines">
        <p>
          Un comodín vale por cualquier carta. En la mesa queda{' '}
          <b>amarrado a la carta que representa</b>, y la carta se ve escrita
          encima de él.
        </p>
        <Muestra
          cartas={[
            n('9', 'hearts'),
            n('10', 'hearts'),
            comodin('j'),
            n('Q', 'hearts'),
          ]}
          representa={{ 2: 'J' }}
          pie="El comodín está haciendo de J♥"
        />
        <p>
          Puedes <b>recuperar su puesto</b> entregándole la carta que estaba
          tapando: el comodín no se va a tu mano, se corre a otro lugar del
          mismo grupo. Nunca cambia de grupo.
        </p>
        <p>
          En una escala <b>nunca van dos comodines seguidos</b>. En un trío no
          hay límite, una vez el grupo está en la mesa.
        </p>
        <p className="text-muted-foreground">
          Y cuestan <b>50 puntos</b> si la ronda termina contigo agarrándolo.
          Es lo más caro que hay.
        </p>
      </Seccion>

      <Seccion titulo="Salir de la ronda">
        <p>
          Sales cuando te quedas <b>sin cartas</b>, y da igual cómo:{' '}
          <b>botando</b> la última al descarte, o <b>ligando</b> la última en un
          grupo de la mesa. La ronda se acaba ahí mismo.
        </p>
        <p className="text-muted-foreground">
          Si el mazo se agota tres veces sin que nadie salga, la ronda queda en{' '}
          <b>tablas</b>: nadie gana y todos cuentan lo que tienen.
        </p>
      </Seccion>

      <Seccion titulo="El puntaje">
        <p>
          Al cerrarse la ronda, cada quien cuenta{' '}
          <b>las cartas que le quedaron en la mano</b>. Lo que está en la mesa no
          cuenta.
        </p>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border text-sm">
          <Puntos carta="2 al 10" valor="Su número" />
          <Puntos carta="J, Q, K" valor="10" />
          <Puntos carta="A" valor="20" />
          <Puntos carta="Comodín" valor="50" />
        </ul>
        <p>
          Quien salió no suma nada. Los totales se acumulan ronda tras ronda, y
          al final <b>gana el de menos puntos</b>. Si hay empate, ganan todos
          los empatados.
        </p>
      </Seccion>

      <Seccion titulo="Los contratos">
        <p>
          En este orden, uno por ronda. El host escoge cuáles se juegan antes de
          repartir; por defecto van los siete primeros.
        </p>
        <ol className="flex flex-col gap-px overflow-hidden rounded-lg border text-sm">
          {CATALOGO.map((contrato, indice) => {
            const porDefecto = CONTRATOS_POR_DEFECTO.includes(contrato.id)

            return (
              <li
                key={contrato.id}
                className="bg-card flex items-baseline gap-3 px-3 py-2"
              >
                <span className="text-muted-foreground tabular-nums">
                  {indice + 1}
                </span>
                <span className={cn(!porDefecto && 'text-muted-foreground')}>
                  {contrato.nombre}
                </span>
                {!porDefecto && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    apagado por defecto
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </Seccion>
    </div>
  )
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {titulo}
      </h2>
      <div className="flex flex-col gap-2.5 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Paso({
  numero,
  nombre,
  children,
}: {
  numero: number
  nombre: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-muted text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
        {numero}
      </span>
      <span className="min-w-0">
        <b>{nombre}.</b> {children}
      </span>
    </li>
  )
}

/**
 * An example, on the felt. The dark ground is not decoration: these are the
 * same cards at the same size against the same background the table uses, so
 * recognising one here is recognising it there.
 */
function Muestra({
  cartas,
  pie,
  representa,
}: {
  cartas: readonly Card[]
  pie: string
  /** For a comodín in the row: the rango it is standing for, by position. */
  representa?: Record<number, Rank>
}) {
  return (
    <figure className="flex flex-col items-center gap-1.5 rounded-lg bg-stone-950 px-3 py-2.5">
      <div className="flex">
        {cartas.map((card, indice) => (
          <Carta
            key={card.id}
            card={card}
            size="sm"
            represents={representa?.[indice]}
            className="-ml-[0.9em] first:ml-0"
          />
        ))}
      </div>
      <figcaption className="text-[11px] tracking-wide text-tinta-suave">
        {pie}
      </figcaption>
    </figure>
  )
}

function Puntos({ carta, valor }: { carta: string; valor: string }) {
  return (
    <li className="bg-card flex items-baseline justify-between px-3 py-2">
      <span>{carta}</span>
      <span className="text-muted-foreground tabular-nums">{valor}</span>
    </li>
  )
}
