# Project status — pick up here

Last updated after Phase 38.

Read this first, then `mission.md` for the why, `carioca-rules.md` for the game,
`tech-stack.md` for the stack, and `roadmap.md` for what comes next. This file is
the short version and the handoff point; the roadmap is the authority on
sequencing.

**Keep this file current.** Update it at the end of every phase — a stale status
doc is worse than none.

---

## Where things stand

Phases 0–33 are done. **Carioca is playable, and it is entered through one
door.** Open the site on a phone, get dealt an alias, create a partida —
you host, a short code is dealt, three bots sit down — and play a full
partida: draw, lay down, unload onto anyone's grupos, discard, and see the
scoreboard at the end.

Milestones 1 and 2 are both complete. What is missing is other people — and
after Phase 29 the roadmap was reordered for exactly that: **Milestone 3 is
now online play** (a partida started, joined with a short code, bots in the
empty seats), and the better bots moved behind it as Milestone 4.

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
| 28 | Ajustes from inside the partida | ✅ |
| 29 | The comodines get a face | ✅ |
| 30 | The seat's view | ✅ |
| 31 | A ronda that always ends: tablas | ✅ |
| 32 | Who you are: identity, alias from a file, persistence | ✅ |
| 33 | One door: create (host, 3 bots default) or join by code | ✅ |
| 34 | The partida lives on the server | ✅ |
| 35 | Several people at one table | ✅ — **Milestone 3** |
| 36 | The player's clock | ✅ |
| 37 | Absences: reconnection, and leaving on purpose | ✅ |
| 38 | Real-time transport: measured, polling kept | ✅ — a decision, no code |
| 39 | Bot personalities | ✅ — **Milestone 4** |
| 40 | Your own seat: your clock, arranging off-turn, controls in reach | ✅ |
| 41 | A turn you can follow: paced narration, and gold on what landed | ✅ |
| 42 | What it was won with: the final mesa before the score | ✅ |
| 43 | The white you choose: one slider, every white | ← **next** |
| 44 | Rough edges *(was 40)* | |

**Phases 40–43 are the list from playing online**, and they displaced the old
Phase 40 to 44 — the same rule as the two lists before them: what a real game
finds outranks new machinery. Seven asks in three kinds: the game shows less
than it knows and moves faster than the eye (41, 42), your own seat is the
worst-served part of the screen (40), and the white was tuned at night and is
too dim by day (43). They are ordered smallest-and-most-unfair first, then the
two that need design, then the palette last, because a pass over every white
surface belongs after the phases that add surfaces. `roadmap.md` has the
reasoning and the obstacles already found in the code.

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

**The second list from the table is done** (Phases 26–28): an empty hand now
wins however it was emptied — a ligada that empties the hand closes the ronda
instead of freezing the game — the setup screen offers sin comodines and
defaults to cartas oscuras with fullscreen off, and the bots' thinking time
and the card finish are editable from the in-game menu, effective on the very
next turn.

**And the comodines wear faces** (Phase 29): a gallery in
`public/candidatos/comodines` is read by the server at build time, and each
ronda deals a face to each comodín from the partida's seed — rondas differ, a
replayed seed repeats. Curating the gallery is deleting files and pushing;
no code changes. `lib/caras.ts`, `components/caras.tsx`.

- **Repo:** https://github.com/cposada8/mazo
- **Live:** https://mazo-six.vercel.app — **online play is in production**
  since Milestone 3: the door creates or joins a partida by code, and a
  table with more than one person is refereed by the server. **Milestone 4
  is in production too**, played on dev first and promoted on the owner's
  word that it held: the host picks who sits in each bot seat. `/mesa` steps
  through a bot partida, `/pruebas` shows deals and grupo validation.
- **Dev:** https://mazo-git-dev-cepm23.vercel.app — the latest commit on `dev`,
  public, no login.
- **Deploys:** work goes to `dev`, which builds by itself. Production changes
  only by merging `dev` into `main`. Nothing else deploys `main`.
