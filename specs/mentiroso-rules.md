# Mentiroso — rules

The second game on Mazo: a traditional shedding game, known elsewhere as
*Cheat*, *I Doubt It* or *Bullshit*. This is the authority on how Mazo plays
it, written before any code, the way `carioca-rules.md` was for Carioca.

Written 2026-11-05. The owner settled the sequence, the play size and who
may call; everything else is the game's common form, written down for the
owner to correct. Rules marked **(Mazo's call)** are not the game's but
ours, forced by playing it online; they are the first place to look if
something feels wrong at the table.

## The game in one paragraph

The whole deck is dealt. On your turn you put cards **face down** on the
pile and **announce** what they are. You may lie. Anyone may call
**«¡Mentiroso!»**: the cards are turned over, and whoever was wrong — the
liar, or the one who doubted the truth — takes the whole pile. The first
player with no cards left wins.

## Players and the deck

- **3 to 6 players.** With two, each knows exactly what the other holds
  after a few turns, and lying stops being a game.
- **One 52-card deck, no comodines.** A comodín would be a card that is
  never a lie, which removes the doubt the game is made of.
- **The whole deck is dealt**, one card at a time, starting with the seat
  after the dealer. 52 does not divide by 3, 5 or 6, so some seats start
  with one card more; that is the game, not a flaw.
- **Who starts** is drawn from the partida's seed, like Carioca's first
  opener — reproducible, never chosen.

## The turn

### The rank that must be played: a fixed sequence

The announced rank follows **A, 2, 3 … 10, J, Q, K**, then back to **A**,
round after round. The first play of the game announces aces; each play
after it announces the next rank, whoever makes it. Nobody chooses the
rank — only how many cards, and whether they are really that rank.

The sequence **carries on after a call**: a call changes who holds the pile,
never which rank comes next.

### How many cards a play holds: 1 to 4

A play puts down **at least one card and at most four** — four being how
many of each rank a single deck has. The number is public: everybody sees
how many cards went onto the pile, so «tres reinas» is a claim about what
they are, never about how many.

### No passing

A player in turn **must play**. There is always a legal play — any one card,
announced as the rank in turn — so passing would only be a way to never
lie, and the game is about having to.

### Turn order

Play goes around the table in one direction, every seat in turn. A call
does not change it: after a call, the turn passes to whoever was next after
the player who made the play that was called.

## «¡Mentiroso!»

### Who may call: anyone

**Any other player** may call on the play just made — not the player who
made it. Only the **last** play can be called; once the next play is on the
pile, the one before it is safe forever.

### When the chance closes **(Mazo's call)**

Around a real table the call is a shout before the next player's cards land.
Online, a fast next player — or a bot — would make calling impossible. So
after every play there is a **window to call**: a few seconds (3 by
default, a lobby setting like the turn clock) in which the next player
cannot play yet and anyone may call. When it closes without a call, the
play stands and the next turn starts.

If two players call at once, **the first call the server receives** is the
one that counts; the others are simply too late.

### What a call turns over

Only the cards of **the play that was called** are turned face up — not the
pile beneath them. The play is a lie if **any** of its cards is not the
announced rank.

- **A lie:** the player who made it takes the whole pile into their hand.
- **The truth:** the player who called takes the whole pile.

Either way the pile is now empty, the turned cards go into a hand with the
rest of it, and play continues as above.

What the turned cards were is **public**: everybody saw them. Everything
else in the pile stays secret, including to the player who takes it — they
see their own new hand, nobody else's.

## Going out

A player **goes out** when their hand is empty and their last play
**survives**: the window closes with no call, or a call finds it true. If a
call finds it a lie, they take the pile and play on.

Going out with a true last play that was called gives the pile to the caller,
as any truthful call does.

## Winning and the partida

- The **first player to go out wins** the partida. One mano, one winner —
  there is no score to carry and no second place.
- A partida is short (a few minutes), so «otra» deals a new one at the same
  table, the way Carioca's lobby does after a final score.

## What everybody sees

Public: how many cards every seat holds, how many are in the pile, every
play's size and announced rank, every call and what it turned over, and the
rank in turn. Secret: every hand but your own, and every card in the pile
that has not been turned.

As with Carioca, the server is the referee and never sends a seat anything
it may not see.

## Open

Nothing is open. A rule found missing while building it is written here
first, then coded.
