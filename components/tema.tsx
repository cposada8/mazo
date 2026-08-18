'use client'

import { ThemeProvider, useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

/**
 * Light, dark, or whatever the phone is set to.
 *
 * The class goes on <html> before the page paints, which is what keeps a dark
 * setting from flashing white on load — the reason this uses a library instead
 * of a `useState` and a class toggle.
 */
export function ProveedorDeTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}

const OPCIONES = [
  { valor: 'light', etiqueta: 'Claro', Icono: Sun },
  { valor: 'dark', etiqueta: 'Oscuro', Icono: Moon },
  { valor: 'system', etiqueta: 'Automático', Icono: Monitor },
] as const

export function SelectorDeTema({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  // The chosen theme is only known in the browser, so nothing is highlighted
  // until the page has hydrated. Rendering a guess on the server would be a
  // mismatch; this is the plain way to ask "am I in the browser yet?".
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  return (
    <div
      className={cn('flex gap-px overflow-hidden rounded-md border', className)}
      role="group"
      aria-label="Tema"
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = montado && theme === valor
        return (
          <button
            key={valor}
            type="button"
            onClick={() => setTheme(valor)}
            aria-label={etiqueta}
            aria-pressed={activo}
            title={etiqueta}
            className={cn(
              'flex items-center justify-center px-2.5 py-1.5 transition-colors',
              activo ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            <Icono className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
