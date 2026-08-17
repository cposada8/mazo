'use client'

import { useState, useSyncExternalStore } from 'react'
import {
  CATALOGO,
  CONTRATOS_POR_DEFECTO,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Contrato,
} from '@/lib/engine'
import { hayPantallaCompleta, pedirPantallaCompleta } from '@/lib/pantalla'
import { limpiarSemilla, semillaAleatoria } from '@/lib/semilla'

/** Remembered across partidas: the answer to this rarely changes per person. */
const CLAVE_PANTALLA = 'mazo:pantalla-completa'

export type Ajustes = {
  jugadores: number
  seed: string
  /** The contratos to play, in order. Never empty. */
  contratos: Contrato[]
  /** Seconds a bot spends on its whole turn — draw, unload and discard. */
  segundosBot: number
  /** May the descarte pile be browsed, or does memory stay part of the game? */
  verDescarte: boolean
  /** May the relato line be opened into the ronda's whole story? */
  verHistorial: boolean
  /** Dark card faces instead of light ones. A deck preference, remembered. */
  cartasOscuras: boolean
}

/** Remembered across partidas: which deck you like holding rarely changes. */
const CLAVE_BARAJA = 'mazo:cartas-oscuras'

/** Whole-turn thinking times on offer. Two is the pace of a real table. */
const SEGUNDOS = [1, 2, 3, 5] as const

/**
 * Everything chosen before the first card is dealt.
 *
 * This screen also settles a technical problem it does not look like it is
 * solving: a partida is now created when you press the button, not while the
 * page renders. Random dealing during render would mean the prerendered HTML
 * and the browser disagree — which is exactly why every first partida used to
 * be the same one.
 */
