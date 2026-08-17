# Project status — pick up here

Last updated after Phase 15.

Read this first, then `mission.md` for the why, `carioca-rules.md` for the game,
`tech-stack.md` for the stack, and `roadmap.md` for what comes next. This file is
the short version and the handoff point; the roadmap is the authority on
sequencing.

**Keep this file current.** Update it at the end of every phase — a stale status
doc is worse than none.

---

## Where things stand

Phases 0–11 are done. **Carioca is playable.** Open `/jugar` on a phone and play
a full partida against bots: draw, lay down, unload onto anyone's grupos,
discard, and see the scoreboard at the end.

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
| 17 | The table: seats around it, grupos in the middle | ← **next** |
| 18–24 | Bot framework and personalities, then online | not started |

Off the roadmap, after Phase 15: **a ronda no longer slips past you.** When
somebody goes out, the game stops on a screen that says who won, with the
scoreboard and the ronda just played picked out, and deals the next one only
when you press «Siguiente reparto». The engine still closes and deals in the
same move — the pause lives in `usePartida`, and no bot plays while it is up.

And a bug it turned up: **a new reparto arrived with cards already pinned.**
The bloques from the last hand were still there, and because card ids repeat
between deals they matched cards they were never made from. The arrangement
belongs to the ronda it was made in, so `usePartida` now drops it whenever the
ronda changes — not inside «Siguiente reparto», which was the convenient place
rather than the correct one.

- **Repo:** https://github.com/cposada8/mazo
- **Live:** https://mazo-six.vercel.app — `/mesa` steps through a bot partida,
  `/pruebas` shows deals and grupo validation.
- **Dev:** https://mazo-git-dev-cepm23.vercel.app — the latest commit on `dev`,
  public, no login.
- **Deploys:** work goes to `dev`, which builds by itself. Production changes
  only by merging `dev` into `main`. Nothing else deploys `main`.
- **Tests:** 352, all green (the soak takes ~15s). `npm run test:run`, `npx tsc --noEmit`, `npm run lint`.

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
components/carta.tsx The visual card.
components/mesa.tsx  The table: opponents, grupos, piles, your hand. Optional
                     callbacks turn it from a game you watch into one you play.
app/jugar/           The playable game: page.tsx and usePartida.ts.
components/tema.tsx  Light / dark / follow the phone.
lib/mano.ts          Arranging your hand: order, sorting, pinned bloques.
                     A comfort, never a rule.
app/pruebas/         The page that makes the engine visible.
__tests__/engine/    Tests, including helpers.ts for scripted rondas.
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

**Phase 17 — the table.** The game looks like a form: one column, opponents as
lines of text, grupos as a list. It should look like a table with seats around
it, names in position, and the grupos in the middle where they belong once they
are communal. **Landscape**, decided — the content is thirteen cards wide.
`roadmap.md` has the three reference tables and what is worth taking from each.
First feature built on `dev`.

**Phase 18 — the bot framework.** The step that makes difficulty levels
possible, and the one online play needs anyway.

Right now a bot receives the whole `RondaState` and is merely well-behaved about
not reading other hands. Phase 18 makes that structural: a **view** of what one
seat can legitimately see — its own hand, the grupos on the mesa, the descarte,
how many cards everyone holds. A bot takes the view and returns a `Move`.

That same function is what the server will need in Phase 23 to send each player
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
  before Phase 21.
- **Real-time transport.** Vercel functions cannot hold WebSockets. Polling with
  TanStack Query is the likely first implementation, behind an interface so it
  can be swapped for Pusher or Supabase Realtime. Decide in Phase 23, not before.
- **A ronda nobody can win.** Carioca has no stalemate rule, and the soak
  measures the consequence: ~1.3% of bot partidas never end. Harmless in a test,
  a hung game online. Options are written up in `carioca-rules.md`; decide before
  Phase 23.

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