- **Tests:** 501, all green (the run takes ~16s, mostly the soak). `npm run test:run`, `npx tsc --noEmit`, `npm run lint`.
- **Database:** SQLite via Prisma 7 + libSQL. Local dev uses `prisma/dev.db`;
  **online is live on Turso** — database `mazo`, in its own group in
  `aws-us-east-1` so it sits beside Vercel's functions and leaves
  `fwc_2026`'s group alone. Credentials are in `.env.local` (gitignored) and
  as encrypted Vercel env vars for all three environments.
  - After a schema change: `npx prisma db push` for local, then
    `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma
    --script | turso db shell mazo` for Turso — the Prisma CLI will not take
    a `libsql://` URL directly.

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
lib/engine/vista.ts  What one seat may see. Bots and the server both take it.
lib/asientos.ts      Where each seat goes around the table. Pure geometry.
lib/relato.ts        A move told in words, public information only — the
                     `mazo` variant cannot carry a card by construction.
lib/semilla.ts       Short readable seeds, random by default.
lib/pantalla.ts      The Fullscreen API, wrapped small.
app/manifest.ts      Standalone install, for the screen space.
app/jugar/           The table itself: juego.tsx, usePartida.ts. inicio.tsx is
                     the pre-door setup screen, retiring in Phase 34.
app/partida/[codigo]/  The lobby, then the table. One URL, one partida.
app/api/partidas/    Create, read, and act on a partida.
lib/lobby.ts         The wire between door and server: types both sides share.
lib/codigo.ts        The short invite code, and what a typed one means.
lib/alias.ts         Parsing the alias file.
components/puerta.tsx     The door: create a partida, or join by code.
components/identidad.tsx  Your secreto and alias, dealt on first visit.
components/consultas.tsx  TanStack Query, for polling the lobby.
lib/server/          Server-only. db.ts is the connection; partidas.ts is
                     partidas at rest and every lobby operation.
prisma/schema.prisma Partida and Asiento. State is the engine's own JSON.
components/tema.tsx  Light / dark / follow the phone.
lib/mano.ts          Arranging your hand: order, sorting, pinned bloques,
                     latched sort. A comfort, never a rule.
app/pruebas/         The page that makes the engine visible.
__tests__/           Tests, including engine/helpers.ts for scripted rondas.
```

Partidas are persisted (Phase 32); the table itself still plays in the
browser, from the state the server dealt. Phase 34 moves the refereeing
server-side.

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

**Online play, reprioritized — and there is no solo mode.** The roadmap's
Milestone 3 is now "Playable together": Phases 30–38 unify the game behind
**one door** — arriving at the app deals you an alias (from
`public/candidatos/alias.txt`, curated like the comodín gallery); the home
screen offers create-a-partida (you host a table that starts with three
bots) or join-by-code; playing alone is just hosting without pruning the
bots. Every human turn gets a host-configured clock (45 s by default, the
ficha's ring draining like a bot's). Where a partida lives is decided by
who is at it: a bots-only table stays in the browser — playable with no
connection at all — while a table with more than one human lives on the
server, both behind one interface (Phase 34); a dropped player returns to
their seat by secret, with a bot covering for them meanwhile (Phase 37). Bot
personalities and the rough edges moved behind all of it. The full argument
and each phase's done-when are in `roadmap.md` under "Online moves to the
front".

**Phase 30 is done: the seat's view.** `lib/engine/vista.ts` — a
`VistaDeAsiento` holds exactly one hand (its own seat's), everyone else as
counts, grupos and bajado status, the stock as a number, and no `rngState`
(whoever holds the stream can predict the stock). Bots decide from a view —
`decidir(vista)` — and `probarEnMesa` lets them try mesa moves against the
real `apply` run over an imagined ronda whose invented parts are never read.
The soak passed untouched: zero refused moves. This view is what the server
sends each player in Phase 34.

**Phase 31 is done: every ronda ends.** The owner chose tablas — two
rebarajadas per ronda, and a stock draw that cannot be served closes the
ronda with nobody winning; everyone scores their hand. The soak now
finishes 1,000/1,000 (12 of the 13 old stalls died to the rule; the 13th
was a bot loop — bajado bots taking "useful" discards with no contract
left to build — and El Codicioso now draws blind once bajado unless the
card ligadoes immediately). The owner also asked for two things recorded
in Phase 37: a deliberate **Abandonar** option, and — already shipped —
the Volver al inicio link on the setup screen.

**Phase 32 is done: identity and persistence.** Every browser is dealt a
secreto and an alias from `public/candidatos/alias.txt` on first visit
(`components/identidad.tsx`), editable in place, greeting seat 0 at the
solo table. Partidas rest in SQLite through Prisma 7 + libSQL
(`lib/server/`), seats are claimed by secreto, and the wrong secreto gets
null, never a hand. **Production needs a Turso database and its env vars
(`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) before the lobby deploys.**

