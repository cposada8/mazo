/**
 * The scoreboard: what each ronda cost each player, and where that leaves them.
 *
 * Shared by the game you play and the one you watch, because it is the same
 * table either way.
 *
 * The columns go in standing order (Phase 49): whoever is winning — fewest
 * points — first, ties kept in seat order, so third place is the third
 * column. The seat that is looking gets its column picked out.
 */

import { type VistaDePartida } from '@/lib/engine'
import { cn } from '@/lib/utils'

export function Marcador({
  partida,
  nombres,
  className,
  destacar,
  siguiente,
  yo,
}: {
  partida: VistaDePartida
  nombres: readonly string[]
  className?: string
  /** Index into the historial of the ronda to pick out — the one just played. */
  destacar?: number
  /** The ronda in `partida` has not started yet: it is what comes next. */
  siguiente?: boolean
  /** The seat looking at the table, whose column is picked out. */
  yo?: number
}) {
  const menor = Math.min(...partida.totales)
  const columnas = columnasPorPuesto(partida.totales)
  const jugado = partida.historial.length > 0
  const mia = (seat: number) =>
    seat === yo && 'bg-amber-400/15 dark:bg-amber-300/10'

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-1 pr-3 font-medium">Ronda</th>
              {columnas.map(({ seat, puesto }) => (
                <th
                  key={seat}
                  aria-current={seat === yo ? 'true' : undefined}
                  className={cn(
                    'rounded-t-md py-1 pr-1 pl-3 text-right align-bottom font-medium',
                    mia(seat),
                    seat === yo && 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  {jugado && (
                    <span className="block text-[10px] font-normal tabular-nums opacity-80">
                      {puesto}°
                    </span>
                  )}
                  {nombres[seat] ?? `J${seat + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partida.historial.map((marcador, index) => (
              <tr
                key={index}
                className={cn('border-t', index === destacar && 'bg-accent')}
              >
                <td className="text-muted-foreground py-1 pr-3">
                  {marcador.contrato.nombre}
                </td>
                {columnas.map(({ seat }) => (
                  <td
                    key={seat}
                    className={cn(
                      'py-1 pr-1 pl-3 text-right tabular-nums',
                      mia(seat),
                      seat === marcador.ganador && 'text-foreground font-semibold',
                    )}
                  >
                    {seat === marcador.ganador && (
                      <span aria-label="ganó la ronda" className="mr-1">
                        🏆
                      </span>
                    )}
                    {marcador.puntos[seat]}
                  </td>
                ))}
              </tr>
            ))}

            {partida.ronda && (
              <tr className="border-t">
                <td className="text-muted-foreground py-1 pr-3 italic">
                  {partida.ronda.contrato.nombre} · {siguiente ? 'sigue' : 'en juego'}
                </td>
                {columnas.map(({ seat }) => (
                  <td
                    key={seat}
                    className={cn('text-muted-foreground py-1 pr-1 pl-3 text-right', mia(seat))}
                  >
                    —
                  </td>
                ))}
              </tr>
            )}

            <tr className="border-t-2 font-semibold">
              <td className="py-1 pr-3">Total</td>
              {columnas.map(({ seat, total }) => (
                <td
                  key={seat}
                  className={cn(
                    'rounded-b-md py-1 pr-1 pl-3 text-right tabular-nums',
                    mia(seat),
                    total === menor && 'text-emerald-700 dark:text-emerald-400',
                  )}
                >
                  {total}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {partida.historial.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Todavía no termina ninguna ronda. Gana quien tenga menos puntos al final.
        </p>
      )}
    </section>
  )
}

/**
 * The seats in standing order: fewest points first, ties in seat order. Tied
 * seats share a puesto, and the next one skips past them (1°, 1°, 3°).
 */
export function columnasPorPuesto(
  totales: readonly number[],
): { seat: number; total: number; puesto: number }[] {
  const orden = totales
    .map((total, seat) => ({ seat, total }))
    .sort((a, b) => a.total - b.total || a.seat - b.seat)
  return orden.map((columna) => ({
    ...columna,
    puesto: 1 + orden.filter((otra) => otra.total < columna.total).length,
  }))
}
