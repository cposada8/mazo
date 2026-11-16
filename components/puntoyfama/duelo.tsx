'use client'

/**
 * The duel's board (Phase 104): two people, each guessing the other's
 * number. Three moments: setting your number for the other, out of sight;
 * guessing theirs, with their answers to your number coming in beside
 * yours; and the result — fewer tries wins — with both numbers turned over
 * and both lists of guesses side by side.
 */

import { CircleHelp, Lock, LogOut, Trophy } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { CuentaAtras, formatoDeTiempo } from '@/components/carrera/comun'
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
import type { IntentoPF, VistaDelDuelo } from '@/lib/engine/puntoyfama'
import { cn } from '@/lib/utils'
import { BotonDeNota, HojaDeNota, VistaDeNota, useApuntes } from './apuntes'
import { FilaDeIntento, FilaEscrita, HojaDeReglas, Marcas, TecladoNumerico, enUnCampo, repetidas } from './tablero'

export type PropsDelDuelo = {
  vista: VistaDelDuelo
  nombres: ReadonlyMap<number, string>
  enviando: boolean
  error: { texto: string; code: string; vez: number } | null
  ahora: () => number
  onPoner: (numero: string) => Promise<unknown>
  onIntentar: (numero: string) => Promise<unknown>
  onSalir: () => void
  /** The rules, opened over the board from its ⓘ (Phase 107). */
  reglas?: ReactNode
  /** Where this player's marks and note are kept — the partida's code (Phase 110). */
  apuntes?: string
}

