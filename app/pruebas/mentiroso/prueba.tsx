'use client'

import { useRouter } from 'next/navigation'
import { MesaMentirosoLocal } from '@/components/mentiroso/local'
import { semillaAleatoria } from '@/lib/semilla'

const NOMBRES = ['Tú', 'El Embustero 1', 'El Embustero 2', 'El Embustero 3']

export function PruebaMentiroso({ seed }: { seed: string }) {
  const router = useRouter()
  return (
    <MesaMentirosoLocal
      key={seed}
      seed={seed}
      jugadores={NOMBRES.length}
      nombres={NOMBRES}
      onSalir={() => router.push('/')}
      onOtra={() => router.replace(`/pruebas/mentiroso?semilla=${semillaAleatoria()}`)}
    />
  )
}
