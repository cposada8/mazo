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

### Phase 16 — Dev before prod ✅
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

**Done.** Dev is **https://mazo-git-dev-cepm23.vercel.app**, production stays
**https://mazo-six.vercel.app**, and the flow is the two lines in the README.
No code and no `vercel.json` — the whole phase was a branch, a settings change
and writing it down.

Two things learned that are not obvious:

- **Vercel does not build a commit it has already built.** Creating `dev` off
  `main` produced no deployment at all, because the branch pointed at a SHA
  production had already deployed. The first real commit on `dev` built
  immediately. Nothing was broken; it just looks broken for a minute.
- **The protection setting is backwards from what you want.** The project was on
  `ssoProtection: all_except_custom_domains` — Vercel's Standard Protection —
  which locks preview URLs behind a Vercel login and leaves the production alias
  public, since the production domain counts as the custom one. That is the
  wrong way round for a dev URL whose purpose is to be opened on a phone or sent
  to a friend, so it is now off. The repo is public and the game holds nobody's
  data; there is nothing on a preview that is not already on GitHub.

### Phase 17 — The table ✅
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

**Done.** `components/mesa.tsx` rebuilt, and seating extracted to
`lib/asientos.ts` — where a seat goes is geometry, so it is a pure function
with its own tests rather than percentages buried in JSX. The component only
places what that module decides.

Three things came out differently than written above:

- **The oval is drawn after all.** The note taken from cardgames.io said the
  arrangement alone reads as a table and no oval is needed — true in portrait,
  where an ellipse eats the room. Lying down there is room, and Plato was
  right: a felt oval on a dark ground reads as a table instantly, and the dark
  surround is what makes the felt look lit rather than merely green.
- **The game takes the whole viewport**, over the site's own header. A phone
  lying down is 390 pixels tall; `100dvh` underneath a 42-pixel header put the
  hand off the bottom of the screen. The cost is that the theme switcher is
  covered during a game, which is a fair trade for a hand you can see.
- **The middle scrolls sideways**, and that is the weakest part of this phase.
  It was flagged in advance as the hard part — poker's middle holds five cards
  and ours holds the whole mesa — and a horizontally scrolling row is the
  honest minimum, not a solution. Six players deep into a partida, the grupos
  run off the right edge and have to be scrolled to. Worth revisiting in Phase
  20.

Left deliberately undone: animations, real avatars, and any decoration of the
room beyond a dark ground. Those are Phase 32, and none of them is what made
the old screen unreadable.

### Phase 18 — Room to play ✅
Measured on the owner's phone, Chrome on Android, held sideways: the CSS
viewport is about **615 × 287**. The browser's own URL bar takes a fifth of the
screen before the game gets any, and of what is left the hand band takes half —
because the arranging controls wrap into three rows and push everything down.
The table ends up in a strip barely two hundred pixels tall, where a seat's
"12 cartas" is printed on top of a grupo's "TRÍO DE 2".

Nothing here is a new feature. It is the difference between a layout that was
designed against a number and one that survives the phone it runs on.

- **Take the screen back.** A web app manifest with `display: standalone`, so
  the game can be added to the home screen and run without browser chrome at
  all, and the Fullscreen API offered when a partida starts. `100dvh` already
  copes with the URL bar collapsing on scroll; the rest of that space is only
  given to an app that asks for it.
- **Nothing fixed that could be fluid.** Card sizes, seat plates, type and gaps
  all derive from the height actually available rather than from `h-20` and
  `size-8`. One scale, computed from the container, and everything sized in
  terms of it. A table that is comfortable at 400 pixels tall and merely small
  at 250 beats one that is right at 390 and broken either side of it.
- **Lanes that cannot collide.** Seats own a band, the mesa owns another, the
  hand owns a third, and no band may borrow from its neighbour. Today the seats
  are placed by percentage and the grupos by flex, and neither knows the other
  exists — which is why they overlap the moment the screen gets short. The
  arranging controls stop wrapping too: at small sizes they become icons.

