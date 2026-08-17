import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 keeps connection URLs out of the schema. The CLI (db push,
 * migrate) reads this; the runtime client builds its own adapter in
 * `lib/server/db.ts`. Local dev is a SQLite file; production is Turso, whose
 * URL arrives via env.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
})
