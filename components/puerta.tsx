'use client'

/**
 * The door (Phase 33). Two things, and nothing else: create a partida, or
 * join one with its code. Since Phase 78 creating asks which game; joining
 * does not — the code knows.
 *
 * There is no solo mode — creating a partida seats you as host with three
 * bots already at the table, and playing alone is simply not pruning them.
 */

import { useQuery } from '@tanstack/react-query'
import { CornerUpLeft, Loader2, LogIn, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useIdentidad } from '@/components/identidad'
import { CONFIG_POR_DEFECTO } from '@/lib/engine'
import { LARGO_DE_CODIGO } from '@/lib/codigo'
import { DESCRIPCION_DE_JUEGO, JUEGOS, type Juego, NOMBRE_DE_JUEGO } from '@/lib/juegos'
import { crearPartidaRemota, dondeEstoyRemoto } from '@/lib/lobby'

export function Puerta() {
  const router = useRouter()
  const { identidad } = useIdentidad()
  const [codigo, setCodigo] = useState('')
  const [creando, setCreando] = useState<Juego | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  /**
   * The way back (Phase 37). A seat belongs to this browser's secreto, not to
   * a connection, so a page that closed — or a battery that died — left a
   * chair that is still yours. The door asks whether there is one and offers
   * it before anything else.
   */
  const sentado = useQuery({
    queryKey: ['asiento', identidad?.secreto],
    enabled: Boolean(identidad),
    refetchOnWindowFocus: true,
    queryFn: () => dondeEstoyRemoto(identidad!.secreto),
  })

  const crear = async (juego: Juego) => {
    if (!identidad || creando) return
    setCreando(juego)
    setAviso(null)
    try {
      const vista = await crearPartidaRemota({
        secreto: identidad.secreto,
        alias: identidad.alias,
        juego,
        config: CONFIG_POR_DEFECTO,
        segundosPorTurno: 45,
        segundosBot: 2,
      })
      router.push(`/partida/${vista.partida.codigo}`)
    } catch {
      setAviso('No se pudo crear la partida. Intenta otra vez.')
      setCreando(null)
    }
  }

  const unirse = (evento: React.FormEvent) => {
    evento.preventDefault()
    const limpio = codigo.trim().toUpperCase()
    if (limpio.length !== LARGO_DE_CODIGO) {
      setAviso(`El código tiene ${LARGO_DE_CODIGO} letras.`)
      return
    }
    router.push(`/partida/${limpio}`)
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Jugar
      </h2>

      {sentado.data && (
        <button
          type="button"
          onClick={() => router.push(`/partida/${sentado.data}`)}
          className="border-input hover:bg-accent flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
        >
          <CornerUpLeft className="size-4 shrink-0" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Vuelve a la mesa</span>
            <span className="text-muted-foreground text-xs">
              Sigues sentado en la partida{' '}
              <span className="font-mono tracking-widest">{sentado.data}</span>
            </span>
          </span>
        </button>
      )}

      {/* Phase 78: one button per game, side by side — the choice is the
          button, so creating stays one tap. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Crear una partida de…</p>
        <div className="grid grid-cols-2 gap-2">
          {JUEGOS.map((juego) => (
            <button
              key={juego}
              type="button"
              onClick={() => crear(juego)}
              disabled={!identidad || creando !== null}
              className="bg-primary text-primary-foreground flex flex-col items-start gap-1 rounded-md px-4 py-3 text-left disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {creando === juego ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {NOMBRE_DE_JUEGO[juego]}
              </span>
              <span className="text-primary-foreground/75 text-xs leading-snug">
                {DESCRIPCION_DE_JUEGO[juego]}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Empiezas de host con tres bots en la mesa. Quítalos, o invita gente con
        el código.
      </p>

      <form onSubmit={unirse} className="flex gap-2">
        <input
          value={codigo}
          onChange={(evento) => {
            setCodigo(evento.target.value.toUpperCase())
            setAviso(null)
          }}
          placeholder="Código"
          aria-label="Código de la partida"
          maxLength={LARGO_DE_CODIGO}
          autoCapitalize="characters"
          autoComplete="off"
          className="border-input bg-background min-w-0 flex-1 rounded-md border px-3 py-3 font-mono text-sm tracking-[0.3em] uppercase"
        />
        <button
          type="submit"
          className="border-input hover:bg-accent flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors"
        >
          <LogIn className="size-4" aria-hidden />
          Unirme
        </button>
      </form>

      {aviso && <p className="text-sm text-red-600 dark:text-red-400">{aviso}</p>}
    </section>
  )
}
