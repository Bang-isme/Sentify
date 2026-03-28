const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const SCRIPT_PATH = path.resolve(
    __dirname,
    '../scripts/managed-signoff-preflight.js',
)

function runPreflight({ args = [] } = {}) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        windowsHide: true,
    })
}

test('managed signoff preflight reports pending for local targets and missing inputs', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentify-managed-preflight-'))
    const outputPath = path.join(tempDir, 'preflight.json')

    const result = runPreflight({
        args: [
            '--managed-redis-url',
            'redis://127.0.0.1:6379',
            '--staging-api-url',
            'http://127.0.0.1:3000',
            '--output',
            outputPath,
            '--require-ready',
        ],
    })

    assert.equal(result.status, 1)

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    assert.equal(report.readiness.status, 'MANAGED_SIGNOFF_PENDING')
    assert.equal(report.readiness.blockers.includes('Managed Redis target is local'), true)
    assert.equal(report.readiness.blockers.includes('Staging API target is local'), true)
    assert.equal(
        report.readiness.blockers.includes('Merchant staging credentials are incomplete'),
        true,
    )
    assert.equal(Array.isArray(report.nextSteps), true)
    assert.equal(report.nextSteps.some((step) => step.key === 'managedRedis'), true)
    assert.equal(report.nextSteps.some((step) => step.key === 'managedDbProof'), true)
})

test('managed signoff preflight reports ready for external targets plus valid DB proof artifact', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentify-managed-preflight-'))
    const artifactPath = path.join(tempDir, 'managed-db-proof.json')
    const outputPath = path.join(tempDir, 'preflight.json')

    fs.writeFileSync(
        artifactPath,
        JSON.stringify(
            {
                provider: {
                    name: 'Managed Postgres',
                },
                environment: 'staging',
                database: {
                    engine: 'postgresql',
                    sourceIdentifier: 'sentify-prod',
                    targetIdentifier: 'sentify-staging-restore',
                },
                proofType: 'PITR',
                recoveryTarget: {
                    type: 'time',
                    value: '2026-03-28T00:00:00.000Z',
                },
                restore: {
                    requestedAt: '2026-03-28T00:05:00.000Z',
                    restoredAt: '2026-03-28T00:15:00.000Z',
                    status: 'COMPLETED',
                },
                verification: {
                    health: {
                        status: 'PASS',
                    },
                    readSmoke: {
                        status: 'PASS',
                    },
                    dataIntegrity: {
                        status: 'PASS',
                    },
                    rollback: {
                        status: 'PASS',
                    },
                },
            },
            null,
            2,
        ),
    )

    const result = runPreflight({
        args: [
            '--managed-redis-url',
            'redis://managed.example.internal:6379',
            '--staging-api-url',
            'https://staging.sentify.example',
            '--staging-user-email',
            'merchant@example.com',
            '--staging-user-password',
            'DemoPass123!',
            '--staging-admin-email',
            'admin@example.com',
            '--staging-admin-password',
            'DemoPass123!',
            '--managed-db-proof-artifact',
            artifactPath,
            '--output',
            outputPath,
            '--require-ready',
        ],
    })

    assert.equal(result.status, 0)

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    assert.equal(report.readiness.status, 'MANAGED_SIGNOFF_READY')
    assert.deepEqual(report.readiness.blockers, [])
    assert.deepEqual(report.nextSteps, [])
    assert.equal(report.managedDbProofArtifact.validationStatus, 'PASSED')
  })
