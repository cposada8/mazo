'use client'

/**
 * Cómo se juega, Punto y Fama (Phase 106): one screen, as the other games
 * have — the scoring with a real example, the three ways to play, and the
 * bot. A page at `/como-se-juega/punto-y-fama` and an overlay from the
 * board. A summary: `specs/punto-y-fama-rules.md` is the authority.
 */

import { MAX_NUMEROS } from '@/lib/engine/puntoyfama/opciones'
import { Marcas } from './tablero'

export function ComoSeJuegaPuntoYFama() {
  return (
    <div className="flex flex-col gap-7">
      <Seccion titulo="De qué se trata">
        <p>
          Hay un <b>número secreto</b> de 3 a 6 cifras (lo elige el host), <b>sin cifras repetidas</b>; el 0
          puede ir primero. Tú propones números de la misma forma y cada intento recibe una respuesta:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Punto</b>: una cifra que está en el número, pero en otro lugar.
          </li>
          <li>
            <b>Fama</b>: una cifra que está en el número y en su lugar.
          </li>
        </ul>
        <Ejemplo secreto="1234" intento="1325" famas={1} puntos={2} pie="El 3 y el 2 son puntos; el 1 es fama; el 5 no está." />
        <p className="text-muted-foreground">
          No hay límite de intentos: sigues hasta que todas las cifras son fama. Mientras menos intentos, mejor.
        </p>
      </Seccion>

      <Seccion titulo="Números límite">
        <p>
          El host elige <b>cuántos números</b> (de 1 a {MAX_NUMEROS}). Todos adivinan{' '}
          <b>los mismos, en el mismo orden</b>. <b>Gana quien los adivina todos primero</b>; los demás siguen
          jugando y van llegando a sus puestos.
        </p>
      </Seccion>

      <Seccion titulo="Tiempo límite">
        <p>
          El host elige <b>cuántos minutos</b>. <b>Gana quien adivina más números</b> antes de que se acabe el
          tiempo; si empatan, quien adivinó su último número antes.
        </p>
      </Seccion>

      <Seccion titulo="Duelo">
        <p>
          <b>Dos personas.</b> Cada una escribe en secreto el número que la otra tiene que adivinar, y
          adivinan a la vez. <b>Gana quien lo adivina en menos intentos</b>; si empatan, quien lo adivinó
          primero. El que termina antes espera a que el otro termine, y al final se ven los dos números.
        </p>
      </Seccion>

      <Seccion titulo="El bot adivina tu número">
        <p>
          Al revés: piensas un número y el bot lo adivina. Tú le dices cuántos puntos y famas saca cada
          intento; si te equivocas, «Deshacer» lo arregla. Con 4 cifras suele necesitar 5 o 6 intentos.
        </p>
      </Seccion>

      <Seccion titulo="Los demás">
        <p>
          En las carreras ves de cada rival <b>en qué número va y sus respuestas</b>, nunca sus cifras. Al
          terminar, la tabla final muestra los intentos de todos.
        </p>
      </Seccion>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{titulo}</h2>
      <div className="flex flex-col gap-2.5 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Ejemplo({
  secreto,
  intento,
  famas,
  puntos,
  pie,
}: {
  secreto: string
  intento: string
  famas: number
  puntos: number
  pie: string
}) {
  return (
    <figure className="bg-muted/50 flex flex-col items-center gap-2 rounded-xl p-4">
      <p className="text-muted-foreground text-xs">
        Secreto <span className="text-foreground font-mono tracking-widest">{secreto}</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="flex gap-1">
          {[...intento].map((cifra, i) => (
            <span key={i} className="bg-background flex size-10 items-center justify-center rounded-md font-mono text-xl font-bold">
              {cifra}
            </span>
          ))}
        </span>
        <Marcas respuesta={{ famas, puntos }} llegando />
      </div>
      <figcaption className="text-muted-foreground text-center text-xs">{pie}</figcaption>
    </figure>
  )
}