**Done when:** the phone from that screenshot shows the same partida with no
overlap, no dead band, no browser bar — and the hand is the biggest thing on
the screen, because it is the thing being read.

**Done.** Verified in a controlled browser at exactly 615 × 287 (and at 250,
and with six players): the lanes hold, nothing prints on anything, and the
hand band is the tallest thing on the screen at 133 of 287 pixels. The scale
is `.cancha` in `globals.css` — a size container, so every card, ficha and
label derives from `cqh` of the box the table actually landed in, which also
made the `/mesa` viewer fluid for free. The manifest is `app/manifest.ts`
(standalone, landscape for now), and fullscreen is a remembered checkbox on
the setup screen, because the Repartir press is the one user gesture the
Fullscreen API will accept.

Judgment calls made while building, beyond what was written above (Claude's
own, noted per the working agreement):

- **The arranging controls are icons always**, not only at small sizes. Two
  visual grammars for the same buttons is a cost with no payer: each icon
  still says its name on hold and to a screen reader.
- **The top-left corner collapsed to a single menu button.** The old strip —
  contract badge, Marcador, Salir — was itself a lane violation waiting for a
  fifth player. Contract, marcador, seed, fullscreen and salir now live behind
  one button that opens the existing overlay.
- **The seat's card count moved onto the name line** — "Jugador 2 · 12" — one
  line instead of two, because on a 287-pixel phone every line under a ficha
  costs a card's worth of height. The fan still shows the count as cards.
- **The seating arc flattened** (`ARCO` 32 → 14 in `lib/asientos.ts`). A seat
  is nearly as tall as the band it lives in, so a deep arc hung the edge
  seats out of their lane and under the piles — measured, not guessed: the
  first six-player screenshot printed the stock on "Jugador 2".

### Phase 19 — Standing up ✅
The table works held upright, and nobody is told to turn their phone.

Portrait is how a phone is picked up and how it is held one-handed on a sofa.
Phase 17 chose landscape because the content is wide, and that is still true
lying down — but "rotate before you may play" is a toll charged at the door,
and the owner said so the first time he played it on a real phone.

- **Same components, two arrangements.** Upright: seats across the top, the
  mesa in the middle scrolling, the hand along the bottom. The drawn oval gives
  way to the arrangement when there is no room for it — cardgames.io's lesson
  from Phase 17 was a portrait lesson, and this is where it was right.
- Thirteen cards do not fit across 390 pixels, so the hand scrolls sideways.
  That already works and is already how it behaves when a hand grows.
- The rotate-your-phone screen from Phase 17 is deleted, not improved.
- Rotating mid-partida rearranges the table and changes nothing else.

**Done when:** a whole ronda can be played without turning the phone, and
turning it in the middle of one loses neither the selection nor the pinned
bloques.

**Done.** Almost no new code: the lanes built in Phase 18 *are* the portrait
arrangement — seats across the top, mesa in the middle, hand along the
bottom — so this phase is a container query on `.cancha`, not a second
layout. Below 1:1 aspect the oval hides and the grupos wrap into rows
(portrait's spare dimension is height, so the mesa trades its sideways
scroll for wrapping — which incidentally previews the fix Phase 32 wants
for the six-player overflow). The rotate-your-phone screen is deleted, the
manifest orientation loosened to `any`, and rotation mid-turn was verified
to preserve selection and bloques — nothing unmounts, so nothing is lost.

One lesson worth keeping: the portrait overrides only took effect once the
mesa lane's styles moved fully into the stylesheet — a Tailwind utility on
the element outranks a components-layer rule, so a lane styled half in each
place cannot be re-arranged by a media or container query. (Claude's call:
`.carril-mesa` and `.grupos-en-mesa` are now styled in `globals.css` alone.)

### Phase 20 — The right way round, and a table worth looking at ✅
Two corrections to what Phase 17 built.

**It turns the wrong way.** Carioca goes anticlockwise: play passes to the
player on your **right**. The seating puts the next player on your left. Nothing
in the engine changes — `turno` still advances by one and the engine has no
opinion about geometry — only `lib/asientos.ts` decides where that seat is
drawn. The direction was never written down anywhere, which is exactly why it
could be wrong without anybody noticing, so it goes into `carioca-rules.md`
first and the seating follows.

