import type { MetadataRoute } from 'next'

/**
 * The web app manifest: what lets the game be added to a home screen and run
 * standalone, without the browser's own bar taking a fifth of a phone that is
 * already only 287 pixels tall lying down.
 *
 * Orientation is `any` since Phase 19: the table plays upright too, and the
 * phone's own rotation is the player's business.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mazo — Carioca',
    short_name: 'Mazo',
    description: 'Juegos de cartas. Empezando por Carioca.',
    start_url: '/jugar',
    display: 'standalone',
    orientation: 'any',
    background_color: '#022c22',
    theme_color: '#022c22',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icono-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
