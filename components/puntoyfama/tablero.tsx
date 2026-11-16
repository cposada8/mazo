'use client'

/**
 * Punto y Fama's race board (Phase 102): the guesses at the number in play
 * with their answers, the guess being written, a pad of 0–9, the clock, the
 * rivals as answers without digits — and, at the end, the shared finish
 * table (`components/carrera/`).
 *
 * Told in beats: a digit lands as it is typed; a guess goes up into the
 * list and its answer comes in mark by mark — puntos, then famas — the game's own order (Phase 109); a refused
 * guess shakes; a number got is said, then the next one opens.
 */

import { CircleHelp, Delete, LogOut, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CuentaAtras,
  Llegada,
  NUMERO,
  Rivales,
  formatoDeTiempo,
} from '@/components/carrera/comun'
import {
  type Escritura,
  borrar,
  completa,
  cursorDe,
  escribir,
  escrituraVacia,
  mover,
  palabraDe,
} from '@/components/palabras/escritura'
import type { IntentoPF, NumeroTerminado, Respuesta, VistaPuntoYFama } from '@/lib/engine/puntoyfama'
import { cn } from '@/lib/utils'

/** Each mark of an answer coming in. */
const MS_POR_MARCA = 140
/** How long a number got stays said before the next one opens. */
const MS_FIN_DE_NUMERO = 1_600

const FILAS_DEL_TECLADO = ['12345', '67890'] as const

export type PropsDeTableroPF = {
  vista: VistaPuntoYFama
  nombres: ReadonlyMap<number, string>
  soyHost: boolean
  enviando: boolean
  error: { texto: string; code: string; vez: number } | null
  ahora: () => number
  onEnviar: (numero: string) => Promise<unknown>
  onCerrar: () => void
  onSalir: () => void
  /** The rules, opened over the board (Phase 106). */
  reglas?: ReactNode
}

