-- El Mentiroso's bullets (2026-11-05): how many each player starts with.
-- Additive, a constant default: every existing row gets 3, which only a
-- Mentiroso partida reads, and the running code ignores it.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/82-balas.sql
ALTER TABLE "Partida" ADD COLUMN "balas" INTEGER NOT NULL DEFAULT 3;
