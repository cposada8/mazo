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
open on the lay-down turn, opponents' only from the next turn. (That last part
was wrong, and was corrected after Phase 15: the mesa is shut on the lay-down
turn for everyone, own grupos included. See `carioca-rules.md`.)
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

### Phase 14 — Setting up a partida, and seeing the score ✅
Four things a person notices in the first minute and cannot work around:
choosing how many bots to play against, choosing which rondas to play, seeing
where the partida stands without waiting for it to end, and getting a different
deal each time.
**Done when:** two partidas in a row deal differently, a typed seed repeats a
deal exactly, the table size and the contract list are chosen before dealing,
and the scoreboard can be opened mid-partida.

**Done.** `app/jugar/inicio.tsx` and `components/marcador.tsx`.

The seed bug is the interesting one. Every first partida was identical because
the seed was fixed — a workaround from Phase 11, when the partida was created
*while the page rendered*. Dealing at random during render means the prerendered
HTML and the browser disagree about the cards, so the seed had to be a constant.

Splitting setup from play fixes the cause rather than the symptom: the partida is
created when the button is pressed, which is long after the page has hydrated,
so the seed can be as random as it should have been. The game is keyed by its
settings, so starting another one mounts a fresh game instead of unwinding the
old one by hand.

Seeds are shown during play and after it, and can be typed back in — a partida
worth replaying, or a bug worth reporting, is now one short word.

The contract list was specified in Phase 0 — the full catalogue, one row each,
individually switchable, 1–7 on by default — and had simply never been built.
The setup screen is where it belongs, and the engine already took the list as
configuration, so it needed no engine change at all.

### Phase 15 — Reading your own hand ✅
Two things that make a hand thinkable rather than merely visible: knowing what it
would cost you right now, and being able to pin cards so that tidying up does
not undo the thinking you already did.

A **bloque** is a run of cards you pin together. Sorting only ever rearranges
what is loose, so a trío you pinned stays a trío on screen however many times
you press *Por pintas*. It commits to nothing and is not a grupo — it does not
even have to be legal. Pinned cards are played exactly like any other, and a
bloque quietly loses cards as they leave your hand, disappearing when the last
one goes.
**Done when:** the hand shows its point total at all times, and a pinned trío
survives sorting the rest of the hand by suit.

**Done.** `lib/mano.ts` and the hand row. Two separate ideas share the screen
and must not be confused: a **propuesta** is a grupo you are about to lay down
this turn, while a **bloque** is just how you like to hold your cards.

---

## How it ships, and how it looks — before more machinery

Two things that are cheap now and expensive later. The first changes where work
lands before it reaches anyone; the second is the only part of the project a
person actually sees.

### Phase 16 — Dev before prod
Every commit so far has gone straight to production, which was fine while the
only player was the person writing it. It stops being fine the moment a partida
is worth showing to someone. Work moves to a **`dev` branch with its own
permanent URL**, and production changes only by a deliberate merge.

What has to be true when this is done is mostly settings and habit, not code:

- `dev` exists, is the branch that gets pushed to, and every push to it builds
  on Vercel by itself. Vercel already does this for any branch that is not the
  production branch — the branch URL is
  `<project>-git-<branch>-<scope>.vercel.app` and always shows the latest commit
  on that branch, so it can be bookmarked on a phone.
- The dev URL opens without a Vercel login, or we know why not. On the Hobby
  plan, Deployment Protection defaults to protecting exactly the preview URLs
  and leaving production public — which is the wrong way round for showing a
  friend a link. It is one setting in the project.
- `main` stays the production branch. Promoting is merging `dev` into `main`,
  and nothing else deploys production.
- The flow is written down in the README, in two lines, because a workflow that
  has to be remembered is a workflow that gets skipped at 1 a.m.

Custom environments (a real `staging` target with its own env vars) are a Pro
feature and are not needed: a branch and its URL are the whole idea.

**Done when:** a push to `dev` is playable on a URL that is not
mazo-six.vercel.app, production is untouched by it, and merging `dev` into
`main` puts exactly what was tested into production.

### Phase 17 — The table
The game is playable and looks like a form. Everything is stacked in one
column — opponents as lines of text, grupos as another list, the piles as two
buttons, the hand at the bottom — and nothing about it says *cards on a table*.
Whose turn it is, who is about to go out, and what is even in play all have to
be read rather than seen.

This phase is about the shape of the thing:

- **A table, round or oval**, with the seats placed around it and each player's
  name at their position. Positions are computed from the number of players —
  the table takes 2 to 6 — not hardcoded per layout.
- **The turn is drawn on the player, not somewhere else** — a ring around the
  seat in play, the way Plato does it. And it is obvious at a glance how many
  cards each opponent is holding.
- **The actions live in the bottom-right corner**, under the thumb, and stay in
  the same place from turn to turn.
- **Grupos live in the middle, not next to their owner.** Once laid down they
  are communal, and the engine already knows whose is whose — `seat` and
  `grupoIndex` still identify a grupo in a move. Where it *sits on screen* is a
  free choice, and the middle of the table is the honest one.
