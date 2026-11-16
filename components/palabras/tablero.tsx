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

import { CircleHelp, Delete, LogOut, X } from 'lucide-react'
import { ComoSeJuegaPalabras } from './reglas'
import {
  CuentaAtras,
  Llegada,
  PALABRA,
  Rivales,
  Vidas,
  formatoDeTiempo,
} from '@/components/carrera/comun'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Color,
  Intento,
  PalabraTerminada,
  VistaPalabras,
} from '@/lib/engine/palabras'
import {
  INTENTOS_POR_PALABRA,
} from '@/lib/engine/palabras/opciones'
import { cn } from '@/lib/utils'
import {
  type Escritura,
  borrar,
  completa,
  escribir,
  escrituraVacia,
  cursorDe,
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
  const conTiempo = vista.modo === 'tiempo'
  // Against the clock the board stops the instant the time is up, on the
  // server's clock, without waiting for the next read to say so.
  const seAcaboElTiempo = vista.fin !== null && reloj >= vista.fin
  const termine =
    (propio?.terminoEn !== null && propio?.terminoEn !== undefined) ||
    vista.cerrada ||
    seAcaboElTiempo
  const [verReglas, setVerReglas] = useState(false)
  const ocupado = enviando || volteando !== null || cierre !== null || verReglas
  const puedeEscribir = Boolean(propio) && empezo && !termine && !vista.cerrada && !ocupado

  // What the grid shows: the word just ended while it is held, else the word in play.
  const intentos = useMemo<readonly Intento[]>(
    () => (cierre ? cierre.intentos : (propio?.intentos ?? [])),
    [cierre, propio?.intentos],
  )
  // A word in play counts; once this player is done there is no next one.
  const numeroDePalabra = Math.max(
    1,
    Math.min((propio?.terminadas.length ?? 0) + (cierre || termine ? 0 : 1), total),
  )
  const resueltas = propio?.terminadas.filter((p) => p.acertada).length ?? 0
  // Every try so far, all words added up (Phase 97) — the chained ones too.
  const intentosPropios =
    (propio?.terminadas.reduce((suma, p) => suma + p.intentos.length, 0) ?? 0) +
    (propio?.intentos.length ?? 0)

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
      // Chained (Phase 96): the next word comes in with the last one already
      // in its first row — turned over in front of you, not found there.
      const encadena = despues?.intentos[0]?.encadenado === true
      setTimeout(() => {
        setCierre(null)
        if (encadena) {
          setVolteando(0)
          setTimeout(() => setVolteando(null), largo * MS_POR_FICHA + 350)
        }
      }, largo * MS_POR_FICHA + 350 + MS_FIN_DE_PALABRA)
    }
  }, [puedeEscribir, propio, escritura, largo, onEnviar])

  const tecla = useCallback(
    (valor: string) => {
      if (!puedeEscribir) return
      if (valor === 'ENVIAR') return void enviar()
      if (valor === 'BORRAR') return setEscritura(borrar)
      if (valor === 'IZQUIERDA') return setEscritura((e) => mover(e, e.cursor === null ? cursorDe(e) : e.cursor - 1))
      if (valor === 'DERECHA') return setEscritura((e) => mover(e, cursorDe(e) + 1))
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

  const fallos = propio?.terminadas.filter((p) => !p.acertada).length ?? 0
  // n words: the time so far with penalties. Against the clock: what is left.
  const tiempoPropio = conTiempo
    ? Math.max(0, (vista.fin ?? reloj) - Math.max(reloj, vista.inicio))
    : propio
      ? propio.terminoEn !== null
        ? (propio.tiempo ?? 0)
        : Math.max(0, reloj - vista.inicio) + fallos * vista.msCastigo
      : 0
  const quedaPoco = conTiempo && empezo && !termine && tiempoPropio <= 30_000

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 pt-1 pb-3">
      <header className="flex items-center justify-between gap-3">
        <span className="-ml-1 flex items-center gap-1">
          <button
            type="button"
            onClick={onSalir}
            aria-label="Salir de la carrera"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setVerReglas(true)}
            aria-label="Cómo se juega"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <CircleHelp className="size-4" aria-hidden />
          </button>
        </span>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-muted-foreground text-xs tracking-widest uppercase">Palabra</span>
          <span className="text-lg font-semibold tabular-nums">
            {numeroDePalabra}
            {!conTiempo && <span className="text-muted-foreground">/{total}</span>}
          </span>
          {vista.vidasIniciales !== null && propio && (
            <Vidas quedan={propio.vidas ?? 0} de={vista.vidasIniciales} />
          )}
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span
            className={cn(
              'font-mono text-lg tabular-nums',
              quedaPoco && 'text-red-600 dark:text-red-400',
            )}
          >
            {formatoDeTiempo(tiempoPropio)}
          </span>
          {conTiempo ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {resueltas} {resueltas === 1 ? 'resuelta' : 'resueltas'}
            </span>
          ) : (
            fallos > 0 && (
              <span className="text-xs text-red-600 tabular-nums dark:text-red-400">
                +{formatoDeTiempo(fallos * vista.msCastigo)} de castigo
              </span>
            )
          )}
          <span className="text-muted-foreground text-xs tabular-nums">
            {intentosPropios} {intentosPropios === 1 ? 'intento' : 'intentos'}
          </span>
        </div>
      </header>

      <Rivales vista={vista} nombres={nombres} marcas={(rival) => <MarcasDeRival colores={rival.colores} largo={largo} />} />

      <div className="relative flex flex-1 flex-col items-center justify-center">
        {!empezo && <CuentaAtras restan={vista.inicio - reloj} />}
        {termine && !cierre && volteando === null ? (
          <Llegada
            vista={vista}
            nombres={nombres}
            soyHost={soyHost}
            terminada={vista.cerrada || seAcaboElTiempo}
            onCerrar={onCerrar}
            Mini={MiniGrilla}
            sustantivo={PALABRA}
          />
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
                : conTiempo
                  ? `Era ${cierre.palabra}${vista.vidasIniciales !== null ? ' · −1 vida' : ''}`
                  : `Era ${cierre.palabra}${vista.msCastigo ? ` · +${formatoDeTiempo(vista.msCastigo)}` : ''}`}
            </span>
          )}
        </div>
      </div>

      {verReglas && (
        <div className="bg-background fixed inset-0 z-50 overflow-y-auto">
          <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Cómo se juega</h2>
              <button
                type="button"
                onClick={() => setVerReglas(false)}
                aria-label="Cerrar las reglas"
                className="hover:bg-accent -mr-2 rounded-md p-2"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ComoSeJuegaPalabras />
            <button
              type="button"
              onClick={() => setVerReglas(false)}
              className="bg-primary text-primary-foreground rounded-md px-4 py-3 text-sm font-medium"
            >
              Volver a la carrera
            </button>
          </div>
        </div>
      )}

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


/** A rival's tries on the word they are on: colours only, in tiny tiles. */
function MarcasDeRival({ colores, largo }: { colores: readonly (readonly Color[])[]; largo: number }) {
  return (
    <span className="flex flex-col gap-px" aria-hidden>
      {Array.from({ length: INTENTOS_POR_PALABRA }, (_, f) => (
        <span key={f} className="flex gap-px">
          {Array.from({ length: largo }, (_, i) => {
            const color = colores[f]?.[i]
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
