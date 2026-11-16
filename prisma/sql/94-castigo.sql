-- Phase 94: what a missed word adds in Palabras' «Palabras límite», the
-- host's to choose, in minutes. Additive, a constant default: every existing
-- row gets 2, the penalty every race had before.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/94-castigo.sql
ALTER TABLE "Partida" ADD COLUMN "castigo" INTEGER NOT NULL DEFAULT 2;
