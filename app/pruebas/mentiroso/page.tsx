import { semillaAleatoria } from '@/lib/semilla'
import { PruebaMentiroso } from './prueba'

/**
 * El Mentiroso against three bots, before the door knows the game (Phase
 * 79). `?semilla=` replays a deal; without one, a new deal every visit.
 */
export const metadata = { title: 'Mentiroso — prueba' }

export default async function Page({ searchParams }: PageProps<'/pruebas/mentiroso'>) {
  const { semilla } = await searchParams
  const seed = typeof semilla === 'string' && semilla ? semilla : semillaAleatoria()
  return <PruebaMentiroso seed={seed} />
}
