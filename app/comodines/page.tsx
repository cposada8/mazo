import Link from 'next/link'
import { connection } from 'next/server'
import { ChevronLeft } from 'lucide-react'
import { GaleriaDeComodines } from '@/components/galeria'
import { ordenarGaleria } from '@/lib/galeria'
import { galeriaDeComodines } from '@/lib/server/galeria'

/**
 * Every face a comodín may wear, open to anyone (Phase 70).
 *
 * No key and no seat: it is the other entrance to the screen the partida's
 * menu opens over the felt, and a link that can be sent. Read on every
 * request rather than at build, because from Phase 72 the gallery changes
 * without a deploy.
 */

export const metadata = {
  title: 'Los comodines — Mazo',
  description: 'Todas las caras que puede llevar un comodín en Mazo.',
}

export default async function Comodines() {
  await connection()
  const caras = ordenarGaleria(await galeriaDeComodines())

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Mazo
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight">Los comodines</h1>
        <p className="text-muted-foreground text-balance">
          Cada ronda, los comodines llevan una de estas caras, repartidas con la
          semilla de la partida. Toca una para verla grande.
        </p>
      </header>

      <GaleriaDeComodines caras={caras} />

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
