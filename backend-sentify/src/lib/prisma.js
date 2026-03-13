const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const env = require('../config/env')

// Prisma client should be a singleton in development to avoid exhausting connections on hot reload.
const globalForPrisma = globalThis

function withConnectionLimit(databaseUrl, connectionLimit) {
    if (!databaseUrl || !connectionLimit) {
        return databaseUrl
    }

    try {
        const url = new URL(databaseUrl)

        if (!url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', String(connectionLimit))
        }

        return url.toString()
    } catch (error) {
        return databaseUrl
    }
}

const adapter = new PrismaPg({
    connectionString: withConnectionLimit(env.DATABASE_URL, env.DB_POOL_MAX),
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
