'use client'

/**
 * The panel, drawn (Phase 44).
 *
 * Two questions per row, and the layout exists to answer them at a glance:
 * *is anybody there?* and *should this still be open?* Everything else — the
 * code, the ages, who is a bot — is detail underneath them.
 */

import { useActionState } from 'react'
import type { PartidaDelPanel } from '@/lib/server/panel'
import { cn } from '@/lib/utils'
import { barrerAhora, cerrar, entrar, limpiarTerminadas, salir } from './acciones'

/** Somebody heard from this recently is somebody who is still at the table. */
const MINUTOS_PRESENTE = 2

export function Entrada() {
  const [error, accion, enviando] = useActionState(entrar, null)

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Partidas abiertas</h1>
        <p className="text-muted-foreground text-sm">
          Para ver y cerrar las mesas que siguen abiertas.
        </p>
      </div>
      <form action={accion} className="flex flex-col gap-2">
        <input
          type="password"
          name="clave"
          autoFocus
          autoComplete="off"
          placeholder="Clave"
          aria-label="Clave del panel"
          className="bg-card rounded-md border px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={enviando}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          Entrar
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </main>
  )
}

export function Panel({
  partidas,
  ahora,
}: {
  partidas: readonly PartidaDelPanel[]
  /** Stamped on the server so the ages do not disagree between the two. */
  ahora: number
}) {
  const abiertas = partidas.filter((p) => p.fase !== 'terminada')
  const terminadas = partidas.length - abiertas.length

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Partidas abiertas{' '}
          <span className="text-muted-foreground font-normal tabular-nums">
            {abiertas.length}
          </span>
        </h1>
        <div className="flex items-center gap-2 text-xs">
          <form action={barrerAhora}>
            <button type="submit" className="bg-card hover:bg-accent rounded-md border px-2.5 py-1.5">
              Barrer ahora
            </button>
          </form>
          {terminadas > 0 && (
            <form action={limpiarTerminadas}>
              <button type="submit" className="bg-card hover:bg-accent rounded-md border px-2.5 py-1.5">
                Borrar {terminadas} terminada{terminadas === 1 ? '' : 's'}
              </button>
            </form>
          )}
          <form action={salir}>
            <button type="submit" className="text-muted-foreground underline">
              Salir
            </button>
          </form>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Una mesa sin gente se cierra sola, y una en silencio por un día se
        cierra cuando alguien abre la puerta. Esto es para verlas, y para las
        excepciones.
      </p>

      {partidas.length === 0 ? (
        <p className="text-muted-foreground py-8 text-sm">No hay ninguna.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {partidas.map((partida) => (
            <Fila key={partida.codigo} partida={partida} ahora={ahora} />
          ))}
        </ul>
      )}
    </main>
  )
}

function Fila({ partida, ahora }: { partida: PartidaDelPanel; ahora: number }) {
  const gente = partida.asientos.filter((a) => !a.esBot && !a.retirado)
  const presentes = gente.filter(
    (a) => a.ultimaSenal !== null && ahora - a.ultimaSenal < MINUTOS_PRESENTE * 60_000,
  )
  const bots = partida.asientos.filter((a) => a.esBot).length
  const cerrada = partida.fase === 'terminada'

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3',
        cerrada && 'opacity-50',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-sm font-medium">{partida.codigo}</span>
          <span className="text-muted-foreground text-xs">{partida.fase}</span>
          {partida.reparto !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              reparto {partida.reparto}/{partida.repartos}
            </span>
          )}
          {/* The one thing worth colouring: whether anybody is actually
              there. A table moves because a bot's time ran out, which is no
              evidence of a person at all. */}
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs',
              presentes.length > 0
                ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {presentes.length > 0
              ? `${presentes.length} en la mesa`
              : gente.length > 0
                ? 'nadie conectado'
                : 'sin gente'}
          </span>
        </div>

        <p className="text-muted-foreground truncate text-xs">
          {partida.asientos
            .map(
              (asiento) =>
                `${asiento.alias}${asiento.esBot ? ' (bot)' : ''}${
                  asiento.retirado ? ' — se fue' : ''
                }`,
            )
            .join(' · ') || 'sin asientos'}
          {bots > 0 && gente.length === 0 && ' — solo bots'}
        </p>

        <p className="text-muted-foreground text-xs tabular-nums">
          creada {hace(ahora - partida.creadaEn)} · movida{' '}
          {hace(ahora - partida.actualizadaEn)} · última señal{' '}
          {partida.ultimaSenal === null ? 'nunca' : hace(ahora - partida.ultimaSenal)}
        </p>
      </div>

      {!cerrada && (
        <form action={cerrar}>
          <input type="hidden" name="codigo" value={partida.codigo} />
          <button
            type="submit"
            className="bg-card hover:bg-accent rounded-md border px-3 py-1.5 text-xs"
          >
            Cerrar
          </button>
        </form>
      )}
    </li>
  )
}

/** An age a person reads: minutes, then hours, then days. */
function hace(ms: number): string {
  const minutos = Math.floor(ms / 60_000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} días`
}
