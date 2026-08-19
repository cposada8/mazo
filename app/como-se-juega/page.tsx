import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ComoSeJuega } from '@/components/reglas'

/**
 * The rules, as a page (Phase 45).
 *
 * The same component the partida's menu opens over the felt — one of the two
 * entrances the owner chose. This one exists so there is something to read
 * *before* sitting down, and something to send to whoever you are about to
 * teach: a table's code is private, a link to the rules is not.
 */

export const metadata = {
  title: 'Cómo se juega — Carioca',
  description:
    'Las reglas de Carioca en una pantalla: el turno, los tríos y las escalas, los comodines, cómo bajarse y cómo se cuentan los puntos.',
}

export default function Reglas() {
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
          Carioca, en una pantalla. Se lee en cinco minutos y se aprende
          jugando: la primera partida trae una guía que te va diciendo qué
          sigue.
        </p>
      </header>

      <ComoSeJuega />

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
