import { semillaAleatoria } from '@/lib/semilla'
import { PruebaMentiroso } from './prueba'

/**
 * El Mentiroso against bots, before the door knows the game (Phase 79).
 * `?semilla=` replays a deal; without one, a new deal every visit.
 * `?jugadores=` seats 3 to 6 (default 4), to see every size of table.
 * `?balas=` gives each player 1 to 5 bullets (default 3).
 */
export const metadata = { title: 'Mentiroso — prueba' }

export default async function Page({ searchParams }: PageProps<'/pruebas/mentiroso'>) {
  const { semilla, jugadores, balas } = await searchParams
  const seed = typeof semilla === 'string' && semilla ? semilla : semillaAleatoria()
  const n = Number(jugadores)
  const sentados = Number.isInteger(n) && n >= 3 && n <= 6 ? n : 4
  const b = Number(balas)
  const cargadas = Number.isInteger(b) && b >= 1 && b <= 5 ? b : 3
  return <PruebaMentiroso seed={seed} jugadores={sentados} balas={cargadas} />
}