export function TableroPuntoYFama({
  vista,
  nombres,
  soyHost,
  enviando,
  error,
  ahora,
  onEnviar,
  onCerrar,
  onSalir,
  reglas,
}: PropsDeTableroPF) {
  const digitos = vista.largo
  const propio = vista.propio
  const [escritura, setEscritura] = useState<Escritura>(() => escrituraVacia(digitos))
  const [sacudir, setSacudir] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  /** The guess just sent, its answer coming in. */
  const [llegando, setLlegando] = useState<number | null>(null)
  /** A number just got, held on screen for a moment. */
  const [cierre, setCierre] = useState<NumeroTerminado | null>(null)
  const [verReglas, setVerReglas] = useState(false)
  const [tic, setTic] = useState(() => ({ reloj: ahora(), local: Date.now() }))
  const reloj = tic.reloj
  const lista = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const id = setInterval(() => setTic({ reloj: ahora(), local: Date.now() }), 250)
    return () => clearInterval(id)
  }, [ahora])

  const avisoDelServidor = error && tic.local - error.vez < 1800 ? error.texto : null
  const sacudida = `${sacudir}-${error?.vez ?? 0}`
  const haySacudida = sacudir > 0 || error !== null

  const empezo = reloj >= vista.inicio
  const conTiempo = vista.modo === 'tiempo'
  const seAcaboElTiempo = vista.fin !== null && reloj >= vista.fin
  const termine =
    (propio?.terminoEn !== null && propio?.terminoEn !== undefined) || vista.cerrada || seAcaboElTiempo
  const ocupado = enviando || cierre !== null || verReglas
  const puedeEscribir = Boolean(propio) && empezo && !termine && !ocupado

  // The guesses shown: the number just got while it is held, else the one in play.
  const intentos = useMemo<readonly IntentoPF[]>(
    () => (cierre ? cierre.intentos : (propio?.intentos ?? [])),
    [cierre, propio?.intentos],
  )
  const numeroEnJuego = Math.max(
    1,
    Math.min((propio?.terminadas.length ?? 0) + (cierre || termine ? 0 : 1), vista.total),
  )
  const resueltos = propio?.terminadas.filter((p) => p.acertada).length ?? 0
  const intentosPropios =
    (propio?.terminadas.reduce((suma, p) => suma + p.intentos.length, 0) ?? 0) +
    (propio?.intentos.length ?? 0)

  // The newest guess in view.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' })
  }, [intentos.length])

  const avisar = (texto: string) => {
    setSacudir((n) => n + 1)
    setAviso(texto)
    setTimeout(() => setAviso(null), 1400)
  }

  const enviar = useCallback(async () => {
    if (!puedeEscribir || !propio) return
    if (!completa(escritura)) return avisar('Faltan cifras.')
    if (repetidas(escritura.letras).size > 0) return avisar('Sin cifras repetidas.')
    const fila = propio.intentos.length
    const antes = propio.terminadas.length
    const respuesta = (await onEnviar(palabraDe(escritura)).catch(() => null)) as
      | { ok: true; mesa: { vista: VistaPuntoYFama } }
      | { ok: false }
      | null
    if (!respuesta?.ok) return
    setEscritura(escrituraVacia(digitos))
    setLlegando(fila)
    setTimeout(() => setLlegando(null), (digitos + 1) * MS_POR_MARCA + 300)
    const despues = respuesta.mesa.vista.propio
    const terminado = despues && despues.terminadas.length > antes ? despues.terminadas[antes] : null
    if (terminado) {
      setCierre(terminado)
      setTimeout(() => setCierre(null), (digitos + 1) * MS_POR_MARCA + 300 + MS_FIN_DE_NUMERO)
    }
  }, [puedeEscribir, propio, escritura, digitos, onEnviar])

  const tecla = useCallback(
    (valor: string) => {
      if (!puedeEscribir) return
      if (valor === 'ENVIAR') return void enviar()
      if (valor === 'BORRAR') return setEscritura(borrar)
      if (valor === 'IZQUIERDA') return setEscritura((e) => mover(e, e.cursor === null ? cursorDe(e) : e.cursor - 1))
      if (valor === 'DERECHA') return setEscritura((e) => mover(e, cursorDe(e) + 1))
      // A digit may be typed twice while writing; only sending it is refused (Phase 108).
      setEscritura((e) => escribir(e, valor))
    },
    [puedeEscribir, enviar],
  )

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
      else if (/^\d$/.test(evento.key)) teclaRef.current(evento.key)
      else return
      evento.preventDefault()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  const tiempo = conTiempo
    ? Math.max(0, (vista.fin ?? reloj) - Math.max(reloj, vista.inicio))
    : propio
      ? propio.terminoEn !== null
        ? (propio.tiempo ?? 0)
        : Math.max(0, reloj - vista.inicio)
      : 0
  const quedaPoco = conTiempo && empezo && !termine && tiempo <= 30_000

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 pt-1 pb-3">
      <header className="flex items-center justify-between gap-3">
        <span className="-ml-1 flex items-center gap-1">
          <button type="button" onClick={onSalir} aria-label="Salir de la carrera" className="text-muted-foreground hover:text-foreground p-1">
            <LogOut className="size-4" aria-hidden />
          </button>
          {reglas && (
            <button type="button" onClick={() => setVerReglas(true)} aria-label="Cómo se juega" className="text-muted-foreground hover:text-foreground p-1">
              <CircleHelp className="size-4" aria-hidden />
            </button>
          )}
        </span>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-muted-foreground text-xs tracking-widest uppercase">Número</span>
          <span className="text-lg font-semibold tabular-nums">
            {numeroEnJuego}
            {!conTiempo && <span className="text-muted-foreground">/{vista.total}</span>}
          </span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className={cn('font-mono text-lg tabular-nums', quedaPoco && 'text-red-600 dark:text-red-400')}>
            {formatoDeTiempo(tiempo)}
          </span>
          {conTiempo && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {resueltos} {resueltos === 1 ? 'adivinado' : 'adivinados'}
            </span>
          )}
          <span className="text-muted-foreground text-xs tabular-nums">
            {intentosPropios} {intentosPropios === 1 ? 'intento' : 'intentos'}
          </span>
        </div>
      </header>

      <Rivales vista={vista} nombres={nombres} marcas={(rival) => <RespuestasDeRival respuestas={rival.colores} />} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {!empezo && <CuentaAtras restan={vista.inicio - reloj} />}
        {termine && !cierre ? (
          <div className="overflow-y-auto">
            <Llegada
              vista={vista}
              nombres={nombres}
              soyHost={soyHost}
              terminada={vista.cerrada || seAcaboElTiempo}
              onCerrar={onCerrar}
              Mini={MiniNumeros}
              sustantivo={NUMERO}
              anchoDeColumna={Math.max(8, digitos * 1.5 + 3.5)}
            />
          </div>
        ) : (
          <>
            <ol ref={lista} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1" aria-label="Tus intentos">
              {intentos.length === 0 && (
                <li className="text-muted-foreground m-auto max-w-64 text-center text-sm">
                  Adivina el número de {digitos} cifras, sin cifras repetidas.
                  <Leyenda className="mt-3" />
                </li>
              )}
              {intentos.map((intento, i) => (
                <FilaDeIntento key={i} intento={intento} numero={i + 1} llegando={i === llegando} />
              ))}
            </ol>
            <FilaEscrita
              digitos={digitos}
              escritura={cierre ? null : escritura}
              conCursor={puedeEscribir}
              sacudida={haySacudida ? sacudida : null}
              onTocar={(i) => setEscritura((e) => mover(e, i))}
            />
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
          {(aviso ?? avisoDelServidor) && (
            <span className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium shadow">
              {aviso ?? avisoDelServidor}
            </span>
          )}
          {cierre && llegando === null && (
            <span className="animate-in fade-in zoom-in-95 bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-semibold shadow">
              ¡Era {cierre.palabra}! · {cierre.intentos.length} {cierre.intentos.length === 1 ? 'intento' : 'intentos'}
            </span>
          )}
        </div>
      </div>

      {!termine && <TecladoNumerico activo={puedeEscribir} onTecla={tecla} />}

      {verReglas && reglas && <HojaDeReglas reglas={reglas} onCerrar={() => setVerReglas(false)} />}
    </main>
  )
}

