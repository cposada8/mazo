# Tech Stack

The guiding rule: **reuse what already works.** This stack mirrors the owner's
`fwc_2026` project so that effort goes into the game, not into learning new
tooling. Anything not already proven there needs a justification in this file.

## Decided

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | The engine is a rules system; the type checker is the cheapest test available. |
| Framework | Next.js 16, App Router | Already known, and server components keep hidden information off the client. |
| UI runtime | React 19 | Comes with Next 16. |
| Styling | Tailwind CSS v4 | Already known. Mobile-first utilities suit a card table. |
| Components | shadcn/ui | Copy-in components, no runtime dependency, easy to restyle for a card theme. |
| Icons | lucide-react | Already in use. |
| Client state | Zustand | Small store for local UI and the solo game session. |
| Server state | TanStack Query | Only once online play needs polling/refetching. Not before. |
| Tests | Vitest + Testing Library | The engine is tested with plain Vitest, no DOM. |
| Database | Prisma + libSQL (Turso) | Same setup as `fwc_2026`: a local SQLite file in dev, Turso in production. |
| Auth | **None** | Dropped deliberately. Nobody wants to create an account to play a card game. Players join a partida with a code and a nickname. How a guest is identified in the database is an open design question — see below. |
| Hosting | Vercel | Already used and working on mobile and desktop. |
| Package manager | npm | Matches the existing project. |

## Repository shape

A single Next.js app, no monorepo. The separation that matters is enforced by
directory, not by package boundaries:

```
lib/engine/          Pure game rules. No React, no Prisma, no fetch. Never imports
                     from app/ or components/.
lib/engine/carioca/  Carioca-specific rules. Generic card primitives live one
                     level up so a second game can reuse them.
lib/bots/            Bot strategies. Import the engine; nothing imports them back.
app/                 Next.js routes, server actions, API handlers.
components/          React UI.
prisma/              Schema and migrations.
specs/               This constitution and per-feature specs.
__tests__/           Vitest suites, engine tests first.
```

The dependency rule is one-directional: `app/` and `components/` may import from
`lib/`; `lib/engine/` imports nothing from the project outside itself. If that
rule ever needs to break, the design is wrong.

## Deferred

**Real-time transport.** This section was written when Vercel's serverless
functions could not hold open WebSocket connections. That premise has expired —
Vercel Functions support WebSockets on Fluid Compute — but the conclusion
stands: **polling with TanStack Query is the first implementation**, because it
needs no new service at all and a second of latency is invisible in a
turn-based game. The transport sits behind an interface so it can be swapped.
If polling ever feels bad at a real table, the options in order:

1. **Vercel WebSockets** — first-party, no new vendor.
2. **Pusher Channels** — managed, a free tier that covers a handful of
   simultaneous games.
3. **Supabase Realtime** — more capable, but pulls in a second database.

**Guest identity.** With no accounts, the system still has to know which player
at a table is which, survive a page reload, and stop someone from claiming
another player's seat and seeing their hand. The likely shape is a per-seat
secret stored in the browser; the design is settled here as part of Phase 32,
before any persistence code is written.

**Animations.** Card movement will need something better than CSS transitions.
Evaluate when the table UI exists, not before.

## Rejected

- **React Native / Expo** — the phone requirement is satisfied by a responsive
  web app, and app stores add friction to inviting a friend to a game.
- **A game-server framework (Colyseus, Boardgame.io)** — they impose their own
  state model, which conflicts with the pure-engine principle and with hosting on
  Vercel.
- **A monorepo** — one deployable app does not justify the overhead.
