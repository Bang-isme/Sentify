#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const testDir = path.resolve(__dirname, '..', 'test')
const npmCli = process.env.npm_execpath
const resetAttempts = Number.parseInt(process.env.REALDB_RESET_RETRY_ATTEMPTS || '3', 10)
const resetRetryDelayMs = Number.parseInt(process.env.REALDB_RESET_RETRY_DELAY_MS || '1500', 10)
const realDbTests = fs
    .readdirSync(testDir)
    .filter((fileName) => fileName.endsWith('.realdb.test.js'))
    .sort()
    .map((fileName) => path.join('test', fileName))

function wait(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runResetBaseline() {
    for (let attempt = 1; attempt <= resetAttempts; attempt += 1) {
        const reset = spawnSync(process.execPath, [npmCli, 'run', 'db:reset:local-baseline'], {
            stdio: 'inherit',
            env: process.env,
        })

        if (!reset.error && (reset.status ?? 1) === 0) {
            return
        }

        if (attempt >= resetAttempts) {
            if (reset.error) {
                console.error(reset.error.stack || reset.error.message || String(reset.error))
            }
            process.exit(reset.status ?? 1)
        }

        console.warn(
            `db:reset:local-baseline failed before a real-db test run (attempt ${attempt}/${resetAttempts}); retrying in ${resetRetryDelayMs}ms`,
        )
        wait(resetRetryDelayMs)
    }
}

for (const file of realDbTests) {
    runResetBaseline()

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
