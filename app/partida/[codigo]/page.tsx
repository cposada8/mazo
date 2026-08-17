import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PartidaCliente } from './cliente'

/**
 * A partida, by its code (Phase 33). The lobby first, the table once it is
 * dealt — same URL, because it is the same partida.
 *
 * The comodín gallery is read here for the same reason `/jugar` reads it: the
 * folder is the list, and curating it is editing files.
 */
const CARPETA = join('candidatos', 'comodines')

export default async function Page({
  params,
}: PageProps<'/partida/[codigo]'>) {
  const { codigo } = await params

  let galeria: string[] = []
  try {
    galeria = readdirSync(join(process.cwd(), 'public', CARPETA))
      .filter((nombre) => /\.(jpe?g|png|webp|avif)$/i.test(nombre))
      .sort()
      .map((nombre) => `/${CARPETA}/${nombre}`)
  } catch {
    // No folder, no faces: the comodín keeps its drawn design.
  }

  return <PartidaCliente codigo={codigo} galeriaDeComodines={galeria} />
}
