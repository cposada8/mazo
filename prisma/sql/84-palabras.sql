-- Phase 84: Palabras, the third game. How many words the bag holds, and how
-- many letters each has. Additive, constant defaults: every existing row gets
-- 10 and 5, which only a Palabras partida reads.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/84-palabras.sql
ALTER TABLE "Partida" ADD COLUMN "palabras" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Partida" ADD COLUMN "largo" INTEGER NOT NULL DEFAULT 5;
