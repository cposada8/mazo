'use client'

/**
 * Apuntes (Phase 110): what a player keeps so as not to keep it in their
 * head — a mark on each digit of the pad («está», «no está») and one free
 * note. Private: they live in this phone's storage only, under a key that
 * names the partida and the number in play, so a reload keeps them and the
 * next number starts clean.
 */

import { NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

export type Marca = 'esta' | 'noesta'
export type Marcas = Readonly<Partial<Record<string, Marca>>>

type Apuntes = { marcas: Marcas; nota: string }

const PREFIJO = 'mazo:pyf:apuntes:'
const VACIOS: Apuntes = { marcas: {}, nota: '' }

/** A tap with the pencil: está → no está → sin marca. */
export function siguienteMarca(marca: Marca | undefined): Marca | undefined {
  return marca === undefined ? 'esta' : marca === 'esta' ? 'noesta' : undefined
}

function leer(clave: string): Apuntes {
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave)
    if (!crudo) return VACIOS
    const datos = JSON.parse(crudo) as Partial<Apuntes>
    return { marcas: datos.marcas ?? {}, nota: typeof datos.nota === 'string' ? datos.nota : '' }
  } catch {
    return VACIOS
  }
}

function guardar(clave: string, apuntes: Apuntes) {
  try {
    const vacios = apuntes.nota === '' && Object.keys(apuntes.marcas).length === 0
    if (vacios) window.localStorage.removeItem(PREFIJO + clave)
    else window.localStorage.setItem(PREFIJO + clave, JSON.stringify(apuntes))
    // Another number's or partida's notes are done with: only one is kept.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const otra = window.localStorage.key(i)
      if (otra?.startsWith(PREFIJO) && otra !== PREFIJO + clave) window.localStorage.removeItem(otra)
    }
  } catch {
    // No storage (a private window): the notes last as long as the page.
  }
}

/** The marks and the note of the number `clave` names; null keeps none. */
export function useApuntes(clave: string | null) {
  const [estado, setEstado] = useState<{ clave: string | null; apuntes: Apuntes }>(() => ({
    clave,
    apuntes: clave ? leer(clave) : VACIOS,
  }))
  // A new number (or partida): its own notes, read once.
  let actual = estado
  if (estado.clave !== clave) {
    actual = { clave, apuntes: clave ? leer(clave) : VACIOS }
    setEstado(actual)
  }

  const cambiar = useCallback(
    (cambio: (a: Apuntes) => Apuntes) =>
      setEstado((e) => {
        const apuntes = cambio(e.apuntes)
        if (e.clave) guardar(e.clave, apuntes)
        return { ...e, apuntes }
      }),
    [],
  )
  const marcar = useCallback(
    (cifra: string) =>
      cambiar((a) => {
        const marcas = { ...a.marcas }
        const siguiente = siguienteMarca(marcas[cifra])
        if (siguiente) marcas[cifra] = siguiente
        else delete marcas[cifra]
        return { ...a, marcas }
      }),
    [cambiar],
  )
  const escribirNota = useCallback((nota: string) => cambiar((a) => ({ ...a, nota })), [cambiar])

  return { marcas: actual.apuntes.marcas, nota: actual.apuntes.nota, marcar, escribirNota }
}

/** The 📝 in a board's header: shows and hides the note beside the guesses. */
export function BotonDeNota({ abierta, onCambiar, conNota }: { abierta: boolean; onCambiar: () => void; conNota: boolean }) {
  return (
    <button
      type="button"
      onClick={onCambiar}
      aria-label={abierta ? 'Ocultar tu nota' : 'Mostrar tu nota'}
      aria-pressed={abierta}
      className={cn(
        'relative rounded-md p-1',
        abierta ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <NotebookPen className="size-4" aria-hidden />
      {conNota && !abierta && <span className="bg-foreground absolute top-0.5 right-0.5 size-1.5 rounded-full" aria-hidden />}
    </button>
  )
}

const CLAVE_ABIERTA = 'mazo:pyf:nota-abierta'

/** Whether the note is shown beside the guesses — remembered across numbers and reloads (Phase 111). */
export function useNotaAbierta() {
  const [abierta, setAbierta] = useState(() => {
    try {
      return window.localStorage.getItem(CLAVE_ABIERTA) === '1'
    } catch {
      return false
    }
  })
  const cambiar = useCallback(
    () =>
      setAbierta((a) => {
        try {
          if (a) window.localStorage.removeItem(CLAVE_ABIERTA)
          else window.localStorage.setItem(CLAVE_ABIERTA, '1')
        } catch {
          // Without storage it is remembered as long as the page.
        }
        return !a
      }),
    [],
  )
  return { abierta, cambiar }
}

/**
 * The note beside the guesses (Phase 111): read at a glance while playing,
 * a tap to write in it, «Listo» to go back to reading. Never over the board,
 * so nothing has to be closed — and no «atrás» can leave the table for it.
 */
export function NotaAlLado({
  nota,
  onEscribir,
  angosta = false,
}: {
  nota: string
  onEscribir: (nota: string) => void
  /** Narrower beside a six-digit number's guesses. */
  angosta?: boolean
}) {
  const [editando, setEditando] = useState(false)
  return (
    <aside
      aria-label="Tu nota"
      className={cn(
        'bg-card animate-in fade-in slide-in-from-right-2 flex max-w-44 shrink-0 flex-col rounded-md border',
        angosta ? 'w-[32%]' : 'w-[38%]',
      )}
    >
      {editando ? (
        <>
          <textarea
            value={nota}
            onChange={(e) => onEscribir(e.target.value)}
            autoFocus
            placeholder={'1 o 2\n3 o 4'}
            aria-label="Escribe tu nota"
            className="min-h-0 flex-1 resize-none rounded-t-md bg-transparent p-2 font-mono text-sm leading-snug outline-none"
          />
          <div className="flex gap-1 border-t p-1">
            <button
              type="button"
              onClick={() => onEscribir('')}
              disabled={nota === ''}
              aria-label="Borrar la nota"
              className="hover:bg-accent text-muted-foreground rounded p-1.5 disabled:opacity-30"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="bg-primary text-primary-foreground flex-1 rounded px-2 py-1.5 text-xs font-semibold"
            >
              Listo
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar tu nota"
          className="flex min-h-0 flex-1 flex-col items-stretch gap-1 overflow-y-auto p-2 text-left"
        >
          {nota.trim() ? (
            <span className="font-mono text-sm leading-snug break-words whitespace-pre-wrap">{nota}</span>
          ) : (
            <span className="text-muted-foreground text-xs">Toca para escribir lo que vas sabiendo.</span>
          )}
          <span className="text-muted-foreground mt-auto flex items-center gap-1 pt-1 text-[10px] tracking-wide uppercase">
            <Pencil className="size-3" aria-hidden /> editar
          </span>
        </button>
      )}
    </aside>
  )
}

/** How a marked key looks on the pad. */
export function estiloDeMarca(marca: Marca | undefined): string | undefined {
  if (marca === 'esta') return 'bg-[oklch(0.52_0.15_255)] text-white hover:bg-[oklch(0.56_0.15_255)]'
  if (marca === 'noesta') return 'bg-[oklch(0.3_0_0)] text-white/35 line-through hover:bg-[oklch(0.33_0_0)]'
  return undefined
}

export function nombreDeMarca(marca: Marca | undefined): string {
  return marca === 'esta' ? ', está' : marca === 'noesta' ? ', no está' : ''
}

export const AYUDA_DEL_LAPIZ = 'Toca una cifra: está → no está → sin marca.'
