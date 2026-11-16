'use client'

/**
 * The pieces every guessing race's board shares (Phase 102, out of
 * Palabras' board): the time as m:ss, lives as hearts, the 3-2-1, the
 * rivals' cards and the finish screen with its table. What differs between
 * the games is handed in — how a rival's tries look (colours, or puntos and
 * famas), how a secret's tries are drawn small, and what a secret is called.
 */

import { Heart, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import type { IntentoBase } from '@/lib/engine/comun/carrera'
import type { VistaCarrera, VistaDeRivalEn } from '@/lib/engine/comun/vista-carrera'
import { cn } from '@/lib/utils'
import { type MiniIntentos, TablaDeLlegada } from './tabla'

/** What a secret is called, for the sentences around it. */
export type Sustantivo = {
  readonly uno: string
  readonly varios: string
  /** «la» for a word, «lo» for a number. */
  readonly articulo: 'la' | 'lo'
}
export const PALABRA: Sustantivo = { uno: 'palabra', varios: 'palabras', articulo: 'la' }
export const NUMERO: Sustantivo = { uno: 'número', varios: 'números', articulo: 'lo' }

export function formatoDeTiempo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const resto = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${resto}` : `${m}:${resto}`
}

/** Lives left as hearts (Phase 90): full for each left, outlined for each lost. */
export function Vidas({ quedan, de }: { quedan: number; de: number }) {
  return (
    <span className="mt-0.5 flex gap-0.5" aria-label={`${quedan} de ${de} vidas`}>
      {Array.from({ length: de }, (_, i) => (
        <Heart
          key={`${i}-${i < quedan}`}
          className={cn(
            'size-3.5',
            i < quedan ? 'fill-red-500 text-red-500' : 'text-muted-foreground/50 palabras-cae',
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}

export function CuentaAtras({ restan }: { restan: number }) {
  const n = Math.max(1, Math.ceil(restan / 1000))
  return (
    <div className="bg-background/85 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
      <span className="text-muted-foreground text-sm">Todos parten a la vez</span>
      <span key={n} className="animate-in zoom-in-50 fade-in text-7xl font-bold tabular-nums">
        {n}
      </span>
    </div>
  )
}

/** Each rival: how far, their total of tries, and their tries' public half. */
export function Rivales<I extends IntentoBase, M>({
  vista,
  nombres,
  marcas,
}: {
  vista: VistaCarrera<I, M>
  nombres: ReadonlyMap<number, string>
  /** How a rival's tries on their secret in play look, without what was guessed. */
  marcas: (rival: VistaDeRivalEn<I, M>) => ReactNode
}) {
  if (vista.rivales.length === 0) return null
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1">
      {vista.rivales.map((rival) => {
        const conTiempo = vista.modo === 'tiempo'
        const llego = conTiempo ? rival.termino : rival.tiempo !== null
        return (
          <li
            key={rival.asiento}
            className={cn(
              'bg-card flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5',
              rival.retirado && 'opacity-40',
            )}
          >
            <span className="flex flex-col leading-tight">
              <span className="max-w-24 truncate text-xs font-medium">
                {nombres.get(rival.asiento) ?? '—'}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {conTiempo
                  ? `${rival.acertadas} ✓${llego ? ' · fuera' : ` · va en ${rival.terminadas + 1}`}${rival.vidas !== null ? ` · ♥${rival.vidas}` : ''}`
                  : llego
                    ? `llegó · ${formatoDeTiempo(rival.tiempo!)}`
                    : `${Math.min(rival.terminadas + 1, vista.total)}/${vista.total}`}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {rival.intentos} {rival.intentos === 1 ? 'intento' : 'intentos'}
              </span>
            </span>
            {!llego && marcas(rival)}
          </li>
        )
      })}
    </ul>
  )
}

/** Your race is over: your time or your count, and the finish table. */
export function Llegada<I extends IntentoBase, M>({
  vista,
  nombres,
  soyHost,
  terminada,
  onCerrar,
  Mini,
  sustantivo,
  anchoDeColumna,
}: {
  vista: VistaCarrera<I, M>
  nombres: ReadonlyMap<number, string>
  soyHost: boolean
  /** The race is over for everyone — closed, or (against the clock) the time is up. */
  terminada: boolean
  onCerrar: () => void
  Mini: MiniIntentos<I>
  sustantivo: Sustantivo
  anchoDeColumna?: number
}) {
  const propio = vista.propio!
  const conTiempo = vista.modo === 'tiempo'
  const fallos = propio.terminadas.filter((p) => !p.acertada).length
  const resueltas = propio.terminadas.length - fallos
  const faltan = vista.clasificacion.filter((p) => !p.termino && !p.retirado).length
  const ganador = vista.clasificacion[0]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        {terminada && ganador ? (
          <>
            <Trophy className="size-7" aria-hidden />
            <h2 className="text-2xl font-semibold">
              {ganador.asiento === propio.asiento
                ? '¡Ganaste!'
                : `Ganó ${nombres.get(ganador.asiento) ?? '—'}`}
            </h2>
          </>
        ) : (
          <h2 className="text-2xl font-semibold">
            {propio.vidas === 0 ? 'Te quedaste sin vidas' : 'Terminaste'}
          </h2>
        )}
        {conTiempo ? (
          <p className="text-muted-foreground text-sm">
            Resolviste{' '}
            <span className="text-foreground font-semibold">
              {resueltas} {resueltas === 1 ? sustantivo.uno : sustantivo.varios}
            </span>
            {fallos > 0 && ` · ${fallos} sin adivinar`}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Tu tiempo: <span className="text-foreground font-mono">{formatoDeTiempo(propio.tiempo ?? 0)}</span>
            {fallos > 0 &&
              ` · ${fallos} sin adivinar${vista.msCastigo ? ` (+${formatoDeTiempo(fallos * vista.msCastigo)})` : ''}`}
          </p>
        )}
        {!terminada && faltan > 0 && (
          <p className="text-muted-foreground text-sm">
            {conTiempo
              ? 'Los demás siguen hasta que se acabe el tiempo.'
              : faltan === 1
                ? 'Falta uno por llegar.'
                : `Faltan ${faltan} por llegar.`}
          </p>
        )}
      </div>

      <TablaDeLlegada
        vista={vista}
        nombres={nombres}
        formatoDeTiempo={formatoDeTiempo}
        Mini={Mini}
        rotulo={sustantivo.uno[0].toUpperCase() + sustantivo.uno.slice(1)}
        articulo={sustantivo.articulo}
        plural={sustantivo.varios}
        ancho={anchoDeColumna}
      />

      {soyHost && !terminada && faltan > 0 && (
        <button
          type="button"
          onClick={onCerrar}
          className="border-input hover:bg-accent rounded-md border px-4 py-2.5 text-sm"
        >
          Cerrar la carrera ahora
        </button>
      )}
    </div>
  )
}
