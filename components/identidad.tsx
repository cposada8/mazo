'use client'

/**
 * Who you are, without an account (Phase 32).
 *
 * On first arriving at the app — any page — the browser is dealt an identity:
 * a random **secreto** and an **alias** drawn from the curated list. Both live
 * in localStorage and survive reloads. The alias is yours to change wherever
 * it is shown; the secreto is what will claim a seat at a table, and is never
 * displayed.
 *
 * The identity only exists in the browser, so the server render shows nothing
 * and the alias appears after hydration — the same discipline as the theme.
 */

import { Pencil } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react'
import { ALIAS_DE_EMERGENCIA } from '@/lib/alias'

export type Identidad = {
  /** Claims your seat. Never shown, never sent anywhere but your own seat. */
  readonly secreto: string
  readonly alias: string
}

const CLAVE = 'mazo:identidad'

type Contexto = {
  /** Null on the server and for the first client frame. */
  identidad: Identidad | null
  cambiarAlias: (alias: string) => void
}

const ContextoDeIdentidad = createContext<Contexto>({
  identidad: null,
  cambiarAlias: () => {},
})

export function useIdentidad(): Contexto {
  return useContext(ContextoDeIdentidad)
}

function leer(): Identidad | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const dato = JSON.parse(crudo) as Partial<Identidad>
    if (typeof dato.secreto === 'string' && typeof dato.alias === 'string') {
      return { secreto: dato.secreto, alias: dato.alias }
    }
  } catch {
    // A corrupt value reads as no identity; a fresh one is dealt.
  }
  return null
}

function guardar(identidad: Identidad) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(identidad))
  } catch {
    // Storage refused (private mode, full): the identity lives for the tab.
  }
}

/**
 * localStorage is the store; React subscribes to it. One module-level copy so
 * every subscriber sees the same object and `getSnapshot` stays stable.
 */
let vigente: Identidad | null = null
const oyentes = new Set<() => void>()

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

function repartirIdentidad(aliases: readonly string[]): Identidad {
  if (vigente) return vigente
  vigente = leer()
  if (vigente) return vigente

  const alias =
    aliases.length > 0
      ? aliases[Math.floor(Math.random() * aliases.length)]
      : ALIAS_DE_EMERGENCIA
  vigente = { secreto: crypto.randomUUID(), alias }
  guardar(vigente)
  return vigente
}

export function ProveedorDeIdentidad({
  aliases,
  children,
}: {
  /** The curated list the server read from `public/candidatos/alias.txt`. */
  aliases: readonly string[]
  children: React.ReactNode
}) {
  const identidad = useSyncExternalStore(
    suscribir,
    () => repartirIdentidad(aliases),
    () => null,
  )

  const cambiarAlias = useCallback((alias: string) => {
    const limpio = alias.trim()
    if (!limpio || !vigente) return
    vigente = { ...vigente, alias: limpio }
    guardar(vigente)
    for (const oyente of oyentes) oyente()
  }, [])

  return (
    <ContextoDeIdentidad.Provider value={{ identidad, cambiarAlias }}>
      {children}
    </ContextoDeIdentidad.Provider>
  )
}

/**
 * "Juegas como …", with the alias editable in place. Lives on the home page
 * and the setup screen; the same identity shows up at the table.
 */
export function AliasEditable() {
  const { identidad, cambiarAlias } = useIdentidad()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')

  if (!identidad) return null

  const confirmar = () => {
    cambiarAlias(borrador)
    setEditando(false)
  }

  if (editando) {
    return (
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          confirmar()
        }}
        className="flex items-center gap-2 text-sm"
      >
        <label htmlFor="alias" className="text-muted-foreground">
          Juegas como
        </label>
        <input
          id="alias"
          autoFocus
          defaultValue={identidad.alias}
          onChange={(evento) => setBorrador(evento.target.value)}
          onBlur={confirmar}
          maxLength={24}
          className="border-input bg-background w-36 rounded-md border px-2 py-1 text-sm"
        />
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setBorrador(identidad.alias)
        setEditando(true)
      }}
      className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
    >
      Juegas como{' '}
      <span className="text-foreground font-medium">{identidad.alias}</span>
      <Pencil className="size-3.5" aria-hidden />
      <span className="sr-only">Cambiar alias</span>
    </button>
  )
}