export function TableroDuelo({
  vista,
  nombres,
  enviando,
  error,
  ahora,
  onPoner,
  onIntentar,
  onSalir,
  reglas,
  apuntes,
}: PropsDelDuelo) {
  const digitos = vista.digitos
  const yo = vista.yo
  const rival = vista.rival
  const nombreRival = (rival && nombres.get(rival.asiento)) ?? 'el otro'
  const [escritura, setEscritura] = useState<Escritura>(() => escrituraVacia(digitos))
  const [sacudir, setSacudir] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [llegando, setLlegando] = useState<number | null>(null)
  const [verReglas, setVerReglas] = useState(false)
  const [verNota, setVerNota] = useState(false)
  const [lapiz, setLapiz] = useState(false)
  const notas = useApuntes(apuntes ? `${apuntes}:duelo` : null)
  const { marcar } = notas
  const [tic, setTic] = useState(() => ({ reloj: ahora(), local: Date.now() }))
  const lista = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const id = setInterval(() => setTic({ reloj: ahora(), local: Date.now() }), 250)
    return () => clearInterval(id)
  }, [ahora])

  const avisoDelServidor = error && tic.local - error.vez < 1800 ? error.texto : null
  const sacudida = `${sacudir}-${error?.vez ?? 0}`
  const haySacudida = sacudir > 0 || error !== null

  const poniendo = yo !== null && yo.secreto === null
  const esperandoAlOtro = yo?.secreto !== null && vista.inicio === null
  const empezo = vista.inicio !== null && tic.reloj >= vista.inicio
  const lotengo = yo?.terminoEn !== null && yo?.terminoEn !== undefined
  const fin = vista.resultado !== null
  const puedeEscribir = !enviando && !fin && !verReglas && !verNota && (poniendo || (empezo && !lotengo))
  // Marks and the note are for guessing their number, not for setting yours.
  const conApuntes = Boolean(apuntes) && !poniendo && !fin

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' })
  }, [yo?.intentos.length])

  const enviar = useCallback(async () => {
    if (!puedeEscribir) return
    const falta = !completa(escritura)
    if (falta || repetidas(escritura.letras).size > 0) {
      setSacudir((n) => n + 1)
      setAviso(falta ? 'Faltan cifras.' : 'Sin cifras repetidas.')
      setTimeout(() => setAviso(null), 1400)
      return
    }
    const fila = yo?.intentos.length ?? 0
    const respuesta = (await (poniendo ? onPoner : onIntentar)(palabraDe(escritura)).catch(() => null)) as
      | { ok: boolean }
      | null
    if (!respuesta?.ok) return
    setEscritura(escrituraVacia(digitos))
    if (!poniendo) {
      setLlegando(fila)
      setTimeout(() => setLlegando(null), 1200)
    }
  }, [puedeEscribir, escritura, yo, poniendo, onPoner, onIntentar, digitos])

  const tecla = useCallback(
    (valor: string) => {
      if (!puedeEscribir) return
      if (lapiz && conApuntes && valor === 'ENVIAR') return setLapiz(false)
      if (lapiz && conApuntes && /^\d$/.test(valor)) return marcar(valor)
      if (valor === 'ENVIAR') return void enviar()
      if (valor === 'BORRAR') return setEscritura(borrar)
      if (valor === 'IZQUIERDA') return setEscritura((e) => mover(e, e.cursor === null ? cursorDe(e) : e.cursor - 1))
      if (valor === 'DERECHA') return setEscritura((e) => mover(e, cursorDe(e) + 1))
      // A digit may be typed twice while writing; only sending it is refused (Phase 108).
      setEscritura((e) => escribir(e, valor))
    },
    [puedeEscribir, enviar, lapiz, conApuntes, marcar],
  )
  const teclaRef = useRef(tecla)
  useEffect(() => {
    teclaRef.current = tecla
  }, [tecla])
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey || enUnCampo(evento)) return
      if (evento.key === 'Enter') teclaRef.current('ENVIAR')
      else if (evento.key === 'Backspace') teclaRef.current('BORRAR')
      else if (/^\d$/.test(evento.key)) teclaRef.current(evento.key)
      else return
      evento.preventDefault()
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  const tiempo = vista.inicio !== null && empezo ? (yo?.terminoEn ?? tic.reloj - vista.inicio) : 0

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 pt-1 pb-3">
      <header className="flex items-center justify-between gap-3">
        <span className="-ml-1 flex items-center gap-1">
          <button type="button" onClick={onSalir} aria-label="Salir del duelo" className="text-muted-foreground hover:text-foreground p-1">
            <LogOut className="size-4" aria-hidden />
          </button>
          {reglas && (
            <button type="button" onClick={() => setVerReglas(true)} aria-label="Cómo se juega" className="text-muted-foreground hover:text-foreground p-1">
              <CircleHelp className="size-4" aria-hidden />
            </button>
          )}
          {conApuntes && !lotengo && <BotonDeNota onAbrir={() => setVerNota(true)} conNota={notas.nota.trim() !== ''} />}
        </span>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-muted-foreground text-xs tracking-widest uppercase">Duelo</span>
          <span className="max-w-48 truncate text-sm font-semibold">contra {nombreRival}</span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="font-mono text-lg tabular-nums">{formatoDeTiempo(tiempo)}</span>
          {yo?.secreto && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Lock className="size-3" aria-hidden /> tu número {yo.secreto}
            </span>
          )}
        </div>
      </header>

      {fin ? (
        <Resultado vista={vista} nombres={nombres} />
      ) : poniendo ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-xl font-semibold">Tu número para {nombreRival}</h2>
          <p className="text-muted-foreground max-w-72 text-sm">
            {digitos} cifras sin repetir. {nombreRival} no lo verá hasta el final.
          </p>
          {rival?.puso && <p className="text-muted-foreground text-xs">{nombreRival} ya puso el suyo.</p>}
        </div>
      ) : esperandoAlOtro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-xl font-semibold">Esperando a {nombreRival}…</h2>
          <p className="text-muted-foreground text-sm">Está escribiendo el número que tú vas a adivinar.</p>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2">
          {!empezo && vista.inicio !== null && <CuentaAtras restan={vista.inicio - tic.reloj} />}
          <div className="bg-card flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="truncate">
              {nombreRival} · {rival?.respuestas.length ?? 0}{' '}
              {rival?.respuestas.length === 1 ? 'intento' : 'intentos'}
              {rival?.terminoEn != null && ' · ¡ya lo tiene!'}
            </span>
            <span className="flex flex-col items-end gap-0.5" aria-label={`Respuestas de ${nombreRival} a tu número`}>
              {(rival?.respuestas ?? []).slice(-2).map((r, i) => (
                <Marcas key={i} respuesta={r} chico />
              ))}
            </span>
          </div>
          {conApuntes && !lotengo && <VistaDeNota nota={notas.nota} onAbrir={() => setVerNota(true)} />}
          <ol ref={lista} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1" aria-label="Tus intentos">
            {(yo?.intentos ?? []).map((intento, i) => (
              <FilaDeIntento key={i} intento={intento} numero={i + 1} llegando={i === llegando} />
            ))}
          </ol>
          {lotengo && (
            <p className="text-center text-sm font-medium">
              ¡Lo tienes en {yo!.intentos.length} {yo!.intentos.length === 1 ? 'intento' : 'intentos'}! Esperando a que{' '}
              {nombreRival} termine…
            </p>
          )}
        </div>
      )}

      {(aviso ?? avisoDelServidor) && (
        <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">{aviso ?? avisoDelServidor}</p>
      )}

      {!fin && !esperandoAlOtro && !lotengo && (
        <>
          <FilaEscrita
            digitos={digitos}
            escritura={escritura}
            conCursor={puedeEscribir}
            sacudida={haySacudida ? sacudida : null}
            onTocar={(i) => setEscritura((e) => mover(e, i))}
          />
          <TecladoNumerico
            activo={puedeEscribir}
            onTecla={tecla}
            marcas={conApuntes ? notas.marcas : undefined}
            lapiz={lapiz && conApuntes}
            onLapiz={conApuntes ? () => setLapiz((l) => !l) : undefined}
          />
          {poniendo && (
            <p className="text-muted-foreground text-center text-xs">ENVIAR pone tu número; ya no se puede cambiar.</p>
          )}
        </>
      )}

      {verReglas && reglas && <HojaDeReglas reglas={reglas} onCerrar={() => setVerReglas(false)} />}
      {verNota && <HojaDeNota nota={notas.nota} onEscribir={notas.escribirNota} onCerrar={() => setVerNota(false)} />}
    </main>
  )
}

