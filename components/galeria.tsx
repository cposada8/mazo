'use client'

/**
 * The comodín gallery, as a grid of faces (Phase 70).
 *
 * One component for both entrances: the `/comodines` page and the screen
 * over the felt from the partida's menu. A face opens large in an overlay
 * inside the page — not a browser dialog, which would stall the table — and
 * any tap closes it, so on a phone it is one tap in and one tap out.
 */

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CaraDeGaleria } from '@/lib/galeria'
import { cn } from '@/lib/utils'

export function GaleriaDeComodines({
  caras,
  className,
}: {
  caras: readonly CaraDeGaleria[]
  className?: string
}) {
  const [abierta, setAbierta] = useState<CaraDeGaleria | null>(null)

  useEffect(() => {
    if (!abierta) return
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierta(null)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierta])

  if (caras.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        La galería está vacía: los comodines llevan su dibujo de siempre.
      </p>
    )
  }

  const enJuego = caras.filter((cara) => cara.enJuego).length

  return (
    <>
      {enJuego > 0 && (
        <p className="text-muted-foreground mb-2 text-xs">
          Primero {enJuego === 1 ? 'la que está' : `las ${enJuego} que están`}{' '}
          en los comodines de esta ronda.
        </p>
      )}
      <ul className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
        {caras.map((cara) => (
          <li key={cara.src}>
            <button
              type="button"
              onClick={() => setAbierta(cara)}
              aria-label={cara.enJuego ? 'Ver comodín en juego' : 'Ver comodín'}
              className={cn(
                'relative block aspect-[8/11] w-full overflow-hidden rounded-md border bg-violet-500/10 shadow-sm',
                cara.enJuego &&
                  'ring-offset-background ring-2 ring-amber-500 ring-offset-1',
              )}
            >
              <Image
                src={cara.src}
                alt=""
                fill
                sizes="(min-width: 640px) 120px, 33vw"
                className="object-cover"
              />
              {cara.enJuego && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-medium tracking-wide text-amber-200 uppercase">
                  En juego
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {abierta && (
        <div
          role="presentation"
          onClick={() => setAbierta(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="relative aspect-[8/11] max-h-[80dvh] w-full max-w-[min(100%,calc(80dvh*8/11))] overflow-hidden rounded-xl border border-white/20 shadow-2xl">
            <Image
              src={abierta.src}
              alt={abierta.enJuego ? 'Comodín en juego' : 'Comodín'}
              fill
              sizes="(min-width: 640px) 60vh, 100vw"
              className="object-cover"
            />
            {abierta.enJuego && (
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-xs font-medium tracking-wide text-amber-200 uppercase">
                En juego esta ronda
              </span>
            )}
          </div>
          <button
            type="button"
            autoFocus
            aria-label="Cerrar"
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-[calc(env(safe-area-inset-right)+0.75rem)] rounded-full bg-black/60 p-2 text-white ring-1 ring-white/20"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </>
  )
}
