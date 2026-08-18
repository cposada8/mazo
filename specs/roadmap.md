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
room beyond a dark ground. Those are Phase 44, and none of them is what made
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
scroll for wrapping — which incidentally previews the fix Phase 44 wants
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

Dimmed later, on the owner's word — twice, because the first pass was too
timid: **nothing in dark mode is pure white any more.** This game is played on a phone at night, often with the lights
off, and a white slab on a near-black ground is a lamp pointed at the
reader. The brightest tone is now a soft off-white and the filled slabs —
a chosen option, Repartir, a ticked box — are dimmer still; the dark
deck's pips and the light deck's face came down with them, and the amber
turn accent too, since once the whites dropped it became the brightest
thing on the screen. Contrast stayed far above what legibility needs; what
it stopped being is painful. All of it lives in the tokens, which is why
it was one edit rather than thirty.

The second pass separated two things that had been one colour: **text and
filled slabs**. Everything that reads as a pressed option — Repartir, a
chosen number of seconds, a ticked box — was `bg-foreground`, so it wore
exactly the tone the text did. A block of colour throws far more light
than a letter of it, which is why the buttons still glared after the text
had stopped. They now take `--primary`, sitting well below the text
(0.62 against 0.79), and carry dark ink of their own.

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
- **The descarte can be browsed.** Tap the count and see every card in it,
  top first. (The control moved off the pile in Phase 36's follow-ups: a
  sixteen-pixel chip on the corner of the draw button turned a peek into a
  card you could not put back. It lives in the info strip now.) Only the top card is *playable* — this changes no
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

## Online moves to the front

Decided after Phase 29: multiplayer stops waiting. What is wanted is concrete —
start a partida, have one or several people join it with a short code, fill the
empty seats with bots — and everything else pending moves behind it. El
Codicioso is the only bot online needs for now, so the better bots (the old
Milestone 3) are displaced, not cancelled.

Sharpened while planning it: **there is no solo mode.** Playing against bots
and playing against people are the same game entered through the same door.
Arriving at the app deals you an alias (Phase 32). The home screen offers
exactly two things — create a partida, or join one with its code (Phase 33).
Creating one makes you the host of a table that already has **three bots
sitting at it** — a table of four by default — and hosting is choosing: keep
the bots, remove them, invite people, mix. The old setup screen's options
become the host's lobby.

One door does not mean one home: **where a partida lives is decided by who
is sitting at it.** A table of bots and nobody else keeps living in the
browser, the way the whole game does today — no connection needed to play,
and losing the signal mid-partida loses nothing. A table with another human
in it lives on the server, the only place two phones can trust. Same UI,
same engine, same seat's view; the two homes sit behind one interface
(Phase 34), and the drift risk a second implementation usually brings is
contained by how little each backing owns — transport, storage, and where
the bots think. The rest is shared, or it is a bug. The one honest
trade-off: nobody can join a partida that lives in your phone, so a
bots-only local table has no live code — the code is for inviting, and
inviting is what server tables are for.

The old plan survives this better than it might look. The four online phases
(old 33–36) keep their shape and their order; what changes is what stands in
front of them, and what was learned since they were written:

- **The seat's view comes first.** The old bot-framework phase already said
  that its view — what one seat can legitimately see — "is what the server
  will need in Phase 35 to send each player only their own cards". That half
  is pulled forward; the hand-evaluation helpers and the personalities wait.
- **The ronda nobody can win gets its rule now.** ~1.3% of bot partidas stall
  with no winner. Harmless in a soak, a hung room online — and it was already
  marked "decide before server play".
- **The bots move to the server.** Today `usePartida` runs `movesDelTurno` in
  the browser and spreads the moves with `setTimeout`. Online, a bot is the
  server's tenant. The functions themselves relocate for free — `lib/bots`
  imports nothing but the engine — but the pacing needs a server answer,
  because a serverless function has no clock between requests.
- **Every human turn gets a clock**, asked for with the reprioritization: a
  player who walks away loses one turn, not the whole table. Phase 21 built
  the draining ring and said so at the time — "what it leaves behind is the
  mechanism a real timer would need later".
- **One premise expired.** `tech-stack.md` said Vercel functions cannot hold
  WebSockets; since Fluid Compute they can. Polling first is still the plan —
  no new vendor, and a second of latency is invisible in a turn-based game —
  but the transport phase inherits a first-party option it did not have.

---

## Milestone 3 — Playable together

### Phase 30 — The seat's view ✅
What one seat can legitimately see, as a type: its own hand, everyone's
grupos, the descarte (browsable since Phase 24, public by definition), the
piles' sizes, everyone's card counts, whose turn it is, the fase, the
contract, who has bajado. And **no field that could carry another player's
hand** — the same construction that keeps `Relato`'s `mazo` variant from ever
naming a hidden card. Phase 22 called that discipline structural and named
this phase as the place it becomes so.

The bot interface narrows to take the view — `decidir(vista)` instead of
`decidir(state)` — and El Codicioso is ported. It already behaves as if this
were true ("it looks only at its own seat and the public piles"), so the port
is moving field accesses, not rethinking the bot. The runner keeps the full
state; only *deciding* is restricted.

This is the server's payload. Phase 34 sends each player exactly this view,
so it is worth getting right rather than fast.

**Done when:** the Phase 9 soak passes unchanged with the bot deciding from
the view alone, and a test proves that building any seat's view of any state
yields no card of any other hand.

**Done.** `lib/engine/vista.ts`, 409 tests. The soak passed untouched — zero
refused moves with the bot deciding from its view. The port surfaced one
design question worth recording: the bot *tries* mesa moves before making
them, and a view cannot run `apply`. The answer is `probarEnMesa`, in the
engine: a mesa move's legality depends only on public information plus the
mover's own hand, so the trial imagines the ronda around the view — other
hands empty, stock empty — and asks the **real** `apply`, whose mesa code
paths never read the imagined parts. The trial and the referee cannot
disagree, because they are the same function. The view also drops `rngState`
deliberately: whoever holds the stream can predict the stock, so a view
never carries it — and a test pins that.

