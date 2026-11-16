-- Phase 89: Palabras' two ways to race — n words, or x minutes for the most
-- words. Additive, constant defaults: every existing row is 'palabras' with
-- 5 minutes it never reads, and the running code ignores both columns.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/89-modo.sql
ALTER TABLE "Partida" ADD COLUMN "modo" TEXT NOT NULL DEFAULT 'palabras';
ALTER TABLE "Partida" ADD COLUMN "minutos" INTEGER NOT NULL DEFAULT 5;
