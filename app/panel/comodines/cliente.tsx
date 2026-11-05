'use client'

/**
 * The gallery's editing screen, drawn (Phase 72).
 *
 * A photo from a phone's camera is several megabytes; a comodín is drawn at
 * most a few hundred pixels wide. So the browser shrinks it before it is
 * sent — which also keeps it under a Server Action's 1 MB body — and the
 * server still checks size and type on its own (`lib/server/comodines.ts`).
 */

import { ChevronLeft, ImagePlus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useRef, useState, useTransition } from 'react'
import type { ComodinEditable } from '@/lib/server/comodines'
import { quitar, subir } from './acciones'

/** The long side after shrinking: twice the largest a comodín is drawn. */
const LADO_MAXIMO = 1000
const CALIDAD = 0.85

/** The photo, shrunk to JPEG in the browser. Orientation is applied first. */
async function achicar(archivo: File): Promise<File> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto)
  imagen.close()
  const blob = await new Promise<Blob | null>((listo) =>
    lienzo.toBlob(listo, 'image/jpeg', CALIDAD),
  )
  if (!blob) throw new Error('No se pudo achicar la foto.')
  const nombre = archivo.name.replace(/\.[^.]*$/, '') + '.jpg'
  return new File([blob], nombre, { type: 'image/jpeg' })
}

export function EditorDeComodines({
  comodines,
}: {
  comodines: readonly ComodinEditable[]
}) {
  const [error, accion, enviando] = useActionState(subir, null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [preparando, startPreparar] = useTransition()
  const entrada = useRef<HTMLInputElement>(null)
  const ocupado = enviando || preparando

  const elegir = (archivo: File | undefined) => {
    if (!archivo) return
    setErrorLocal(null)
    startPreparar(async () => {
      try {
        const datos = new FormData()
        datos.set('foto', await achicar(archivo))
        startPreparar(() => accion(datos))
      } catch {
        setErrorLocal('No se pudo leer esa foto.')
      } finally {
        if (entrada.current) entrada.current.value = ''
      }
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/panel"
          className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Panel
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Los comodines</h1>
        <p className="text-muted-foreground text-sm">
          {comodines.length === 1 ? 'Una cara' : `${comodines.length} caras`}. Lo que
          subas o quites vale para las partidas nuevas; las que están en juego siguen
          con las suyas.
        </p>
      </div>

      <label
        className={`border-input hover:bg-accent flex w-fit cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${ocupado ? 'pointer-events-none opacity-50' : ''}`}
      >
        <ImagePlus className="size-4" aria-hidden />
        {ocupado ? 'Subiendo…' : 'Subir una foto'}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={ocupado}
          onChange={(e) => elegir(e.target.files?.[0])}
        />
      </label>
      {(errorLocal ?? error) && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorLocal ?? error}</p>
      )}

      {comodines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          La galería está vacía: los comodines llevan la estrella dibujada.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {comodines.map((comodin) => (
            <Cara key={comodin.id} comodin={comodin} />
          ))}
        </ul>
      )}
    </main>
  )
}

function Cara({ comodin }: { comodin: ComodinEditable }) {
  const [confirmando, setConfirmando] = useState(false)
  const [quitando, startQuitar] = useTransition()

  return (
    <li className="flex flex-col gap-1.5">
      <div className="bg-muted relative aspect-[5/7] overflow-hidden rounded-lg border">
        <Image
          src={comodin.url}
          alt={comodin.nombre}
          fill
          sizes="(min-width: 640px) 160px, 33vw"
          className="object-cover"
        />
      </div>
      {confirmando ? (
        <div className="flex gap-1">
          <button
            type="button"
            disabled={quitando}
            onClick={() => {
              const datos = new FormData()
              datos.set('id', comodin.id)
              startQuitar(() => quitar(datos))
            }}
            className="flex-1 rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {quitando ? 'Quitando…' : 'Quitar'}
          </button>
          <button
            type="button"
            disabled={quitando}
            onClick={() => setConfirmando(false)}
            className="border-input flex-1 rounded-md border px-2 py-1.5 text-xs"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors"
          aria-label={`Quitar ${comodin.nombre}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Quitar
        </button>
      )}
    </li>
  )
}