### Phase 31 — A ronda that always ends ✅
The soak has measured it since Phase 9: ~1.3% of partidas reach a state
nobody can win, because Carioca has no stalemate rule. Online, that is a room
nobody can leave. The options are already written up in `carioca-rules.md`;
settle one with the owner, write it into the rules first — the Phase 20
lesson — then into the engine.

**Done when:** the 1,000-partida soak finishes 1,000 — zero stalls — and the
rule reads in `carioca-rules.md` like it was always there.

**Done.** The owner chose **tablas**: the descarte may rebuild the stock
twice, and a stock draw that can no longer be served closes the ronda on the
spot — nobody out, everybody scores their hand, no bonus, the closing seat
opens the next reparto. `ganador` widened to `number | 'nadie' | null`, the
relato narrates the close, and the who-won screen has a tablas face.

The instructive part: the rule alone fixed 12 of the 13 stalls. The
survivor (seed soak-204) never touched the stock at all — two bajado bots
were passing each other's "useful to the contract" discards forever, and a
bajado player has no contract left to be useful *to*. El Codicioso now
draws blind once bajado unless the face-up card can be **ligada right
now** (`probarEnMesa` answering, not a reimplementation). 1,000/1,000
finish; ~27 partidas per thousand see a ronda en tablas. 419 tests.

Also in this phase, asked for with the rule: the setup screen at `/jugar`
gained a **Volver al inicio** link — there was genuinely no way back.

### Phase 32 — Who you are, and where it is kept ✅
Two halves of one fact: the app must know who you are without an account,
and must not forget anything.

**Persistence:** Prisma + libSQL, per `tech-stack.md`: a local SQLite file in
dev, Turso in production. A partida is a row; its state is the JSON the
engine already is — decision 5, the rng riding as one number, was made for
this day, and `apply()` neither knows nor cares where a state slept.

