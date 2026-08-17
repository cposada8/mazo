# Mission

## What Mazo is

**Mazo** is a web platform for playing Latin American card games. The first — and
for now only — game is **Carioca**, a Chilean rummy variant played over a fixed
sequence of contracts.

It runs in the browser and is fully playable on a phone, so a game can start from
a shared link with no install step.

## Why it exists

Three goals, in priority order:

1. **Play Carioca.** The owner enjoys the game and rarely has people around to
   play it with. Mazo should make a game possible at any time — against bots when
   nobody is available, against friends when they are.
2. **Practice.** A deliberate exercise in building a real application: domain
   modeling, game state machines, AI opponents, real-time multiplayer, and
   deployment.
3. **Portfolio.** Public repository, deployed and playable from a link. A
   recruiter should be able to click once and play a hand.

## Who it is for

- **The owner**, playing solo against bots.
- **Friends and family** who already know Carioca, joining a room from their own
  phone with a code — no account required to be a guest.
- **Curious visitors** who have never played, who should be able to learn by
  playing a bot game with in-context hints.

## What success looks like

A milestone is only real when it is playable, not when it compiles.

- **M1 — Engine is right.** A full six-hand Carioca game can be played end to end
  in tests, with correct melds, jokers, and scoring. No UI.
- **M2 — Playable solo.** A person can open the deployed site on a phone, play a
  complete game against bots, and see a final score.
- **M3 — Bots feel like opponents.** At least three distinguishable bots that
  differ in observable behavior, not just in a difficulty number.
- **M4 — Playable together.** Three people in three different places finish a
  game from one invite code, each seeing only their own hand.

## Principles

1. **The engine is pure.** Game rules live in framework-free TypeScript with no
   React, no database, and no network. Bots, the local UI, and the online server
   are all clients of the same engine. This is the single most important
   constraint in the project.
2. **Deterministic by construction.** Shuffling takes an explicit seed. Any game
   can be replayed exactly from its seed and its move list, which makes bugs
   reproducible and enables replays later.
3. **The server is the referee.** In online play the client never decides what is
   legal and never learns another player's hand. Hidden information stays hidden
   server-side.
4. **Mobile first.** The primary device is a phone held in one hand. Desktop is
   the adaptation, not the baseline.
5. **Small, shippable phases.** Every phase in the roadmap ends with something
   demonstrable. Nothing is built two phases ahead of when it is needed.
6. **Rules before code.** Carioca has regional variants. The exact rules are
   written down and agreed before the engine implements them.

## Explicit non-goals

- No real-money play, betting, or wagering of any kind.
- No native iOS/Android apps. The web app is the product; a PWA install is the
  most that is considered.
- No spectator mode, tournaments, ELO ladders, or chat in the first version.
- No second game until Carioca is complete. The architecture stays
  multi-game-ready; the scope does not.

## Open questions

**Resolved.** The rules were settled in Phase 0 and live in
[`carioca-rules.md`](./carioca-rules.md), which is the authority on how the game
works. One item is deferred on purpose: the *escalera* contracts (9 and beyond).

Three of those answers turned out to shape the whole design, and are worth
knowing before reading any code:

- **Contracts are configuration.** Players choose which contracts to play, so the
  engine takes a list rather than knowing a fixed sequence.
- **The player groups, the engine validates.** Six sevens can be one trío or two,
  and that choice belongs to the player. The engine never re-groups a hand.
- **The mesa is contested.** Any player who has bajado can extend anyone's grupos
  and reposition their comodines, so table state is shared, not owned.
