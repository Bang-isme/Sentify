#!/usr/bin/env node

require('dotenv').config()

const prisma = require('../src/lib/prisma')
const { seedDemoData } = require('./seed-data')

async function main() {
    const summary = await seedDemoData({
        prisma,
        logger: (message) => {
            process.stdout.write(`${message}\n`)
        },
    })

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

main()
    .catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.disconnect()
    })
