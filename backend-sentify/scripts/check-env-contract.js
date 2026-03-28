#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const ENV_SCHEMA_PATH = path.join(ROOT, 'src', 'config', 'env.js')
const RUNTIME_ENV_EXAMPLE_PATH = path.join(ROOT, '.env.example')
const RELEASE_ENV_EXAMPLE_PATH = path.join(ROOT, '.env.release-evidence.example')

const ADDITIONAL_RUNTIME_KEYS = [
    'ADMIN_PLATFORM_LOCAL_PROOF_MAX_AGE_HOURS',
    'ADMIN_PLATFORM_MANAGED_PROOF_MAX_AGE_HOURS',
]

const RELEASE_EVIDENCE_KEYS = [
    'RELEASE_EVIDENCE_SOURCE_MODE',
    'RELEASE_EVIDENCE_SOURCE_DB_URL',
    'RELEASE_EVIDENCE_TARGET_DB_URL',
    'RELEASE_EVIDENCE_TARGET_DATABASE',
    'RELEASE_EVIDENCE_SMOKE_USER_ID',
    'RELEASE_EVIDENCE_RESTAURANT_SLUGS',
    'RELEASE_EVIDENCE_MANAGED_REDIS_URL',
    'RELEASE_EVIDENCE_STAGING_API_URL',
    'RELEASE_EVIDENCE_STAGING_TIMEOUT_MS',
    'RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
    'RELEASE_EVIDENCE_STAGING_USER_EMAIL',
    'RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
    'RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
    'RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
    'RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT',
    'RELEASE_EVIDENCE_INCLUDE_PERFORMANCE_PROOF',
    'RELEASE_EVIDENCE_PERFORMANCE_SCALE_URL',
    'RELEASE_EVIDENCE_REQUIRE_MANAGED_SIGNOFF',
]

function parseEnvSchemaKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const keys = []

    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+):/)
        if (!match) {
            continue
        }

        const key = match[1]
        if (key.endsWith('_VALUE') || key === 'CORS_ORIGINS') {
            continue
        }

        keys.push(key)
    }

    return keys
}

function parseEnvFileKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const keys = []

    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)=/)
        if (match) {
            keys.push(match[1])
        }
    }

    return keys
}

function diffKeys({ expected, actual }) {
    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)

    return {
        missing: expected.filter((key) => !actualSet.has(key)),
        extra: actual.filter((key) => !expectedSet.has(key)),
    }
}

function printSection(title, values) {
    if (values.length === 0) {
        return
    }

    process.stderr.write(`${title}\n`)
    for (const value of values) {
        process.stderr.write(`- ${value}\n`)
    }
}

function main() {
    const runtimeExpected = [
        ...parseEnvSchemaKeys(ENV_SCHEMA_PATH),
        ...ADDITIONAL_RUNTIME_KEYS,
    ]
    const runtimeActual = parseEnvFileKeys(RUNTIME_ENV_EXAMPLE_PATH)
    const releaseActual = parseEnvFileKeys(RELEASE_ENV_EXAMPLE_PATH)

    const runtimeDiff = diffKeys({
        expected: runtimeExpected,
        actual: runtimeActual,
    })
    const releaseDiff = diffKeys({
        expected: RELEASE_EVIDENCE_KEYS,
        actual: releaseActual,
    })
    const misplacedReleaseKeys = runtimeActual.filter((key) =>
        RELEASE_EVIDENCE_KEYS.includes(key),
    )
    const misplacedRuntimeKeys = releaseActual.filter((key) =>
        runtimeExpected.includes(key),
    )

    const hasProblems =
        runtimeDiff.missing.length > 0 ||
        runtimeDiff.extra.length > 0 ||
        releaseDiff.missing.length > 0 ||
        releaseDiff.extra.length > 0 ||
        misplacedReleaseKeys.length > 0 ||
        misplacedRuntimeKeys.length > 0

    if (!hasProblems) {
        process.stdout.write(
            JSON.stringify(
                {
                    ok: true,
                    runtimeExample: path.basename(RUNTIME_ENV_EXAMPLE_PATH),
                    releaseExample: path.basename(RELEASE_ENV_EXAMPLE_PATH),
                },
                null,
                2,
            ) + '\n',
        )
        return
    }

    printSection('Missing keys in .env.example:', runtimeDiff.missing)
    printSection('Unexpected keys in .env.example:', runtimeDiff.extra)
    printSection(
        'Release-evidence keys misplaced in .env.example:',
        misplacedReleaseKeys,
    )
    printSection(
        'Runtime keys misplaced in .env.release-evidence.example:',
        misplacedRuntimeKeys,
    )
    printSection(
        'Missing keys in .env.release-evidence.example:',
        releaseDiff.missing,
    )
    printSection(
        'Unexpected keys in .env.release-evidence.example:',
        releaseDiff.extra,
    )

    process.exitCode = 1
}

main()
