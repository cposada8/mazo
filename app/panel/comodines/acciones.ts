'use server'

/**
 * What the gallery's editing screen can do (Phase 72).
 *
 * Same rule as the panel's own actions: a Server Action is a POST anyone can
 * send, so each one checks the key itself. The page having rendered with an
 * upload button proves nothing about who is calling.
 */

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { agregarComodin, quitarComodin } from '@/lib/server/comodines'
import { COOKIE_DEL_PANEL, claveCorrecta } from '@/lib/server/panel'

async function autorizado(): Promise<boolean> {
  const galleta = await cookies()
  return claveCorrecta(galleta.get(COOKIE_DEL_PANEL)?.value)
}

function refrescar() {
  revalidatePath('/panel/comodines')
  revalidatePath('/comodines')
}

export async function subir(
  _estado: string | null,
  datos: FormData,
): Promise<string | null> {
  if (!(await autorizado())) return 'Hace falta la clave.'
  const archivo = datos.get('foto')
  if (!(archivo instanceof File)) return 'Elige una foto.'
  const resultado = await agregarComodin(archivo)
  if (!resultado.ok) return resultado.error
  refrescar()
  return null
}

export async function quitar(datos: FormData): Promise<void> {
  if (!(await autorizado())) return
  const id = String(datos.get('id') ?? '')
  if (id) await quitarComodin(id)
  refrescar()
}
