/**
 * Runs a SQL file against the database the env file names — how a schema
 * change reaches Turso (`prisma db push` is for local files and tests).
 *
 *   npx tsx --env-file=<env> scripts/aplicar-sql.ts prisma/sql/<archivo>.sql
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'

const archivo = process.argv[2]
const url = process.env.DATABASE_URL
if (!archivo || !url) {
  console.error('Uso: tsx --env-file=<env> scripts/aplicar-sql.ts <archivo.sql>')
  process.exit(1)
}

const cliente = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
cliente
  .executeMultiple(readFileSync(archivo, 'utf8'))
  .then(() => console.log(`Aplicado ${archivo} en ${new URL(url).hostname.split('.')[0]}.`))
