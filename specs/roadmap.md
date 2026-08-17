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

### Phase 7 — Full partida and scoring ✅
The configured contract list played in order, per-ronda scoring, the optional
ronda-winner bonus, cumulative totals, and a possibly-shared win.
**Done when:** a test plays a complete partida from a seed and produces a final
scoreboard. **This is Milestone 1.**

**Done.** `lib/engine/{puntaje,partida}.ts`, 188 tests. `aplicarEnPartida` closes
a ronda and deals the next contract by itself, so callers never see the seam.
The winner of a ronda opens the next one; the first opener is chosen or drawn.

**Milestone 1 is complete: the engine is right.**

---

## Milestone 2 — Playable solo

### Phase 8 — Escenarios: dealing the cards you dictate ✅
Build a ronda from named cards instead of a shuffle: these hands for these
seats, these cards coming off the stock in this order, the rest filled from the
seed. Card notation accepts `7♠` and `7s` alike, `**` for a comodín.

This is what makes bots comparable. Put two bots in front of the identical hand
and the identical draw order and the only variable left is the decision each
one makes — otherwise the better cards win and it looks like the better bot.
**Done when:** a test dictates a hand and a draw order, plays it, and gets
exactly the cards it asked for; and asking for a card that does not exist, or a
third copy of one that only has two, is refused.

**Done.** `lib/engine/{notacion,escenario}.ts`, 230 tests. Named cards leave the
deck before the filler is shuffled, so the filler can never duplicate one.

### Phase 9 — A bot that can finish a game ✅
One greedy bot: keep what helps the current contract, discard what does not. It
does not need to play well, only legally and to the end.

The real work is the **grouping search**: because the engine validates rather
than groups, the bot has to find the partitions of its own hand that satisfy the
contrato. That search is reused by every later bot and by the UI when it offers
a hint.
**Done when:** four bots play 1,000 seeded partidas with no crash and no refused
move, under a turn cap that fails loudly instead of hanging — a stalled ronda is
data about the game, since Carioca has no stalemate rule.

**Done.** `lib/bots/`, 265 tests. Zero refused moves across 1,000 partidas: the
bot and the engine never disagree about what is legal. **987 finish; 13 stall**
(1.3%) because nobody completes the contrato and Carioca has no rule for that —
see the open question in `carioca-rules.md`.

The measurable lesson was in the discard heuristic. Counting "cards of the same
suit within three ranks" as useful made `4♦` and `7♦` protect each other forever
without ever forming an escala, and **no** partida with an escala contract ever
finished. Scoring by the length of the actual consecutive run fixed it.

### Phase 10 — The table ✅
Mobile-first UI: your hand, the stock and discard piles, melds on the table,
whose turn it is. Read-only at first — it renders a game state, it does not
mutate one.
**Done when:** a finished game state from Phase 7 renders correctly on a phone
screen.

**Done.** `components/mesa.tsx` and `/mesa`, which steps through a whole bot
partida move by move. Comodines on the mesa render the rango they stand for, so
the positional binding is visible on screen and not just in the code.

### Phase 11 — Play it ✅
Wire interaction: draw, select cards, lay down, discard. Local game against the
Phase 9 bots.
**Done when:** a person plays a full game against bots on the deployed site.
**This is Milestone 2.**

**Done.** `/jugar`, 294 tests. Interaction is optional props on the Phase 10
components, so the same code renders a game you watch and a game you play.

One deliberate deviation: **no Zustand.** One page with one state object does
not need a store. The controller is `app/jugar/usePartida.ts`; reach for a store
when a second screen needs the same state.

Comodín repositioning was deferred at first and then wired in after a real game
turned it up: with `5♥ ** 7♥ 8♥` on the mesa and the `6♥` in hand, tapping the
grupo was refused. Tapping now tries every sensible reading in order — extend
the tail, extend the head, then free the comodín — and lets the engine settle
which is legal, so the player never has to name the move.

The player still groups: you select the cards and `armarGrupo` only works out
whether they read as a trío or an escala, and where a comodín has to sit. It
never picks the cards for you.

---

## Comfort — asked for mid-build, and worth doing before more machinery

### Phase 12 — Dark mode ✅
Light, dark, or follow the phone. Chosen by the person, not by the clock.
**Done when:** the whole site can be held dark, and the choice survives moving
between pages without a white flash on load.

**Done.** `components/tema.tsx`. The class lands on `<html>` before the page
paints, which is the only part of this that is not trivial.

### Phase 13 — Arranging your hand ✅
Thirteen cards in dealt order are hard to read and impossible to think with.
Sort them **by pinta** — each suit low to high, so an escala lines up — or **by
número** — the whole hand low to high with the ace highest, which puts cards of
the same rango side by side. Move the **selected** cards, however many and
however scattered: they gather into one block beside the leftmost one and slide
together from there.
**Done when:** an arrangement survives drawing, discarding and a new ronda, a
newly drawn card arrives somewhere you will notice it, and moving a scattered
selection gathers it rather than shuffling it.

**Done.** `lib/mano.ts` and the controls above the hand. Ordering is a comfort,
never a rule: the engine neither knows nor cares what order a hand is held in,
so none of this can affect what is legal.

The hand itself was rebuilt too — one row that scrolls sideways with the cards
overlapping, instead of a wrapping grid. A grid loses left-to-right order, which
is precisely what arranging a hand is for.

Note the ace appears in two places on purpose. Sorting by número treats it as the
highest card, because that is how a person reads a hand. The engine's ring still
has it at position zero, because an escala can wrap through it. Neither is wrong;
they answer different questions.

---

## Milestone 3 — Bots worth playing

### Phase 14 — Bot framework
Extract the strategy interface: a bot receives the legal state it can see and
returns a move. Add hand-evaluation helpers shared by all bots.
**Done when:** a new bot can be added in one file with no engine changes.

### Phase 15 — Bot personalities
At least three bots that differ observably: e.g. one that hoards for the perfect
meld, one that lays down at the first opportunity, one that watches discards and
plays around opponents. Give them names and short descriptions in the UI.
**Done when:** a head-to-head tournament shows different win rates and visibly
different play. **This is Milestone 3.**

### Phase 16 — Rough edges
Card animations, a hint for new players, an in-game rules summary, and an
end-of-game screen.
**Done when:** someone who has never played Carioca finishes a bot game without
asking for help.

---

## Milestone 4 — Playable together

### Phase 17 — Persistence without accounts
Prisma schema, finished partidas saved, and a guest identity that survives a
page reload without anyone signing up. How a seat is claimed and protected is an
open design question — see `tech-stack.md`.
**Done when:** a player reloads mid-partida and is still themselves, and nobody
can claim a seat that is not theirs.

### Phase 18 — Rooms
Create a room, get an invite code, join as a guest with a nickname, see who is in
the lobby, start when everyone is ready. No gameplay yet.
**Done when:** three devices sit in the same lobby.

### Phase 19 — Server-authoritative play
The game state lives on the server. Each player receives only their own hand and
public information. Moves are submitted and validated server-side. Updates by
polling.
**Done when:** three people in three places finish a game from one invite code,
and no client ever receives another player's cards. **This is Milestone 4.**

### Phase 20 — Real-time transport
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
