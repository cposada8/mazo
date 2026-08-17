# Project status — pick up here

Last updated after Phase 25, and the roadmap update that added Phases 26–28.

Read this first, then `mission.md` for the why, `carioca-rules.md` for the game,
`tech-stack.md` for the stack, and `roadmap.md` for what comes next. This file is
the short version and the handoff point; the roadmap is the authority on
sequencing.

**Keep this file current.** Update it at the end of every phase — a stale status
doc is worse than none.

---

## Where things stand

Phases 0–25 are done. **Carioca is playable, and looks like a card table.**
Open `/jugar` on a phone — held either way — and play a full partida against
bots: draw, lay down, unload onto anyone's grupos, discard, and see the
scoreboard at the end.

Milestones 1 and 2 are both complete. What is missing is other people —
Milestone 3 makes the bots worth playing, Milestone 4 puts friends at the
table.

| Phase | | |
| --- | --- | --- |
| 0 | Rules written down | ✅ |
| 1 | Project skeleton, deployed | ✅ |
| 2 | Cards, seeded randomness, dealing | ✅ |
| 3 | Grupo validation | ✅ |
| 4 | `/pruebas` page | ✅ |
| 5 | The ronda state machine | ✅ |
| 6 | The mesa | ✅ |
| 7 | Full partida and scoring | ✅ |
| 8 | Escenarios: dictated deals | ✅ |
| 9 | El Codicioso, the baseline bot | ✅ |
| 10 | The table on screen | ✅ |
| 11 | Playing it against bots | ✅ |
| 12 | Dark mode | ✅ |
| 13 | Arranging your hand | ✅ |
| 14 | Setting up a partida, seeing the score | ✅ |
| 15 | Reading your own hand | ✅ |
| 16 | Dev before prod: a branch and its own URL | ✅ |
| 17 | The table: seats around it, grupos in the middle | ✅ |
| 18 | Room to play: fullscreen, and sizes that fit the phone | ✅ |
| 19 | Standing up: the table works upright too | ✅ |
| 20 | Turning the right way, and a table worth looking at | ✅ |
| 21 | The clock: bots think for a set time, visibly | ✅ |
| 22 | What just happened: the card travels, and a line says so | ✅ |
| 23 | The comodín that slides | ✅ |
| 24 | Watching the table work: descarte, historial, latched sort | ✅ |
| 25 | Cards with corners | ✅ |
| 26 | Going out by ligando | ✅ |
| 27 | Sin comodines, and the flipped defaults | ✅ |
| 28 | Ajustes from inside the partida | ← **next** |
| 29–31 | Bot framework and personalities | not started |
| 32–35 | Online: persistence, rooms, server play, real-time | not started |

**The table now holds up on a real phone, held either way.** The lanes built
in Phase 18 survive a 615 × 287 viewport and double as the portrait
arrangement (19). The felt is black with a red rim line and play runs
anticlockwise, as the rules now say in writing (20). Bots visibly think for a
set time, the countdown drawn on the ficha (21). Every move is narrated and
animated under one rule — the line may only say what everybody saw — and the
descarte and the historial can be browsed from the table (22, 24). Cards are
corner-indexed so a dealt hand fits without scrolling, and the deck comes in
two finishes (25). The comodín that slides across an escala's end, found at
the table, went into the rules and then the engine (23).

Also there, off the roadmap: **a ronda no longer slips past you** — when
somebody goes out the game pauses on a who-won screen and deals the next
reparto only on «Siguiente reparto». The pause lives in `usePartida`; the
engine still closes and deals in one move.

**What goes next came from the owner's latest games** (Phases 26–28): a hand
emptied by ligar must win instead of freezing the game, the setup screen
gains a sin-comodines option and flips its defaults — cartas oscuras, no
fullscreen — and the bots' thinking time and the card finish become
changeable from inside the partida.

- **Repo:** https://github.com/cposada8/mazo
- **Live:** https://mazo-six.vercel.app — `/mesa` steps through a bot partida,
  `/pruebas` shows deals and grupo validation.
- **Dev:** https://mazo-git-dev-cepm23.vercel.app — the latest commit on `dev`,
  public, no login.
- **Deploys:** work goes to `dev`, which builds by itself. Production changes
  only by merging `dev` into `main`. Nothing else deploys `main`.
- **Tests:** 383, all green (the run takes ~17s, mostly the soak). `npm run test:run`, `npx tsc --noEmit`, `npm run lint`.

## What exists

```
lib/engine/          The whole game. Pure TypeScript.
  cards.ts           Suits, the 13-rank ring, card identity.
  random.ts          Seeded stream: createRng, shuffle.
  deck.ts            buildDeck, deal.
  grupos.ts          Trio and Escala, and validation by phase.
  mesa.ts            Reshaping grupos already on the table.
  ronda.ts           State, moves, and apply() — the referee.
  contratos.ts       The eight contracts, as data.
  puntaje.ts         Card values and hand totals.
  partida.ts         The contracts played in order, scored, to a winner.
  notacion.ts        Card notation: 7♠, 7s, ** for a comodín.
  escenario.ts       A ronda dealt from cards you name, rest filled by seed.

lib/bots/             Clients of the engine. Nothing in the engine imports these.
  agrupar.ts         The grouping search, and how useful a card is.
  codicioso.ts       El Codicioso: the baseline bot.
  mesa.ts            Runs a whole partida with bots in the seats.
  turno.ts           A bot's whole turn decided up front, so the clock can
                     spread its moves over the configured seconds.
components/carta.tsx The visual card: corner-indexed, two finishes.
components/mesa.tsx  The table, landscape or portrait: seats on the rim, the
                     felt, the piles, everyone's grupos in the middle, your
                     hand along the bottom. Optional callbacks turn it from a
                     game you watch into one you play.
lib/asientos.ts      Where each seat goes around the table. Pure geometry.
lib/relato.ts        A move told in words, public information only — the
                     `mazo` variant cannot carry a card by construction.
lib/semilla.ts       Short readable seeds, random by default.
lib/pantalla.ts      The Fullscreen API, wrapped small.
app/manifest.ts      Standalone install, for the screen space.
app/jugar/           The playable game: inicio.tsx, juego.tsx, usePartida.ts.
components/tema.tsx  Light / dark / follow the phone.
lib/mano.ts          Arranging your hand: order, sorting, pinned bloques,
                     latched sort. A comfort, never a rule.
app/pruebas/         The page that makes the engine visible.
__tests__/           Tests, including engine/helpers.ts for scripted rondas.
```

