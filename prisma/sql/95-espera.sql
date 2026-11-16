-- Phase 95: how long Palabras' «Palabras límite» waits for the rest after
-- the first finish, in minutes; 0 is «sin límite», the new default. Races
-- dealt before keep their own rule in their state (the old half hour), so
-- this column only shapes races dealt from now on.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/95-espera.sql
ALTER TABLE "Partida" ADD COLUMN "espera" INTEGER NOT NULL DEFAULT 0;
