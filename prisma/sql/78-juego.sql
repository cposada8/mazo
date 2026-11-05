-- Phase 78: a partida is *of* a game, and el Mentiroso's window has a length.
-- Additive: every existing row becomes Carioca with a 3-second window it
-- never uses, and the running code ignores both columns.
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/78-juego.sql
-- (Prisma's own diff rebuilds the table to place the columns; SQLite adds a
-- NOT NULL column with a constant default in place, and order is cosmetic.)
ALTER TABLE "Partida" ADD COLUMN "juego" TEXT NOT NULL DEFAULT 'carioca';
ALTER TABLE "Partida" ADD COLUMN "segundosVentana" INTEGER NOT NULL DEFAULT 3;
