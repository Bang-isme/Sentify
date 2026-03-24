#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const testDir = path.resolve(__dirname, '..', 'test')
const realDbTests = fs
    .readdirSync(testDir)
    .filter((fileName) => fileName.endsWith('.realdb.test.js'))
    .sort()
    .map((fileName) => path.join('test', fileName))

for (const file of realDbTests) {
    const child = spawnSync(process.execPath, ['--test', file], {
        stdio: 'inherit',
        env: {
            ...process.env,
            RUN_REAL_DB_TESTS: 'true',
        },
    })

    if (child.error) {
        console.error(child.error.stack || child.error.message || String(child.error))
        process.exit(1)
    }

    if ((child.status ?? 1) !== 0) {
        process.exit(child.status ?? 1)
    }
}
