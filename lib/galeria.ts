/**
 * The order the comodín gallery is shown in (Phase 70).
 *
 * Inside a partida the gallery answers one question first — *which faces are
 * on this ronda's comodines?* — so those lead, marked, in the order the deal
 * gave them; the rest of the gallery follows in its own order. A face is
 * shown once even when two comodines wear it (a gallery smaller than the four
 * comodines deals faces twice).
 *
 * A face in play that the gallery no longer lists still leads: from Phase 71
 * a partida keeps the list it was created with, so the gallery can lose a
 * face that a ronda in progress is still wearing.
 */

export type CaraDeGaleria = {
  /** URL an <img> can load. */
  readonly src: string
  /** True when a comodín wears it this ronda. */
  readonly enJuego: boolean
}

export function ordenarGaleria(
  galeria: readonly string[],
  enJuego: readonly string[] = [],
): CaraDeGaleria[] {
  const vistas = new Set<string>()
  const caras: CaraDeGaleria[] = []

  for (const src of enJuego) {
    if (vistas.has(src)) continue
    vistas.add(src)
    caras.push({ src, enJuego: true })
  }
  for (const src of galeria) {
    if (vistas.has(src)) continue
    vistas.add(src)
    caras.push({ src, enJuego: false })
  }
  return caras
}
