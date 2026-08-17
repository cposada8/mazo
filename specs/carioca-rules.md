# Carioca — Rules

Status: **complete for contracts 1–8.** Everything needed to implement the first
version of the engine is settled below.

The escalera contracts (9 and beyond) are the one open item, and they are
deferred on purpose — see *Pending*. Nothing marked *pending* may be implemented.

---

## Settled

### Vocabulary

Fixed terms, used identically in this document, in conversation, and in code.
Domain nouns stay in Spanish where English would lose a distinction — `escala`
and `escalera` are different things and both translate to "run".

| Term | Meaning | In code |
| --- | --- | --- |
| **Partida** | A full session: the ordered sequence of rondas through to the final score. | `Game` |
| **Ronda** | One deal, from dealing until a player goes out. | `Ronda` |
| **Contrato** | What must be laid down in a given ronda. | `Contrato` |
| **mano** | The cards a player holds. Never used for a ronda. | `hand` |
| **rango** | A card's rank: A, 2…10, J, Q, K. Never called *valor* — that is reserved for points. | `rank` |
| **grupo** | A trío or an escala **on the table**. By definition a grupo has been laid down. | `Grupo` |
| **propuesta** | A combination assembled in hand, not yet laid down. Becomes a grupo when accepted. | `Propuesta` |
| **la mesa** | Every grupo laid down by every player. | `mesa` |
| **trío** | Three or more cards of the same rango. | `trio` |
| **escala** | Four or more consecutive cards of the same suit. | `escala` |
| **escalera** | All thirteen ranks, A through K. | `escalera` |
| **comodín** | Joker. | `comodin` |
| **bajarse** | To lay down the contract for the ronda. | `layDown` |
| **mazo** | The face-down draw pile. Called `stock` in code to avoid colliding with the app's name. | `stock` |
| **descarte** | The face-up discard pile. Only its top card is ever in play. | `discard` |

"Mano" is reserved for the cards in a player's hand. The unit of play is always
a **ronda**.

### Partida setup

Some choices are made **once, before the first deal**, and hold for the whole
partida. They are never changed mid-game, and never per ronda.

```ts
type PartidaConfig = {
  contratos: Contrato[]      // which contracts are enabled, in order
  comodines: boolean         // play with jokers or without
  bonusGanadorRonda: number  // points subtracted from the ronda winner; 0 = none
}
```

Settled so far:

| Setting | Options | Default |
| --- | --- | --- |
| Enabled contracts | Each contract toggled independently, always in standard order | 1–7 on, rest off |
| Jokers | On / off | On |
| Ronda-winner bonus | Any number ≥ 0, suggested 0 / 10 / 25 / 50 | 0 |

The bonus is **one number, not a switch plus a number**: `0` means the winner
simply scores nothing, any other value is subtracted from their total. Two fields
could contradict each other; one cannot.

Every table in this document describes the game **as configured**. Rules that
mention comodines simply do not apply when they are switched off.

### Contracts are data, not code

A game is a **list of contracts**, played in order. The engine receives that list
and plays it; it has no built-in notion of "hand 3" or "six hands".

A contract is a requirement to lay down a combination, expressed as a count of
groups:

```ts
type Contrato = {
  id: string
  trios: number
  escalas: number
}
```

Players **choose which contracts to play** before a game starts: toggle any
subset on or off, in the standard order. A short game might be the first four
contracts; a group that dislikes runs might play only the trio contracts; a long
game plays everything.

Consequences of this decision:

- Adding a new contract is adding a row to a catalog, not a change to the engine.
- Game "modes" (quick, standard, full) are just saved presets over the same list.
- The 13-card ladder contracts can be added later without touching game logic,
  provided they fit the same shape — see *pending* below, because they may not.

**Constraint:** at least one contract must be enabled.

#### How the choice is presented

Not as presets or difficulty levels. The player sees **the full catalog as a
list, one row per contract, each individually switchable on or off** — a checkbox
is the obvious control, but the concept is what matters: every contract is
independently toggleable, and the list is always shown in full.

Defaults: **contracts 1–7 on, everything below them off.** Contract 8 and the
escalera contracts exist in the list, unchecked, so a player can add them
deliberately.

