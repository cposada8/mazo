# Roadmap

Phases are deliberately small: each one is a session or two of work and ends in
something that can be demonstrated. A phase is done when its **Done when** line
is true — not when the code exists.

Phases are ordered by dependency, not by appeal. The engine comes before any
pixel because bots and online play are both built on top of it.

---

## Milestone 1 — The engine is right

### Phase 0 — Write down the rules ✅
Settle every open question and record the result in `specs/carioca-rules.md`:
vocabulary, contract catalog, deck, deal and turn, comodines, mesa interaction,
scoring, win condition.
**Done when:** the rules document is complete enough that someone else could
implement the game from it without asking a question.

**Done.** Contracts 1–8 are fully specified. The escalera contracts (9+) are
deferred by decision, not by omission.

### Phase 1 — Project skeleton ✅
Scaffold Next.js 16 + TypeScript + Tailwind v4 + shadcn + Vitest. One page that
says the game's name. Deploy it to Vercel.
**Done when:** the deployed URL opens on a phone, and `npm test` runs green with
one trivial test.

**Done.** Live at **https://mazo-six.vercel.app**. Build and tests green.

### Phase 2 — Cards and the mazo ✅
Card representation with per-instance ids (there are two of every card), the
cyclic rank ring, deck construction with the comodines toggle, a seeded random
stream, and dealing.
**Done when:** the same seed always produces the same deal, proven by a test, and
consecutiveness works across the K–A–2 wrap.

**Done.** `lib/engine/{cards,random,deck}.ts`, 67 tests. A `purity.test.ts`
enforces the import rule so the engine cannot quietly grow a dependency on the
app.

### Phase 3 — Grupos ✅
Validate a trío and an escala, with comodines bound to the card they stand for.
Phase-dependent: one comodín at lay-down, unlimited in trios afterwards, never
two consecutive in an escala.
**Done when:** a table-driven test covers every valid and invalid example in
`carioca-rules.md`.

**Done.** `lib/engine/grupos.ts`, 94 tests. A comodín's binding is *positional*:
an escala knows the rank it starts on, so slot `i` stands for
`rankAfter(start, i)` and nothing can drift out of sync.

### Phase 4 — Banco de pruebas ✅
A `/pruebas` page that makes the finished engine visible. Deal a ronda from a
seed the visitor types and render every hand, the stock and the descarte; retype
the seed and get the identical deal. A second section runs the grupo validator
over the examples from `carioca-rules.md` and shows what it accepts, what it
rejects, and why.

Not playable — no turns, no interaction. Its job is to prove the engine works
without reading a test file, and to settle early what a card looks like on a
phone.
**Done when:** someone with no access to the terminal can confirm the deal is
deterministic and see the comodín rules being enforced.

**Done.** Live at **https://mazo-six.vercel.app/pruebas**.

### Phase 5 — One ronda, start to finish ✅
Turn order, draw from stock or descarte, lay down a contrato, discard, detect
going out, and reshuffle the descarte when the stock empties. Illegal moves are
rejected by the engine, not by the caller.
**Done when:** a test plays a scripted ronda to completion and the final state is
correct.

**Done.** `lib/engine/ronda.ts`. Every move goes through `apply`, which returns
a new state or refuses with a code — the engine is the referee, and state is
never mutated. The random stream rides along as one number so a ronda can be
stored and reloaded and still reshuffle deterministically.

### Phase 6 — The mesa ✅
Adding cards to grupos and repositioning comodines within a grupo, under the
rules that gate them: the mesa is untouchable before bajarse, own grupos are
open on the lay-down turn, opponents' only from the next turn.
**Done when:** a test reproduces the worked example — `2♦ comodín(3♦) 4♦ 5♦`
becoming `2♦ 3♦ 4♦ 5♦ comodín(6♦) 7♦` — and rejects every gated case.

**Done.** `lib/engine/mesa.ts`, 153 tests overall. Reshaping a grupo lives apart
from deciding who may reshape it, so the worked example can be tested without a
ronda around it.

### Phase 7 — Full partida and scoring
The configured contract list played in order, per-ronda scoring, the optional
ronda-winner bonus, cumulative totals, and a possibly-shared win.
**Done when:** a test plays a complete partida from a seed and produces a final
scoreboard. **This is Milestone 1.**

---

## Milestone 2 — Playable solo

### Phase 8 — A bot that can finish a game
One greedy bot: keep what helps the current contract, discard what does not. It
does not need to play well, only legally and to the end.
**Done when:** four bots play 1,000 seeded games with no crash and no illegal
move.

### Phase 9 — The table
Mobile-first UI: your hand, the stock and discard piles, melds on the table,
whose turn it is. Read-only at first — it renders a game state, it does not
mutate one.
**Done when:** a finished game state from Phase 7 renders correctly on a phone
screen.

### Phase 10 — Play it
Wire interaction: draw, select cards, lay down, discard. Local game against the
Phase 8 bots, state in Zustand.
**Done when:** a person plays a full game against bots on the deployed site.
**This is Milestone 2.**

---

## Milestone 3 — Bots worth playing

### Phase 11 — Bot framework
Extract the strategy interface: a bot receives the legal state it can see and
returns a move. Add hand-evaluation helpers shared by all bots.
**Done when:** a new bot can be added in one file with no engine changes.

### Phase 12 — Bot personalities
At least three bots that differ observably: e.g. one that hoards for the perfect
meld, one that lays down at the first opportunity, one that watches discards and
plays around opponents. Give them names and short descriptions in the UI.
**Done when:** a head-to-head tournament shows different win rates and visibly
different play. **This is Milestone 3.**

### Phase 13 — Rough edges
Card animations, a hint for new players, an in-game rules summary, and an
end-of-game screen.
**Done when:** someone who has never played Carioca finishes a bot game without
asking for help.

---

## Milestone 4 — Playable together

### Phase 14 — Persistence without accounts
Prisma schema, finished partidas saved, and a guest identity that survives a
page reload without anyone signing up. How a seat is claimed and protected is an
open design question — see `tech-stack.md`.
**Done when:** a player reloads mid-partida and is still themselves, and nobody
can claim a seat that is not theirs.

### Phase 15 — Rooms
Create a room, get an invite code, join as a guest with a nickname, see who is in
the lobby, start when everyone is ready. No gameplay yet.
**Done when:** three devices sit in the same lobby.

### Phase 16 — Server-authoritative play
The game state lives on the server. Each player receives only their own hand and
public information. Moves are submitted and validated server-side. Updates by
polling.
**Done when:** three people in three places finish a game from one invite code,
and no client ever receives another player's cards. **This is Milestone 4.**

### Phase 17 — Real-time transport
Replace polling with a push transport behind the same interface. Handle
disconnects and reconnects, and let a bot take over an abandoned seat.
**Done when:** a player closes the tab mid-game, returns, and the game is intact.

---

## After

Not scheduled, and not to be started before Milestone 4:

- A second game on the same platform — the real test of the engine's separation.
- PWA install and offline bot play.
- Replays from seed and move list.
- Private leaderboards among friends.
