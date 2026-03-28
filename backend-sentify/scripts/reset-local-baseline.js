#!/usr/bin/env node

require('dotenv').config()

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const stackNamespace = process.env.REVIEW_CRAWL_STACK_NAMESPACE?.trim() || ''
const managedStackStateFile = path.join(
    rootDir,
    '.local-runtime',
    ...(stackNamespace ? [stackNamespace] : []),
    'review-crawl-stack.json',
)

function run(command) {
    execSync(command, {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
    })
}

function runQuiet(command) {
    execSync(command, {
        cwd: rootDir,
        env: process.env,
        stdio: 'ignore',
    })
}

try {
    const restartManagedStack = fs.existsSync(managedStackStateFile)

    if (restartManagedStack) {
        process.stdout.write('Stopping managed review-crawl stack before reset...\n')
        runQuiet('node scripts/local-review-stack.js stop')
    }

    process.stdout.write('Resetting local baseline...\n')
    run('npm run db:generate')
    run('npx prisma migrate reset --force')
    run('npm run db:seed')
    run('npm run db:validate')

    if (restartManagedStack) {
        process.stdout.write('Restarting managed review-crawl stack after reset...\n')
        run('node scripts/local-review-stack.js start')
    }

    process.stdout.write('Local baseline reset complete.\n')
} catch (error) {
    process.exitCode = error?.status || 1
}
