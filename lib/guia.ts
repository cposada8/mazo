/**
 * La guía (Phase 45): one line that says the single thing to do now.
 *
 * The «Done when» of this phase is a person who has never played Carioca
 * finishing a bot game without asking for help, and a rules screen cannot do
 * that on its own — nobody reads a manual before a game, and the moment help
 * is needed is mid-turn, with the cards already in hand. So the manual is what
 * you consult *afterwards* (`components/reglas.tsx`) and this is what carries
 * a first partida: the next move, in the imperative, derived from the state.
 *
 * Pure, and deliberately so. Every line here is a function of what the table
 * already knows, which is what makes it testable without a screen and what
 * keeps it from ever contradicting the buttons: if `Armar` is disabled, the
 * guide is not telling you to press it.
 *
 * It is not a tutorial and it does not teach the game — it names the move. The
 * reasons live in the rules screen, one tap away in the menu.
 */

export type EstadoDeGuia = {
  /** Somebody else's turn is nobody's business: the relato takes the strip. */
  readonly esTuTurno: boolean
  readonly fase: 'draw' | 'act'
  /** Whether this seat has already laid the contract down. */
  readonly yaBajado: boolean
  /**
   * Whether the mesa may be touched right now — bajado, and not on the turn
   * you bajaste. The one rule a new player breaks first, so the guide never
   * points at the mesa while it is closed.
   */
  readonly mesaAbierta: boolean
  /** How many cards are picked up right now. */
  readonly seleccionadas: number
  /** Grupos set aside for a bajada, waiting for the rest of the contract. */
  readonly apartadas: number
  /** Whether what is set aside satisfies this ronda's contract. */
  readonly contratoCompleto: boolean
  /** Whether there is anything on the mesa to ligar onto. */
  readonly hayMesa: boolean
}

/**
 * The line, or null when there is nothing to say — which is every turn that
 * is not yours. Null is not "no advice", it is "the strip belongs to the
 * relato": what somebody else just did is the more useful sentence while you
 * are waiting.
 */
export function guiar(estado: EstadoDeGuia): string | null {
  if (!estado.esTuTurno) return null

  if (estado.fase === 'draw') {
    return 'Roba: toca el mazo o el descarte.'
  }

  return estado.yaBajado ? guiarBajado(estado) : guiarAntesDeBajarse(estado)
}

/**
 * Before the contract is down, the whole turn is about assembling it — and
 * about knowing when to give up on this turn and simply discard, which is the
 * thing a new player does not realise is allowed.
 */
function guiarAntesDeBajarse(estado: EstadoDeGuia): string | null {
  if (estado.contratoCompleto) {
    return 'Ya tienes el contrato: toca Bajarme.'
  }

  if (estado.seleccionadas >= 3) {
    return 'Toca Armar para apartar ese grupo.'
  }

  if (estado.apartadas > 0) {
    return 'Falta más para el contrato: escoge otras cartas y toca Armar.'
  }

  if (estado.seleccionadas === 1) {
    return 'Toca Botar para terminar tu turno.'
  }

  return 'Escoge 3 o más cartas que formen un grupo y toca Armar. Si no puedes, bota una.'
}

/**
 * Once you are down, the turn is about unloading — and the mesa stays shut
 * for the rest of the turn you bajaste, so that case gets its own line rather
 * than an instruction that would be refused.
 */
function guiarBajado(estado: EstadoDeGuia): string | null {
  if (!estado.mesaAbierta) {
    return 'Te acabas de bajar: la mesa se abre en tu próximo turno. Bota una carta.'
  }

  if (!estado.hayMesa) {
    return 'Bota una carta para terminar tu turno.'
  }

  if (estado.seleccionadas > 0) {
    return 'Toca un grupo de la mesa para poner esas cartas, o toca Botar.'
  }

  return 'Escoge cartas y tócalas contra un grupo de la mesa. O bota una para terminar.'
}

/* ------------------------------------------------------------------ ajustes */

/** Whether to show the guide. Per browser, like the deck finish. */
const CLAVE = 'mazo:guia'

/**
 * On for a first visit, because the person it is for has not chosen anything
 * yet. Absent means never decided — by the reader or by the game.
 */
export function leerGuia(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(CLAVE) !== 'no'
}

/** A deliberate choice, from the menu. It is final: nothing overrides it. */
export function recordarGuia(mostrar: boolean) {
  localStorage.setItem(CLAVE, mostrar ? 'si' : 'no')
}

/**
 * The guide turning itself off, once a whole partida has been finished.
 *
 * Only when nobody ever touched the switch — writing 'si' from the menu is
 * how a person says *keep showing me this*, and a partida ending is not an
 * argument against it. That is the whole reason the setting is stored as
 * absent/si/no rather than as a boolean: absent is a fourth thing, and it is
 * the only state this function is allowed to leave.
 */
export function apagarGuiaSiNadieLaEligio() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(CLAVE) === null) localStorage.setItem(CLAVE, 'no')
}
