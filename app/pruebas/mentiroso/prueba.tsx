'use client'

import { useRouter } from 'next/navigation'
import { MesaMentirosoLocal } from '@/components/mentiroso/local'
import { semillaAleatoria } from '@/lib/semilla'

/** You, and one El Embustero per other seat. */
const nombres = (jugadores: number) => [
  'Tú',
  ...Array.from({ length: jugadores - 1 }, (_, i) => `El Embustero ${i + 1}`),
]

export function PruebaMentiroso({
  seed,
  jugadores,
  balas,
}: {
  seed: string
  jugadores: number
  balas: number
}) {
  const router = useRouter()
  return (
    <MesaMentirosoLocal
      key={`${seed}-${jugadores}`}
      seed={seed}
      jugadores={jugadores}
      nombres={nombres(jugadores)}
      balas={balas}
      onSalir={() => router.push('/')}
      onOtra={() =>
        router.replace(
          `/pruebas/mentiroso?semilla=${semillaAleatoria()}&jugadores=${jugadores}&balas=${balas}`,
        )
      }
    />
  )
}