/** The digits written more than once, by position — what keeps a guess from being sent. */
export function repetidas(letras: readonly (string | null)[]): ReadonlySet<number> {
  const posiciones = new Set<number>()
  letras.forEach((letra, i) => {
    if (letra !== null && letras.some((otra, j) => j !== i && otra === letra)) posiciones.add(i)
  })
  return posiciones
}

/** What the colours mean, for whoever is unsure (Phase 107). */
export function Leyenda({ className }: { className?: string }) {
  return (
    <span className={cn('flex flex-col items-start gap-1.5 text-left text-sm', className)}>
      <span className="flex items-center gap-2">
        <Marcas respuesta={{ famas: 0, puntos: 1 }} />
        <span>
          <b>Punto</b>: la cifra está, en otro lugar.
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Marcas respuesta={{ famas: 1, puntos: 0 }} />
        <span>
          <b>Fama</b>: la cifra está y en su lugar.
        </span>
      </span>
    </span>
  )
}

/** The ⓘ's sheet over a board: the legend first, then the whole of «Cómo se juega». */
export function HojaDeReglas({ reglas, onCerrar }: { reglas: ReactNode; onCerrar: () => void }) {
  return (
    <div className="bg-background animate-in fade-in fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo se juega</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar las reglas" className="hover:bg-accent -mr-2 rounded-md p-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">Las marcas</h3>
          <Leyenda />
        </div>
        {reglas}
        <button type="button" onClick={onCerrar} className="bg-primary text-primary-foreground rounded-md px-4 py-3 text-sm font-medium">
          Volver
        </button>
      </div>
    </div>
  )
}

/** An answer as marks: an amber dot per punto, then a green one per fama; «nada» for none. */
export function Marcas({
  respuesta,
  llegando = false,
  chico = false,
}: {
  respuesta: Respuesta
  llegando?: boolean
  chico?: boolean
}) {
  if (respuesta.famas === 0 && respuesta.puntos === 0) {
    return <span className={cn('text-muted-foreground', chico ? 'text-[10px]' : 'text-xs')}>nada</span>
  }
  const marcas = [
    ...Array.from({ length: respuesta.puntos }, () => 'punto' as const),
    ...Array.from({ length: respuesta.famas }, () => 'fama' as const),
  ]
  return (
    <span className="flex items-center gap-1" aria-label={`${respuesta.puntos} puntos, ${respuesta.famas} famas`}>
      {marcas.map((tipo, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full',
            chico ? 'size-2' : 'size-3',
            tipo === 'fama' ? 'bg-[oklch(0.6_0.12_148)]' : 'bg-[oklch(0.72_0.13_88)]',
            llegando && 'palabras-cae',
          )}
          style={llegando ? { animationDelay: `${(i + 1) * MS_POR_MARCA}ms`, animationFillMode: 'both' } : undefined}
        />
      ))}
    </span>
  )
}

