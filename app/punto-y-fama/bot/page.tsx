import { BotQueAdivina } from '@/components/puntoyfama/bot'

/**
 * Punto y Fama's bot (Phase 105): a door of its own, not a partida. It
 * plays in the phone alone — your number never leaves your head.
 */

export const metadata = {
  title: 'El bot adivina tu número — Punto y Fama',
  description: 'Piensa un número sin cifras repetidas; el bot lo adivina con tus puntos y famas.',
}

export default function Page() {
  return <BotQueAdivina />
}
