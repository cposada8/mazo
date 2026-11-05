-- Phase 71: the comodín gallery moves to Blob and a table, and each partida
-- keeps its own copy of it. Additive: the running code ignores both.
-- Apply to each Turso database before deploying code that reads them:
--   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/71-galeria.sql
ALTER TABLE "Partida" ADD COLUMN "caras" TEXT;
CREATE TABLE "Comodin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Comodin_url_key" ON "Comodin"("url");
