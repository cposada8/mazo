# Mazo

Card games in the browser, playable from a phone. The first game is **Carioca**,
a Chilean rummy variant played over a configurable sequence of contracts.

Play against bots when nobody is around, or share a code and play with friends
from their own phones — no account required.

> Status: the rules engine is complete through a full ronda — dealing, grupos,
> turns, laying down, and the mesa. Scoring is next, and nothing is playable by a
> human yet. See [`specs/estado.md`](./specs/estado.md).

## How it is built

The one architectural rule: **the game engine is pure.** Carioca's rules live in
framework-free TypeScript under `lib/engine/` — no React, no database, no
network. Bots, the local UI and the online server are all clients of that same
engine.

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Tests | Vitest |
| Hosting | Vercel |

## Specs

This project is specced before it is coded. Everything worth knowing is in
[`specs/`](./specs):

- **[`estado.md`](./specs/estado.md) — start here.** Where the project stands,
  the decisions that shape the code, and what comes next.
- [`mission.md`](./specs/mission.md) — what Mazo is, who it is for, and what
  counts as done.
- [`carioca-rules.md`](./specs/carioca-rules.md) — the complete rules of Carioca
  as played, and the authority the engine implements.
- [`tech-stack.md`](./specs/tech-stack.md) — the stack, the repository layout,
  and what was deliberately rejected.
- [`roadmap.md`](./specs/roadmap.md) — the work in small phases, each ending in
  something demonstrable.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run   # Vitest, once
npm run build      # production build
```
