const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const SCRIPT_PATH = path.resolve(
    __dirname,
    '../scripts/managed-db-proof-validate.js',
)

function runValidator({ artifact, output }) {
    return spawnSync(process.execPath, [SCRIPT_PATH, '--artifact', artifact, '--output', output], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        windowsHide: true,
    })
}

test('managed db proof validator accepts a complete artifact', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentify-managed-db-proof-'))
    const artifactPath = path.join(tempDir, 'artifact.json')
    const outputPath = path.join(tempDir, 'output.json')

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

    const result = runValidator({
        artifact: artifactPath,
        output: outputPath,
    })

    assert.equal(result.status, 0)

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    assert.equal(report.overallStatus, 'MANAGED_DB_PROOF_COMPLETE')
    assert.deepEqual(report.missingFields, [])
    assert.deepEqual(report.invalidFields, [])
})

test('managed db proof validator fails when required fields are missing or invalid', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentify-managed-db-proof-'))
    const artifactPath = path.join(tempDir, 'artifact.json')
    const outputPath = path.join(tempDir, 'output.json')

    fs.writeFileSync(
        artifactPath,
        JSON.stringify(
            {
                provider: {},
                environment: 'staging',
                database: {
                    engine: 'mysql',
                    sourceIdentifier: '',
                    targetIdentifier: 'restore-target',
                },
                proofType: 'PITR',
                recoveryTarget: {
                    type: 'time',
                    value: '',
                },
                restore: {
                    requestedAt: 'not-a-date',
                    restoredAt: '2026-03-28T00:15:00.000Z',
                    status: 'FAILED',
                },
                verification: {
                    health: {
                        status: 'FAIL',
                    },
                    readSmoke: {
                        status: 'PASS',
                    },
                    dataIntegrity: {
                        status: 'FAIL',
                    },
                },
            },
            null,
            2,
        ),
    )

    const result = runValidator({
        artifact: artifactPath,
        output: outputPath,
    })

    assert.equal(result.status, 1)

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    assert.equal(report.overallStatus, 'MANAGED_DB_PROOF_FAILED')
    assert.equal(report.missingFields.includes('provider.name'), true)
    assert.equal(
        report.invalidFields.includes('database.engine must be postgresql'),
        true,
    )
})
