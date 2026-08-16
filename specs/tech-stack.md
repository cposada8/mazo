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
| Auth | Clerk | Same as `fwc_2026`. Required only for saved history and hosting a room. |
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

**Real-time transport.** Vercel's serverless functions cannot hold open
WebSocket connections, so online play needs a managed transport. The decision is
deliberately postponed to the online phase, when the shape of the state updates
is known. Current leaning, in order:

1. **Pusher Channels** — smallest amount of new concept; a free tier that covers
   a handful of simultaneous games.
2. **Supabase Realtime** — more capable, but pulls in a second database.
3. **Polling with TanStack Query** — no new service at all, and a legitimate
   starting point for a turn-based game where a second of latency is invisible.

Polling is the likely first implementation precisely because it needs no new
vendor; the transport sits behind an interface so it can be swapped.

**Animations.** Card movement will need something better than CSS transitions.
Evaluate when the table UI exists, not before.

## Rejected

- **React Native / Expo** — the phone requirement is satisfied by a responsive
  web app, and app stores add friction to inviting a friend to a game.
- **A game-server framework (Colyseus, Boardgame.io)** — they impose their own
  state model, which conflicts with the pure-engine principle and with hosting on
  Vercel.
- **A monorepo** — one deployable app does not justify the overhead.