**Phase 33 is done: one door.** The home page is the way in — create a
partida (you host; a short code is dealt; three bots sit down) or join by
code. `/partida/[codigo]` is the lobby and then the table; three route
handlers under `/api/partidas` serve it, and `lib/lobby.ts` holds the wire
types both sides share. The old `/jugar` setup screen was absorbed into the
host's lobby. A bots-only table plays locally from the server's deal, per
the two-homes rule, and reloading the URL already resumes it.

**Phase 34 is done: the partida lives on the server.** `lib/server/juego.ts`
referees with the same `apply()`; `/api/partidas/[codigo]/mesa` reads and
plays. The table now draws from a view rather than a `RondaState`, so
opponents' cards never reach the component. One controller (`useMesa`) is
the whole game on screen, with two transports — local (`usePartida`, which
also keeps the partida in localStorage under its código) and remote
(`useMesaRemota`). Your own move lands before the server answers via
`aplicarEnVista`; only a stock draw waits, because that card is genuinely
unknowable. `/jugar` is retired: the door is the only way in.

**Phase 35 is done — and with it Milestone 3.** Three people and a bot
finish a partida from one code, with every read by every player checked
for cards that are not theirs. The phase found one real leak: the lobby
endpoint, read by everybody, was returning the whole `estado` once dealt.
It now carries the seed and a `repartida` flag; the full state has a
server-only reader.

**Phase 36 is done: the player's clock.** Every human turn runs on the
host's timer (45 s by default), enforced lazily by the same loop that
advances bots — an opponent's poll is what makes a timeout land. An
expired turn draws, throws one card at random (from the ronda's own
stream, so replays repeat it) and passes; the relato says whose time ran
out. The ring — and your own «Tu mano» badge, still until now — drains
from the server's timestamp, so every device shows the same time left.

**Phase 37 is done: absences, and leaving on purpose.** «Salir» used to be
a link to the home page — the server never heard it — so quitting and
losing signal were the same event. Now they are different, and what tells
them apart is only what you pressed: a closed page keeps your chair and
the door offers it back (`/api/asiento`), while Salir frees it for good
after one confirmation. A vacated seat is skipped, never played: no cards,
no turns, no waiting, score frozen, **and no bot inheriting it** — the
owner cut that deliberately.

**Phase 38 is done, and it is a decision rather than a diff.** Two people
played a partida from one code on separate phones and the ritmo held, so
**polling with TanStack Query stays** and no push transport was built. The
options it inherited — first-party WebSockets on Fluid Compute, then Pusher —
stay written down in the roadmap; the transport lives behind one interface
precisely so that waiting costs nothing.

**Found at that same real table, and fixed off the roadmap:** the shared
table was drawn from seat 0 rather than from your own seat. `TU_ASIENTO = 0`
was true while the only human was whoever opened the page, and every "is this
me?" question still asked it — whose alias, whose turn, who won, whose points,
which moves read in second person. Only the hand was right, because the hand
comes from the view. The seat now comes from the controller (`vista.asiento`).
Worth keeping: every browser check had been run as the host, who really is
seat 0, so the bug was invisible from where the checking was done. **A promise
about several people has to be checked from more than one of their seats.**

**Phase 39 is under way — Milestone 4, bots worth playing:** at least three
bots that differ observably, choosable in the lobby wherever the host seats
one. The Phase 30 view is what makes a discard-watching bot honest: what a
seat has seen is an input, not a licence to peek.

**Its groundwork is done: El Codicioso's floor was raised first.** Playing
against it turned up two blind spots that were not character but competence,
and a personality has to be a difference of *strategy*, never of competence —
so they were fixed in the baseline before any second bot exists:

1. **The mesa has two doors.** `moverComodin` — taking the slot a comodín is
   standing in, paid for with the exact card it stands for — was a legal
   engine move no bot had ever played, because every trial the bot ran built
   an `agregar`. Zero uses across the soak before, 1,760 after.