export function FilaDeIntento({ intento, numero, llegando }: { intento: IntentoPF; numero: number; llegando: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 rounded-md px-2 py-1', llegando && 'animate-in fade-in slide-in-from-bottom-2')}>
      <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">{numero}</span>
      <span className="flex gap-1">
        {[...intento.palabra].map((cifra, i) => (
          <span key={i} className="bg-muted flex size-9 items-center justify-center rounded-md font-mono text-lg font-bold">
            {cifra}
          </span>
        ))}
      </span>
      <Marcas respuesta={intento} llegando={llegando} />
    </li>
  )
}

/** The guess being written: one slot per digit, touchable, as Palabras' row. */
export function FilaEscrita({
  digitos,
  escritura,
  conCursor,
  sacudida,
  onTocar,
}: {
  digitos: number
  escritura: Escritura | null
  conCursor: boolean
  sacudida: string | null
  onTocar: (indice: number) => void
}) {
  const repetida = escritura ? repetidas(escritura.letras) : new Set<number>()
  return (
    <div key={sacudida ?? 'quieta'} className={cn('flex justify-center gap-2 py-2', sacudida && 'palabras-sacudir')}>
      {Array.from({ length: digitos }, (_, i) => {
        const cifra = escritura?.letras[i] ?? undefined
        const enCursor = conCursor && escritura?.cursor === i
        const seRepite = repetida.has(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTocar(i)}
            aria-label={`Cifra ${i + 1}${cifra ? `, ${cifra}` : ', vacía'}${seRepite ? ', repetida' : ''}`}
            className={cn(
              'flex size-14 items-center justify-center rounded-md border-2 font-mono text-3xl font-bold',
              cifra ? 'border-muted-foreground/60 palabras-cae' : 'border-border',
              enCursor && 'border-foreground ring-foreground/25 ring-2',
              seRepite && 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400',
            )}
          >
            {cifra}
          </button>
        )
      })}
    </div>
  )
}

export function TecladoNumerico({
  activo,
  onTecla,
}: {
  activo: boolean
  onTecla: (valor: string) => void
}) {
  const tecla = 'bg-[oklch(0.45_0_0)] text-white hover:bg-[oklch(0.5_0_0)]'
  return (
    <div className={cn('flex flex-col gap-1.5 transition-opacity', !activo && 'opacity-60')}>
      {FILAS_DEL_TECLADO.map((fila) => (
        <div key={fila} className="flex gap-1.5">
          {[...fila].map((cifra) => (
            <button
              key={cifra}
              type="button"
              onClick={() => onTecla(cifra)}
              className={cn('h-13 flex-1 rounded-md font-mono text-xl font-bold', tecla)}
            >
              {cifra}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onTecla('BORRAR')} aria-label="Borrar" className={cn('flex h-13 flex-1 items-center justify-center rounded-md', tecla)}>
          <Delete className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => onTecla('ENVIAR')} className="bg-primary text-primary-foreground h-13 flex-[2] rounded-md text-sm font-bold">
          ENVIAR
        </button>
      </div>
    </div>
  )
}

/** A rival's answers on the number they are on — the last few, marks only. */
function RespuestasDeRival({ respuestas }: { respuestas: readonly Respuesta[] }) {
  const ultimas = respuestas.slice(-3)
  return (
    <span className="flex min-w-14 flex-col gap-0.5" aria-hidden>
      {ultimas.length === 0 ? (
        <span className="text-muted-foreground text-[10px]">—</span>
      ) : (
        ultimas.map((r, i) => <Marcas key={i} respuesta={r} chico />)
      )}
    </span>
  )
}

/** A number's guesses, small, for the finish table: digits and marks. */
function MiniNumeros({ intentos }: { intentos: readonly IntentoPF[] }) {
  return (
    <div className="animate-in fade-in flex flex-col items-center gap-0.5">
      {intentos.map((intento, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="font-mono text-xs tracking-wider">{intento.palabra}</span>
          <Marcas respuesta={intento} chico />
        </div>
      ))}
    </div>
  )
}
