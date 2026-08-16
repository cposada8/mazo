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

Carioca is played with regional and family variations. These must be settled in
Phase 0 before the engine is written:

- **Contract sequence.** How many hands, and which combination of trios and runs
  in each. The commonly cited Chilean sequence is six hands, but the exact list
  is not assumed here.
- **Run length and wrap-around.** How many cards make an *escala*, and whether the
  ace may act as both low and high.
- **Deck composition.** Number of decks and jokers relative to player count.
- **Jokers.** Point value, whether a meld may hold more than one, and whether a
  laid-down joker can be swapped out by the card it represents.
- **Laying down.** Whether a player may add to opponents' melds, and whether the
  discard pile may be drawn from freely or only under conditions.
- **Scoring.** Point value of aces and face cards, and whether going out awards a
  bonus.
- **Win condition.** Lowest cumulative score after the final hand, assumed but to
  be confirmed.
