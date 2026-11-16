-- Phase 96: Palabras' chained words — each word opens with the one before as
-- its first try. Additive, a constant default: off for every existing row.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/96-encadenadas.sql
ALTER TABLE "Partida" ADD COLUMN "encadenadas" BOOLEAN NOT NULL DEFAULT false;