2. **A card is worth what its context makes it worth.** The discard scored by
   progress toward the contrato even when the contrato was already on the
   mesa. Once bajado the measure is now reach on the mesa. Phase 31 patched
   this at the draw and left the discard alone.

Same thousand seeds: still 1,000/1,000 finished, average partida 11 turns
shorter. `lib/bots/codicioso.ts` — `puertasDelGrupo`, `valorDeConservar`,
`alcanceEnMesa`. The next step is the shared evaluation module the roadmap
asks for, and then the personalities as data over it.

**The elenco exists and is measured.** `lib/bots/` is now a family: `bot.ts`
(what a bot is), `evaluar.ts` (the shared vocabulary), `perfil.ts` (the turn,
and the three judgements that are character), `catalogo.ts` (the list the
lobby will read), and one file per personality. Over 1,200 four-seat partidas
with seats rotated and none unfinished:

| | victorias | puntos | turno de bajada |
| --- | --- | --- | --- |
| El Codicioso | 460 | 506 | 26.2 |
| El Paciente | 303 | 565 | **33.4** |
| El Memorioso | 443 | 511 | 26.6 |

El Paciente is a different bot and a worse one, which is the deal it makes.
**El Memorioso plays differently and finishes level** — 764 to 739 head to
head is a coin flip. Counting what is dead changes which card it throws and
nothing about who wins; recorded as measured.

**And the lobby seats them.** `Asiento.bot` stores a bot's id; each bot seat
shows a picker with the three names and their one-line descriptions — readable
by everyone at the table, changeable only by the host. The choice reaches both
homes, the server's loop and the browser's, through `movesDelTurno(estado,
botsPorAsiento)`. `botPorId` never returns null, so a stored id that no longer
exists plays as El Codicioso instead of freezing a seat.

**This needs a column online before it deploys.** `ALTER TABLE Asiento ADD
COLUMN bot TEXT` on Turso — additive and nullable, so the running code is
unaffected by it, but the new code cannot read a column that is not there.

**A defect found while measuring, older than this phase, and left open on
purpose: a table of two can stall.** Four bots never fail to finish a ronda in
600 partidas; three fail once; **two fail 62 times**, and raising the turn cap
from 300 to 1,000 rescues none of them. It is El Codicioso alone, so it
predates the personalities. The cause is the descarte loop: tablas fires when
the stock cannot be served, and two bots trading the face-up card never touch
the stock.

**The owner read it as theoretical and is not worried**, and the reasoning
holds: the loop needs *both* players to keep taking the face-up card, and a
table of two always has a person at it, since a table is created by its host.
The fix, if it is ever wanted, is a rule rather than a bot patch, and is
written up in `roadmap.md` beside the measurement.

**And a road deliberately not taken yet.** Everything Phase 39's bots know is
derivable from `VistaDeAsiento`, so `decidir(vista)` keeps its shape and a bot
behaves the same in both homes. The stronger idea — a running model of what
each opponent holds, fed by the `Relato` log so that "who took what" is an
input rather than a guess — is written up in `roadmap.md` under **"Deferred:
the components of a stronger bot"**, together with the rest of what was named
and postponed. It is postponed, not rejected.

## Open questions, deliberately unanswered

- **The escalera contracts (9+).** All thirteen ranks, A through K. They do not
  fit the `{trios, escalas}` shape and win the ronda outright, so they were
  deferred. Do not design `Contrato` in a way that makes them impossible to add.
- **Guest identity.** There is no login and there will not be one. Players join a
  partida with a code and a nickname, so the system still needs to know which
  seat is whose, survive a reload, and stop someone claiming another player's
  seat and seeing their hand. Likely a per-seat secret in the browser. Settled
  in `tech-stack.md` as part of Phase 32, before any code.
- **Real-time transport.** Polling with TanStack Query is the first
  implementation (Phase 34), behind an interface so it can be swapped. The old
  premise that Vercel functions cannot hold WebSockets has expired — Fluid
  Compute supports them — so Phase 38's options are keep-polling, first-party
  WebSockets, then Pusher. Decide there, not before.
- **A ronda nobody can win.** Carioca has no stalemate rule, and the soak
  measures the consequence: ~1.3% of bot partidas never end. Harmless in a test,
  a hung game online. Options are written up in `carioca-rules.md`; deciding it
  is now its own phase — Phase 31, before anything goes online.

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
