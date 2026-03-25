#!/usr/bin/env node

require('dotenv').config()

const { execSync } = require('child_process')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')

function run(command) {
    execSync(command, {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
    })
}

try {
    process.stdout.write('Resetting local baseline...\n')
    run('npm run db:generate')
    run('npx prisma migrate reset --force')
    run('npm run db:seed')
    run('npm run db:validate')
    process.stdout.write('Local baseline reset complete.\n')
} catch (error) {
    process.exitCode = error?.status || 1
}