### The standard catalog

The canonical order, as played by the owner:

| # | Contract | Composition |
| --- | --- | --- |
| 1 | Dos tríos | 2 trios |
| 2 | Un trío y una escala | 1 trio + 1 run |
| 3 | Dos escalas | 2 runs |
| 4 | Tres tríos | 3 trios |
| 5 | Dos tríos y una escala | 2 trios + 1 run |
| 6 | Dos escalas y un trío | 2 runs + 1 trio |
| 7 | Tres escalas | 3 runs |
| 8 | Cuatro tríos | 4 trios |
| 9+ | Escalera contracts | pending — see below |

Contract 8 is the last one expressible as a plain trio/escala count under the
current rules. Everything past it is a different shape.

### What an escala is

An **escala** is **four or more consecutive cards of the same suit**. Four is the
minimum, not the fixed size — a five- or six-card escala is a single valid
escala, not two.

Ranks are **cyclic**: the sequence wraps around from K to A to 2. The ace is
therefore both the low and the high end, and needs no special case. All of these
are valid:

- `A♠ 2♠ 3♠ 4♠`
- `J♥ Q♥ K♥ A♥`
- `K♦ A♦ 2♦ 3♦` — wrapping around

Consequence for the engine: rank order is a ring of 13 positions, not a line.
Consecutiveness is checked modulo 13. An escala can therefore never exceed 13
cards, and a 13-card one is an escalera.

### What a trío is

A **trío** is **three or more cards of the same rango**. Suit is irrelevant.
Three is the minimum, not the fixed size: `7 7 7`, `7 7 7 7` and `7 7 7 7 7` are
each a single valid trío.

### Comodines

A comodín substitutes for any card. How many are allowed in one grupo depends on
**when** the grupo is being formed.

#### At lay-down: one per grupo

When bajándose, a grupo may contain **at most one comodín**.

| Grupo | Valid at lay-down |
| --- | --- |
| `7 7 comodín` | yes — counts as a trío |
| `7 comodín comodín` | no — two comodines |
| `comodín 4♠ 5♠ 6♠` | yes |

#### After lay-down: more, but never adjacent in an escala

Once a grupo is on the table, further comodines may be added to it, subject to
one restriction:

> An escala may never contain **two consecutive comodines**.

| Escala | Valid after lay-down |
| --- | --- |
| `comodín 3♥ 4♥ 5♥ comodín 7♥` | yes — the comodines stand for 2♥ and 6♥, not adjacent |
| `2♥ 3♥ 4♥ comodín comodín 7♥` | no — the comodines stand for 5♥ and 6♥, adjacent |

The adjacency rule applies **only to escalas**, since only an escala has an
order. A **trío has no limit**: `7 7 comodín comodín comodín` is valid once the
grupo is on the table.

Note the invariant this preserves: because lay-down allows only one comodín, a
trío always keeps at least two real cards of its rango, however many comodines
are piled on later.

#### A comodín belongs to its grupo forever

Once a comodín is part of a grupo on the mesa, it **can never move to another
grupo**. It can only be repositioned *within* the grupo it lives in.

Repositioning is not free: to move a comodín, a player must **supply the card it
was standing for**. The comodín is not taken into anyone's hand — it stays on the
table and is reassigned to a different position in the same grupo.

Any player **who has already bajado** may do this on their turn, on any grupo,
including grupos they did not lay down.

Worked example. The mesa holds the escala `2♦ comodín(3♦) 4♦ 5♦`. The player in
turn holds `3♦` and `7♦`:

1. Play the `3♦` into the position the comodín was filling.
2. The freed comodín stays in this grupo and is reassigned to `6♦`.
3. Play the `7♦`.

Result: `2♦ 3♦ 4♦ 5♦ comodín(6♦) 7♦` — a six-card escala. The player unloaded two
cards on someone else's grupo, and the comodín never left it.

This is why comodines are bound to a concrete card: without that binding there is
nothing to "supply" and nothing to reposition.

#### What this forces on the engine

Two design consequences, both load-bearing:

1. **Validation is phase-dependent.** `7 7 comodín comodín` is illegal while
   laying down and may be legal afterwards. A grupo validator cannot be a pure
   function of the cards; it takes the phase as an argument.
