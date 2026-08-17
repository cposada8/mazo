# Project status — pick up here

Last updated after Phase 10.

Read this first, then `mission.md` for the why, `carioca-rules.md` for the game,
`tech-stack.md` for the stack, and `roadmap.md` for what comes next. This file is
the short version and the handoff point; the roadmap is the authority on
sequencing.

**Keep this file current.** Update it at the end of every phase — a stale status
doc is worse than none.

---

## Where things stand

Phases 0–10 are done. **Milestone 1 is complete: the engine is right.** Bots now
play whole partidas against each other, and `/mesa` draws one move by move on a
phone. A person still cannot play: the table renders a state, it does not change
one. That is Phase 11, and it finishes Milestone 2.

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
| 11 | Playing it against bots | ← **next** |
| 12–18 | Better bots, then online | not started |

- **Repo:** https://github.com/cposada8/mazo
- **Live:** https://mazo-six.vercel.app — `/mesa` steps through a bot partida,
  `/pruebas` shows deals and grupo validation.
- **Deploys:** every push to `main` goes to production automatically.
- **Tests:** 265, all green (the soak takes ~15s). `npm run test:run`, `npx tsc --noEmit`, `npm run lint`.

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
components/mesa.tsx  The table: opponents, grupos, piles, your hand.
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

**Phase 11 — play it.** The first time a person can play Carioca here. It needs:

- Interaction on top of the components in `components/mesa.tsx`, which already
  draw everything: tap a pile to draw, select cards to lay down or add, tap one
  to discard.
- El Codicioso in the other seats, moving after you do.
- Client state in Zustand; the engine stays the referee, so every tap becomes a
  `Move` handed to `aplicarEnPartida` and refusals surface as "you cannot do
  that" rather than as a broken board.
- **Done when** a person plays a full partida against bots on the deployed site.
  That is Milestone 2.

Worth knowing while building it: `buscarAgrupacion` from `lib/bots` is what the
"can I bajarme?" hint should call — it already finds a grouping the engine will
accept. And scenarios give you any board state to work against without playing
to it.

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
  can be swapped for Pusher or Supabase Realtime. Decide in Phase 17, not before.
- **A ronda nobody can win.** Carioca has no stalemate rule, and the soak
  measures the consequence: ~1.3% of bot partidas never end. Harmless in a test,
  a hung game online. Options are written up in `carioca-rules.md`; decide before
  Phase 17.

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
