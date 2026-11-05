/**
 * The comodín gallery, editable (Phase 72). Behind the panel's key: the
 * panel's cookie rides on `/panel`, so it already covers this page, and a
 * deployment with no key has no editing at all.
 */

import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { AlInicio, Entrada } from '../cliente'
import { COOKIE_DEL_PANEL, claveCorrecta, hayPanel } from '@/lib/server/panel'
import { listarComodines } from '@/lib/server/comodines'
import { EditorDeComodines } from './cliente'

export const metadata = { title: 'Los comodines — editar' }

export default async function PaginaDeComodines() {
  // Per request, always: whether there is a key is read at run time, not
  // frozen by a build that happened not to have one.
  await connection()
  if (!hayPanel()) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
        <AlInicio />
        <p className="text-muted-foreground text-sm">Este despliegue no tiene panel.</p>
      </main>
    )
  }

  const galleta = await cookies()
  if (!claveCorrecta(galleta.get(COOKIE_DEL_PANEL)?.value)) {
    return (
      <Entrada
        titulo="Los comodines"
        descripcion="Para subir y borrar las fotos de los comodines."
      />
    )
  }

  return <EditorDeComodines comodines={await listarComodines()} />
}
