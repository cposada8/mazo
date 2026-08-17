/**
 * The scoreboard: what each ronda cost each player, and where that leaves them.
 *
 * Shared by the game you play and the one you watch, because it is the same
 * table either way.
 */

import { type PartidaState } from '@/lib/engine'
import { cn } from '@/lib/utils'

export function Marcador({
  partida,
  nombres,
  className,
  destacar,
  siguiente,
}: {
  partida: PartidaState
  nombres: readonly string[]
  className?: string
  /** Index into the historial of the ronda to pick out — the one just played. */
  destacar?: number
  /** The ronda in `partida` has not started yet: it is what comes next. */
  siguiente?: boolean
}) {
  const jugadores = partida.totales.length
  const menor = Math.min(...partida.totales)

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-1 pr-3 font-medium">Ronda</th>
              {Array.from({ length: jugadores }, (_, seat) => (
                <th key={seat} className="py-1 pl-3 text-right font-medium">
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
                {marcador.puntos.map((puntos, seat) => (
                  <td
                    key={seat}
                    className={cn(
                      'py-1 pl-3 text-right tabular-nums',
                      seat === marcador.ganador && 'text-foreground font-semibold',
                    )}
                  >
                    {seat === marcador.ganador && (
                      <span aria-label="ganó la ronda" className="mr-1">
                        🏆
                      </span>
                    )}
                    {puntos}
                  </td>
                ))}
              </tr>
            ))}

            {partida.ronda && (
              <tr className="border-t">
                <td className="text-muted-foreground py-1 pr-3 italic">
                  {partida.ronda.contrato.nombre} · {siguiente ? 'sigue' : 'en juego'}
                </td>
                {Array.from({ length: jugadores }, (_, seat) => (
                  <td key={seat} className="text-muted-foreground py-1 pl-3 text-right">
                    —
                  </td>
                ))}
              </tr>
            )}

            <tr className="border-t-2 font-semibold">
              <td className="py-1 pr-3">Total</td>
              {partida.totales.map((total, seat) => (
                <td
                  key={seat}
                  className={cn(
                    'py-1 pl-3 text-right tabular-nums',
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
