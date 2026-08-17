/**
 * The database connection (Phase 32).
 *
 * SQLite through libSQL everywhere: a local file in dev, Turso in production.
 * `DATABASE_URL` (and `DATABASE_AUTH_TOKEN` for Turso) select which. The
 * client is a module-level singleton so Next's dev-mode module reloads do not
 * pile up connections.
 */

import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

function crearCliente(): PrismaClient {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  return new PrismaClient({ adapter })
}

const globalConPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalConPrisma.prisma ?? crearCliente()

if (process.env.NODE_ENV !== 'production') globalConPrisma.prisma = prisma
