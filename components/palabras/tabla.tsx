'use client'

/**
 * The finish table (Phase 92, the owner, 2026-11-15): laid out like
 * Carioca's scoreboard. Players are the columns in standing order — whoever
 * won by the race's rule first — and the words are the rows. Each cell says
 * how that player did on that word; touching a row opens everyone's tries on
 * it, side by side under their columns. Many players scroll sideways; the
 * word column stays put. Your own column is picked out, as in Carioca.
 */

import { ChevronDown } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { Color, Intento, VistaPalabras } from '@/lib/engine/palabras'
import { cn } from '@/lib/utils'
import { tablaDeLlegada } from './tabla-datos'

const VALOR: Record<Color, string> = {
  verde: 'oklch(0.6 0.12 148)',
  amarillo: 'oklch(0.72 0.13 88)',
  gris: 'oklch(0.45 0 0)',
}

export function TablaDeLlegada({
  vista,
  nombres,
  formatoDeTiempo,
}: {
  vista: VistaPalabras
  nombres: ReadonlyMap<number, string>
  formatoDeTiempo: (ms: number) => string
}) {
  const { columnas, filas } = tablaDeLlegada(vista)
  const [abierta, setAbierta] = useState<number | null>(null)
  const yo = vista.propio?.asiento
  const conTiempo = vista.modo === 'tiempo'
  const mia = (asiento: number) => asiento === yo && 'bg-amber-400/15 dark:bg-amber-300/10'
  // Wide enough for a row of small tiles under each name.
  const anchoDeColumna = `${Math.max(5.5, vista.largo * 1.35 + 0.75)}rem`
  // The word column stays put while the players scroll past it.
  const fija = 'bg-background sticky left-0 z-10'

  return (
    <section className="flex flex-col gap-2">
      {/* Edge to edge on a phone: the fixed word column carries the left
          gutter itself, so nothing scrolling under it shows beside it. */}
      <div className="-mx-4 overflow-x-auto">
        <table className="mr-4 border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th className={cn(fija, 'py-1 pr-3 pl-4 text-left align-bottom font-medium')}>
                Palabra
              </th>
              {columnas.map(({ asiento, puesto }) => (
                <th
                  key={asiento}
                  aria-current={asiento === yo ? 'true' : undefined}
                  style={{ minWidth: anchoDeColumna }}
                  className={cn(
                    'rounded-t-md px-2 py-1 text-center align-bottom font-medium',
                    mia(asiento),
                    asiento === yo && 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  <span className="block text-[10px] font-normal tabular-nums opacity-80">
                    {puesto.lugar}°
                  </span>
                  <span className="block max-w-28 truncate">
                    {asiento === yo ? 'Tú' : (nombres.get(asiento) ?? '—')}
                  </span>
                  <span className="text-foreground block text-xs font-semibold tabular-nums">
                    {conTiempo
                      ? `${puesto.acertadas} ${puesto.acertadas === 1 ? 'palabra' : 'palabras'}`
                      : puesto.tiempo !== null
                        ? formatoDeTiempo(puesto.tiempo)
                        : puesto.retirado
                          ? 'salió'
                          : `${puesto.acertadas}/${vista.total}`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const abiertaAqui = abierta === fila.indice
              return (
                <Fragment key={fila.indice}>
                  <tr
                    onClick={() => setAbierta(abiertaAqui ? null : fila.indice)}
                    aria-expanded={abiertaAqui}
                    className="hover:bg-accent/60 cursor-pointer"
                  >
                    <td className={cn(fija, 'border-t py-2 pr-3 pl-4')}>
                      <span className="flex items-center gap-1.5 font-mono text-xs tracking-wider whitespace-nowrap">
                        <span className="text-muted-foreground w-5 text-right tabular-nums">
                          {fila.indice + 1}
                        </span>
                        {fila.palabra}
                        <ChevronDown
                          className={cn(
                            'text-muted-foreground size-3.5 transition-transform',
                            abiertaAqui && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </span>
                    </td>
                    {fila.celdas.map((celda, i) => (
                      <td
                        key={columnas[i].asiento}
                        className={cn(
                          'border-t px-2 py-2 text-center text-xs tabular-nums',
                          mia(columnas[i].asiento),
                        )}
                      >
                        {celda === null ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : celda.sinTerminar ? (
                          <span
                            className="font-semibold text-amber-700 dark:text-amber-400"
                            title="Sin terminar: se acabó la carrera"
                          >
                            ⏱ {celda.intentos.length}
                          </span>
                        ) : celda.acertada ? (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            ✓ {celda.intentos.length}
                          </span>
                        ) : (
                          <span className="font-semibold text-red-600 dark:text-red-400">✗</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {abiertaAqui && (
                    <tr>
                      <td className={cn(fija, 'pb-3 pl-4')} />
                      {fila.celdas.map((celda, i) => (
                        <td
                          key={columnas[i].asiento}
                          className={cn('px-2 pb-3 align-top', mia(columnas[i].asiento))}
                        >
                          {celda ? (
                            <>
                              <MiniGrilla intentos={celda.intentos} />
                              {celda.sinTerminar && (
                                <p className="pt-1 text-center text-[11px] text-amber-700 dark:text-amber-400">
                                  sin terminar
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground pt-1 text-center text-[11px]">
                              No llegó
                            </p>
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {filas.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nadie terminó ninguna palabra.</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          ✓ la adivinó · ✗ no la adivinó
          {filas.some((f) => f.celdas.some((c) => c?.sinTerminar)) &&
            ' · ⏱ iba en ella cuando se acabó'}
          . Toca una palabra para ver los intentos de todos.
          {columnas.length > 2 && ' Desliza hacia la derecha para ver a los demás.'}
        </p>
      )}
    </section>
  )
}

/** A word's tries, small: letters and colours, as they were played. */
function MiniGrilla({ intentos }: { intentos: readonly Intento[] }) {
  return (
    <div className="animate-in fade-in flex flex-col items-center gap-0.5">
      {intentos.map((intento, f) => (
        <div key={f} className="flex gap-0.5">
          {[...intento.palabra].map((letra, i) => (
            <span
              key={i}
              className="flex size-5 items-center justify-center rounded-[3px] text-[10px] font-bold text-white"
              style={{ background: VALOR[intento.colores[i]] }}
            >
              {letra}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