- **Your hand keeps the bottom of the screen**, with everything Phase 13 and 15
  built: order, pinned bloques, points.
- Landscape phone first, light and dark, and no canvas or WebGL — this stays
  HTML the browser can lay out and a screen reader can read.

#### What was looked at, and what is worth taking

**cardgames.io/hearts, on a phone in portrait** — the plainest of the three,
and proof of how little it takes. Four seats: you at the bottom, one
opponent at the top, one on each side edge. There is **no drawn table at all** —
the felt is a flat green background and the *arrangement* is what reads as a
table. Each seat is a small avatar with a name under it. Opponents' hands are
fanned card backs at their seat, so how many cards someone is holding is
something you see rather than a number you read. Your hand is one overlapping
row across the full width, sitting on a light tray that separates it from the
felt. The instruction for the turn is a yellow strip **directly above the
hand** — where the eye already is. The running score is a tiny permanent table
in the corner, never a screen of its own.

**PokerNow** — the drawn-oval version: a green ellipse floating on a dark
ground, each seat a small plate on the ellipse's edge with name and chip count,
the common cards and pot in the middle, your own cards at the near edge. It is
the look people picture when they say "poker table", and it is a desktop
layout: on a phone the ellipse eats the room the cards need.

**Plato's poker table** — the one the owner actually plays, and the richest of
the three. It is **landscape**, with an oval table drawn in perspective sitting
inside an illustrated room. Every seat is a round avatar with the name under it,
a chips pill under that, and the player's two cards as small backs beside the
avatar. The player in turn wears a **ring around their avatar** that doubles as
the countdown — the turn is not a colour change somewhere else on the screen,
it is drawn on the person. Empty seats keep a grey silhouette, so the table does
not change shape with the number of players. Your own cards are larger, at the
bottom centre, and the three actions are big buttons in the **bottom-right
corner, under the thumb**. A small badge above your cards names what you are
holding — "Pareja J" — a derived hint about your own hand, which is exactly what
our points readout already is.

What Plato teaches that the other two do not: the actions belong in the thumb's
corner, the turn belongs on the avatar, and the *room* does the decorating so
the felt itself can stay plain and legible.

Taken together: **seats on the edges and hand at the bottom, felt as background,
no drawn oval.** Avatars, wood grain and felt texture are decoration and can
wait; what does the work is position, a lit seat for the turn, and seeing card
counts as cards.

The one thing none of the references solves for us: poker's middle holds five
cards and ours holds **the whole mesa** — up to four grupos per player, six
players. That communal area is the hard part of this phase, not the seating.

**Settled: the game is played in landscape.** Everything built so far is
portrait, which is how a phone is held by default — but a hand is thirteen
cards wide and the mesa is a row of grupos, so the content is landscape-shaped,
and Plato has already trained the owner to turn the phone sideways for a card
game. The cost is real and has to be paid explicitly: someone arriving in
portrait must be *told* to rotate, kindly and once, rather than being shown a
squashed table.

The pages around the game — setup, the scoreboard, the end of a ronda — stay
readable in portrait. It is the table that wants the width.

Also worth a look if they come back up: playcarioca.cl, cariocaonline.com and
ludocca.com are existing online cariocas. All three were down or behind a login
when checked on 2026-08-17.

**Done when:** someone who has not seen the project recognises a card table in
the first second, follows whose turn it is without being told, and the same
screen works for two players and for six on a phone held sideways.

---

## Milestone 3 — Bots worth playing

### Phase 18 — Bot framework
Extract the strategy interface: a bot receives the legal state it can see and
returns a move. Add hand-evaluation helpers shared by all bots.
**Done when:** a new bot can be added in one file with no engine changes.

### Phase 19 — Bot personalities
At least three bots that differ observably: e.g. one that hoards for the perfect
meld, one that lays down at the first opportunity, one that watches discards and
plays around opponents. Give them names and short descriptions in the UI.
**Done when:** a head-to-head tournament shows different win rates and visibly
different play. **This is Milestone 3.**

### Phase 20 — Rough edges
Card animations, a hint for new players, an in-game rules summary, and an
end-of-game screen.
**Done when:** someone who has never played Carioca finishes a bot game without
asking for help.

---

## Milestone 4 — Playable together

### Phase 21 — Persistence without accounts
Prisma schema, finished partidas saved, and a guest identity that survives a
page reload without anyone signing up. How a seat is claimed and protected is an
open design question — see `tech-stack.md`.
**Done when:** a player reloads mid-partida and is still themselves, and nobody
can claim a seat that is not theirs.

### Phase 22 — Rooms
Create a room, get an invite code, join as a guest with a nickname, see who is in
the lobby, start when everyone is ready. No gameplay yet.
**Done when:** three devices sit in the same lobby.

### Phase 23 — Server-authoritative play
The game state lives on the server. Each player receives only their own hand and
public information. Moves are submitted and validated server-side. Updates by
polling.
**Done when:** three people in three places finish a game from one invite code,
and no client ever receives another player's cards. **This is Milestone 4.**

### Phase 24 — Real-time transport
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
