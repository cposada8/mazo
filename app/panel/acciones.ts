'use server'

/**
 * What the panel can do (Phase 44).
 *
 * A Server Action is a POST anyone can send, so each one checks the key
 * again: the page having rendered is not evidence that the caller is the
 * owner. The cookie is the key itself, httpOnly, so the browser can send it
 * and no script can read it.
 */

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { barrer } from '@/lib/server/partidas'
import {
  COOKIE_DEL_PANEL,
  borrarTerminadas,
  cerrarPartida,
  claveCorrecta,
} from '@/lib/server/panel'

/** Six hours: long enough for an evening of tidying, short enough to expire. */
const HORAS_DE_SESION = 6

export async function entrar(_estado: string | null, datos: FormData): Promise<string | null> {
  const clave = String(datos.get('clave') ?? '')
  if (!claveCorrecta(clave)) return 'Esa no es la clave.'

  const galleta = await cookies()
  galleta.set(COOKIE_DEL_PANEL, clave, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: HORAS_DE_SESION * 3600,
    path: '/panel',
  })
  return null
}

export async function salir() {
  const galleta = await cookies()
  galleta.delete({ name: COOKIE_DEL_PANEL, path: '/panel' })
}

/** Every action re-checks: the cookie is the credential, not the render. */
async function autorizado(): Promise<boolean> {
  const galleta = await cookies()
  return claveCorrecta(galleta.get(COOKIE_DEL_PANEL)?.value)
}

export async function cerrar(datos: FormData) {
  if (!(await autorizado())) return
  const codigo = String(datos.get('codigo') ?? '')
  if (codigo) await cerrarPartida(codigo)
  revalidatePath('/panel')
}

export async function barrerAhora() {
  if (!(await autorizado())) return
  await barrer()
  revalidatePath('/panel')
}

export async function limpiarTerminadas() {
  if (!(await autorizado())) return
  await borrarTerminadas()
  revalidatePath('/panel')
}
