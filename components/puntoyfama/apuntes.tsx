'use client'

/**
 * Apuntes (Phase 110): what a player keeps so as not to keep it in their
 * head — a mark on each digit of the pad («está», «no está») and one free
 * note. Private: they live in this phone's storage only, under a key that
 * names the partida and the number in play, so a reload keeps them and the
 * next number starts clean.
 */

import { NotebookPen, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'

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

/** The 📝 in a board's header. */
export function BotonDeNota({ onAbrir, conNota }: { onAbrir: () => void; conNota: boolean }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={conNota ? 'Abrir tu nota' : 'Escribir una nota'}
      className="text-muted-foreground hover:text-foreground relative p-1"
    >
      <NotebookPen className="size-4" aria-hidden />
      {conNota && <span className="bg-foreground absolute top-0.5 right-0.5 size-1.5 rounded-full" aria-hidden />}
    </button>
  )
}

/** The note, closed: its first lines above the guesses; a tap opens it. */
export function VistaDeNota({ nota, onAbrir }: { nota: string; onAbrir: () => void }) {
  if (!nota.trim()) return null
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Abrir tu nota"
      className="bg-card text-muted-foreground flex w-full items-start gap-2 rounded-md border px-3 py-1.5 text-left text-xs"
    >
      <NotebookPen className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span className="line-clamp-2 whitespace-pre-line">{nota.trim()}</span>
    </button>
  )
}

/** The note, open: one free text over the board, written and erased at will. */
export function HojaDeNota({
  nota,
  onEscribir,
  onCerrar,
}: {
  nota: string
  onEscribir: (nota: string) => void
  onCerrar: () => void
}) {
  return (
    <div className="bg-background animate-in fade-in fixed inset-0 z-50 flex flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tu nota</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar la nota" className="hover:bg-accent -mr-2 rounded-md p-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p className="text-muted-foreground text-xs">Solo tú la ves. Se borra cuando pasas al siguiente número.</p>
        <textarea
          value={nota}
          onChange={(e) => onEscribir(e.target.value)}
          autoFocus
          placeholder={'1 o 2\n3 o 4'}
          aria-label="Tu nota"
          className="border-input bg-card min-h-40 flex-1 resize-none rounded-md border p-3 font-mono text-base leading-relaxed outline-none focus:ring-2"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEscribir('')}
            disabled={nota === ''}
            className="border-input hover:bg-accent flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
            Borrar nota
          </button>
          <button type="button" onClick={onCerrar} className="bg-primary text-primary-foreground flex-1 rounded-md px-4 py-3 text-sm font-medium">
            Listo
          </button>
        </div>
      </div>
    </div>
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
