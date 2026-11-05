import { semillaAleatoria } from '@/lib/semilla'
import { PruebaMentiroso } from './prueba'

/**
 * El Mentiroso against bots, before the door knows the game (Phase 79).
 * `?semilla=` replays a deal; without one, a new deal every visit.
 * `?jugadores=` seats 3 to 6 (default 4), to see every size of table.
 */
export const metadata = { title: 'Mentiroso — prueba' }

export default async function Page({ searchParams }: PageProps<'/pruebas/mentiroso'>) {
  const { semilla, jugadores } = await searchParams
  const seed = typeof semilla === 'string' && semilla ? semilla : semillaAleatoria()
  const n = Number(jugadores)
  const sentados = Number.isInteger(n) && n >= 3 && n <= 6 ? n : 4
  return <PruebaMentiroso seed={seed} jugadores={sentados} />
}