Nothing is persisted and there is no database yet. Everything runs in memory.

## The five decisions that shape the code

Change these and a lot breaks. They are here so the next person does not undo
them by accident.

1. **The engine is pure.** `lib/engine/` imports nothing from the app and no
   framework. `__tests__/engine/purity.test.ts` fails the build if that slips.
   Bots, the UI and the future server are all clients of the engine.

2. **The engine validates; it never decides.** The player proposes a grouping
   and `apply()` accepts or refuses it. Six sevens can be one trío or two, and
   that choice belongs to the player — auto-grouping would silently take a real
   decision away. Any "suggested grouping" is a UI hint, never engine behavior.

3. **Ranks are a ring, not a line.** `cyclicDistance` works modulo 13, so
   `K A 2 3` is a legal escala and the ace needs no special case.

4. **A comodín's binding is positional.** An escala stores the rank it starts on;
   slot `i` stands for `rankAfter(start, i)`. There is no stored "this joker means
   6♥" that could drift out of sync, and adjacency is just comparing neighbours.

5. **Randomness is a stream carried as one number.** `RondaState.rngState`
   survives serialization, so a ronda can be stored in a database, reloaded, and
   keep reshuffling deterministically. Replays come free later.

One more worth knowing: **the winner of a ronda opens the next one.** The first
ronda's opener is chosen by whoever set up the partida, or drawn — and even the
draw comes from the partida seed, so nothing about a partida is unreproducible.

And a trap: **a card id names a card in the deck, not a card in this ronda.**
`7-s#0` is the same string in every deal. Anything that remembers cards by id
across rondas — an arrangement, a selection, a hint — will keep matching after
the cards are gone and has to be dropped when the ronda changes.

## What comes next

**Phase 26 — going out by ligando.** Found at the table, and it froze the
game: every card ligada, the hand empty, and no discard left to end the turn —
going out was defined as botar the last card, so the state had no exit. The
rule, settled with the owner: **an empty hand wins, however it was emptied.**
Into `carioca-rules.md` first, then `apply()` closes the ronda after a ligada
that empties the hand, with the freeze the owner hit as the test.

**Phase 27 — sin comodines, and the flipped defaults.** The setup screen
offers playing without comodines — on by default, and the engine has had the
toggle since Phase 2 — and a fresh browser now gets cartas oscuras and no
fullscreen. Both defaults stay remembered per browser once changed.

**Phase 28 — ajustes from inside the partida.** The bots' thinking time and
claras/oscuras become editable from the in-game menu, effective the very next
turn. What is a rule — comodines, contracts, seed — stays read-only there.

**Phase 29 — the bot framework.** The step that makes difficulty levels
possible, and the one online play needs anyway.

Right now a bot receives the whole `RondaState` and is merely well-behaved about
not reading other hands. Phase 29 makes that structural: a **view** of what one
seat can legitimately see — its own hand, the grupos on the mesa, the descarte,
how many cards everyone holds. A bot takes the view and returns a `Move`.

That same function is what the server will need in Phase 34 to send each player
only their own cards, so it is worth getting right rather than fast.

It also unlocks what bots with memory need: once the input is explicitly "what
this seat has seen", remembering discards and reading opponents becomes a
property of the bot rather than a licence to peek.

## Open questions, deliberately unanswered

- **The escalera contracts (9+).** All thirteen ranks, A through K. They do not
  fit the `{trios, escalas}` shape and win the ronda outright, so they were
  deferred. Do not design `Contrato` in a way that makes them impossible to add.
- **Guest identity.** There is no login and there will not be one. Players join a
  partida with a code and a nickname, so the system still needs to know which
  seat is whose, survive a reload, and stop someone claiming another player's
  seat and seeing their hand. Likely a per-seat secret in the browser. Settle it
  before Phase 32.
- **Real-time transport.** Vercel functions cannot hold WebSockets. Polling with
  TanStack Query is the likely first implementation, behind an interface so it
  can be swapped for Pusher or Supabase Realtime. Decide in Phase 34, not before.
- **A ronda nobody can win.** Carioca has no stalemate rule, and the soak
  measures the consequence: ~1.3% of bot partidas never end. Harmless in a test,
  a hung game online. Options are written up in `carioca-rules.md`; decide before
  Phase 34.

## How this project is run

- **Spec-driven.** Rules are settled in `specs/` before they are coded. When a
  rule turns out to be missing, it gets written down first — that is how the
  discard-what-you-just-took rule got resolved.
- **Small phases, each ending in something demonstrable.** Nothing is built two
  phases ahead of when it is needed.
- **Ask one question at a time.** The owner's stated preference: no walls of
  text, no batches of questions.
- **Commit and push at the end of every phase**, and mark the phase ✅ in the
  roadmap with a one-line note on what was learned.
