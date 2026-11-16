'use client'

/**
 * The Palabras board (Phase 85): the grid of the word in play, the keyboard
 * with Ñ, the clock, and the rivals as coloured squares.
 *
 * Told in beats, in the table's animation language: a letter lands as it is
 * typed; a try turns over one tile at a time and only then shows its colours;
 * a refused try shakes; a solved row jumps; a missed word is revealed; then
 * the next board comes in.
 *
 * It holds no answer and could not: everything it draws comes from this
 * player's view, which the server built.
 */

import { Crown, Delete, LogOut, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Color,
  Intento,
  PalabraTerminada,
  Puesto,
  VistaPalabras,
} from '@/lib/engine/palabras'
import {
  INTENTOS_POR_PALABRA,
  MS_CASTIGO,
} from '@/lib/engine/palabras/opciones'
import { cn } from '@/lib/utils'
import {
  type Escritura,
  borrar,
  completa,
  escribir,
  escrituraVacia,
  mover,
  palabraDe,
} from './escritura'

/** One tile turning over. */
const MS_POR_FICHA = 260
/** How long an ended word stays on screen before the next one comes in. */
const MS_FIN_DE_PALABRA = 1_700

const FILAS_DE_TECLADO = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'] as const

const FONDO: Record<Color, string> = {
  verde: 'bg-[oklch(0.6_0.12_148)] border-[oklch(0.6_0.12_148)] text-white',
  amarillo: 'bg-[oklch(0.72_0.13_88)] border-[oklch(0.72_0.13_88)] text-white',
  gris: 'bg-[oklch(0.45_0_0)] border-[oklch(0.45_0_0)] text-white',
}
const VALOR: Record<Color, string> = {
  verde: 'oklch(0.6 0.12 148)',
  amarillo: 'oklch(0.72 0.13 88)',
  gris: 'oklch(0.45 0 0)',
}
const RANGO: Record<Color, number> = { gris: 0, amarillo: 1, verde: 2 }

/**
 * The keyboard's own colours (the owner, 2026-11-15): a key not tried yet is
 * grey, a letter tried and not in the word goes black — in both themes.
 */
const TECLA_SIN_USAR = 'bg-[oklch(0.45_0_0)] text-white hover:bg-[oklch(0.5_0_0)]'
const TECLA: Record<Color, string> = {
  verde: FONDO.verde,
  amarillo: FONDO.amarillo,
  gris: 'bg-[oklch(0.22_0_0)] text-white',
}

