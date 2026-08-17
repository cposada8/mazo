# Project status — pick up here

Last updated after Phase 7 — Milestone 1 complete.

Read this first, then `mission.md` for the why, `carioca-rules.md` for the game,
`tech-stack.md` for the stack, and `roadmap.md` for what comes next. This file is
the short version and the handoff point; the roadmap is the authority on
sequencing.

**Keep this file current.** Update it at the end of every phase — a stale status
doc is worse than none.

---

## Where things stand

Phases 0–7 are done. **Milestone 1 is complete: the engine is right.** It plays
a whole partida — every contract, scored, with a winner. Nothing is playable by
a human yet; that is Milestone 2.

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
| 8 | A bot that can finish a game | ← **next** |
| 9–17 | UI, then online play | not started |

- **Repo:** https://github.com/cposada8/mazo
- **Live:** https://mazo-six.vercel.app — and https://mazo-six.vercel.app/pruebas
- **Deploys:** every push to `main` goes to production automatically.
- **Tests:** 192, all green. `npm run test:run`, `npx tsc --noEmit`, `npm run lint`.

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
components/carta.tsx The visual card.
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

## What comes next

**Phase 8 — a bot that can finish a game.** The first piece of Milestone 2, and
the thing that turns the engine from a library into a game. It needs:

- One greedy strategy: a function from the state a seat can see to a legal
  `Move`. Keep what serves the current contrato, discard what does not.
- It does not have to play *well*. It has to play *legally*, and finish.
- Because the player groups and the engine only validates, a bot has to
  **search** groupings — the same cards satisfy different contracts depending on
  how they are cut.
- **Done when** four bots play 1,000 seeded partidas with no crash and no
  refused move. That soak test is the real deliverable: it is what will find the
  engine bugs the unit tests missed.

Then the table UI (9) and wiring the interaction (10) make it playable by a
person — the first time Carioca can actually be played on a phone.

## Open questions, deliberately unanswered

- **The escalera contracts (9+).** All thirteen ranks, A through K. They do not
  fit the `{trios, escalas}` shape and win the ronda outright, so they were
  deferred. Do not design `Contrato` in a way that makes them impossible to add.
- **Guest identity.** There is no login and there will not be one. Players join a
  partida with a code and a nickname, so the system still needs to know which
  seat is whose, survive a reload, and stop someone claiming another player's
  seat and seeing their hand. Likely a per-seat secret in the browser. Settle it
  before Phase 14.
- **Real-time transport.** Vercel functions cannot hold WebSockets. Polling with
  TanStack Query is the likely first implementation, behind an interface so it
  can be swapped for Pusher or Supabase Realtime. Decide in Phase 16, not before.

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
