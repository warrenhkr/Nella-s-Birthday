import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~~/generated/prisma'
import type { PrismaClient as PrismaClientType } from '~~/generated/prisma'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClientType
}

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize Prisma. Prefer a Supabase Session Pooler URL in server contexts.')
  }

  if (connectionString.includes('supabase.co:5432') || (connectionString.includes('db.') && connectionString.includes(':5432'))) {
    console.warn('[Prisma] Direct PostgreSQL URL detected. For Supabase, prefer a Session Pooler URL (typically port 6543) instead of the direct 5432 connection.')
  }

  return connectionString
}

function getPrismaClient() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const adapter = new PrismaPg({ connectionString: getConnectionString() })
  const prisma = new PrismaClient({ adapter })
  globalForPrisma.prisma = prisma
  return prisma
}

const prisma = new Proxy({} as PrismaClientType, {
  get(_target, property, receiver) {
    return Reflect.get(getPrismaClient(), property, receiver)
  }
})

export default prisma