export function formatoDeTiempo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const resto = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${resto}` : `${m}:${resto}`
}

export type PropsDeTablero = {
  vista: VistaPalabras
  nombres: ReadonlyMap<number, string>
  soyHost: boolean
  enviando: boolean
  error: { texto: string; code: string; vez: number } | null
  /** The server's clock. */
  ahora: () => number
  onEnviar: (palabra: string) => Promise<unknown>
  onCerrar: () => void
  onSalir: () => void
}

export function TableroPalabras({
  vista,
  nombres,
  soyHost,
  enviando,
  error,
  ahora,
  onEnviar,
  onCerrar,
  onSalir,
}: PropsDeTablero) {
  const { largo, total } = vista
  const propio = vista.propio
  const [escritura, setEscritura] = useState<Escritura>(() => escrituraVacia(vista.largo))
  const [sacudir, setSacudir] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  /** The row this phone just sent, turning over. */
  const [volteando, setVolteando] = useState<number | null>(null)
  /** A word that just ended, held on screen for a moment. */
  const [cierre, setCierre] = useState<PalabraTerminada | null>(null)
  const [tic, setTic] = useState(() => ({ reloj: ahora(), local: Date.now() }))
  const reloj = tic.reloj

  useEffect(() => {
    const id = setInterval(() => setTic({ reloj: ahora(), local: Date.now() }), 250)
    return () => clearInterval(id)
  }, [ahora])

  // A refusal from the server shakes the row and says why, briefly.
  const avisoDelServidor = error && tic.local - error.vez < 1800 ? error.texto : null
  const sacudida = `${sacudir}-${error?.vez ?? 0}`
  const haySacudida = sacudir > 0 || error !== null

  const empezo = reloj >= vista.inicio
  const termine = propio?.terminoEn !== null && propio?.terminoEn !== undefined
  const ocupado = enviando || volteando !== null || cierre !== null
  const puedeEscribir = Boolean(propio) && empezo && !termine && !vista.cerrada && !ocupado

  // What the grid shows: the word just ended while it is held, else the word in play.
  const intentos = useMemo<readonly Intento[]>(
    () => (cierre ? cierre.intentos : (propio?.intentos ?? [])),
    [cierre, propio?.intentos],
  )
  const numeroDePalabra = Math.min(
    (propio?.terminadas.length ?? 0) + (cierre ? 0 : 1),
    total,
  )

  // The keyboard knows, per letter, the best colour earned on this word.
  const colorDeTecla = useMemo(() => {
    const mapa = new Map<string, Color>()
    const hasta = volteando !== null ? volteando : intentos.length
    for (const intento of intentos.slice(0, hasta)) {
      ;[...intento.palabra].forEach((letra, i) => {
        const color = intento.colores[i]
        const antes = mapa.get(letra)
        if (!antes || RANGO[color] > RANGO[antes]) mapa.set(letra, color)
      })
    }
    return mapa
  }, [intentos, volteando])

  const enviar = useCallback(async () => {
    if (!puedeEscribir || !propio) return
    if (!completa(escritura)) {
      setSacudir((n) => n + 1)
      setAviso('Faltan letras.')
      setTimeout(() => setAviso(null), 1400)
      return
    }
    const fila = propio.intentos.length
    const antes = propio.terminadas.length
    const respuesta = (await onEnviar(palabraDe(escritura)).catch(() => null)) as
      | { ok: true; mesa: { vista: VistaPalabras } }
      | { ok: false }
      | null
    if (!respuesta?.ok) return
    setEscritura(escrituraVacia(largo))
    const despues = respuesta.mesa.vista.propio
    const terminada =
      despues && despues.terminadas.length > antes ? despues.terminadas[antes] : null
    if (terminada) setCierre(terminada)
    setVolteando(fila)
    setTimeout(() => setVolteando(null), largo * MS_POR_FICHA + 350)
    if (terminada) {
      setTimeout(() => setCierre(null), largo * MS_POR_FICHA + 350 + MS_FIN_DE_PALABRA)
    }
  }, [puedeEscribir, propio, escritura, largo, onEnviar])

  const tecla = useCallback(
    (valor: string) => {
      if (!puedeEscribir) return
      if (valor === 'ENVIAR') return void enviar()
      if (valor === 'BORRAR') return setEscritura(borrar)
      if (valor === 'IZQUIERDA') return setEscritura((e) => mover(e, e.cursor - 1))
      if (valor === 'DERECHA') return setEscritura((e) => mover(e, e.cursor + 1))
      setEscritura((e) => escribir(e, valor))
    },
    [puedeEscribir, enviar],
  )

  // A computer's keyboard too.
  const teclaRef = useRef(tecla)
  useEffect(() => {
    teclaRef.current = tecla
  }, [tecla])
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return
      if (evento.key === 'Enter') teclaRef.current('ENVIAR')
      else if (evento.key === 'Backspace') teclaRef.current('BORRAR')
      else if (evento.key === 'ArrowLeft') teclaRef.current('IZQUIERDA')
      else if (evento.key === 'ArrowRight') teclaRef.current('DERECHA')
      else {
        const letra = evento.key
          .toUpperCase()
          .normalize('NFD')
          .replace(/Ñ/g, 'Ñ')
          .replace(/[̀-ͯ]/g, '')
        if (/^[A-ZÑ]$/.test(letra)) teclaRef.current(letra)
        else return
      }
      evento.preventDefault()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  const tiempoPropio = propio
    ? propio.tiempo !== null
      ? propio.tiempo
      : Math.max(0, reloj - vista.inicio) +
        propio.terminadas.filter((p) => !p.acertada).length * MS_CASTIGO
    : 0
  const fallos = propio?.terminadas.filter((p) => !p.acertada).length ?? 0

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 pt-1 pb-3">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSalir}
          aria-label="Salir de la carrera"
          className="text-muted-foreground hover:text-foreground -ml-1 p-1"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-muted-foreground text-xs tracking-widest uppercase">Palabra</span>
          <span className="text-lg font-semibold tabular-nums">
            {numeroDePalabra}
            <span className="text-muted-foreground">/{total}</span>
          </span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="font-mono text-lg tabular-nums">{formatoDeTiempo(tiempoPropio)}</span>
          {fallos > 0 && (
            <span className="text-xs text-red-600 tabular-nums dark:text-red-400">
              +{formatoDeTiempo(fallos * MS_CASTIGO)} de castigo
            </span>
          )}
        </div>
      </header>

      <Rivales vista={vista} nombres={nombres} />

      <div className="relative flex flex-1 flex-col items-center justify-center">
        {!empezo && <CuentaAtras restan={vista.inicio - reloj} />}
        {termine && !cierre && volteando === null ? (
          <Llegada vista={vista} nombres={nombres} soyHost={soyHost} onCerrar={onCerrar} />
        ) : (
          <Grilla
            largo={largo}
            intentos={intentos}
            escritura={cierre ? null : escritura}
            conCursor={puedeEscribir}
            onTocar={(i) => setEscritura((e) => mover(e, i))}
            volteando={volteando}
            sacudida={haySacudida ? sacudida : null}
            cierre={cierre}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
          {(aviso ?? avisoDelServidor) && (
            <span className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium shadow">
              {aviso ?? avisoDelServidor}
            </span>
          )}
          {cierre && volteando === null && (
            <span
              className={cn(
                'animate-in fade-in zoom-in-95 rounded-md px-3 py-1.5 text-sm font-semibold shadow',
                cierre.acertada ? 'bg-foreground text-background' : 'bg-red-600 text-white',
              )}
            >
              {cierre.acertada
                ? ['¡Genial!', '¡Bien!', '¡Eso!', '¡Muy bien!', '¡Bien!', '¡Por poco!'][
                    cierre.intentos.length - 1
                  ]
                : `Era ${cierre.palabra} · +2:00`}
            </span>
          )}
        </div>
      </div>

      {!termine && (
        <Teclado colorDeTecla={colorDeTecla} activo={puedeEscribir} onTecla={tecla} />
      )}
    </main>
  )
}

function Grilla({
  largo,
  intentos,
  escritura,
  conCursor,
  onTocar,
  volteando,
  sacudida,
  cierre,
}: {
  largo: number
  intentos: readonly Intento[]
  /** The try being written; null while an ended word is held on screen. */
  escritura: Escritura | null
  /** Draw where the next letter goes — only while this player can write. */
  conCursor: boolean
  /** A tile of the row in play was touched: the next letter goes there. */
  onTocar: (indice: number) => void
  volteando: number | null
  /** Changes on every refusal, so the row shakes again; null before any. */
  sacudida: string | null
  cierre: PalabraTerminada | null
}) {
  // Tiles as big as fit: by width for long words, by height on a short phone.
  const ancho = `min(${largo * 62}px, calc(100vw - 32px), calc((100dvh - 430px) / ${INTENTOS_POR_PALABRA} * ${largo}))`
  const filaActual = cierre ? -1 : intentos.length

  return (
    <div
      className="grid gap-1.5"
      style={{ width: ancho, gridTemplateRows: `repeat(${INTENTOS_POR_PALABRA}, 1fr)` }}
    >
      {Array.from({ length: INTENTOS_POR_PALABRA }, (_, fila) => {
        const intento = intentos[fila]
        const esActual = fila === filaActual
        const gano =
          cierre?.acertada && fila === cierre.intentos.length - 1 && volteando === null
        return (
          <div
            key={esActual ? `actual-${sacudida}` : fila}
            className={cn('grid gap-1.5', esActual && sacudida && 'palabras-sacudir')}
            style={{ gridTemplateColumns: `repeat(${largo}, 1fr)` }}
          >
            {Array.from({ length: largo }, (_, i) => {
              const letra = intento
                ? [...intento.palabra][i]
                : esActual
                  ? (escritura?.letras[i] ?? undefined)
                  : undefined
              const color = intento?.colores[i]
              const voltea = intento && fila === volteando
              const tocable = esActual && !intento && escritura !== null
              const enCursor = tocable && conCursor && escritura.cursor === i
              const Ficha = tocable ? 'button' : 'div'
              return (
                <Ficha
                  key={i}
                  {...(tocable
                    ? {
                        type: 'button' as const,
                        onClick: () => onTocar(i),
                        'aria-label': `Casilla ${i + 1}${letra ? `, ${letra}` : ', vacía'}`,
                      }
                    : {})}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-sm border-2 font-bold uppercase select-none',
                    tocable && 'cursor-pointer',
                    largo >= 7 ? 'text-xl' : 'text-2xl sm:text-3xl',
                    color && !voltea && FONDO[color],
                    !color && (letra ? 'border-muted-foreground/60' : 'border-border'),
                    !intento && letra && 'palabras-cae',
                    voltea && 'palabras-voltea',
                    gano && 'palabras-salta',
                    // Last, so it wins over the empty tile's border.
                    enCursor && 'border-foreground ring-foreground/25 ring-2',
                  )}
                  style={
                    voltea
                      ? ({
                          '--final': VALOR[color!],
                          animationDelay: `${i * MS_POR_FICHA}ms`,
                        } as React.CSSProperties)
                      : gano
                        ? { animationDelay: `${i * 90}ms` }
                        : undefined
                  }
                >
                  {letra}
                </Ficha>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Teclado({
  colorDeTecla,
  activo,
  onTecla,
}: {
  colorDeTecla: ReadonlyMap<string, Color>
  activo: boolean
  onTecla: (valor: string) => void
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 transition-opacity', !activo && 'opacity-60')}>
      {FILAS_DE_TECLADO.map((fila, n) => (
        <div key={fila} className="flex gap-1">
          {n === 2 && (
            <button
              type="button"
              onClick={() => onTecla('ENVIAR')}
              className={cn(TECLA_SIN_USAR, 'h-13 flex-[1.6] rounded-md text-xs font-bold')}
            >
              ENVIAR
            </button>
          )}
          {[...fila].map((letra) => {
            const color = colorDeTecla.get(letra)
            return (
              <button
                key={letra}
                type="button"
                onClick={() => onTecla(letra)}
                className={cn(
                  'h-13 min-w-0 flex-1 rounded-md text-sm font-bold transition-colors',
                  color ? TECLA[color] : TECLA_SIN_USAR,
                )}
              >
                {letra}
              </button>
            )
          })}
          {n === 2 && (
            <button
              type="button"
              onClick={() => onTecla('BORRAR')}
              aria-label="Borrar"
              className={cn(TECLA_SIN_USAR, 'flex h-13 flex-[1.6] items-center justify-center rounded-md')}
            >
              <Delete className="size-5" aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/** Each rival: how far, and the colours of their tries on the word they are on. */
function Rivales({
  vista,
  nombres,
}: {
  vista: VistaPalabras
  nombres: ReadonlyMap<number, string>
}) {
  if (vista.rivales.length === 0) return null
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1">
      {vista.rivales.map((rival) => {
        const llego = rival.tiempo !== null
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
                {llego
                  ? `llegó · ${formatoDeTiempo(rival.tiempo!)}`
                  : `${Math.min(rival.terminadas + 1, vista.total)}/${vista.total}`}
              </span>
            </span>
            {!llego && (
              <span className="flex flex-col gap-px" aria-hidden>
                {Array.from({ length: INTENTOS_POR_PALABRA }, (_, f) => (
                  <span key={f} className="flex gap-px">
                    {Array.from({ length: vista.largo }, (_, i) => {
                      const color = rival.colores[f]?.[i]
                      return (
                        <span
                          key={i}
                          className={cn('size-1.5 rounded-[1px]', !color && 'bg-muted')}
                          style={color ? { background: VALOR[color] } : undefined}
                        />
                      )
                    })}
                  </span>
                ))}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CuentaAtras({ restan }: { restan: number }) {
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

/** Your race is over: your time, and the standings as they are. */
function Llegada({
  vista,
  nombres,
  soyHost,
  onCerrar,
}: {
  vista: VistaPalabras
  nombres: ReadonlyMap<number, string>
  soyHost: boolean
  onCerrar: () => void
}) {
  const propio = vista.propio!
  const fallos = propio.terminadas.filter((p) => !p.acertada).length
  const faltan = vista.clasificacion.filter((p) => !p.termino && !p.retirado).length
  const ganador = vista.clasificacion[0]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        {vista.cerrada && ganador ? (
          <>
            <Trophy className="size-7" aria-hidden />
            <h2 className="text-2xl font-semibold">
              {ganador.asiento === propio.asiento
                ? '¡Ganaste!'
                : `Ganó ${nombres.get(ganador.asiento) ?? '—'}`}
            </h2>
          </>
        ) : (
          <h2 className="text-2xl font-semibold">Terminaste</h2>
        )}
        <p className="text-muted-foreground text-sm">
          Tu tiempo: <span className="text-foreground font-mono">{formatoDeTiempo(propio.tiempo ?? 0)}</span>
          {fallos > 0 && ` · ${fallos} sin adivinar (+${formatoDeTiempo(fallos * MS_CASTIGO)})`}
        </p>
        {!vista.cerrada && faltan > 0 && (
          <p className="text-muted-foreground text-sm">
            {faltan === 1 ? 'Falta uno por llegar.' : `Faltan ${faltan} por llegar.`}
          </p>
        )}
      </div>

      <Clasificacion puestos={vista.clasificacion} nombres={nombres} propio={propio.asiento} total={vista.total} />

      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">Tus palabras</summary>
        <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
          {propio.terminadas.map((p, i) => (
            <li key={i} className={cn(!p.acertada && 'text-red-600 dark:text-red-400')}>
              {i + 1}. {p.palabra} {p.acertada ? `· ${p.intentos.length}` : '· ✗'}
            </li>
          ))}
        </ol>
      </details>

      {soyHost && !vista.cerrada && faltan > 0 && (
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

function Clasificacion({
  puestos,
  nombres,
  propio,
  total,
}: {
  puestos: readonly Puesto[]
  nombres: ReadonlyMap<number, string>
  propio: number
  total: number
}) {
  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-lg border">
      {puestos.map((p) => (
        <li
          key={p.asiento}
          className={cn(
            'bg-card flex items-center gap-3 px-4 py-2.5 text-sm',
            p.asiento === propio && 'bg-accent',
            p.retirado && 'opacity-50',
          )}
        >
          <span className="text-muted-foreground w-5 tabular-nums">{p.lugar}</span>
          <span className="flex-1 truncate">
            {nombres.get(p.asiento) ?? '—'}
            {p.lugar === 1 && p.termino && <Crown className="ml-1.5 inline size-3.5" aria-hidden />}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {p.acertadas}/{total}
          </span>
          <span className="w-16 text-right font-mono tabular-nums">
            {p.tiempo !== null ? formatoDeTiempo(p.tiempo) : p.retirado ? 'salió' : '…'}
          </span>
        </li>
      ))}
    </ol>
  )
}
