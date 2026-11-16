'use client'

/**
 * Cómo se juega, Palabras (Phase 91) — the other two games' «Cómo se juega»
 * for the third: one screen, a heading and two or three sentences a section,
 * real rows of tiles turning over where a colour needs showing. One
 * component, two entrances: the page at `/como-se-juega/palabras`, and an
 * overlay from the board.
 *
 * A summary. `specs/palabras-rules.md` is the authority, and anything
 * settled there and contradicted here is a bug here.
 */

import type { Color } from '@/lib/engine/palabras'
import {
  INTENTOS_POR_PALABRA,
  MAX_MINUTOS,
  MAX_PALABRAS,
  MS_CASTIGO,
} from '@/lib/engine/palabras/opciones'
import { cn } from '@/lib/utils'

const VALOR: Record<Color, string> = {
  verde: 'oklch(0.6 0.12 148)',
  amarillo: 'oklch(0.72 0.13 88)',
  gris: 'oklch(0.45 0 0)',
}

export function ComoSeJuegaPalabras() {
  return (
    <div className="flex flex-col gap-7">
      <Seccion titulo="De qué se trata">
        <p>
          Wordle en español, <b>como carrera</b>. Todos adivinan{' '}
          <b>las mismas palabras, en el mismo orden</b>, cada uno en su
          tablero. Las palabras tienen de <b>5 a 8 letras</b>, según lo que
          elija el host; la Ñ es una letra más y las tildes no cuentan.
        </p>
      </Seccion>

      <Seccion titulo="Los colores">
        <p>
          Tienes <b>{INTENTOS_POR_PALABRA} intentos</b> por palabra, y cada
          intento tiene que ser una palabra de verdad. Al enviarlo, las letras
          se dan vuelta una a una:
        </p>
        <Ejemplo
          palabra="DOLER"
          colores={['amarillo', 'verde', 'gris', 'verde', 'verde']}
          pie="La respuesta es PODER."
        />
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Verde</b>: la letra está, y en ese lugar.
          </li>
          <li>
            <b>Amarillo</b>: está, pero en otro lugar.
          </li>
          <li>
            <b>Gris</b>: no está — o ya se pintaron todas las veces que está.
          </li>
        </ul>
        <Ejemplo
          palabra="ERROR"
          colores={['amarillo', 'amarillo', 'verde', 'amarillo', 'gris']}
          pie="La respuesta es PERRO: tiene dos R, así que la tercera queda gris."
        />
        <p className="text-muted-foreground">
          Para escribir, puedes <b>tocar una casilla</b> y la letra va ahí: si
          ya sabes que termina en «ECO», escribe eso primero y vuelve al
          comienzo.
        </p>
      </Seccion>

      <Seccion titulo="Palabras límite">
        <p>
          El host elige <b>cuántas palabras</b> (de 1 a {MAX_PALABRAS}).{' '}
          <b>Gana quien las termina todas en menos tiempo.</b>
        </p>
        <p>
          Si no adivinas una, se revela, pasas a la siguiente y{' '}
          <b>sumas {MS_CASTIGO / 60_000} minutos</b> a tu tiempo.
        </p>
      </Seccion>

      <Seccion titulo="Tiempo límite">
        <p>
          El host elige <b>cuántos minutos</b> (de 1 a {MAX_MINUTOS}).{' '}
          <b>Gana quien resuelve más palabras</b> antes de que se acabe el
          tiempo; si empatan, quien resolvió su última antes. Cuando el reloj
          llega a cero, todos los tableros se detienen a la vez.
        </p>
        <p>
          Con <b>vidas</b> (de 1 a 5, o sin vidas): cada palabra que no
          adivinas cuesta una. Sin vidas se acaba tu carrera, te quedas con las
          que resolviste, y los demás siguen hasta el final.
        </p>
      </Seccion>

      <Seccion titulo="Los demás">
        <p>
          Mientras juegas ves de cada rival <b>en qué palabra va y sus
          colores</b>, nunca sus letras. Cuando terminas, puedes abrir cada
          palabra — tuya o de los demás — y ver todos sus intentos.
        </p>
        <p className="text-muted-foreground">
          Se entra con el código, incluso con la carrera andando, pero el reloj
          es el mismo para todos: quien llega tarde parte atrasado.
        </p>
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

/** A row of tiles that turns over, one at a time, as a try does on the board. */
function Ejemplo({
  palabra,
  colores,
  pie,
}: {
  palabra: string
  colores: readonly Color[]
  pie: string
}) {
  return (
    <figure className="bg-muted/50 flex flex-col items-center gap-2 rounded-xl p-4">
      <div className="flex gap-1.5">
        {[...palabra].map((letra, i) => (
          <span
            key={i}
            className={cn(
              'palabras-voltea flex size-11 items-center justify-center rounded-sm border-2 text-xl font-bold',
            )}
            style={
              {
                '--final': VALOR[colores[i]],
                animationDelay: `${300 + i * 260}ms`,
              } as React.CSSProperties
            }
          >
            {letra}
          </span>
        ))}
      </div>
      <figcaption className="text-muted-foreground text-center text-xs">{pie}</figcaption>
    </figure>
  )
}
