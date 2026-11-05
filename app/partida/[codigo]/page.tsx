import { galeriaDeComodines } from '@/lib/server/galeria'
import { PartidaCliente } from './cliente'

/**
 * A partida, by its code (Phase 33). The lobby first, the table once it is
 * dealt — same URL, because it is the same partida.
 */
export default async function Page({
  params,
}: PageProps<'/partida/[codigo]'>) {
  const { codigo } = await params
  const galeria = await galeriaDeComodines()

  return <PartidaCliente codigo={codigo} galeriaDeComodines={galeria} />
}
