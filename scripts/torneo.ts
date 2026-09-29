/**
 * The bench from the command line (Phase 53).
 *
 *   npm run torneo                                   # every bot, 4 seats, 400 partidas
 *   npm run torneo -- --bots codicioso,paciente      # just these, rotated
 *   npm run torneo -- --partidas 1000 --asientos 3
 *   npm run torneo -- --estricta --sin-comodines --semilla otra
 *   npm run torneo -- --bots calculador,calculador-sin-memoria
 *   npm run torneo -- --bots tahur,calculador --hilos 11   # split across processes
 *
 * Same options, same numbers: the partidas are seeded.
 */

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import {
  BOTS,
  type Reporte,
  botPorId,
  jugarTorneo,
  sinMemoria,
  unirReportes,
} from "@/lib/bots";
import { CONFIG_POR_DEFECTO, type PartidaConfig } from "@/lib/engine";

const { values } = parseArgs({
  options: {
    bots: { type: "string" },
    partidas: { type: "string", default: "400" },
    asientos: { type: "string", default: "4" },
    semilla: { type: "string", default: "torneo" },
    estricta: { type: "boolean", default: false },
    "sin-comodines": { type: "boolean", default: false },
    /** Processes to split the partidas across; the numbers do not change. */
    hilos: { type: "string", default: "1" },
    // Internal: one slice, run by a parent that splits the work.
    desde: { type: "string" },
    json: { type: "boolean", default: false },
  },
});

// `calculador-sin-memoria` is El Calculador fed no relatos (Phase 55).
const SUFIJO = "-sin-memoria";
const ids = values.bots
  ?.split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const base = (id: string) =>
  id.endsWith(SUFIJO) ? id.slice(0, -SUFIJO.length) : id;
for (const id of (ids ?? []).map(base)) {
  if (!BOTS.some((bot) => bot.id === id)) {
    console.error(
      `No hay un bot «${id}». Los que hay: ${BOTS.map((bot) => bot.id).join(", ")}`,
    );
    process.exit(1);
  }
}
const bots = ids
  ? ids.map((id) =>
      id.endsWith(SUFIJO) ? sinMemoria(botPorId(base(id))) : botPorId(id),
    )
  : BOTS;

const config: PartidaConfig = {
  ...CONFIG_POR_DEFECTO,
  comodines: !values["sin-comodines"],
  bajada: values.estricta ? "estricta" : "libre",
};

const partidas = Number(values.partidas);
const asientos = Number(values.asientos);

const hilos = Math.max(1, Math.min(Number(values.hilos), partidas));

/** One slice in a child process: the same script, asked for JSON. */
function tajada(desde: number, cuantas: number): Promise<Reporte> {
  const argumentos = process.argv
    .slice(2)
    .filter(
      (_, i, todos) =>
        !["--hilos", "--partidas"].includes(todos[i]) &&
        !["--hilos", "--partidas"].includes(todos[i - 1]),
    );
  return new Promise((resolve, reject) => {
    const hijo = spawn(
      process.execPath,
      [
        ...process.execArgv,
        process.argv[1],
        ...argumentos,
        "--partidas",
        String(cuantas),
        "--desde",
        String(desde),
        "--json",
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let salida = "";
    hijo.stdout.on("data", (trozo) => (salida += trozo));
    hijo.on("close", () => {
      try {
        resolve(JSON.parse(salida) as Reporte);
      } catch (error) {
        reject(error);
      }
    });
  });
}

const inicio = performance.now();
const semilla = values.semilla!;

if (values.json) {
  const desde = Number(values.desde ?? 0);
  process.stdout.write(
    JSON.stringify(
      jugarTorneo({ bots, partidas, asientos, semilla, config, desde }),
    ),
  );
  process.exit(0);
}

async function principal() {
  const reporte =
    hilos === 1
      ? jugarTorneo({ bots, partidas, asientos, semilla, config })
      : unirReportes(
          await Promise.all(
            Array.from({ length: hilos }, (_, h) => {
              const desde = Math.floor((partidas * h) / hilos);
              const hasta = Math.floor((partidas * (h + 1)) / hilos);
              return tajada(desde, hasta - desde);
            }),
          ),
        );
  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);

  console.log(
    `\n${reporte.terminadas}/${reporte.partidas} partidas terminadas · ${asientos} asientos · ` +
      `bajada ${config.bajada} · ${config.comodines ? "con" : "sin"} comodines · ${segundos}s\n`,
  );
  console.table(
    [...reporte.bots]
      .sort((a, b) => b.tasaDeVictoria - a.tasaDeVictoria)
      .map((bot) => ({
        bot: bot.nombre,
        asientos: bot.asientos,
        victorias: Number(bot.victorias.toFixed(1)),
        "% victoria": `${(bot.tasaDeVictoria * 100).toFixed(1)}%`,
        "puntos/asiento": Math.round(bot.puntosPorAsiento),
        "rondas ganadas": bot.rondasGanadas,
        "turno de bajada": bot.turnoDeBajada?.toFixed(1) ?? "—",
      })),
  );
  console.log(`Parte justa por asiento: ${((1 / asientos) * 100).toFixed(1)}%`);

  if (reporte.faltas.length === 0) {
    console.log("Faltas: ninguna.\n");
  } else {
    const porTipo = new Map<string, number>();
    for (const falta of reporte.faltas)
      porTipo.set(falta.tipo, (porTipo.get(falta.tipo) ?? 0) + 1);
    console.log("Faltas:", Object.fromEntries(porTipo));
    for (const falta of reporte.faltas.slice(0, 10))
      console.log("  ", JSON.stringify(falta));
    console.log();
    process.exitCode = 1;
  }
}

void principal();
