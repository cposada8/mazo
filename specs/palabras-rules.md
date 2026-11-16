# Palabras — rules

The third game on Mazo, and the first without cards: the five-letter word
puzzle known as *Wordle*, in Spanish, played **as a race**. Everyone gets
the same words in the same order; the first to get through them wins. This
is the authority on how Mazo plays it, written before any code, the way
`carioca-rules.md` and `mentiroso-rules.md` were.

Written 2026-11-15 from the owner's brief: a race, the number of words
chosen when the partida is created, the words drawn at random from a long
list (around a thousand), the same list and order for every player, the
first to finish wins, others may join. Everything else is the puzzle's
common form, written down for the owner to correct. Rules marked
**(Mazo's call)** are not the puzzle's but ours, forced by racing it; they
are the first place to look if something feels wrong.

*Palabras* is a working name. The game is not called Wordle on Mazo — that
name belongs to someone else.

## The game in one paragraph

The partida draws **n secret words** of five letters. Each player solves
them **one after another, in the same order**, on their own board: six
tries per word, each try a real word, and after each try every letter turns
**green** (right letter, right place), **yellow** (in the word, elsewhere)
or **grey** (not in the word). A word guessed — or its six tries spent —
opens the next one. Whoever finishes the bag first, by the ranking below,
wins.

## Players

- **1 or more**, up to the lobby's limit (Mazo's call: **8**). One player
  is a timed solo run; the race needs two.
- **No bots** at first. A bot that solves Wordle is easy to write and no fun
  to lose to; one with a level (slower, fewer tries) is in *After*.

## The words

- **5, 6, 7 or 8 letters, Spanish** — the host chooses the length in the
  lobby (the owner, 2026-11-15), five by default; every word of a race has
  the same length. The alphabet is the 27 letters of the Spanish keyboard:
  A–Z and **Ñ**. Ñ is its own letter, never N.
- **Tildes are ignored** in play: ÁRBOL is typed and scored as ARBOL; Ü is
  U. The word is shown with its tildes when it is revealed.
- **Two lists (Mazo's call)**, as the puzzle has always had:
  - **The answers** — at least **1,000** common words per length: nouns, adjectives, verbs
    in the infinitive or in common forms, nothing obscure, nothing
    offensive, no proper nouns. Only these are ever drawn.
  - **The accepted guesses** — a much longer list of real Spanish five-letter
    words (plurals and conjugations included). A try must be in it; a try
    that is not shakes and costs nothing.
- **The bag** is n answers drawn **without repetition** from the partida's
  seed, so the same seed always draws the same words in the same order.
- **n is chosen at creation** (Mazo's call: **3, 5, 10, 15 or 20**,
  10 by default), and cannot change once the race starts.

## Scoring a try

The puzzle's standard rule, including repeated letters:

1. Every letter in its right place is **green**.
2. Then, left to right, a letter that is in the word is **yellow** only
   while the word still has an unmatched copy of it; otherwise **grey**.

So with the answer PERRO, the try ERROR scores E yellow, R yellow, R green,
O yellow, R **grey** — PERRO has two R's, both already coloured, so the
third is grey. Never more coloured copies of a letter than the word holds.

The keyboard keeps, per letter, the best colour it has earned *on the
current word*, and is cleared when the word changes.

## The race

- **Everyone starts together.** The host starts the race from the lobby; a
  short count (3, 2, 1) on every screen, then the first word opens for all
  at the same instant. The clock is the server's.
- **A word ends** when it is guessed or its sixth try is wrong. A missed
  word is **revealed**, and the player moves on — the race never stalls on
  one word.
- **Missing a word costs time (Mazo's call): +2 minutes** on that player's
  clock. Without a cost, giving up six quick tries would be the fastest way
  through the bag.
- **Finishing** is ending the last word. The player's **time** is the moment
  they finished, measured from the start, plus their penalties.
- **The ranking**, once everyone has finished or the race is closed: the
  lowest time wins. Ties (rare) go to fewer total tries.
- **Closing the race.** The race closes when every player has finished, or
  when the host closes it, or **30 minutes** after the first player
  finished (Mazo's call), whichever comes first. A player who has not
  finished is ranked after everyone who did, by words solved.

## Two ways to race (the owner, 2026-11-15)

The host picks one in the lobby.

- **Palabras límite** — everything in «The race» above: n words, and the
  clock runs until you end the last one.
- **Tiempo límite** — everyone gets **x minutes**, and whoever solves **the
  most words** in them wins. The words are still the same for everyone and
  in the same order; each player gets as far down the list as they can.
  - **The minutes** (Mazo's call): 3, 5, 10 or 15 as shortcuts, or any
    whole number from 1 to 60 typed.
  - **The list** is every answer of the chosen length, drawn from the seed,
    so nobody runs out of words.
  - **A missed word** is revealed and the player moves on, with no time
    added — the clock is already the limit; what a miss costs is the word
    not solved, and a life (below).
  - **Lives** (Phase 90): each player starts with k lives — 3 by default,
    the host picks 1 to 5, or «sin vidas». Every missed word costs one.
    With none left the player's race is over: they keep the words they
    solved, and the others play on until the time is up.
  - **The end.** When the minutes are up, every board stops at once, on
    the server's clock, mid-word included. The host can still close it
    early. A latecomer races on the same clock, so has less time.
  - **The ranking** (Mazo's call): most words solved; ties go to whoever
    solved their last word first, then to fewer tries.

## What you see of the others

- **Their progress, not their letters.** For each rival: which word they
  are on (e.g. 4/10), and the colours of their tries on it as small grey,
  yellow and green squares — never the letters.
- **The moment someone finishes**, it is said on every screen («Ana
  terminó — 3:42»).
- **No word is shown to anyone before they have ended it themselves.** A
  revealed word stays hidden from players still on it.
- **Once you have finished** (every word ended, out of lives, the time up or
  the race closed) you may open any rival's ended words and see their tries
  in letters (the owner, 2026-11-15): you can no longer play, so it changes
  nothing. A rival's word in play stays colours only until they end it.
- **The finish screen** is a table (the owner, 2026-11-15): players as
  columns in standing order, words as rows; touching a word shows everyone's
  tries on it side by side.

## Joining

- **By code, like every partida.** Anyone with the code joins the lobby
  until the race starts.
- **Joining a race already running (Mazo's call):** allowed, as a player
  whose clock started at the race's start — a late joiner simply starts
  behind. They see the same words in the same order.
- **Leaving** a race in progress keeps the player in the ranking with what
  they finished; nothing else waits for them.

## Fairness

- **The answers never reach a phone before they are ended.** The server
  holds the bag and scores each try; a phone only ever receives the colours
  of its own tries and, when a word ends, that word.
- **Every try is checked by the server** against the accepted list, so a
  modified client cannot claim a solve.
