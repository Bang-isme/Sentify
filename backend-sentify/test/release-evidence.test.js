const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildCompatibilityStatus,
} = require('../scripts/release-evidence.js')

test('release evidence compatibility stays complete when only optional checks are skipped', () => {
    const status = buildCompatibilityStatus([
        {
            key: 'managedRedis',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'backupRestoreRollback',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'stagingApi',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'performanceProof',
            required: false,
            status: 'PASSED',
        },
        {
            key: 'managedDbProof',
            required: false,
            status: 'SKIPPED',
        },
    ])

    assert.equal(status, 'COMPATIBILITY_PROOF_COMPLETE')
})

test('release evidence compatibility becomes partial when an optional executed check is partial', () => {
    const status = buildCompatibilityStatus([
        {
            key: 'managedRedis',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'backupRestoreRollback',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'stagingApi',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'performanceProof',
            required: false,
            status: 'PARTIAL',
        },
        {
            key: 'managedDbProof',
            required: false,
            status: 'SKIPPED',
        },
    ])

    assert.equal(status, 'COMPATIBILITY_PROOF_PARTIAL')
})

test('release evidence compatibility fails when a required check fails', () => {
    const status = buildCompatibilityStatus([
        {
            key: 'managedRedis',
            required: true,
            status: 'FAILED',
        },
        {
            key: 'backupRestoreRollback',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'stagingApi',
            required: true,
            status: 'PASSED',
        },
        {
            key: 'managedDbProof',
            required: false,
            status: 'SKIPPED',
        },
    ])

    assert.equal(status, 'COMPATIBILITY_PROOF_FAILED')
})
