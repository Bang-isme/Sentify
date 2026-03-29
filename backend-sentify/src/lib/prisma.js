const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const env = require('../config/env')
const { normalizeDatabaseUrl } = require('./database-url')

// Prisma client should be a singleton in development to avoid exhausting connections on hot reload.
const globalForPrisma = globalThis

const adapter = new PrismaPg({
    connectionString: normalizeDatabaseUrl(env.DATABASE_URL, {
        connectionLimit: env.DB_POOL_MAX,
        connectTimeoutSeconds: env.DB_CONNECT_TIMEOUT_SECONDS,
        statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
        idleInTransactionTimeoutMs: env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    }),
})

const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

async function disconnect() {
    await prisma.$disconnect()
}

module.exports = prisma
module.exports.disconnect = disconnect
