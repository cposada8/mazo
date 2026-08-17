import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { JugarCliente } from './cliente'

/**
 * The gallery of comodín faces is whatever sits in
 * `public/candidatos/comodines` when the site builds. Read here, on the
 * server, so curating the folder — adding, pruning, renaming — is the whole
 * workflow: no list to maintain anywhere in the code.
 *
 * The page is static, so the readdir happens once at build time, which is
 * also exactly when the images themselves are deployed.
 */
const CARPETA = join('candidatos', 'comodines')

export default function Page() {
  let galeria: string[] = []
  try {
    galeria = readdirSync(join(process.cwd(), 'public', CARPETA))
      .filter((nombre) => /\.(jpe?g|png|webp|avif)$/i.test(nombre))
      .sort()
      .map((nombre) => `/${CARPETA}/${nombre}`)
  } catch {
    // No folder, no faces: the comodín keeps its drawn design.
  }

  return <JugarCliente galeriaDeComodines={galeria} />
}
