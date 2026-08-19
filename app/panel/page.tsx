/**
 * Which tables are still open (Phase 44).
 *
 * The list exists so the owner can *see*; keeping it short is the job of the
 * rules, not of this page. A table with no people left in it closes itself,
 * a retired seat's poll no longer drives anybody's bots, and a day of silence
 * ends a partida the next time somebody opens the door.
 */

import { cookies } from 'next/headers'
import { Entrada, Panel } from './cliente'
import {
  COOKIE_DEL_PANEL,
  claveCorrecta,
  hayPanel,
  listarPartidas,
} from '@/lib/server/panel'

export const metadata = { title: 'Partidas abiertas' }

export default async function PaginaDelPanel() {
  // No key configured, no panel. A deployment where nobody chose one is not a
  // deployment with an open door.
  if (!hayPanel()) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted-foreground text-sm">
          Este despliegue no tiene panel.
        </p>
      </main>
    )
  }

  const galleta = await cookies()
  if (!claveCorrecta(galleta.get(COOKIE_DEL_PANEL)?.value)) return <Entrada />

  const { partidas, ahora } = await listarPartidas()
  return <Panel partidas={partidas} ahora={ahora} />
}