**Identity,** settled in `tech-stack.md` before any code, closing its open
question: **no accounts, ever.** On first arriving at the app — the app, not
any particular room — you are dealt a per-browser secret and an **alias**,
drawn at random from `public/candidatos/alias.txt`: one name per line,
curated the same way as the comodín gallery (Phase 29's lesson) — add or
delete lines, push, and the deploy serves the new list. Both survive reload.
The alias is yours to change wherever it is shown; the secret is what claims
a seat, and is shown to nobody. An alias already taken at a table is not
dealt twice there.

And it lands in the current game immediately — this is the first visible
piece of the unified game: the table you already play greets you by your
alias instead of a generic label.

**Done when:** a partida survives the server process dying; a fresh browser
is named without being asked and keeps its name across reloads; changing the
alias sticks; the current solo table shows it; and presenting the wrong
secret can neither claim an occupied seat nor see its hand.

**Done.** Identity is `components/identidad.tsx` — a secreto
(`crypto.randomUUID`) and an alias from the file, dealt on first visit,
held in localStorage behind `useSyncExternalStore`, editable on the home
page and the setup screen, and greeting seat 0 at the solo table.
Persistence is Prisma 7 + libSQL (`lib/server/{db,partidas}.ts`): a
partida row holds the engine's own JSON (decision 5 doing its job), seats
are rows claimed by secreto, and `vistaParaSecreto` answers the wrong
secreto with null — indistinguishable from a partida that does not exist.
Tests run against a real SQLite file, schema pushed fresh each run. Worth
knowing: Prisma 7 moved the connection URL out of the schema into
`prisma.config.ts`, and the CLI no longer auto-loads `.env`. Production
still needs a Turso database and its two env vars — provision when Phase
33's lobby first deploys. 428 tests.

### Phase 33 — One door ✅
The home screen becomes the whole way in, and there is nothing behind it but
partidas: **create one** — you become the host, a **short code** is dealt,
and the table starts with **three bots already seated**, a table of four by
default — or **join one**, code in hand. Hosting is choosing: prune the
bots, add them back, wait for friends, or press start right away — which is
all that "playing alone" means now. The host configures the partida with
everything the old setup screen offered (contracts, comodines, seed,
thinking time) plus the **turn clock** Phase 36 will enforce: seconds per
human turn, **45 by default**. Those options move here; the old setup screen
is absorbed, not duplicated.

The lobby shows who is sitting where, everyone by their Phase 32 alias.
TanStack Query enters here to poll it — per `tech-stack.md`, "only once
online play needs polling", and now it does. Starting a table whose only
human is the host launches the game that already exists — the local one —
which under the two-homes rule is not a stopgap but the permanent routing
for a bots-only table; a start with other humans seated waits for Phases
34–35. And since the code exists for inviting, a table that never needed
one — all bots, no signal — can be created and played without asking the
server for anything.

**Done when:** the app is entered only through the door; creating deals a
code and three bots and the host prunes them; three devices sit in the same
lobby under their own aliases and reclaim their seats after a reload; and a
host alone with bots presses start and plays a full partida.

**Done.** `components/puerta.tsx` on the home page, `/partida/[codigo]` for
the lobby and the table, three route handlers, and `lib/lobby.ts` holding
the wire types both sides share so they cannot drift. Verified in a browser:
create → code `W2W6P` with three bots → Repartir → a full ronda played, bots
bajándose, aliases on the seats.

Four things worth keeping:

- **Sitting down needs no button.** Arriving with a code *is* asking for a
  seat, so the lobby joins you on the first poll that says you have none.
- **Removing a bot renumbers the table.** The engine deals by seat index, so
  a hole at index 1 would be a seat nobody sits in. Tested explicitly.
- **The old setup screen was absorbed, not copied** — contracts, comodines,
  clocks, and the two memory aids from Phase 24, which moved into the
  partida row so they survive `/jugar` retiring in Phase 34.
- **Reload already resumes a dealt partida**, ahead of schedule: the state
  is on the server and the deal is deterministic from its seed, so the
  local table rebuilds precisely what was stored. That is Phase 34's
  groundwork arriving for free.

One deliberate stop: starting with more than one human is refused with a
note, because the transport is Phases 34–35. The button is there; the
server behind it is next.

Two corrections after the owner used it on a phone. The checkboxes had
been **rebuilt rather than reused** when the setup screen moved in here,
and a filled square with nothing in it reads as neither on nor off — the
tick and the muted label came back, and the switches went back to real
`<input type="checkbox">`, which the platform draws unmistakably. And
every tap **waited a round trip**: choosing the rules used to be local
state and felt like it, so the host's settings now apply optimistically
and reconcile with the answer. A lesson worth keeping: moving a control
behind the network is a change to how it *feels*, not only to where its
value lives.

### Phase 34 — The partida lives on the server ✅
The thin slice that proves the architecture with the least new truth: **one
human plays against server-side bots** from a room code. A bots-only table
normally lives in the browser under the two-homes rule — this phase is the
server learning to hold the same partida, proven with the fewest humans
that can prove it.

Moves go up as requests; `apply()` referees on the server exactly as it
referees in the browser today; what comes down is the Phase 30 view plus the
public move log, and the client narrates and animates from that log with
everything Phase 22 built — the log was written against the same information
rule the view enforces, so nothing about it changes.

Your own moves must not wait for the wire: the client holds the same engine,
so it applies the move it just sent **optimistically** and the server's
answer can only agree — same pure function, same state. What the network
delays is seeing *others* move, which is what polling is for.

The bots think on the server, where there is no clock between requests: a
bot's turn is advanced **lazily** — computed when its thinking time has
passed and the next request arrives — with timestamps attached so the client
can pace the replay the way Phase 21 paced the original.

The local game does not retire — it is **formalized**: the controller talks
to a partida through one interface with two backings, `local` and `remota`,
and the door routes by who is seated — only bots, local; another human,
remota. The local backing also learns to persist (localStorage), so the
reload a server partida survives by construction, a bots-only one now
survives too — with the network off.

**Done when:** a full partida against server bots is played from a room
code with no visible lag on the player's own moves, and a reload resumes it
mid-turn; a bots-only partida started at the door plays to the end in
airplane mode and survives its own reload; and a test on the wire format
proves no payload ever contains a card of another hand.

**Done.** `lib/server/juego.ts` referees with the same `apply()`, and
`/api/partidas/[codigo]/mesa` reads and plays. 447 tests. Four things came
out of building it:

- **The table had to stop taking a `RondaState` first.** It rendered
  opponents' fans by mapping over their actual cards and merely not looking
  at the faces. It now takes a `VistaDeAsiento` and draws each fan from a
  count, so a card that is not yours never reaches the component — which is
  what let the payload be the view.
- **One table, two transports.** `useMesa` is the whole game on screen;
  `usePartida` (local) and `useMesaRemota` (server) only differ in where the
  view comes from and where a move goes. The pause, the travelling card and
  the mark on what you just drew are now **derived from the public log**
  rather than recorded when a move is sent — which is why a move somebody
  *else* made animates too.
- **Your own move lands before the server answers.** `aplicarEnVista` runs
  the real `apply` over the imagined ronda, so a move out of your own hand
  shows at once and the server can only agree. Drawing from the stock is the
  one move it refuses to guess: which card you drew is genuinely unknowable
  until the answer arrives.
- **Polling is everybody's clock.** A serverless function has no clock
  between requests, so a bot turn is *due* rather than scheduled, and any
  request arriving after its thinking time plays it. That also means the poll
  must keep running with the tab in the background — found in the browser,
  where a backgrounded lobby quietly stopped noticing people arriving.

The local home stayed and grew persistence: a bots-only partida is kept in
localStorage under its **código** — not its seed, because a seed names a
deal and replaying one should start over. Verified in a browser: a
five-seat table with two people and three bots, each seeing only their own
hand, played from one code.

### Phase 35 — Several people at one table ✅
The seats fill with people. Each device polls, receives its own view, and
plays its own turns; everyone watches the same partida move. The who-won
pause stays per-client — the next ronda is already dealt, and holding it on
screen is presentation, as it always was.

**Done when:** three people in three places finish a partida from one invite
code, and no client ever received another player's cards. **This is
Milestone 3.**

**Found afterwards, at a real table:** kimberly hosted and lucifer joined,
and on *lucifer's* screen the other player was also called «lucifer». One
constant caused it — `TU_ASIENTO = 0`, true while the only human was
whoever opened the page, and false the moment somebody else sat down. The
table drew every "is this me?" from seat zero: the names, whose turn it
was, whether *you* won, your own points. Only the hand was right, because
that comes from the view. The seat now comes from the controller, and a
test holds the exact table that failed.

The lesson is about how it survived: every browser check I ran was as the
**host**, who really is seat 0, so the bug was invisible from where I was
standing. A promise about several people needs to be checked from more
than one of their seats.

Phase 34's machinery is seat-count-blind, so most of this phase
was proving the promise rather than building for it: `varios.test.ts` sits
three people and a bot at one code, plays the partida to its last contract,
and checks **on every read by every player** that no card of anyone else's
hand appears anywhere in what they received.

It also found the leak that mattered. The **lobby** endpoint is read by
everybody at the table, and once dealt it was returning the partida's whole
`estado` — every hand in it. The public shape now carries the seed and a
`repartida` flag and nothing else; the full state has its own server-only
reader, and a test lists every card in play and asserts none of them appears
in what the lobby sends. It is the same discipline as the seat's view, one
endpoint further out — and a reminder that the rule has to be applied to
every payload, not just the one designed around it.

### Phase 36 — The player's clock ✅
Phase 21 timed the bots and promised the rest: "the mechanism a real timer
would need later, when the other seats are people who can walk away from
their phone." Later is now.

- **Every human turn has a clock**, set in the lobby by the host, 45 seconds
  by default.
- **The ficha's ring drains**, exactly the Phase 21 animation — the countdown
  is drawn on the player, and it starts from the server's timestamp so every
  device agrees on how much is left.
- **On expiry the turn plays itself out minimally:** draw from the stock if
  no card was drawn, then discard a random card, and the turn passes. The
  randomness comes from the partida's own stream, so a replayed partida
  replays its timeouts.
- **The server enforces it, lazily,** like bot turns: the deadline is stored
  with the turn and the first request after it applies the forced moves — an
  opponent's poll is what makes a timeout land, so nobody has to keep their
  tab open for the game to advance.

**Done when:** a player who does nothing loses exactly one turn — drew,
discarded at random, passed — the relato says so in words, the ring on their
ficha drained in time with it, and the host's lobby setting is the time it
actually took.

**Done.** `lib/engine/tiempo.ts` says what a turn nobody played looks like,
and the server applies it in the same loop that already advanced bots — a
turn is *due* rather than scheduled, so the only change was giving a human
seat its own allotment. 464 tests.

Three things worth keeping:

- **Which card goes is a pure function of the state.** It comes from the
  ronda's own stream, read without consuming it, so a replayed partida
  replays its timeouts. It is deliberately not the worst card or the best:
  a timeout should cost what a timeout costs, and a program playing well on
  your behalf is a different game.
- **The ring starts where everyone else sees it.** The turn's start is the
  server's timestamp, and the client starts the CSS animation partway
  through with a negative delay — so a phone that reloads mid-turn, or
  joins late, picks the countdown up rather than starting a fresh one.
- **Your own badge drains now**, which Phase 21 deliberately left still
  ("nothing hurries a human yet"). Only where the server enforces it: a
  table alone with bots still hurries nobody, because there is nobody to
  keep waiting.

### Phase 37 — Absences, and leaving on purpose ✅
Reconnection, and the seat whose player is gone. The design leans entirely
on choices already made: a seat belongs to a **per-browser secret** (Phase
32), not to a connection — and with polling there is no connection to lose.
Every request stands alone and says who it is from, so coming back is not a
resurrection of anything; it is just arriving again. Closed tab, dead
battery, lost signal: one path serves all three.

- **The way back is the door.** Opening the app while seated at a live
  partida shows it before anything else — *Vuelve a la mesa* — because the
  server can answer "where is this secret sitting?". The room's URL works
  too: reopening the tab, or tapping the invite link a second time, lands
  you at your own seat with the full current view rebuilt from scratch. The
  state is small; nothing incremental is needed.
- **Presence is a timestamp, not a session.** Every poll refreshes the
  seat's last-seen, and a seat gone quiet wears it on its ficha, so the
  table sees who is absent without anyone asking.
- **The table never waits**, because Phase 36 already forces the move when
  the clock runs out. What this phase adds is mercy: a seat that keeps
  timing out is handed to a bot — better turns than forced random
  discards — and handed back the moment its owner reappears, starting with
  their next turn.

And leaving is also something you do **on purpose** (asked for by the owner
with the Phase 31 decision): an **Abandonar** option, deliberately tucked
behind the menu so nobody hits it by accident, hands you back to the lobby
and retires your seat for the rest of the partida. The table plays on
without you: your score and your historial stay on the marcador exactly as
they stood, but the retired seat is dealt no more cards, takes no more
turns, and accrues no more points. Retiring a seat mid-ronda is engine work
— its hand leaves play and the turn order closes over the gap — and is
specified in `carioca-rules.md` before it is coded, per the standing rule.

If Phase 38 ever swaps polling for a push transport, this is the contract
it must keep: a dropped socket rejoins by secret and receives the whole
view again.

**Cut by the owner:** the bot that was going to cover an absent seat. Two
reasons, and the second is the real one: a stand-in keeps your score
moving while you are not there, and the point of an empty chair is that
nobody is playing it. An absent player already loses only what the clock
takes — draw, random discard, pass — which is the whole cost of being
away.

**Done when:** killing the page mid-turn and reopening the app puts the
player back at their seat, hand and turn intact; and a player who presses
Salir frees their chair for good — no more cards, no more turns, nobody
waiting — with their score frozen where they left it.

**Done.** 473 tests. The shape of it came from the owner correcting an
assumption of mine, and the correction was the point of the phase:

- **«Salir» did nothing.** It was a link to the home page — the server
  never heard about it — so leaving and losing signal were the same
  event, and the table kept dealing you cards and waiting out your clock.
  It now frees the seat, and asks first, because it is the only
  irreversible thing on that screen and it shares a word with "show me the
  home page".
- **Leaving and being gone are different, and the only thing that tells
  them apart is what you pressed.** A closed page keeps your chair; the
  door offers it back (`/api/asiento` answers "where is this secreto
  sitting?"). Pressing Salir gives it up, and the door stops offering it.
- **A vacated seat is skipped, never played.** Its cards leave play, the
  turn order closes over it, later repartos deal it nothing, and its total
  freezes — `puntosDeMano([])` is zero, so the score stops moving without
  a special case. A table down to one player ends rather than playing on
  alone.

### Phase 38 — Real-time transport ✅ — closed as a decision, not as code
Only if polling feels bad at a real table. It did not. Two people played a
partida from one code on separate phones on 18 August 2026, and the owner's
verdict was that it held: an opponent's move is there by the time you look
up from your own hand. **Polling with TanStack Query stays.**

What this phase inherited stays written down rather than built: Vercel
Functions now hold WebSockets on Fluid Compute, so the order to try, should
the day come, is first-party WebSockets and then Pusher. Nothing about that
swap gets harder by waiting — the transport sitting behind one interface
(`useMesaRemota`, Phase 34) is exactly what makes the delay free. What would
reopen it is a bigger table, a slower network, or a real-time feel the game
does not currently need: Carioca is turn-based, and a second of latency in a
turn-based game is invisible.

**Learned:** a phase whose done-when is a measurement is allowed to end
without a diff. Writing the decision down is the deliverable.

**Done when:** ✅ polling measured at a real table and declared good enough.

---

## Milestone 4 — Bots worth playing

Displaced by the reprioritization, not diminished: online play with one
dull bot comes before solo play with three interesting ones.

### Phase 39 — Bot personalities ✅
At least three bots that differ observably: e.g. one that hoards for the
perfect meld, one that lays down at the first opportunity, one that watches
discards and plays around opponents — which the Phase 30 view makes honest,
since "what this seat has seen" is now an input rather than a licence to
peek. The rest of the old framework phase lands here too: hand-evaluation
helpers shared by all bots, and a new bot addable in one file with no engine
changes. Names and short descriptions in the UI, choosable wherever the host
seats a bot — which, one door being one door, is the lobby.
**Done when:** ✅ a head-to-head tournament shows different win rates and
visibly different play, and the host seats whoever they like from the lobby.
**This is Milestone 4.**

**The lobby seats them.** `Asiento.bot` holds a bot's id; the picker on each
bot seat shows the three names with their one-line descriptions, so everyone
at the table reads who they are up against and only the host can change it.
The choice reaches both homes — the server's own loop and the browser's — and
`botPorId` never returns null, so a partida stored with a bot that has since
been renamed away keeps playing as El Codicioso rather than owning a seat that
cannot take its turn.

**Groundwork ✅ — the floor before the personalities.** Playing the bots
turned up two things that were not character, they were blindness, and the
owner's call was to fix them first so that the new floor is the baseline
everything else is measured against:

- **The mesa has two doors and the bot knew one.** Every trial the bot ran
  built an `agregar` move, so the slot a comodín is standing in — reachable
  only by `moverComodin`, paid for with the exact card it stands for — was
  invisible. The bot watched the 6♥ it needed go past while a comodín sat on
  the mesa pretending to be it. **Across the soak's thousand partidas the old
  bot played that move zero times; the new one plays it 1,760.**
- **A card is worth what its context makes it worth.** The discard scored
  every card by progress toward the contrato *even after bajarse*, when there
  is nothing left to lay down — so a useless pair of fours outranked the card
  with a home waiting on somebody's escala. Once bajado the measure is now
  reach on the mesa: which grupo out there could still grow to take it.
  Phase 31 had already patched this at the draw and left the discard alone.

Same thousand seeds, before and after: still 1,000/1,000 finished, and the
average partida is 11 turns shorter (332.7 → 321.1). The draw stays strict —
bajado, the face-up card is taken only if it ligadoes *right now* — because
loosening that is what hung seed soak-204, and freeing a comodín shrinks the
hand and grows the mesa, so it cannot loop.

**The family, and what measuring it said.** `lib/bots/` now has a shape: a
`Perfil` answers the three judgements that are character — is the face-up card
worth taking, is this the moment to lay down, what is a card worth in hand —
and `decidirConPerfil` plays the turn around them. Everything else is shared
in `evaluar.ts`, because a personality must be a difference of strategy and
never of competence. One judgement is withheld on purpose: once bajado, the
face-up card is taken only if the mesa will take it now, which is the rule
that keeps two bots from passing the same card forever.

Measured over 1,200 four-seat partidas, seats rotated, none unfinished:

| | victorias | puntos por asiento | turno medio de bajada |
| --- | --- | --- | --- |
| El Codicioso | 460 | 506 | 26.2 |
| El Paciente | 303 | 565 | **33.4** |
| El Memorioso | 443 | 511 | 26.6 |

- **El Paciente is a different bot and a worse one, which is the deal.** It
  lays down seven turns later, and head to head against the baseline it loses
  931 to 574 and carries 52 more points a partida. Patience costs exactly what
  it was always going to cost.
- **El Memorioso plays differently and finishes level.** 764 to 739 over 1,500
  partidas is a coin flip, and the points are 401 to 400. Counting what is
  dead changes which card it throws — it lets go of a pair whose partners are
  all face up, which the other two protect to the end — and changes nothing
  about who wins. Recorded as measured, not as hoped.

Two things the measuring turned up that were not the point of the phase:

- **Greed at the draw is not a personality this game can carry.** El Paciente
  first hoarded at the draw too, taking anything with a partner. Four of them
  hung 222 rondas out of 400 — and tablas did not save them, because tablas
  fires when the *stock* cannot be served and a table of hoarders takes the
  face-up card every turn and never touches the stock.
- **Two-seat tables stall, and always did — and the owner is not worried.**
  Four bots: 0 rondas in 600 never end. Three: 1. **Two: 62.** Raising the cap
  from 300 turns to 1,000 rescues none of them, so they are not slow, they are
  stuck — the same descarte loop, which two players fall into far more easily
  than four. It predates the phase: it is El Codicioso alone, and strictly it
  means Phase 31's "every ronda ends" is not true at two seats.

  **Deliberately left open.** The loop needs *both* players to keep taking the
  face-up card, and a table of two always has a person at it — a table is
  created by its host, who sits at it. A human does not play the loop. So the
  case that fails is bots-only-at-two, which nobody can arrange, and the owner
  read it as theoretical and said so.

  If it is ever worth closing, close it as a rule and not as a patch to one
  bot: *a ronda in which nobody bajas and nothing is added to the mesa for N
  full rounds ends en tablas.* That shuts the door on every loop of this
  shape, including the hoarding one measured above, and it belongs in
  `carioca-rules.md` before it belongs in the engine — the way tablas itself
  was settled.

### Deferred: the components of a stronger bot
Named while planning Phase 39 and left out of it on purpose. None of these is
needed for three bots that play observably differently; all of them are needed
for a bot that is genuinely hard to beat. Written down here so the next person
does not have to rediscover them.

- **A model of what each opponent holds.** The owner's idea, and the largest of
  these. Instead of counting cards in the abstract, the bot keeps a running
  belief about every other seat — what they have taken face up, what they have
  declined to take, how many cards they hold, what they have bajado — and from
  it estimates what each seat *needs* and what it can afford to be without. Two
  concrete plays fall straight out:
  - **What my predecessor is likely to throw** is what I can afford to wait for
    rather than chase.
  - **What my successor is likely to take** is what I must not throw. Only the
    player in turn draws, so a discard is offered to exactly one person: the
    next seat. That makes the defensive half of the model unusually cheap —
    one seat to worry about, not five.
- **Relatos as honest memory.** The belief above cannot be derived from a
  `VistaDeAsiento`: a view is a snapshot, and it shows the descarte as a pile
  without saying who took what off it. The `Relato` log already persisted
  beside the partida is the missing input, and it is public *by construction* —
  a bot reading it is not peeking, which is the whole reason that type was
  built the way it was. The price is that `Bot.decidir` grows a second
  argument both homes have to feed. Its limit, in every version of this idea:
  a rebarajada empties the descarte back into the stock and takes the trail
  with it.
- **What a discard gives away.** Phase 39 asks what a card is worth *to me*.
  The other half is what it is worth to the table — a card that lands on a
  grupo already on the mesa is a gift to whoever is bajado — and the strict
  version of that question needs the model above.
- **Pressure from the end of the ronda.** Points in hand only become a penalty
  when somebody goes out. How urgently to dump expensive cards should scale
  with how close the ronda is to closing: hands shrinking, somebody bajado,
  the stock low, the rebarajadas spent.
- **The comodín economy.** El Codicioso never throws a comodín and never weighs
  one against what holding it costs. A stronger bot decides when 50 points in
  hand outweigh the flexibility.

Phase 39 itself takes the cheaper road deliberately: everything its bots know
is derivable from the seat's own view, so `decidir(vista)` keeps its shape and
a bot behaves identically in the browser and on the server. What the view
alone can already support is real counting — which cards are dead because both
copies have been seen, and which are still live — and that is enough for a bot
that visibly plays differently.

---

## The list from playing online — ahead of the rough edges

Milestone 4 shipped and the owner went and played the thing with other
people. The list that came back is seven items long, and it sorts into three
kinds.

**The game knows more than it shows, and it moves faster than the eye.** A
move made three seats away lands as a fait accompli; the ronda that was just
won vanishes before anyone can look at what won it; cards appear on the mesa
with nothing to say they are new.

**Your own seat is the worst-served part of the screen.** Your clock is
running and you cannot see it; the hand goes rigid the moment it stops being
your turn, which is exactly when there is time to think; and upright, the
controls for arranging it are pushed off the edge by a line of text.

**And one colour.** The white was tuned at night and is too dim by day.

Same rule as the two lists before it — what a real game finds outranks new
machinery — so these go ahead of the rough edges, and **the old Phase 40 is
now Phase 44.** They are ordered smallest-and-most-unfair first, then the
two that need design, then the palette last, because a pass over every white
surface should come after the phases that add surfaces.

### Phase 40 — Your own seat ✅
Three asks, all about the half of the screen that is yours — the least
served part of the table. None of them changes a rule, and none of them is
hard; what they have in common is that the seat you actually sit in is
treated as a spectator's.

- **The clock you can read.** Phase 36 gave the human turn a clock and drew
  it in two places: the ring around the ficha of whoever is up, and — for
  your own turn — a bar that drains behind the words «Tu mano». Online, the
  owner sees the first and not the second. **You can watch everybody's time
  run out except your own,** which is the one that costs you a turn. Find
  out first which it is — not rendering, or rendering and invisible; both
  are plausible from the code, since `relojPropio` is true only on server
  tables (`useMesaRemota`) and the mark it produces is a translucent wash
  behind a heading in a scrolling strip. The fix is the same either way:
  **your own countdown should be as loud as the one drawn on other people**,
  and drawn where your eyes already are on your turn, which is your hand and
  not the far side of the table. Nothing about the mechanism changes — the
  duration and the start line still come from the server (Phase 36's
  negative delay), so what you see agrees with what everyone else sees
  draining.

- **The hand you can arrange while others play.** Waiting is when you have
  time to think, and it is exactly when the hand goes rigid. The intent is
  already in the code — `AccionesDeMano` carries the comment "always
  available: it changes nothing about the game, so there is no reason to
  lock it to your turn" — and one line defeats it: `onCarta` is passed only
  when `esTuTurno`, so off your turn you cannot **select**, and everything
  except the two sort buttons needs a selection. Gathering, sliding, pinning
  a bloque: all unreachable while somebody else thinks. **Selecting is not a
  move** — it touches nothing the referee judges — so it should work
  whenever the hand is on screen, and the selection you built while waiting
  should still be there when your turn arrives, ready to be discarded or
  bajado.

- **The controls that do not need a swipe.** In portrait the hand's heading
  row is one line that does not wrap: the instruction («Toca el mazo o el
  descarte para robar.»), then «Tu mano», then the arranging controls — and
  on a phone held upright the instruction eats the row and pushes the
  controls off the right edge, so grouping, sliding and pinning are reached
  by scrolling sideways to find them. **The row belongs to the hand's
  controls.** Take the instruction out of it. If a hint survives at all it
  belongs where the game already narrates itself — the info strip along the
  felt — and never in competition with the buttons. Phase 44's hint for new
  players inherits that constraint rather than reopening it.

**Done when:** on a phone held upright, at a real online table: you can tell
how much of your turn is left without looking at anyone else's ficha and it
agrees with what they see; you can select, gather, slide and pin cards while
another player is thinking, and the arrangement is still there when your
turn comes; and every one of those controls is on screen without scrolling
to it.

**Done.** Measured on a 390 × 844 viewport at a two-human table, which is the
only kind that has a human clock at all — and that turned out to be the whole
of the first ask.

- **The clock was rendering. It was off the screen.** `relojPropio` was set
  and the badge was draining, but the heading row was a sideways scroller and
  «Tu mano» — the thing the wash sits behind — had been pushed past the right
  edge by the instruction in front of it. So the third ask was the cause of
  the first, and the two were one fix. The ring is there on merit rather than
  necessity: it is 18 px beside the badge, drawn by the same `AnilloDeReloj`
  the fichas use, from the same `Reloj` — measured at 45 s with a −0.19 s
  delay while the seat across the table showed the same countdown.
- **The row wraps now instead of scrolling.** The heading and the controls
  never shrink; whatever is passed in beside them takes the leftover width
  and drops to a second line when there is none. A long aviso costs 22 px of
  height while it is up and is readable in full, which is better than the
  truncation it used to get — and the controls do not move for it.
- **Selecting off-turn was one conditional.** `useMano` never checked whose
  turn it was; `Tablero` withheld `onCarta`. Measured while seat 1 was
  thinking: twelve cards selectable, two gathered and slid left, pinned into
  a bloque — and nothing that would be a move on offer, because `Controles`
  still asks whose turn it is.

**Learned:** three complaints, two causes. The instruction line was not
merely in the way of the controls, it was hiding the clock as well — worth
remembering the next time something is reported invisible on a phone.

### Phase 41 — A turn you can follow ✅
The complaint, in the owner's words: *de repente te aparece que ya el jugador
botó y cogió.* Two causes, and they compound.

- **The server plays a whole turn at once.** A bot's turn comes *due* and
  `avanzar` applies every move of it in one write (`lib/server/juego.ts`),
  so the next poll is handed draw, bajada and discard as a single jump. The
  local home does the opposite: Phase 21's `tiemposDeMoves` spreads the same
  moves across the bot's seconds precisely so the turn can be watched.
- **The client narrates only the last one.** `useMesa` animates the newest
  relato and drops the rest on purpose — "catching up on several at once
  should land the table where it is now, not replay the last few seconds."
  That was the right call for a reload. It is the wrong one for a turn that
  happened while you were looking at it.

The fix has a server half and a client half, and the phase should do both:
**pace the bot's turn on the server** — one move due at a time, the seconds
divided the way Phase 21 divides them, so the intermediate states genuinely
exist for a poll to find — and **queue the narration on the client**, so
several relatos arriving together are told in order at a readable pace
rather than all but one thrown away. Keep the drop for the case it was
written for: catching up after a reload, or a gap long enough that replaying
it would be a lie.

One constraint is not negotiable and belongs in the write-up: **the view
cannot be rewound.** The engine has already moved the card by the time the
client hears about it, so the pacing is presentation, and the mesa may show
a result a beat before the story finishes telling it. Decide how much of a
beat is honest.

This is also the first thing that reopens **Phase 38**, which measured
polling and kept it. The answer may well be *poll faster while somebody else
is thinking* rather than a new transport — a 1.2 s interval is invisible on
your own turn and is exactly the wrong grain for watching someone else's.
Measure before reaching for WebSockets.

**And the other half of following a turn: say what landed.** Every card put
on the mesa during a turn is **marked — gold — until that turn ends**:
whatever is bajado, whatever is added to somebody else's grupo, the card
that pays for a freed comodín. It answers the same question the travelling
card answers for the piles, and it answers it for your own plays too, which
is the cheapest way to see that what you tapped went where you meant.

The mark cannot come from the relato: `agrega` names cards as prose («J♥»)
and `bajada` does not name them at all. **The mesa itself is the source** —
grupo cards carry ids, the view carries the mesa, and a diff against the
mesa as it stood at the start of the current `numeroDeTurno` is public
information by construction, so it works in both homes and tells no secrets.

**Done when:** you can sit through another player's whole turn — a bot's or
a person's — and see it happen in the order it happened, and when it is over
the mesa still shows, in gold, exactly what that turn put there.

**Done.** Both halves, and a third thing the first two made necessary.

- **The server divides the turn.** `avanzar` runs the same `tiemposDeMoves`
  the browser has used since Phase 21, as deadlines rather than timers: move
  *k* of *n* is due at its share of the allotment, a request plays only what
  is due, and a turn left half-played keeps its start line so the rest comes
  due to whoever asks next. The last move still lands at the end, so a turn
  takes exactly the seconds the lobby set. The bot is re-decided from where
  the turn stands rather than remembered — it is pure, so the resumed turn is
  the one that was interrupted.
- **The write became a compare-and-swap.** Pacing multiplies the windows in
  which two watchers find the same move due, and the loser used to overwrite
  the winner — briefly taking a move back. The update is now conditional on
  the state it was computed from still being the stored one, and the loser
  reads the winner's answer. No new column: the state is its own version.
- **The client tells the story rather than displaying it.** `useMesa` counts
  what has been told; the rest is a queue, 750 ms a line and 300 ms while
  catching up, and past five waiting it lands where the table is — Phase 22's
  instinct, kept for the reload it was right about. The travelling card is
  fired by a line being *told*, not by the log growing, so animation and words
  stay in step.
- **And the poll rate follows the wait**, which is Phase 38 reopened and
  answered without touching the transport: 500 ms while another seat is
  playing, 1500 ms on your own turn, when nothing can change without you. On
  balance it is not more polling — only one seat is in turn at a time, and
  that is the seat that slows down.

**Measured at a two-human table with three-second bots.** Every bot turn now
reaches the screen as two separate showings about a second apart — *El
Codicioso 1 robó del mazo*, then *El Codicioso 1 botó J♥* — where before both
landed in the same frame and only the second was ever shown. A poll costs 4 ms
with the bot simulation that now runs on every read.

**The gold is derived from the mesa, not from the log**, because `agrega`
names its cards as prose and `bajada` does not name them at all. The base is
taken at each turn change from the mesa *as it stood at the look before*,
which is what keeps a whole turn's work marked in the case that motivated the
phase: when the turn number and the new cards arrive together, measuring
against the current look would erase the mark in the same frame it appeared.

**What is honest about the beat.** The queue paces the telling, not the game:
the view has already moved, so the mesa can be one line ahead of the words
naming the move that changed it. That is the price of a story told in order
and it is cheaper than no story.

**Verified by test rather than at the table:** the gold itself. Its derivation
is pinned by three cases against the real hook — a grupo growing mid-turn, a
whole turn arriving at once, and the mark clearing when the next turn passes —
and its rendering by two more. Nobody has yet sat at a live table and watched
an opponent bajarse in gold; a bot lays down around its twenty-sixth turn,
which is a long time to hold a browser open.

### Phase 42 — What it was won with ✅
Somebody goes out and the table is gone: `FinDeRonda` replaces the whole
screen with the score. You never see the mesa that ended the ronda, nor the
play that closed it — and going out on a ligada (Phase 26) means the winning
card can be a single card on somebody else's grupo, which is exactly the
thing everyone wants to look at.

The obstacle is structural and worth naming before any UI is drawn: **the
engine closes the ronda and deals the next one in the same move.** By the
frame the client learns a ronda ended, `vista.ronda` is already the next
reparto — and a poll can skip the closing state entirely, so even
remembering the previous render does not save it online. So the closing mesa
has to be **kept, not caught**: `Marcador` grows a snapshot of the mesa as it
stood when the ronda closed, and the historial carries it — which means the
engine, the persisted partida, and every device reading them agree on what
the final table looked like.

With that in hand the pause gets its first step: **the mesa as it ended,
before the score.** Whoever won, what they went out with, and — for free, if
Phase 41 lands first — the last turn's cards still in gold. Then the
scoreboard, on a tap, the way it works now.

**Done when:** a ronda you did not win ends and you can study the final mesa
for as long as you like, see which grupo the winner's last card went to, and
only then move on to the score.

**Done.** The obstacle was the one the phase named, and the fix is the one it
proposed: `Marcador` carries a picture of the mesa as it stood when the ronda
closed, plus `cierre` — the ids the closing move put there, which is the
answer to *con qué*. Both are optional, so a partida saved before they existed
opens and goes straight to the score, as it always did.

- **The diff is taken in `aplicarEnPartida`**, which is the only place that
  holds both the ronda before the closing move and the one after it.
  `cerrarRonda` takes the earlier one as an argument and subtracts: what is on
  the mesa now and was not then is what it was won with. Empty when the winner
  went out by botando, and the screen says so in words instead.
- **The pause opens on the table.** «Ver el puntaje» is one tap away and
  «Volver a ver la mesa» comes back, so the score is behind the mesa rather
  than instead of it. The snapshot is drawn with `GrupoEnMesa` on the same
  felt and with the same deck, and the comodines wear the faces of the ronda
  that ended rather than the one already dealt behind it.

**A privacy test caught something worth writing down.** The existing guard —
no payload may contain a card id belonging to another seat's hand — went red,
because **card ids repeat from one reparto to the next**: `J-hearts#0` names
the first J♥ in every deal, so a card photographed on last ronda's mesa shares
its id with whoever holds that card now. Nothing is leaked (a photograph of a
finished ronda says nothing about this one, and everything in it was face up
when it was taken), so the guard now covers the live view and exempts the
historial, in writing. What keeps it honest structurally is that the snapshot
is read from `grupos` and never from `hand` — pinned by its own test.

**Seen working, not only tested:** a ronda closed by ligando in a real
browser, at 390 × 844. The screen says «Salió poniendo lo que está en
dorado», the three grupos are on the felt, and the 7♦ that closed it is
ringed on the trío it joined.

### Phase 43 — The white you choose ✅
The owner tuned the white by night, over a run of commits, and the result is
right in the dark and too dim in daylight. Turning it up puts the lamp back
in your face at night. **This is not a setting the theme can decide** — it is
ambient light, and the phone is in a different room every time.

So: **one control for the white, and one white for everything.** A slider —
or whatever reads best on a phone with one thumb — that moves the brightest
tone the app uses, and moves it *everywhere*: text, card faces, the pips,
buttons, borders, the marks on the felt.

That last word is the work. Today there is no single white to turn. Dark
mode defines a family of near-whites by hand (`--foreground` at oklch 0.79,
`--primary` at 0.62, `--muted-foreground` at 0.6, and the deck's
`--carta-tinta`), and roughly thirty literal `stone-*` utilities are
scattered through the components besides. **Unify first, then expose:** one
token for the white with the rest derived from it by ratio — the way
`--carta-md` already generates every card size — and the literals folded in.
Then a slider is one variable, and a value stored per browser and applied
before paint, exactly the way `components/tema.tsx` already lands the theme
class without a flash.

Keep the range honest at both ends: the bottom of the slider must still pass
contrast against the near-black ground, and the top must not be pure white
on the felt.

**Done when:** one control, moved with a thumb, visibly changes every white
on the table at once — text, cards and buttons together, with none of them
left behind — the choice survives a reload, and the same phone can be read
outdoors at noon and in a dark room without touching anything else.

**Done.** The slider was the easy half, as expected. The work was that there
was no white to turn.

- **One number, everything else a distance from it.** `--blanco` is the
  lightness of the brightest ink; `--tinta`, `--tinta-suave`, `--tinta-tenue`
  and `--linea` are written as `calc()` offsets, the dark theme's foreground,
  primary, muted and ring are written the same way, and the dark deck's
  `--carta-tinta` is simply `--tinta-suave`. The offsets were read off the
  values already in the file, so at the default the palette is byte-for-byte
  the one the owner tuned at night — this phase changes nothing until the
  slider is moved.
- **The literals are gone**, or rather sorted: about thirty `stone-*`
  utilities were inks and became `text-tinta`, `border-linea` and friends
  through `@theme inline`; the rest were **grounds** — `bg-stone-950`, the
  ficha, the felt's chips — and stayed, because a dark table is a dark table
  however bright its ink.
- **It is not a theme, and it is not the theme's.** What changes is the room,
  not the hour, so the light theme's near-black text is untouched and the
  table — dark in both themes — carries the same ink family either way.
- **Two controls, one number.** Beside the theme switcher in the header, and
  inside the game's menu, which is where you notice it. Both read one
  module-level store, so they cannot disagree. The value lands on `<html>`
  before the first paint from a script at the top of the body — Phase 12's
  no-flash discipline, for the same reason.
- **The ends are held.** 0.72 to 0.94: below that the dimmest ink stops
  clearing the near-black ground, above it the felt gets the lamp the whole
  palette was tuned to avoid. Anything else — a hand-edited key, a NaN — is
  clamped or ignored.

**Measured in the browser, dark theme, one partida open:** moving the slider
from 0.79 to 0.94 took the body text 0.79 → 0.94, the filled slabs 0.62 →
0.77, the felt's labels 0.71 → 0.86 and the card pips 0.71 → 0.86, all in the
same frame. The choice survives navigation and reload.

---

## Closing Milestone 4

### Phase 44 — Rough edges
*Was Phase 40, displaced by the list above.*

A hint for new players and an in-game rules summary. Card animations were
pulled forward into Phase 22 and the end-of-game screen into Phase 42; what
is left here is the mesa that runs off the right edge when six players are
deep into a partida — Phase 17 left it scrolling sideways, which is the
honest minimum and not an answer.

Whatever the hint turns out to be, it does not go back in the hand's heading
row: Phase 40 cleared that row for the arranging controls because upright
they were being pushed off the screen.
**Done when:** someone who has never played Carioca finishes a bot game without
asking for help, and a full mesa can be read without scrolling to find it.

---

## After

Not scheduled, and not to be started before Milestone 3 — online play:

- A second game on the same platform — the real test of the engine's separation.
- Opening the app with no network at all. *Playing* bots offline is Phase
  34's two-homes rule; what remains is a service worker so the app itself
  loads without a connection. Installing to the home screen was pulled
  forward into Phase 18, for the screen space rather than for the install.
- Replays from seed and move list.
- Private leaderboards among friends.
