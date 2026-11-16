'use client'

/**
 * The bot that guesses your number (Phase 105): played in the phone alone,
 * with no connection at all — your number never goes into the app. The bot
 * proposes a guess; you answer it with two steppers, puntos and famas; it
 * keeps every number that would have answered the same and guesses again.
 * «Deshacer» takes the last answer back; answers no number fits are said
 * plainly; how many numbers it still considers is shown, shrinking.
 */

import { ChevronLeft, Minus, Plus, RotateCcw, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  DIGITOS,
  DIGITOS_POR_DEFECTO,
  type EstadoDelBot,
  adivino,
  contradice,
  cuantosNumeros,
  deshacer,
  empezarBot,
  posiblesDe,
  responder,
  siguienteIntento,
} from '@/lib/engine/puntoyfama'
import { semillaAleatoria } from '@/lib/semilla'
import { cn } from '@/lib/utils'
import { Marcas } from './tablero'

export function BotQueAdivina() {
  const [digitos, setDigitos] = useState<number>(DIGITOS_POR_DEFECTO)
  const [bot, setBot] = useState<EstadoDelBot | null>(null)
  const [puntos, setPuntos] = useState(0)
  const [famas, setFamas] = useState(0)

  const intento = useMemo(() => (bot ? siguienteIntento(bot) : null), [bot])
  const quedan = useMemo(() => (bot ? posiblesDe(bot).length : cuantosNumeros(digitos)), [bot, digitos])
  const loTiene = bot !== null && adivino(bot)
  const contradiccion = bot !== null && contradice(bot)

  const empezar = () => {
    setBot(empezarBot(digitos, semillaAleatoria()))
    setPuntos(0)
    setFamas(0)
  }
  const contestar = () => {
    if (!bot) return
    setBot(responder(bot, { puntos, famas }))
    setPuntos(0)
    setFamas(0)
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm">
          <ChevronLeft className="size-4" aria-hidden />
          Mazo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">El bot adivina tu número</h1>
        <p className="text-muted-foreground text-sm">
          Piensa un número de {digitos} cifras sin repetir y anótalo en un papel. El bot propone un número y tú
          le dices cuántos <b className="text-foreground">puntos</b> (cifra que está, pero en otro lugar) y cuántas{' '}
          <b className="text-foreground">famas</b> (cifra en su lugar) saca.
        </p>
      </header>

      {!bot ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Cifras</h2>
            <div className="flex gap-2">
              {DIGITOS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDigitos(n)}
                  aria-pressed={n === digitos}
                  className={cn(
                    'border-input flex-1 rounded-md border py-2 text-sm tabular-nums',
                    n === digitos ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={empezar} className="bg-primary text-primary-foreground rounded-md px-4 py-3.5 text-sm font-medium">
            Ya lo pensé
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-5">
          <ol className="flex flex-col gap-1.5">
            {bot.pasos.map((paso, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">{i + 1}</span>
                <span className="font-mono text-lg tracking-widest">{paso.intento}</span>
                <Marcas respuesta={paso} />
              </li>
            ))}
          </ol>

          {loTiene ? (
            <div className="animate-in fade-in flex flex-col items-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">Tu número es</p>
              <p className="font-mono text-5xl font-bold tracking-widest">{bot.pasos.at(-1)!.intento}</p>
              <p className="text-sm">
                Lo adiviné en {bot.pasos.length} {bot.pasos.length === 1 ? 'intento' : 'intentos'}.
              </p>
            </div>
          ) : contradiccion ? (
            <div className="rounded-lg border border-red-600/40 p-4 text-sm">
              <p className="font-medium text-red-600 dark:text-red-400">Ningún número cumple con todas tus respuestas.</p>
              <p className="text-muted-foreground mt-1">
                Revisa tu número y usa «Deshacer» para corregir la respuesta que estaba mal.
              </p>
            </div>
          ) : (
            intento && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground text-xs tracking-widest uppercase">Intento {bot.pasos.length + 1}</span>
                  <span key={intento} className="animate-in zoom-in-95 fade-in font-mono text-5xl font-bold tracking-widest">
                    {intento}
                  </span>
                  <Quedan quedan={quedan} />
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  <Contador
                    titulo="Puntos"
                    color="bg-[oklch(0.72_0.13_88)]"
                    valor={puntos}
                    max={digitos - famas}
                    onCambiar={setPuntos}
                  />
                  <Contador
                    titulo="Famas"
                    color="bg-[oklch(0.6_0.12_148)]"
                    valor={famas}
                    max={digitos - puntos}
                    onCambiar={setFamas}
                  />
                </div>
                <button type="button" onClick={contestar} className="bg-primary text-primary-foreground w-full rounded-md px-4 py-3.5 text-sm font-medium">
                  {famas === digitos ? '¡Esa es!' : 'Responder'}
                </button>
              </div>
            )
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBot(deshacer(bot))}
              disabled={bot.pasos.length === 0}
              className="border-input hover:bg-accent flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm disabled:opacity-40"
            >
              <Undo2 className="size-4" aria-hidden />
              Deshacer
            </button>
            <button
              type="button"
              onClick={() => setBot(null)}
              className="border-input hover:bg-accent flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm"
            >
              <RotateCcw className="size-4" aria-hidden />
              Otro número
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

/** How many numbers the bot still considers, under its guess — shrinking with each answer. */
function Quedan({ quedan }: { quedan: number }) {
  return (
    <span className="text-muted-foreground mt-1 text-sm">
      Le {quedan === 1 ? 'queda' : 'quedan'}{' '}
      <b key={quedan} className="text-foreground animate-in zoom-in-75 fade-in inline-block text-lg tabular-nums">
        {quedan.toLocaleString('es')}
      </b>{' '}
      {quedan === 1 ? 'número posible' : 'números posibles'}
    </span>
  )
}

/** A stepper for one count; the two together never pass the number of digits. */
function Contador({
  titulo,
  color,
  valor,
  max,
  onCambiar,
}: {
  titulo: string
  color: string
  valor: number
  max: number
  onCambiar: (valor: number) => void
}) {
  return (
    <div className="bg-card flex flex-col items-center gap-2 rounded-lg border p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <span className={cn('size-3 rounded-full', color)} aria-hidden />
        {titulo}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(0, valor - 1))}
          disabled={valor === 0}
          aria-label={`Menos ${titulo.toLowerCase()}`}
          className="border-input hover:bg-accent rounded-full border p-2 disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="w-6 text-center text-3xl font-bold tabular-nums">{valor}</span>
        <button
          type="button"
          onClick={() => onCambiar(Math.min(max, valor + 1))}
          disabled={valor >= max}
          aria-label={`Más ${titulo.toLowerCase()}`}
          className="border-input hover:bg-accent rounded-full border p-2 disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
