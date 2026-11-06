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
  that opens. 52 does not divide by 3, 5 or 6, so some seats start with one
  card more — the opener always among them; that is the game, not a flaw.
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

### When the chance closes: the next play

A play is open to a call **until the next play lands** — the owner,
2026-11-05, the way it is played around a real table and in Plato. The
player in turn decides: call, or play their own cards, and the moment those
land the play before is safe forever. Everyone else may call until then.
There is no pause of its own length: how long a play stays open is however
long the next player takes — a bot's thinking time, or a person's clock.

**A last card is not played over.** If the open play emptied its player's
hand, the player in turn cannot simply play — that would let them out with
nobody deciding. They call it, or accept it («Le creo»); their clock, run
out, accepts it.

If two players call at once, **the first call the server receives** is the
one that counts; the others are simply too late. **(Mazo's call)**

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

## The bullets — the owner's table, 2026-11-05

Not in the classic game; played the way Plato plays it, and **always on** at
Mazo:

- Every player starts with **bullets** — **3** by default; the host picks
  **1 to 5** in the lobby.
- **Calling costs a bullet.** If the call finds a lie, the bullet comes back.
  If the play was true, the bullet is spent — on top of taking the pile.
- **A player with no bullets cannot call.** They can still play, and a play
  that emptied a hand they can only accept («Le creo»).
- Bullets are public: everybody sees everybody's.

## Going out

A player **goes out** when their hand is empty and their last play
**survives**: the next player accepts it, or a call finds it true. If a
call finds it a lie, they take the pile and play on.

Going out with a true last play that was called gives the pile to the caller,
as any truthful call does.

## Winning and the partida

- The **first player to go out wins** the partida. One mano, one winner —
  there is no score to carry and no second place.
- A partida is short (a few minutes), so «otra» deals a new one at the same
  table, the way Carioca's lobby does after a final score.

## Leaving, and the clock **(Mazo's call)**

Found missing while building play among several people (Phase 80), and
settled the way Carioca settles it:

- **Leaving on purpose** takes a seat out of the partida. Its cards leave
  play — nobody inherits them — the turn order skips it from then on, and it
  can neither play nor call. If its own play is in the window when it
  leaves, the window closes on the spot and the play stands; leaving is
  never a way to go out, so it wins nothing.
- **When fewer than two seats are left**, or no person is, the partida ends
  with no winner.
- **The player's clock**: a person in turn who does not play within the
  table's time per play has one card played for them — a random one, from
  the seed — announced as the rank in turn, like anybody's. A person is
  never forced to call.

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