2. **Each comodín must know what it represents.** Adjacency is only decidable if
   every comodín in an escala is bound to a concrete rango and suit. A comodín on
   the table is not a wildcard floating in a set — it occupies a specific
   position.

Point 2 also determines what "adding a comodín to an escala" means as a move: the
player is not dropping a joker onto a pile, they are naming the card it stands
for. The UI has to ask for that, or infer it and let the player confirm.

### Touching the mesa

One rule governs every interaction with cards already on the table:

> **A player who has not bajado cannot touch the mesa.** Not to add a card, not
> to reposition a comodín, not at all.

Having bajado, what a player may do depends on whose grupo it is:

| Target | When |
| --- | --- |
| **Their own** grupos | Immediately, including the same turn they bajaron |
| **Another player's** grupos | Only from the **next** turn onward |

So a player who lays down `7 7 7` and `Q Q Q` with a fourth `7` left over can
attach it to their own trío in that same turn — but has to wait a turn before
unloading anything onto an opponent.

### The deck

Two standard 52-card decks, each contributing its two jokers:

| | Count |
| --- | --- |
| Standard cards | 104 (2 × 52) |
| Comodines | 4 (2 × 2) |
| **Total, jokers on** | **108** |
| **Total, jokers off** | **104** |

The composition is **fixed** — it does not scale with the number of players.

Because there are two of every card, a card's identity is not unique: two `7♠`
exist and are interchangeable. The engine must give each physical card its own
instance id, so that "the seven of spades" is never assumed to mean one card.

### The deal and the turn

Each player is dealt **12 cards**, in every ronda. The number never changes with
the contract.

A partida takes **2 to 6 players**. Six is the ceiling because of what is left in
the stock after dealing, with jokers on:

| Players | Dealt | Stock remaining |
| --- | --- | --- |
| 2 | 24 | 84 |
| 3 | 36 | 72 |
| 4 | 48 | 60 |
| 5 | 60 | 48 |
| 6 | 72 | 36 |

With jokers off, subtract 4 from every stock figure. Two players is assumed
playable and is what makes solo-against-one-bot possible; revisit if it turns out
to be a poor game.

A turn is always the same two steps:

1. **Draw** one card — the hand goes to 13. The player chooses freely between
   the top of the **stock** (face down, unknown) and the top of the **descarte**
   (face up — the previous player's discard, visible to everyone before the
   choice is made). There is no condition attached to taking the discard.
2. **Discard** one card — the hand returns to 12.

Whatever else happens in a turn (laying down, adding to melds) happens between
those two steps.

Only the **top** card of the descarte is available. The pile underneath is out of
play.

A player **may discard the same card they just took** from the descarte. Many
rummy variants forbid this because it lets a turn pass at no cost; Carioca as
played here does not, and the permission is deliberate rather than an oversight.

#### When the stock runs out

If the stock empties while the ronda is still going, the descarte is **shuffled
back into a new stock** and play continues. The current top card stays face up as
the descarte, so the pile is never empty and the next player always has the same
two choices.

The ronda ends only when someone goes out — never because cards ran out.

This has a consequence for determinism: a ronda may need to shuffle more than
once, so the engine carries a seeded random **stream**, not a single shuffle.
Replaying a seed has to reproduce every reshuffle, not just the deal.

#### Starting a ronda

After dealing, one card is turned face up from the stock to start the descarte.

**Who plays first rotates.** Seat 0 opens the first ronda, seat 1 the second, and
so on around the table. This was not stated in the rules as given; it is
implemented because the alternative — the same seat always opening — hands that
seat a standing advantage across a whole partida, which no card game intends.
Flagged here rather than buried in the code, and easy to change: `startRonda`
takes the opening seat as an argument.

This means the first turn is **not a special case**: the first player faces the
same choice as everyone else — take the face-up card, or draw from the stock.
Turning the card is an initialization step, not a rule the turn logic has to know
about.

#### Why 12 matters

The hand size caps what a contract can require. Counting minimum sizes — trío 3,
escala 4 — against the 13 cards held mid-turn:

