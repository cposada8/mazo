import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ComoSeJuegaMentiroso } from '@/components/reglas-mentiroso'

/**
 * El Mentiroso's rules, as a page (Phase 81) — the same component the table
 * opens over the felt, here to read before sitting down or to send to whoever
 * you are about to teach.
 */

export const metadata = {
  title: 'Cómo se juega — Mentiroso',
  description:
    'Las reglas del Mentiroso en una pantalla: el turno, cuándo decir «¡Mentiroso!», quién se lleva la pila y cómo se gana.',
}

export default function ReglasMentiroso() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Mazo
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight">Cómo se juega</h1>
        <p className="text-muted-foreground text-balance">
          El Mentiroso, en una pantalla. ¿Buscas Carioca?{' '}
          <Link href="/como-se-juega" className="text-foreground underline underline-offset-2">
            Sus reglas están aquí
          </Link>
          .
        </p>
      </header>

      <ComoSeJuegaMentiroso />

      <footer className="mt-4 flex flex-col gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground rounded-md px-4 py-3.5 text-center text-sm font-medium"
        >
          Jugar
        </Link>
      </footer>
    </main>
  )
}