**And it is ugly.** Green felt is the default nobody chose. Black, with a thin
red line following the rim: elegant and a little gothic rather than a casino
floor. Three things constrain it — the card faces stay the most legible thing
on the screen; the accent that means *this seat is playing* is one colour used
in exactly two places, the ring on the ficha and the badge on your hand, and it
has to still read against the new ground; and both themes keep working.

**Done when:** the player who goes after you is sitting on your right, and the
table looks like something somebody chose.

**Done.** The direction went into `carioca-rules.md` first ("The deal and the
turn"), then `lib/asientos.ts` mirrored its x axis — one line — and the test
now asserts turn order runs right to left. The table is black on black: the
room `stone-950`, the felt `stone-900`, a one-pixel `red-800` line following
the rim, and dark red card backs. The turn accent stayed **amber**, not red
(Claude's call): the rim line is already red, and an accent that matches the
decoration stops meaning anything. Amber appears in exactly two places — the
ficha of the seat in play and the badge on your hand — and the draw-me rings
on the piles went neutral to keep it that way.

One change beyond the letter of the phase (Claude's call, in service of "the
card faces stay the most legible thing on the screen"): **card faces no
longer follow the theme.** In dark mode they were dark grey on a black felt;
now a card is white with black or red pips in either theme, the way a card
under a table lamp would be. The comodín kept its violet, always on white.

### Phase 21 — The clock ✅
A turn takes time, and the time is something you can watch.

- **Bots think for a set number of seconds**, chosen on the setup screen, **two
  by default.** It is the **whole turn** that is timed, not each move: the bot
  draws, unloads and discards inside its two seconds. Timing each move instead
  would make a turn with a bajada take six seconds, and waiting is not the same
  as watching.
- **The ficha drains.** The ring around the seat in play empties as the time
  runs out, so the countdown is drawn on the player — the same place the turn
  already is.
- **No clock for you, yet.** Nothing hurries a human move. This phase is about
  being able to follow the bots, not about pressure. What it leaves behind is
  the mechanism a real timer would need later, when the other seats are people
  who can walk away from their phone.

**Done when:** a bot's turn takes as long as the setup screen says it does, and
how much of it is left can be seen without reading a number.

**Done.** Timing the whole turn required knowing the whole turn before its
first move lands, and the engine's purity made that free: `movesDelTurno`
(`lib/bots/turno.ts`) simulates the bot's turn to completion, and the real
applications then walk the exact same states on a schedule —
`tiemposDeMoves` spreads them so the **last** move lands when the time runs
out, which is what makes the turn take exactly what the setup screen says
(measured: two 3-second bots, 6.1 seconds). The scheduler effect is keyed by
the *turn*, not the state, so the moves it applies cannot reschedule it.

The ring is CSS, not ticks: an SVG arc keyed to the turn, one
`stroke-dashoffset` animation whose duration is the configured seconds —
restarting is remounting, and no JavaScript runs per frame. Options offered:
1 / 2 / 3 / 5 seconds, two by default. Your own badge does not drain;
nothing hurries a human yet, as specified.

### Phase 22 — What just happened ✅
The game changes state in silence and expects you to have been looking. Two
ways of showing a move that has already been made:

- **The card travels.** Taking from the mazo or from the descarte animates the
  card moving to the hand that took it, slowly enough to follow.
- **A line under the piles** says what was done, in words: *Jugador 5 robó del
  mazo*, *Jugador 5 tomó J♥ del descarte*.

One rule shapes the line: **it may only say what everybody can see.** A card
taken off the descarte was face up, so it is named. A card off the mazo is
secret, and the line says only that somebody drew — never which card. That is
the same discipline Phase 30 makes structural, and writing the log against it
first is a rehearsal: a public log is a view of the ronda with one seat's
privileges, which is precisely what a bot is about to be handed.

**Done when:** you can look away, look back, and know what happened from the
line — and nothing in it could ever tell you a card you are not entitled to
know.

**Done.** The discipline is structural, as intended: `lib/relato.ts` turns a
move plus the state it was played into a `Relato`, and the `mazo` variant
*cannot carry a card* — the type has no field for one. Tests assert the line
for a stock draw contains no suit symbol, and that descarte draws and
discards name exactly the card everyone saw. The log narrates more than the
two required lines — bajadas, cards added to grupos, freed comodines — all
public by the same rule. The line lives in an info strip along the felt's
bottom edge, sharing it with the contract name; the pile counts moved onto
the piles as chips to pay for the strip's height.

The travelling card is presentation only: by the time it renders, the engine
has already moved the card, and the animation measures the live layout
(`data-pila` → `data-destino`) so it survives portrait, landscape and any
future rearrangement. A descarte card travels face up; a stock draw travels
face down — the animation obeys the same rule as the line. One addition
beyond the letter of the phase (Claude's call): your own moves read in
second person — "Tomaste J♥ del descarte" — because "Tú tomó" is nobody's
Spanish.

---

## Asked for after playing on dev — prioritized ahead of the machinery

The owner played the Phase 18–22 build and came back with a list: one rule the
engine gets wrong, and four ways the table makes you work for what it already
knows. A real game finding a real bug outranks new machinery, so these go
first and everything after them moves down two.

### Phase 23 — The comodín that slides ✅
Found at the table: the mesa held `Q♠ K♠ A♠ comodín(2♠)` and the player held
the `10♠`. Playing it must work — `Q K A comodín(2)` and `comodín(J) Q K A`
are the *same escala* read from either end, so the comodín slides across at
no cost and the 10 lands to make `10♠ comodín(J♠) Q♠ K♠ A♠`. The engine
refused it, which is a bug in the rules as played.

The rule goes into `carioca-rules.md` first (the Phase 20 lesson: what is not
written down can be wrong without anyone noticing), then into the engine:
extending an escala tries the plain reading, and when that fails, the reading
with the far extreme's comodín slid over. The slide only ever moves the
outermost card, never crosses another, and the result still validates — a
comodín cannot slide into adjacency with another comodín.

**Done when:** the exact hand from the bug report plays: tapping the grupo
with the 10 selected puts it down and rebinds the comodín, and the refusal
cases (two extreme comodines, a card that fits neither reading) still refuse.

**Done.** `extendEscala` in `lib/engine/mesa.ts` now tries both readings; the
UI needed no change, because tapping a grupo already tries head and tail and
lets the engine pick. The bug's exact position is a test, with its mirror
and both refusal cases.

### Phase 24 — Watching the table work ✅
Four quality-of-life asks from the same session, all about seeing what the
game already knows:

- **The discard travels too.** Phase 22 animated taking a card; botar was
  still a teleport. Same mechanism, opposite direction, always face up —
  a discard is public by definition.
- **The descarte can be browsed.** Tap the pile's count chip and see every
  card in it, top first. Only the top card is *playable* — this changes no
  rule, it only spares the memory. Switchable on the setup screen, on by
  default, for tables that want remembering to be part of the game.
- **The log can be reread.** Tap the line under the piles and the whole
  ronda's story opens, newest first, every line under Phase 22's rule: only
  what everybody saw. Same setup switch treatment, on by default.
- **Sorting can be left pressed.** A sort button now latches: while it is
  down, the card you draw files itself into place. Releasing it freezes the
  hand exactly as it lies — nothing moves — and newly drawn cards go back to
  arriving at the end, where they are easy to notice.

**Done when:** a discard visibly flies to the pile; the descarte and the
historial open from the table and both switches on the setup screen actually
remove them; and with a sort held down, a drawn card lands sorted, while
releasing it moves nothing.

**Done.** The latched sort survives a new reparto on purpose — it is a
preference, not an arrangement, so the next hand arrives already sorted
(Claude's call). The historial keeps `Relato` values, not strings, so the
information rule is enforced by the same type it was written in.

### Phase 25 — Cards with corners ✅
Asked for after playing with the Phase 24 build: the hand cards were still too
big, and the old face — rank top-left, pinta alone in the middle — wasted the
one part of a fanned card that stays visible. A real card prints the rank in
the corner with its pinta **directly underneath**, precisely so a fan can be
held tight; ours now does the same, mirrored in the far corner, with the
centre pip kept as decoration for the cards that sit uncovered.

With the corner carrying the whole identity, the fan tightens: the overlap
scales with the card (each shows its left edge plus a finger's worth) and the
hand cards shrink about 15%. The payoff measured at 615 × 287: a dealt hand
of twelve went from scrolling off-screen to **372 pixels wide, all visible at
once** — the mesa lane got taller for free.

**Done when:** every card in a tightly fanned hand is identifiable by its
left edge alone, the whole dealt hand fits a phone lying down without
scrolling, and the comodín still shows what it stands for while overlapped.

**Done.** The comodín's binding moved into its corner too (★ with the rank it
stands for underneath) — bottom-corner labels vanish under the next card in a
tight fan, corners do not.

Follow-ups from the first games played with this build, each asked for at
the table:

- **The drawn card is marked** until your discard ends the turn. The latch
  files a drawn card into place, which is its job, and also exactly how you
  lose track of what you just drew; the mark gives that back. Found by
  hand-diffing, not by peeking at the stock, so a reshuffle cannot mislabel
  it, and a bot's draws never mark anything. First shipped as a blue ring
  plus a nudge out of the fan; the owner asked for quieter, so it is now a
  **thin gold halo and nothing raised**.
- **A selected card slides up, never in front.** Selection used to raise the
  card with a z-index so its ring stayed visible — and on the tight fan that
  covered the next card's corner and stole its taps, forcing right-to-left
  selection. The lift alone is the signal now, like a card pushed out of a
  real fan.
- **The deck comes in two finishes.** Card faces read their colours from CSS
  variables, and `.cartas-oscuras` on the game's wrapper reskins every card —
  hand, piles, grupos, overlays — to the near-black faces of the pre-Phase-20
  build, which the owner missed. Chosen on the setup screen, remembered in
  the browser, light by default.

---

## The second list from the table — again ahead of the machinery

Another session on dev, another list: a hole in the rules that froze a game, a
variant the engine has understood since Phase 2 but the setup screen never
offers, defaults that fight what the owner actually picks, and two options
that can only be chosen before the game that asks for them. Same policy as the
last list: findings from real games outrank new machinery, so these go first
and Milestones 3 and 4 move down three.

### Phase 26 — Going out by ligando ✅
Found at the table, and it froze the game: the player unloaded every card in
hand onto the mesa and the turn could not end. Going out was defined as
discarding your last card, so a hand emptied by ligar was a state the rules
never contemplated — the engine did what the spec said, and the spec was
wrong.

The rule, settled with the owner: **an empty hand wins, however it was
emptied.** If a ligada leaves the hand empty, the ronda closes right there and
the player goes out exactly as if they had discarded — 0 points or the bonus —
with the last card lying on the mesa instead of the descarte. The alternative
considered, refusing the ligada that would empty the hand, scores identically
(the card could always be discarded instead) but turns the most satisfying
play in the game into a refusal that has to be explained.

Rules first, per the Phase 20 lesson: `carioca-rules.md` redefines going out
as *running out of cards*, whether by botar or by ligar; then `apply()` closes
the ronda after a ligada that empties the hand, and the relato says so:
*"Jugador 3 ligó su última carta y cerró la ronda."*

**Done when:** the exact situation from the bug report plays to the end —
ligando everything wins the ronda on the spot — and a scripted test holds the
ronda closed, the winner's score right, and the relato telling it.

**Done.** The check lives in `apply()` itself, once, after every accepted
move: an empty hand closes the ronda whatever emptied it, so no move can
leave the ronda in a state it cannot get out of. That made two older rules
redundant rather than wrong: `bajarse` no longer refuses to consume the whole
hand (a bajada of all thirteen now goes out on the spot, and
`SIN_CARTA_PARA_DESCARTAR` is gone from the error codes), and freeing a
comodín with the last card closes too. Scoring needed nothing — the winner
was always "the seat with the empty hand". The relato carries a `cierra`
flag on the moves that can now end a ronda, and the bots were already safe:
El Codicioso has never ligado its last card, by its own guard.

One follow-up from the first game played against it: the engine closed the
ronda but the *controller* dealt straight past the who-won screen — of the
three places `usePartida` applied a move, the ligada path recorded it
without checking whether it had ended anything. All three now share one
`asentar` helper, so no path can move past a finished ronda unseen; the
regression test stubs the deal and plays the exact ligada.

### Phase 27 — Sin comodines, and the defaults the owner keeps correcting ✅
Two setup-screen matters, both cheap and both about the first minute.

- **Playing without comodines is a real variant**, and the engine has had the
  toggle since Phase 2 — `buildDeck` already takes it. The setup screen
  offers it: **with comodines by default**, and switching it off deals a deck
  with none in it. A per-partida choice like the contract list, never changed
  mid-game.
- **The defaults flip to what the owner actually picks.** Cards deal
  **oscuras** by default — the near-black faces from Phase 25 — and
  **fullscreen starts off**. Both stay remembered per browser, so this only
  decides what a first visit looks like; anyone who has already chosen keeps
  their choice.

**Done when:** a partida dealt with comodines off contains none anywhere —
hands, stock, descarte — through every reshuffle; and a fresh browser gets
dark cards, no fullscreen, and comodines on, without touching a switch.

**Done.** The engine needed nothing — `comodines` already rode
`PartidaConfig` from `buildDeck` up; the whole phase is one checkbox on the
setup screen and the plumbing through `Ajustes`. A test now plays a full
sin-comodines partida move by move asserting no comodín in any hand, pile or
grupo of any state. The comodines choice is deliberately **not** remembered
(Claude's call): it is a rule, like the contract list, so every setup starts
from the standard game. The two flipped defaults only rewrote what an empty
localStorage means — anyone who already chose keeps their choice.

### Phase 28 — Ajustes from inside the partida ✅
The bots' thinking time and the card finish are chosen on the setup screen
and then locked for the whole partida — but neither is a rule. One is pacing,
the other is paint, and wanting them different is something you discover
*while playing*, which is exactly when the game refuses to change them.

This is the options screen the game should have had: the Phase 18 menu button
already opens an overlay with the contract, marcador, seed and salir, and the
ajustes live there too. Thinking time and claras/oscuras take effect
immediately — the very next bot turn thinks for the new time. What *is* a
rule — comodines, the contract list, the seed — is visible there but not
editable, because a partida's identity does not change mid-game.

**Done when:** the thinking time and the card finish can both be changed
without leaving the table, the change shows on the next turn, and nothing
that affects legality can be touched from the same panel.

**Done.** The thinking time and the baraja moved from partida props to state
inside `Juego`, so the setup screen only says where they start; the menu
overlay edits them with the same controls setup uses (exported, not
duplicated). Better than promised on immediacy: the bot scheduler already
depended on `segundosBot`, so a change replans the turn *in progress* — a
test drops a 600-second bot to 0.05 mid-turn and watches it finish. A baraja
change also writes the browser preference, so the next partida deals the
finish you switched to. The rules stay untouchable; the menu now also names
the partida's comodines setting alongside the contract, since a rule you
cannot edit should still be visible.

---

## Asked for after the second list shipped

### Phase 29 — The comodines get a face ✅
The comodín has worn the same drawn ★-and-☺ since the first card was drawn on
screen. The owner wants it to wear art: a gallery of candidate images —
Guasones, Hisokas, Parcas — lives in `public/candidatos/comodines`, and each
**ronda deals faces from it**: every comodín in the deck gets an image for
that ronda, different rondas deal different ones, and the four comodines
differ from each other whenever the gallery has four to give.

The shape of the thing:

- **The gallery is the folder.** The server reads the directory at build time
  and hands the list to the game — no manifest to maintain, so curating is
  the owner's stated workflow: delete the images that lose, push, done. An
  empty or missing folder means the drawn design, everywhere, which is also
  what `/mesa` and `/pruebas` keep showing.
- **Dealt from the seed, like everything else.** The faces come from the
  partida's seed and the ronda's index, not from `Math.random()`: replaying a
  seed replays its comodines, and the choice is made "al iniciar la ronda"
  exactly as asked — nothing reshuffles mid-ronda.
- **Paint, not a rule.** The engine does not know the images exist. A comodín
  still shows ★ in its corner — over a scrim, since a fanned card is
  identified by its left edge and a photo underneath cannot be allowed to
  cost that — and the rank it stands for when ligado.
- **Photos served small.** The candidates are multi-megabyte originals;
  `next/image` serves each one resized and re-encoded for a card-sized slot,
  so the originals can stay originals while a phone downloads kilobytes.

**Done when:** two rondas of the same partida show different comodín faces,
replaying a seed shows the same ones again, the corner ★ and the ligado rank
stay readable over every candidate, and pruning the folder to fewer images
needs nothing but deleting files.

**Done.** `lib/caras.ts` deals the faces (the four comodín ids are knowable
because the deck is deterministic — the same property every test leans on),
a context in `components/caras.tsx` carries them to every card, and the
`/jugar` page turned into a thin server component whose only job is the
`readdir`. The corners sit on a black scrim over the photo, and the centre ☺
yields to it. Measured through the optimizer: a 180 KB candidate serves at
~5 KB for a card-sized slot, so the multi-megabyte originals cost the phone
nothing. `/mesa` and `/pruebas` keep the drawn design — no provider, no
photo — which is also the fallback for an empty folder.

---

## Milestone 3 — Bots worth playing

### Phase 30 — Bot framework
Extract the strategy interface: a bot receives the legal state it can see and
returns a move. Add hand-evaluation helpers shared by all bots.
**Done when:** a new bot can be added in one file with no engine changes.

### Phase 31 — Bot personalities
At least three bots that differ observably: e.g. one that hoards for the perfect
meld, one that lays down at the first opportunity, one that watches discards and
plays around opponents. Give them names and short descriptions in the UI.
**Done when:** a head-to-head tournament shows different win rates and visibly
different play. **This is Milestone 3.**

### Phase 32 — Rough edges
A hint for new players, an in-game rules summary, and an end-of-game screen.
Card animations were pulled forward into Phase 22; what is left here is the
mesa that runs off the right edge when six players are deep into a partida —
Phase 17 left it scrolling sideways, which is the honest minimum and not an
answer.
**Done when:** someone who has never played Carioca finishes a bot game without
asking for help, and a full mesa can be read without scrolling to find it.

---

## Milestone 4 — Playable together

### Phase 33 — Persistence without accounts
Prisma schema, finished partidas saved, and a guest identity that survives a
page reload without anyone signing up. How a seat is claimed and protected is an
open design question — see `tech-stack.md`.
**Done when:** a player reloads mid-partida and is still themselves, and nobody
can claim a seat that is not theirs.

### Phase 34 — Rooms
Create a room, get an invite code, join as a guest with a nickname, see who is in
the lobby, start when everyone is ready. No gameplay yet.
**Done when:** three devices sit in the same lobby.

### Phase 35 — Server-authoritative play
The game state lives on the server. Each player receives only their own hand and
public information. Moves are submitted and validated server-side. Updates by
polling.
**Done when:** three people in three places finish a game from one invite code,
and no client ever receives another player's cards. **This is Milestone 4.**

### Phase 36 — Real-time transport
Replace polling with a push transport behind the same interface. Handle
disconnects and reconnects, and let a bot take over an abandoned seat.
**Done when:** a player closes the tab mid-game, returns, and the game is intact.

---

## After

Not scheduled, and not to be started before Milestone 4:

- A second game on the same platform — the real test of the engine's separation.
- Offline bot play. Installing to the home screen was pulled forward into
  Phase 18, for the screen space rather than for the install.
- Replays from seed and move list.
- Private leaderboards among friends.
