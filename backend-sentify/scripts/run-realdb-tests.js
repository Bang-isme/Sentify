#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const child = spawnSync(process.execPath, ['--test', 'test/publish.realdb.test.js'], {
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

process.exit(child.status ?? 1)
