import { galeriaDePartida } from '@/lib/server/galeria'
import { PartidaCliente } from './cliente'

/**
 * A partida, by its code (Phase 33). The lobby first, the table once it is
 * dealt — same URL, because it is the same partida.
 *
 * Its comodines are dealt from the partida's own copy of the gallery
 * (Phase 71), not from the gallery as it is now.
 */
export default async function Page({
  params,
}: PageProps<'/partida/[codigo]'>) {
  const { codigo } = await params
  const galeria = await galeriaDePartida(codigo)

  return <PartidaCliente codigo={codigo} galeriaDeComodines={galeria} />
}
