import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ComoSeJuegaPalabras } from '@/components/palabras/reglas'

/**
 * Palabras' rules, as a page (Phase 91) — the same component the board opens
 * over itself, here to read before a race or to send to whoever you invite.
 */

export const metadata = {
  title: 'Cómo se juega — Palabras',
  description:
    'Las reglas de Palabras en una pantalla: los colores, las dos modalidades, las vidas y lo que ves de los demás.',
}

export default function ReglasPalabras() {
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
          Palabras, en una pantalla. ¿Buscas otro juego? Las reglas de{' '}
          <Link href="/como-se-juega" className="text-foreground underline underline-offset-2">
            Carioca
          </Link>,{' '}
          del{' '}
          <Link href="/como-se-juega/mentiroso" className="text-foreground underline underline-offset-2">
            Mentiroso
          </Link>{' '}
          y de{' '}
          <Link href="/como-se-juega/punto-y-fama" className="text-foreground underline underline-offset-2">
            Punto y Fama
          </Link>
          .
        </p>
      </header>

      <ComoSeJuegaPalabras />

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
