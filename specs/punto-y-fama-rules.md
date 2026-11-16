# Punto y Fama — rules

The fourth game on Mazo: guessing a secret number, played as a race, as a
duel, or against a bot that guesses yours. This is the authority on how
Mazo plays it, written before any code, the way the other three games'
rules were.

Written 2026-11-16 from the owner's brief: a number of n digits, n chosen
by the player, no digit repeated; three ways to play — a list of k numbers
everyone guesses in the same order (first to finish wins, the rest keep
going and take their places), the most numbers in x minutes, and one
against one, each setting the other a number (fewest tries wins, and the
other gets to finish); and a bot that guesses *your* number while you tell
it its puntos and famas. The game itself follows the owner's own
`punto-y-fama` repository (sibling of this one). Everything else is the
game's common form, written down for the owner to correct. Rules marked
**(Mazo's call)** are not the game's but ours.

## The game in one paragraph

Somebody holds a **secret number** of n digits, none repeated. You guess
numbers of the same shape. Each guess is answered with **famas** — digits
in the number *and in the right place* — and **puntos** — digits in the
number *but in another place*. Five famas on five digits is the number. The
fewer tries, the better.

## The numbers

- **n digits, 3 to 6** (Mazo's call, as the owner's app offers; 7 and 8 are
  possible later). The host picks n in the lobby; every number of a game
  has the same n.
- **The ten digits 0–9, none repeated.** **0 may come first** — 0123 is a
  number of four digits — as in the owner's app.
- **A guess** must be a number of the same shape: n digits, none repeated.
  Anything else is refused at no cost.

## Scoring a guess

For the secret 1234 and the guess 1325: the 1 is a **fama** (right digit,
right place); the 3 and the 2 are **puntos** (in the number, elsewhere);
the 5 is nothing. Answer: 1 fama, 2 puntos. With no repeated digits in
either, every digit is at most one of the two.

There is **no limit of tries** for a number (the game's own form): you keep
guessing until you get it.

## Three ways to play

### 1. Números límite — a race

The host picks **k numbers** (Mazo's call: 3, 5, 10 as shortcuts, or 1–50
typed). The server draws them from the seed; **everybody guesses the same
numbers, in the same order**, each at their own pace. **Whoever gets all k
first wins**; the rest keep playing — the race does not close on them
(the owner) — and take their places as they arrive. Ties (rare) go to
fewer tries.

### 2. Tiempo límite — the most numbers in x minutes

As in Palabras: the host picks **x minutes**; the same list in the same
order for everyone; **whoever gets the most numbers before the time is up
wins**, ties going to whoever got their last one first, then to fewer
tries. Every board stops at once on the server's clock.

### 3. Duelo — one against one

**Exactly two players.** Each one **sets a number for the other** — typed
in secret, checked for shape, held by the server, never shown to the other
until the end. Once both are set, both guess **at the same time**, each at
their own pace, the server scoring every guess. **Whoever gets the other's
number in fewer tries wins.** Whoever finishes first waits — the other
**gets to finish** (the owner) — and only then is the winner known.

- **A tie in tries** (Mazo's call): whoever got it first, in time. Played
  out properly it is rare; a true tie is called a draw.
- At the end, **both numbers are shown**, with both lists of guesses.

## Contra el bot — the bot guesses yours

A game for one: **you think of a number** (it never goes into the app), and
**the bot guesses it**. For each of its guesses you answer how many puntos
and famas it got; it narrows down the numbers that would have answered the
same and guesses again, until it has five famas on five digits (or n on n).

- **The bot** is the owner's solver from `punto-y-fama`: keep every number
  that would have given exactly the answers so far; first guess at random;
  after that, for each place, the digit most common among the numbers left.
  With 4 digits it gets any number in 5.5 tries on average, 8 at most.
- **«Deshacer»** takes the last answer back, for a slip of the finger.
- **Answers that contradict each other** — no number fits them all — are
  said plainly, so you can check your number and undo the wrong one.
- It plays in the phone alone: there is nothing secret to keep from anyone.

## What you see of the others (the races)

As in Palabras: of each rival, **which number they are on and their
tries' answers** (puntos and famas), never their guesses' digits until you
have finished; then everything, in the finish table (Palabras' Phase 92):
players as columns by standing, numbers as rows, each opening to
everyone's guesses. And everyone's **total of tries**, always.

## Joining

By code, like every partida. A race takes latecomers while it runs, on the
same clock. A duel is full at two.

## Fairness

The server holds every secret — the race's numbers and the duel's two —
and scores every guess. A phone only ever receives its own answers, and a
number once its player has got it.
