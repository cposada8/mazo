# Carioca — Rules

Status: **in progress.** This document is built up one settled question at a
time. Phase 0 of the roadmap is complete only when nothing here is marked
pending.

Nothing marked *pending* may be implemented.

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
| **trío** | Three or more cards of the same rango. | `trio` |
| **escala** | Four or more consecutive cards of the same suit. | `escala` |
| **escalera** | All thirteen ranks, A through K. | `escalera` |
| **comodín** | Joker. | `comodin` |
| **bajarse** | To lay down the contract for the ronda. | `layDown` |

"Mano" is reserved for the cards in a player's hand. The unit of play is always
a **ronda**.

### Partida setup

Some choices are made **once, before the first deal**, and hold for the whole
partida. They are never changed mid-game, and never per ronda.

```ts
type PartidaConfig = {
  contratos: Contrato[]   // which contracts are enabled, in order
  comodines: boolean      // play with jokers or without
}
```

Settled so far:

| Setting | Options | Default |
| --- | --- | --- |
| Enabled contracts | Any non-empty subset of the catalog, in standard order | to confirm |
| Jokers | On / off | On |

Every table in this document describes the game **as configured**. Rules that
mention comodines simply do not apply when they are switched off.

### Contracts are data, not code

A game is a **list of contracts**, played in order. The engine receives that list
and plays it; it has no built-in notion of "hand 3" or "six hands".

A contract is a requirement to lay down a combination, expressed as a count of
groups:

```ts
type Contract = {
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

1. **Draw** one card — the hand goes to 13.
2. **Discard** one card — the hand returns to 12.

Whatever else happens in a turn (laying down, adding to melds) happens between
those two steps.

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

### Everything else


- Where a card may be drawn from: stock only, or also the discard pile.
- Which contracts are enabled by default.
- Jokers: point value, how many per meld, whether a laid joker can be swapped.
- Laying down: adding to opponents' melds, drawing from the discard pile.
- Scoring: card values, and whether going out earns a bonus.
- Win condition.
