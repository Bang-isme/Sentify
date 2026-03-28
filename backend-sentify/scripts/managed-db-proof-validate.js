#!/usr/bin/env node

require('dotenv').config()

const fs = require('fs')
const path = require('path')

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-db-proof-validation.json',
)

const PASS_STATUSES = new Set(['PASS', 'PASSED', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'])

function readFlag(args, name) {
    const inline = args.find((value) => value.startsWith(`${name}=`))

    if (inline) {
        return inline.slice(`${name}=`.length)
    }

    const index = args.findIndex((value) => value === name)
    if (index === -1) {
        return undefined
    }

    return args[index + 1]
}

function hasFlag(args, name) {
    return args.includes(name)
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/managed-db-proof-validate.js --artifact <file> [options]',
            '',
            'Options:',
            '  --artifact <file>          Managed DB proof artifact JSON to validate',
            '  --output <file>            Write validation report JSON',
            '  --help                     Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT',
        ].join('\n'),
    )
}

function normalizeForDigest(value) {
    if (value instanceof Date) {
        return value.toISOString()
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeForDigest(item))
    }

    if (value && typeof value === 'object') {
        const normalized = {}

        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeForDigest(value[key])
        }

        return normalized
    }

    return value
}

function getPathValue(source, dottedPath) {
    return dottedPath.split('.').reduce((current, key) => {
        if (current == null || typeof current !== 'object') {
            return undefined
        }

        return current[key]
    }, source)
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0
}

