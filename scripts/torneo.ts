/**
 * The bench from the command line (Phase 53).
 *
 *   npm run torneo                                   # every bot, 4 seats, 400 partidas
 *   npm run torneo -- --bots codicioso,paciente      # just these, rotated
 *   npm run torneo -- --partidas 1000 --asientos 3
 *   npm run torneo -- --estricta --sin-comodines --semilla otra
 *
 * Same options, same numbers: the partidas are seeded.
 */

import { parseArgs } from 'node:util'
import { BOTS, botPorId, jugarTorneo } from '@/lib/bots'
import { CONFIG_POR_DEFECTO, type PartidaConfig } from '@/lib/engine'

const { values } = parseArgs({
  options: {
    bots: { type: 'string' },
    partidas: { type: 'string', default: '400' },
    asientos: { type: 'string', default: '4' },
    semilla: { type: 'string', default: 'torneo' },
    estricta: { type: 'boolean', default: false },
    'sin-comodines': { type: 'boolean', default: false },
  },
})

const ids = values.bots?.split(',').map((id) => id.trim()).filter(Boolean)
for (const id of ids ?? []) {
  if (!BOTS.some((bot) => bot.id === id)) {
    console.error(`No hay un bot «${id}». Los que hay: ${BOTS.map((bot) => bot.id).join(', ')}`)
    process.exit(1)
  }
}
const bots = ids ? ids.map((id) => botPorId(id)) : BOTS

const config: PartidaConfig = {
  ...CONFIG_POR_DEFECTO,
  comodines: !values['sin-comodines'],
  bajada: values.estricta ? 'estricta' : 'libre',
}

const partidas = Number(values.partidas)
const asientos = Number(values.asientos)

const inicio = performance.now()
const reporte = jugarTorneo({ bots, partidas, asientos, semilla: values.semilla!, config })
const segundos = ((performance.now() - inicio) / 1000).toFixed(1)

console.log(
  `\n${reporte.terminadas}/${reporte.partidas} partidas terminadas · ${asientos} asientos · ` +
    `bajada ${config.bajada} · ${config.comodines ? 'con' : 'sin'} comodines · ${segundos}s\n`,
)
console.table(
  [...reporte.bots]
    .sort((a, b) => b.tasaDeVictoria - a.tasaDeVictoria)
    .map((bot) => ({
      bot: bot.nombre,
      asientos: bot.asientos,
      victorias: Number(bot.victorias.toFixed(1)),
      '% victoria': `${(bot.tasaDeVictoria * 100).toFixed(1)}%`,
      'puntos/asiento': Math.round(bot.puntosPorAsiento),
      'rondas ganadas': bot.rondasGanadas,
      'turno de bajada': bot.turnoDeBajada?.toFixed(1) ?? '—',
    })),
)
console.log(`Parte justa por asiento: ${((1 / asientos) * 100).toFixed(1)}%`)

if (reporte.faltas.length === 0) {
  console.log('Faltas: ninguna.\n')
} else {
  const porTipo = new Map<string, number>()
  for (const falta of reporte.faltas) porTipo.set(falta.tipo, (porTipo.get(falta.tipo) ?? 0) + 1)
  console.log('Faltas:', Object.fromEntries(porTipo))
  for (const falta of reporte.faltas.slice(0, 10)) console.log('  ', JSON.stringify(falta))
  console.log()
  process.exitCode = 1
}
