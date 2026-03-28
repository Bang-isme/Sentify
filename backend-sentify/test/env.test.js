const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ENV_MODULE_PATH = path.resolve(__dirname, '../src/config/env.js')

function runEnvProbe(overrides = {}) {
    return spawnSync(
        process.execPath,
        [
            '-e',
            `
                const env = require(${JSON.stringify(ENV_MODULE_PATH)});
                process.stdout.write(JSON.stringify({
                    jwtSecretPrevious: env.JWT_SECRET_PREVIOUS ?? null,
                    authCookieDomain: env.AUTH_COOKIE_DOMAIN ?? null,
                    trustProxyValue: env.TRUST_PROXY_VALUE ?? null
                }));
            `,
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
            windowsHide: true,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/sentify?schema=public',
                JWT_SECRET: '12345678901234567890123456789012',
                JWT_SECRET_PREVIOUS: '',
                JWT_ISSUER: 'sentify-api',
                JWT_AUDIENCE: 'sentify-web',
                ...overrides,
            },
        },
    )
}

function parseProbeJson(stdout) {
    const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    return JSON.parse(lines.at(-1))
}

test('env config accepts empty JWT_SECRET_PREVIOUS as unset', () => {
    const result = runEnvProbe()

    assert.equal(result.status, 0)
    const parsed = parseProbeJson(result.stdout)
    assert.equal(parsed.jwtSecretPrevious, null)
})

test('env config still rejects non-empty short JWT_SECRET_PREVIOUS values', () => {
    const result = runEnvProbe({
        JWT_SECRET_PREVIOUS: 'too-short',
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /JWT_SECRET_PREVIOUS/)
})

test('env config parses numeric TRUST_PROXY values for hosted reverse proxies', () => {
    const result = runEnvProbe({
        TRUST_PROXY: '1',
    })

    assert.equal(result.status, 0)
    const parsed = parseProbeJson(result.stdout)
    assert.equal(parsed.trustProxyValue, 1)
})