function Resultado({ vista, nombres }: { vista: VistaDelDuelo; nombres: ReadonlyMap<number, string> }) {
  const r = vista.resultado!
  const yo = vista.yo!
  const rival = vista.rival!
  const nombreRival = nombres.get(rival.asiento) ?? 'el otro'
  const titulo =
    r.tipo === 'empate' ? 'Empate' : r.asiento === yo.asiento ? '¡Ganaste!' : `Ganó ${nombreRival}`
  const porque =
    r.tipo === 'empate'
      ? 'Los mismos intentos, en el mismo tiempo.'
      : r.porque === 'retiro'
        ? `${r.asiento === yo.asiento ? nombreRival : 'Tú'} se fue del duelo.`
        : r.porque === 'tiempo'
          ? 'Los mismos intentos: ganó quien lo adivinó primero.'
          : 'En menos intentos.'
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-1 flex-col gap-5 overflow-y-auto">
      <div className="flex flex-col items-center gap-1 text-center">
        <Trophy className="size-7" aria-hidden />
        <h2 className="text-2xl font-semibold">{titulo}</h2>
        <p className="text-muted-foreground text-sm">{porque}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Lado
          titulo="Tú"
          adivinaste={rival.secreto}
          intentos={yo.intentos}
          terminoEn={yo.terminoEn}
          destacado
        />
        <Lado
          titulo={nombreRival}
          adivinaste={yo.secreto}
          intentos={rival.intentos ?? []}
          terminoEn={rival.terminoEn}
        />
      </div>
    </div>
  )
}

/** One side of the result: the number they were after, and every guess at it. */
function Lado({
  titulo,
  adivinaste,
  intentos,
  terminoEn,
  destacado = false,
}: {
  titulo: string
  adivinaste: string | null
  intentos: readonly IntentoPF[]
  terminoEn: number | null
  destacado?: boolean
}) {
  return (
    <section className={cn('flex flex-col gap-2 rounded-lg border p-3', destacado && 'bg-amber-400/15 dark:bg-amber-300/10')}>
      <h3 className="truncate text-sm font-semibold">{titulo}</h3>
      <p className="text-muted-foreground text-xs">
        buscaba <span className="text-foreground font-mono text-sm tracking-widest">{adivinaste ?? '—'}</span>
      </p>
      <p className="text-xs tabular-nums">
        {terminoEn !== null
          ? `${intentos.length} ${intentos.length === 1 ? 'intento' : 'intentos'} · ${formatoDeTiempo(terminoEn)}`
          : 'no lo adivinó'}
      </p>
      <ol className="flex flex-col gap-1">
        {intentos.map((intento, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm tracking-wider">{intento.palabra}</span>
            <Marcas respuesta={intento} chico />
          </li>
        ))}
      </ol>
    </section>
  )
}
