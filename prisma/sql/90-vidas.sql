-- Phase 90: lives in Palabras' time mode — a missed word costs one. 0 is
-- «sin vidas». Additive, constant default: every existing row gets 3, which
-- only a time-limit Palabras race reads.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/90-vidas.sql
ALTER TABLE "Partida" ADD COLUMN "vidas" INTEGER NOT NULL DEFAULT 3;
