'use client'

/**
 * The lobby (Phase 33).
 *
 * Everyone at a code polls this screen and sees the same table filling up.
 * The host owns the rules — contracts, comodines, the clocks — and everyone
 * owns their own alias. Sitting down happens by itself on arrival: you came
 * here with a code, which is what asking for a seat means.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronDown,
  Copy,
  Crown,
  Loader2,
  Play,
  Plus,
  UserRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIdentidad } from '@/components/identidad'
import { BOTS, BOT_POR_DEFECTO, botPorId } from '@/lib/bots'
import {
  CATALOGO,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PartidaConfig,
} from '@/lib/engine'
import {
  type Accion,
  type RespuestaDeLobby,
  type VistaDeLobby,
  actuar,
  leerLobby,
  mensajeDeLobby,
} from '@/lib/lobby'
import { semillaAleatoria } from '@/lib/semilla'
import { cn } from '@/lib/utils'

/** How often a lobby asks the server whether anything changed. */
const MS_ENTRE_CONSULTAS = 2000

/** Seconds per human turn on offer. 45 is the default the owner chose. */
export const SEGUNDOS_POR_TURNO = [30, 45, 60, 90, 120] as const
const SEGUNDOS_BOT = [1, 2, 3, 5] as const

export function Lobby({
  codigo,
  onEmpezar,
  onSalir,
}: {
  codigo: string
  /** Called when the deal lands, with everything the table needs. */
  onEmpezar: (vista: VistaDeLobby) => void
  /** Leaving before the deal: the seat simply goes, and the others close up. */
  onSalir: () => void
}) {
  const { identidad } = useIdentidad()
  const clienteDeConsultas = useQueryClient()
  const [aviso, setAviso] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  /** One definition, used by the poll and by every optimistic write. */
  const clave = useMemo(
    () => ['lobby', codigo, identidad?.secreto],
    [codigo, identidad?.secreto],
  )

  const consulta = useQuery({
    queryKey: clave,
    enabled: Boolean(identidad),
    refetchInterval: MS_ENTRE_CONSULTAS,
    // Keep asking with the tab in the background: somebody waiting for
    // friends to arrive will be doing something else while they wait.
    refetchIntervalInBackground: true,
    queryFn: () => leerLobby(codigo, identidad!.secreto),
  })

  const respuesta = consulta.data
  const vista = respuesta?.ok ? respuesta.vista : null
  const partida = vista?.partida ?? null

  const mutacion = useMutation({
    mutationFn: (accion: Accion) => actuar(codigo, identidad!.secreto, accion),
    /**
     * Show the change before the server has agreed to it.
     *
     * Choosing the rules used to be local state and felt like it; going
     * through the server made every tap wait a round trip, which on a phone
     * is a checkbox that hesitates. The host is the only one who may change
     * these, so there is nothing to lose a race with — and the poll is
     * cancelled first, or an answer already in flight would put the old
     * value straight back.
     */
    onMutate: async (accion: Accion) => {
      if (accion.tipo !== 'ajustes') return
      await clienteDeConsultas.cancelQueries({ queryKey: clave })

      const previa = clienteDeConsultas.getQueryData<RespuestaDeLobby>(clave)
      if (!previa?.ok) return { previa }

      clienteDeConsultas.setQueryData(clave, {
        ...previa,
        vista: {
          ...previa.vista,
          partida: {
            ...previa.vista.partida,
            ...(accion.config ? { config: accion.config } : {}),
            ...(accion.segundosPorTurno !== undefined
              ? { segundosPorTurno: accion.segundosPorTurno }
              : {}),
            ...(accion.segundosBot !== undefined
              ? { segundosBot: accion.segundosBot }
              : {}),
            ...(accion.verDescarte !== undefined
              ? { verDescarte: accion.verDescarte }
              : {}),
            ...(accion.verHistorial !== undefined
              ? { verHistorial: accion.verHistorial }
              : {}),
          },
        },
      } satisfies RespuestaDeLobby)

      return { previa }
    },
    onError: (_error, _accion, contexto) => {
      // The server never heard it: put back exactly what was on screen.
      if (contexto?.previa) clienteDeConsultas.setQueryData(clave, contexto.previa)
      setAviso('No se pudo cambiar eso. Intenta otra vez.')
    },
    onSuccess: (respuesta) => {
      if (respuesta.ok) {
        setAviso(null)
        clienteDeConsultas.setQueryData(clave, respuesta)
      } else {
        setAviso(mensajeDeLobby(respuesta.code))
        void consulta.refetch()
      }
    },
  })

  /**
   * Arriving with a code *is* asking for a seat, so sitting down needs no
   * button. Runs once, when the first read comes back saying you have no seat
   * — and only while the lobby is still open. The latch is a ref rather than
   * state: nothing renders differently because we asked, and a second poll
   * must not fire a second request.
   */
  const pedido = useRef(false)
  useEffect(() => {
    if (pedido.current || !identidad || !partida) return
    if (vista?.asiento !== null) return
    if (partida.fase !== 'lobby') return
    pedido.current = true
    mutacion.mutate({ tipo: 'unirse', alias: identidad.alias })
  }, [identidad, partida, vista, mutacion])

  // The deal has landed — for everyone at the table, not just whoever pressed.
  useEffect(() => {
    if (vista && vista.partida.fase === 'jugando' && vista.asiento !== null) {
      onEmpezar(vista)
    }
  }, [vista, onEmpezar])

  if (consulta.isPending) return <Cargando />

  if (respuesta && !respuesta.ok) {
    return <NoExiste mensaje={mensajeDeLobby(respuesta.code)} />
  }
  if (!partida || !vista) return <Cargando />

  const yo = partida.asientos.find((asiento) => asiento.indice === vista.asiento)
  const soyHost = Boolean(yo?.esHost)
  const humanos = partida.asientos.filter((asiento) => !asiento.esBot)
  const puedeEmpezar = partida.asientos.length >= MIN_PLAYERS

  const ajustar = (cambio: Partial<Omit<Accion & { tipo: 'ajustes' }, 'tipo'>>) =>
    mutacion.mutate({ tipo: 'ajustes', ...cambio })

  const alternarContrato = (id: string) => {
    const encendidos = new Set(partida.config.contratos.map((c) => c.id))
    if (encendidos.has(id)) encendidos.delete(id)
    else encendidos.add(id)
    const contratos = CATALOGO.filter((contrato) => encendidos.has(contrato.id))
    if (contratos.length === 0) return
    ajustar({ config: { ...partida.config, contratos } satisfies PartidaConfig })
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSalir}
          className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Salir de la partida
        </button>
        <h1 className="text-3xl font-semibold tracking-tight">La mesa</h1>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(partida.codigo)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="border-input hover:bg-accent flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
        >
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-muted-foreground text-xs">
              Código para invitar
            </span>
            <span className="font-mono text-2xl tracking-[0.4em]">
              {partida.codigo}
            </span>
          </span>
          {copiado ? (
            <Check className="size-4 shrink-0" aria-hidden />
          ) : (
            <Copy className="text-muted-foreground size-4 shrink-0" aria-hidden />
          )}
          <span className="sr-only">Copiar el código</span>
        </button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          En la mesa · {partida.asientos.length}
        </h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border">
          {partida.asientos.map((asiento) => (
            <li
              key={asiento.indice}
              className="bg-card flex items-center gap-3 px-4 py-3 text-sm"
            >
              {asiento.esBot ? (
                <Bot className="text-muted-foreground size-4 shrink-0" aria-hidden />
              ) : (
                <UserRound
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              )}
              {asiento.esBot ? (
                <QuienJuega
                  bot={asiento.bot}
                  puedeElegir={soyHost}
                  onElegir={(bot) =>
                    mutacion.mutate({ tipo: 'cambiarBot', indice: asiento.indice, bot })
                  }
                />
              ) : (
                <span className="flex-1 truncate">
                  {asiento.alias}
                  {asiento.indice === vista.asiento && (
                    <span className="text-muted-foreground"> · tú</span>
                  )}
                </span>
              )}
              {asiento.esHost && (
                <Crown className="text-muted-foreground size-3.5" aria-hidden />
              )}
              {soyHost && asiento.esBot && partida.asientos.length > MIN_PLAYERS && (
                <button
                  type="button"
                  onClick={() => mutacion.mutate({ tipo: 'quitar', indice: asiento.indice })}
                  aria-label={`Quitar a ${asiento.alias}`}
                  className="text-muted-foreground hover:text-foreground -mr-1 p-1"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>

        {soyHost && partida.asientos.length < MAX_PLAYERS && (
          <button
            type="button"
            onClick={() => mutacion.mutate({ tipo: 'bot', bot: BOT_POR_DEFECTO.id })}
            className="border-input hover:bg-accent flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors"
          >
            <Plus className="size-4" aria-hidden />
            Agregar un bot
          </button>
        )}
      </section>

      {soyHost ? (
        <Ajustes
          partida={partida}
          onContrato={alternarContrato}
          onComodines={(comodines) =>
            ajustar({ config: { ...partida.config, comodines } })
          }
          onSegundosPorTurno={(segundosPorTurno) => ajustar({ segundosPorTurno })}
          onSegundosBot={(segundosBot) => ajustar({ segundosBot })}
          onVerDescarte={(verDescarte) => ajustar({ verDescarte })}
          onVerHistorial={(verHistorial) => ajustar({ verHistorial })}
        />
      ) : (
        <ResumenDeAjustes partida={partida} />
      )}

      {aviso && <p className="text-sm text-red-600 dark:text-red-400">{aviso}</p>}

      {soyHost ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!puedeEmpezar || mutacion.isPending}
            onClick={() =>
              mutacion.mutate({ tipo: 'empezar', seed: semillaAleatoria() })
            }
            className="bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-medium disabled:opacity-50"
          >
            <Play className="size-4" aria-hidden />
            Repartir
          </button>
          {humanos.length > 1 && (
            <p className="text-muted-foreground text-xs">
              Con más de una persona la partida la lleva el servidor: cada quien
              ve solo su mano, y la mesa avanza aunque cierres la página.
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Esperando a que {partida.asientos.find((a) => a.esHost)?.alias ?? 'el host'}{' '}
          reparta…
        </p>
      )}
    </main>
  )
}

/**
 * A bot seat: which personality is playing it, and — for the host — a way to
 * change it.
 *
 * The name shown is the bot's own, because at this table that is the only
 * thing a bot could be called, and the line under it is what it does. Everyone
 * else reads the same two lines without the picker: knowing who you are up
 * against is not a privilege of the host.
 */
function QuienJuega({
  bot,
  puedeElegir,
  onElegir,
}: {
  bot: string | null
  puedeElegir: boolean
  onElegir: (bot: string) => void
}) {
  const quien = botPorId(bot)

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      {puedeElegir ? (
        <span className="relative flex items-center">
          <select
            value={quien.id}
            onChange={(evento) => onElegir(evento.target.value)}
            aria-label={`Quién juega en este asiento, ahora ${quien.nombre}`}
            className="focus-visible:ring-ring w-full appearance-none truncate rounded-sm bg-transparent pr-5 focus-visible:ring-2 focus-visible:outline-none"
          >
            {BOTS.map((otro) => (
              <option key={otro.id} value={otro.id}>
                {otro.nombre}
              </option>
            ))}
          </select>
          <ChevronDown
            className="text-muted-foreground pointer-events-none absolute right-0 size-3.5"
            aria-hidden
          />
        </span>
      ) : (
        <span className="truncate">{quien.nombre}</span>
      )}
      <span className="text-muted-foreground truncate text-xs">
        {quien.descripcion}
      </span>
    </span>
  )
}

function Ajustes({
  partida,
  onContrato,
  onComodines,
  onSegundosPorTurno,
  onSegundosBot,
  onVerDescarte,
  onVerHistorial,
}: {
  partida: NonNullable<VistaDeLobby['partida']>
  onContrato: (id: string) => void
  onComodines: (comodines: boolean) => void
  onSegundosPorTurno: (segundos: number) => void
  onSegundosBot: (segundos: number) => void
  onVerDescarte: (ver: boolean) => void
  onVerHistorial: (ver: boolean) => void
}) {
  const encendidos = new Set(partida.config.contratos.map((c) => c.id))

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Los repartos
        </h2>
        <ul className="flex flex-col gap-px overflow-hidden rounded-lg border">
          {CATALOGO.map((contrato, i) => {
            const activo = encendidos.has(contrato.id)
            return (
              <li key={contrato.id}>
                <button
                  type="button"
                  onClick={() => onContrato(contrato.id)}
                  aria-pressed={activo}
                  className="bg-card hover:bg-accent flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                >
                  {/* The tick is what says "on" — a filled square alone reads
                      as neither, which is exactly how it was misread. */}
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border text-xs',
                      activo
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {activo ? '✓' : ''}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className={cn('flex-1', !activo && 'text-muted-foreground')}>
                    {contrato.nombre}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <Interruptor
        titulo="Con comodines"
        detalle="Sin ellos, el mazo se reparte sin ningún comodín."
        activo={partida.config.comodines}
        onCambiar={onComodines}
      />

      <Escogencia
        titulo="Tiempo por jugada"
        detalle="Si se acaba, se roba del mazo y se bota una carta al azar."
        opciones={SEGUNDOS_POR_TURNO}
        valor={partida.segundosPorTurno}
        onCambiar={onSegundosPorTurno}
      />

      <Escogencia
        titulo="Los bots piensan"
        opciones={SEGUNDOS_BOT}
        valor={partida.segundosBot}
        onCambiar={onSegundosBot}
      />

      <Interruptor
        titulo="Se puede revisar el descarte"
        detalle="Apágalo si recordar debe ser parte del juego."
        activo={partida.verDescarte}
        onCambiar={onVerDescarte}
      />

      <Interruptor
        titulo="Se puede releer lo que pasó"
        activo={partida.verHistorial}
        onCambiar={onVerHistorial}
      />
    </section>
  )
}

function ResumenDeAjustes({
  partida,
}: {
  partida: NonNullable<VistaDeLobby['partida']>
}) {
  return (
    <section className="text-muted-foreground flex flex-col gap-1 text-sm">
      <h2 className="text-xs font-medium tracking-widest uppercase">
        Lo que escogió el host
      </h2>
      <p>
        {partida.config.contratos.length} repartos ·{' '}
        {partida.config.comodines ? 'con comodines' : 'sin comodines'} ·{' '}
        {partida.segundosPorTurno} s por jugada
      </p>
    </section>
  )
}

function Interruptor({
  titulo,
  detalle,
  activo,
  onCambiar,
}: {
  titulo: string
  detalle?: string
  activo: boolean
  onCambiar: (activo: boolean) => void
}) {
  return (
    <label className="border-input hover:bg-accent flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors">
      {/* A real checkbox: the platform draws it, so on and off are never a
          question of what our own square happens to mean. */}
      <input
        type="checkbox"
        checked={activo}
        onChange={() => onCambiar(!activo)}
        className="size-4 shrink-0 accent-current"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm">{titulo}</span>
        {detalle && <span className="text-muted-foreground text-xs">{detalle}</span>}
      </span>
    </label>
  )
}

function Escogencia({
  titulo,
  detalle,
  opciones,
  valor,
  onCambiar,
}: {
  titulo: string
  detalle?: string
  opciones: readonly number[]
  valor: number
  onCambiar: (valor: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {titulo}
      </h2>
      <div className="flex gap-2">
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => onCambiar(opcion)}
            className={cn(
              'border-input flex-1 rounded-md border py-2 text-sm tabular-nums transition-colors',
              opcion === valor
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent',
            )}
          >
            {opcion}s
          </button>
        ))}
      </div>
      {detalle && <p className="text-muted-foreground text-xs">{detalle}</p>}
    </div>
  )
}

function Cargando() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-6 py-12">
      <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
    </main>
  )
}

function NoExiste({ mensaje }: { mensaje: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{mensaje}</h1>
      <Link
        href="/"
        className="bg-primary text-primary-foreground rounded-md px-4 py-3 text-center text-sm font-medium"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