function isIsoDateLike(value) {
    return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function isPassingStatus(value) {
    return isNonEmptyString(value) && PASS_STATUSES.has(value.trim().toUpperCase())
}

function validateArtifact(artifact) {
    const requiredStringPaths = [
        'provider.name',
        'environment',
        'database.engine',
        'database.sourceIdentifier',
        'database.targetIdentifier',
        'proofType',
        'recoveryTarget.type',
        'recoveryTarget.value',
        'restore.status',
    ]
    const requiredDatePaths = ['restore.requestedAt', 'restore.restoredAt']
    const requiredPassingStatuses = [
        'restore.status',
        'verification.health.status',
        'verification.readSmoke.status',
        'verification.dataIntegrity.status',
    ]
    const missingFields = []
    const invalidFields = []
    const warnings = []

    for (const dottedPath of requiredStringPaths) {
        const value = getPathValue(artifact, dottedPath)

        if (!isNonEmptyString(value)) {
            missingFields.push(dottedPath)
        }
    }

    for (const dottedPath of requiredDatePaths) {
        const value = getPathValue(artifact, dottedPath)

        if (!isIsoDateLike(value)) {
            invalidFields.push(`${dottedPath} must be an ISO timestamp`)
        }
    }

    for (const dottedPath of requiredPassingStatuses) {
        const value = getPathValue(artifact, dottedPath)

        if (!isPassingStatus(value)) {
            invalidFields.push(`${dottedPath} must be a passing status`)
        }
    }

    const databaseEngine = getPathValue(artifact, 'database.engine')
    if (isNonEmptyString(databaseEngine) && databaseEngine.trim().toLowerCase() !== 'postgresql') {
        invalidFields.push('database.engine must be postgresql')
    }

    const optionalRollbackStatus = getPathValue(artifact, 'verification.rollback.status')
    if (!optionalRollbackStatus) {
        warnings.push('verification.rollback.status is missing')
    } else if (!isPassingStatus(optionalRollbackStatus)) {
        warnings.push('verification.rollback.status is present but not passing')
    }

    const overallStatus =
        missingFields.length > 0 || invalidFields.length > 0
            ? 'MANAGED_DB_PROOF_FAILED'
            : 'MANAGED_DB_PROOF_COMPLETE'

    return {
        overallStatus,
        missingFields,
        invalidFields,
        warnings,
        summary: {
            provider: getPathValue(artifact, 'provider.name') || null,
            environment: getPathValue(artifact, 'environment') || null,
            proofType: getPathValue(artifact, 'proofType') || null,
            recoveryTarget: {
                type: getPathValue(artifact, 'recoveryTarget.type') || null,
                value: getPathValue(artifact, 'recoveryTarget.value') || null,
            },
            sourceIdentifier:
                getPathValue(artifact, 'database.sourceIdentifier') || null,
            targetIdentifier:
                getPathValue(artifact, 'database.targetIdentifier') || null,
            restoredAt: getPathValue(artifact, 'restore.restoredAt') || null,
        },
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const artifactPath =
        readFlag(args, '--artifact') ||
        process.env.RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH

    if (!artifactPath) {
        printUsage()
        process.exitCode = 1
        return
    }

    const resolvedArtifactPath = path.resolve(artifactPath)
    const startedAt = new Date()

    if (!fs.existsSync(resolvedArtifactPath)) {
        const missingReport = {
            benchmark: {
                startedAt,
                finishedAt: new Date(),
                durationMs: 0,
                mode: 'managed_db_proof_validation',
            },
            artifactPath: resolvedArtifactPath,
            overallStatus: 'MANAGED_DB_PROOF_FAILED',
            missingFields: ['artifact'],
            invalidFields: ['artifact file does not exist'],
            warnings: [],
            summary: null,
        }

        const resolvedOutputPath = path.resolve(outputPath)
        fs.mkdirSync(path.dirname(resolvedOutputPath), {
            recursive: true,
        })
        fs.writeFileSync(
            resolvedOutputPath,
            `${JSON.stringify(normalizeForDigest(missingReport), null, 2)}\n`,
        )
        process.stdout.write(
            `${JSON.stringify(
                {
                    overallStatus: missingReport.overallStatus,
                    artifactPath: resolvedArtifactPath,
                },
                null,
                2,
            )}\n`,
        )
        process.stdout.write(
            `Managed DB proof validation report written to ${resolvedOutputPath}\n`,
        )
        process.exitCode = 1
        return
    }

    let artifact
    try {
        artifact = JSON.parse(fs.readFileSync(resolvedArtifactPath, 'utf8'))
    } catch (error) {
        const parseReport = {
            benchmark: {
                startedAt,
                finishedAt: new Date(),
                durationMs: 0,
                mode: 'managed_db_proof_validation',
            },
            artifactPath: resolvedArtifactPath,
            overallStatus: 'MANAGED_DB_PROOF_FAILED',
            missingFields: [],
            invalidFields: [
                `artifact must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            ],
            warnings: [],
            summary: null,
        }

        const resolvedOutputPath = path.resolve(outputPath)
        fs.mkdirSync(path.dirname(resolvedOutputPath), {
            recursive: true,
        })
        fs.writeFileSync(
            resolvedOutputPath,
            `${JSON.stringify(normalizeForDigest(parseReport), null, 2)}\n`,
        )
        process.stdout.write(
            `${JSON.stringify(
                {
                    overallStatus: parseReport.overallStatus,
                    artifactPath: resolvedArtifactPath,
                },
                null,
                2,
            )}\n`,
        )
        process.stdout.write(
            `Managed DB proof validation report written to ${resolvedOutputPath}\n`,
        )
        process.exitCode = 1
        return
    }

    const validation = validateArtifact(artifact)
    const finishedAt = new Date()
    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'managed_db_proof_validation',
        },
        artifactPath: resolvedArtifactPath,
        ...validation,
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), {
        recursive: true,
    })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
    )

    process.stdout.write(
        `${JSON.stringify(
            {
                overallStatus: report.overallStatus,
                artifactPath: resolvedArtifactPath,
                warnings: report.warnings,
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(
        `Managed DB proof validation report written to ${resolvedOutputPath}\n`,
    )

    if (report.overallStatus === 'MANAGED_DB_PROOF_FAILED') {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exitCode = 1
})