export function Inicio({
  onEmpezar,
  semillaPrevia,
}: {
  onEmpezar: (ajustes: Ajustes) => void
  /** Offered back after a finished partida, so it can be replayed. */
  semillaPrevia?: string
}) {
  const [jugadores, setJugadores] = useState(3)
  const [semilla, setSemilla] = useState('')
  const [segundosBot, setSegundosBot] = useState(2)
  const [verDescarte, setVerDescarte] = useState(true)
  const [verHistorial, setVerHistorial] = useState(true)
  const [cartasOscuras, setCartasOscuras] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(CLAVE_BARAJA) === 'si',
  )

  const escogerBaraja = (oscuras: boolean) => {
    localStorage.setItem(CLAVE_BARAJA, oscuras ? 'si' : 'no')
    setCartasOscuras(oscuras)
  }
  const [encendidos, setEncendidos] = useState<readonly string[]>(
    CONTRATOS_POR_DEFECTO,
  )

  /**
   * Fullscreen is asked for here, on the Repartir press, because that is the
   * one moment a user gesture and the start of a partida coincide — the
   * browser will not grant it on a timer. Whether it is even offered is only
   * known in the browser, so the checkbox appears after hydration.
   */
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const ofrecerPantalla = montado && hayPantallaCompleta()
  const [conPantalla, setConPantalla] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(CLAVE_PANTALLA) !== 'no',
  )

  const alternarPantalla = () => {
    setConPantalla((antes) => {
      localStorage.setItem(CLAVE_PANTALLA, antes ? 'no' : 'si')
      return !antes
    })
  }

  // Always in catalogue order, however they were switched on.
  const contratos = CATALOGO.filter((contrato) => encendidos.includes(contrato.id))

  const alternar = (id: string) =>
    setEncendidos((actual) =>
      actual.includes(id) ? actual.filter((otro) => otro !== id) : [...actual, id],
    )

  const empezar = () => {
    if (contratos.length === 0) return
    if (conPantalla) pedirPantallaCompleta()
    onEmpezar({
      jugadores,
      seed: limpiarSemilla(semilla) || semillaAleatoria(),
      contratos: [...contratos],
      segundosBot,
      verDescarte,
      verHistorial,
      cartasOscuras,
    })
  }

  const bots = jugadores - 1

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Jugar Carioca</h1>
        <p className="text-muted-foreground text-balance">
          Contra El Codicioso, que se baja apenas puede y no perdona un descarte
          útil.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Cuántos en la mesa
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {Array.from(
            { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
            (_, i) => MIN_PLAYERS + i,
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setJugadores(n)}
              aria-pressed={jugadores === n}
              className={`rounded-md border py-3 text-sm tabular-nums transition-colors ${
                jugadores === n
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-card hover:bg-accent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          Tú y {bots} {bots === 1 ? 'bot' : 'bots'}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Rondas que se juegan
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {contratos.length} de {CATALOGO.length}
          </span>
        </div>

        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border">
          {CATALOGO.map((contrato, indice) => {
            const activo = encendidos.includes(contrato.id)
            return (
              <li key={contrato.id}>
                <button
                  type="button"
                  onClick={() => alternar(contrato.id)}
                  aria-pressed={activo}
                  className="bg-card hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                >
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded border text-xs ${
                      activo
                        ? 'bg-foreground text-background border-transparent'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {activo ? '✓' : ''}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {indice + 1}
                  </span>
                  <span className={`text-sm ${activo ? '' : 'text-muted-foreground'}`}>
                    {contrato.nombre}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-muted-foreground text-sm text-balance">
          Se juegan en este orden, una ronda cada una. Apaga las que no quieras:
          menos rondas, partida más corta.
          {contratos.length === 0 && (
            <span className="text-red-600 dark:text-red-400">
              {' '}
              Deja al menos una encendida.
            </span>
          )}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Cuánto piensa un bot
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {SEGUNDOS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegundosBot(s)}
              aria-pressed={segundosBot === s}
              className={`rounded-md border py-3 text-sm tabular-nums transition-colors ${
                segundosBot === s
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-card hover:bg-accent'
              }`}
            >
              {s} s
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm text-balance">
          El turno completo del bot — robar, bajar y botar — cabe en ese
          tiempo, y el anillo del que juega se va vaciando.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Ayudas de memoria
        </h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={verDescarte}
            onChange={() => setVerDescarte((antes) => !antes)}
            className="size-4 accent-current"
          />
          <span>
            Mirar el descarte completo
            <span className="text-muted-foreground">
              {' '}
              — tocando el número de la pila
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={verHistorial}
            onChange={() => setVerHistorial((antes) => !antes)}
            className="size-4 accent-current"
          />
          <span>
            Releer lo que ha pasado
            <span className="text-muted-foreground">
              {' '}
              — tocando la línea de la última jugada
            </span>
          </span>
        </label>
        <p className="text-muted-foreground text-sm text-balance">
          Nada de esto cambia una regla: solo muestra lo que ya pasó a la
          vista de todos. Apágalas si recordar es parte del juego en tu mesa.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          La baraja
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <BotonDeBaraja
            nombre="Claras"
            activo={!montado || !cartasOscuras}
            onClick={() => escogerBaraja(false)}
            carta="border-stone-300 bg-stone-50 text-stone-900"
          />
          <BotonDeBaraja
            nombre="Oscuras"
            activo={montado && cartasOscuras}
            onClick={() => escogerBaraja(true)}
            carta="border-stone-600 bg-stone-900 text-stone-50"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Semilla
        </h2>
        <input
          value={semilla}
          onChange={(event) => setSemilla(event.target.value)}
          placeholder="al azar"
          className="bg-card rounded-md border px-3 py-2 font-mono text-sm"
          aria-label="Semilla"
        />
        <p className="text-muted-foreground text-sm text-balance">
          Déjala vacía y sale una al azar. Escribe la misma de una partida
          anterior y vuelven a salir exactamente las mismas cartas.
          {semillaPrevia && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setSemilla(semillaPrevia)}
                className="underline"
              >
                Repetir {semillaPrevia}
              </button>
            </>
          )}
        </p>
      </section>

      {ofrecerPantalla && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={conPantalla}
            onChange={alternarPantalla}
            className="size-4 accent-current"
          />
          <span>
            Pantalla completa
            <span className="text-muted-foreground">
              {' '}
              — la mesa se queda con todo el teléfono
            </span>
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={empezar}
        disabled={contratos.length === 0}
        className="bg-foreground text-background rounded-md px-4 py-3.5 text-sm font-medium disabled:opacity-40"
      >
        Repartir
      </button>
    </main>
  )
}

/** One deck on offer, with a miniature of the card face it stands for. */
function BotonDeBaraja({
  nombre,
  activo,
  onClick,
  carta,
}: {
  nombre: string
  activo: boolean
  onClick: () => void
  /** The miniature's colours — a preview of the actual face. */
  carta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex items-center justify-center gap-2.5 rounded-md border py-2.5 text-sm transition-colors ${
        activo
          ? 'bg-foreground text-background border-transparent'
          : 'bg-card hover:bg-accent'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-5 flex-col items-start gap-px rounded-[3px] border pt-0.5 pl-0.5 text-[9px] leading-none font-semibold ${carta}`}
      >
        <span>A</span>
        <span>♠</span>
      </span>
      {nombre}
    </button>
  )
}