| Contract | Minimum cards | Left to discard |
| --- | --- | --- |
| 1 — dos tríos | 6 | 7 |
| 2 — trío + escala | 7 | 6 |
| 3 — dos escalas | 8 | 5 |
| 4 — tres tríos | 9 | 4 |
| 5 — dos tríos + escala | 10 | 3 |
| 6 — dos escalas + trío | 11 | 2 |
| 7 — tres escalas | 12 | 1 |
| 8 — cuatro tríos | 12 | 1 |

So contracts 7 and 8 consume the entire hand: laying them down leaves exactly one
card, which is the discard — **bajarse and going out are the same move** in those
rondas. And an escalera needs all 13, which is why the escalera contracts cannot
follow the normal draw-lay-discard flow at all.

### Scoring

When a ronda ends, every player counts the cards **left in their hand**. Cards on
the mesa do not count. Points are penalties: low is good.

| Card | Points |
| --- | --- |
| 2–10 | Face value |
| J, Q, K | 10 |
| A | 20 |
| Comodín | 50 |

The comodín is worth more than twice any real card, which makes holding one at
the end of a ronda the single most expensive mistake available.

#### The player who goes out

By default the player who goes out scores **0** for that ronda.

Optionally — `bonusGanadorRonda` in the partida config — they instead score
**minus X**, rewarding closing the ronda over merely dumping cards. There is no
canonical value for X in the game itself; the suggested scale is derived from the
game's own numbers:

| X | Reasoning |
| --- | --- |
| **10** — suggested default | The value of a face card. A player who nearly went out typically holds 10–20 points, so −10 roughly doubles the reward for closing without making it the only viable strategy. |
| 25 | About one bad hand. Chasing the close becomes almost always correct. |
| 50 | The value of a comodín. Over seven rondas that is a 350-point swing — it would decide partidas on its own. |

#### Winning the partida

Scores accumulate across every ronda played. When the last enabled contract is
finished, **the lowest cumulative total wins**. There is no elimination and no
score ceiling that ends a partida early.

A tie is a **shared win**: everyone on the lowest total wins, with no tie-breaker
and no play-off ronda. The engine therefore reports the result as a *list* of
winners, never a single player.

#### Worked example

Three players, contract 1 (*dos tríos*), `bonusGanadorRonda: 0`. Ana goes out; the
others count what is left in hand:

| Player | Cards held | Points |
| --- | --- | --- |
| Ana | — (went out) | **0** |
| Beto | `K♠` `9♥` `comodín` | 10 + 9 + 50 = **69** |
| Caro | `A♦` `4♣` `4♠` `J♥` | 20 + 4 + 4 + 10 = **38** |

With `bonusGanadorRonda: 10`, Ana would score **−10** instead of 0 and the other
two would be unchanged. Totals carry into the next ronda; after all seven, the
lowest total wins.

### The player groups, the engine validates

With six sevens in hand, `7 7 7 7 7 7` may be laid down as **one** trío of six or
as **two** trios of three. Both are legal, and **the player chooses** — the
difference matters, because under the *dos tríos* contract the two-trio grouping
satisfies the contract on its own.

This fixes a core engine rule:

> The engine never infers how a hand should be grouped. The player submits a
> proposed grouping and the engine accepts or rejects it.

Auto-grouping would silently take a real decision away from the player. Any
"suggested grouping" is a UI hint the player can override, never an engine
behavior.

Consequence for bots: a bot must **search** groupings rather than read one off
the hand, since the same cards can satisfy different contracts depending on how
they are cut.

---

## Pending

### The escalera contracts (9 and beyond)

From contract 9 onward the requirement is a complete **escalera**: all thirteen
ranks, A through K. Variants exist — *escalera sucia* (mixed suits) and cleaner
versions. Laying one down uses every card, so it wins the ronda outright and
likely bypasses the normal lay-down-then-discard flow. It does not fit the
`{trios, escalas}` shape.

**Deliberately deferred.** Excluded from the first implementation. The `Contrato`
type must not be designed in a way that makes escaleras impossible to add later,
but no attempt is made to model them yet.

Everything else is settled. Any rule discovered to be missing during
implementation is written here first, then coded.
