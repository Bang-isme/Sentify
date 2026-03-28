#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { loadEnvFiles } = require('./load-env-files')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-release-evidence.json',
)
const DEFAULT_STAGING_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-recovery-drill-managed.json',
)
const DEFAULT_STAGING_API_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-api-proof-managed.json',
)
const DEFAULT_REDIS_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-redis-proof.json',
)
const DEFAULT_PERFORMANCE_OUTPUT_PATH = path.join(
    'load-reports',
    'performance-proof-managed.json',
)
const DEFAULT_MANAGED_DB_PROOF_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-db-proof-validation.json',
)

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

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

function readFlags(args, name) {
    const values = []

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index]

        if (value === name) {
            if (args[index + 1]) {
                values.push(args[index + 1])
            }

            index += 1
            continue
        }

        if (value.startsWith(`${name}=`)) {
            values.push(value.slice(`${name}=`.length))
        }
    }

    return values
}

function hasFlag(args, name) {
    return args.includes(name)
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/release-evidence.js [options]',
            '',
            'Options:',
            '  --source-mode <mode>        Source mode for staging recovery drill: seeded-local or existing',
            '  --source-db-url <url>       Source database URL override',
            '  --target-db-url <url>       Restore target database URL override',
            '  --target-database <name>    Restore target database name override',
            '  --restaurant-slug <slug>    One or more source restaurant slugs',
            '  --smoke-user-id <id>        Optional USER id for authenticated recovery smoke',
            '  --managed-redis-url <url>   Managed Redis URL override',
            '  --staging-api-url <url>     Optional deployed staging API base URL to probe',
            '  --staging-user-email <email> Optional merchant USER email for staging auth smoke',
            '  --staging-user-password <password> Optional merchant USER password',
            '  --staging-admin-email <email> Optional ADMIN email for staging auth smoke',
            '  --staging-admin-password <password> Optional ADMIN password',
            '  --staging-timeout-ms <ms>   Per-request timeout for staging API proof',
            '  --staging-insecure-tls      Disable TLS verification for staging API proof',
            '  --managed-db-proof-artifact <file> Optional provider-managed DB backup/PITR proof artifact',
            '  --managed-db-proof-output <file>   Write managed DB proof validation JSON',
            '  --include-performance-proof Run the local performance proof bundle as part of release evidence',
            '  --performance-scale-url <url> Optional live Google Maps URL for crawl scale estimation',
            '  --require-managed-signoff   Exit non-zero unless external managed sign-off is complete',
            '  --output <file>             Write combined release evidence JSON',
            '  --help                      Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_SOURCE_DB_URL',
            '  RELEASE_EVIDENCE_TARGET_DB_URL',
            '  RELEASE_EVIDENCE_TARGET_DATABASE',
            '  RELEASE_EVIDENCE_MANAGED_REDIS_URL',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_USER_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_TIMEOUT_MS',
            '  RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
            '  RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT',
            '  RELEASE_EVIDENCE_INCLUDE_PERFORMANCE_PROOF',
            '  RELEASE_EVIDENCE_PERFORMANCE_SCALE_URL',
            '  RELEASE_EVIDENCE_REQUIRE_MANAGED_SIGNOFF',
            '  RELEASE_EVIDENCE_SOURCE_MODE',
            '  RELEASE_EVIDENCE_SMOKE_USER_ID',
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

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runNodeScript(scriptName, args) {
    const scriptPath = path.resolve(__dirname, scriptName)
    const child = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
    })

    const stdout = child.stdout || ''
    const stderr = child.stderr || ''

    return {
        ok: !child.error && (child.status ?? 1) === 0,
        status: child.status ?? 1,
        stdout,
        stderr,
        error: child.error ? String(child.error) : null,
    }
}

function buildCompatibilityStatus(checks) {
    const requiredChecks = checks.filter((check) => check.required)
    const failedRequiredChecks = requiredChecks.filter((check) => check.status === 'FAILED')
    const degradedRequiredChecks = requiredChecks.filter(
        (check) => check.status === 'SKIPPED' || check.status === 'PARTIAL',
    )
    const degradedOptionalChecks = checks.filter(
        (check) =>
            !check.required &&
            (check.status === 'FAILED' || check.status === 'PARTIAL'),
    )

    if (failedRequiredChecks.length > 0) {
        return 'COMPATIBILITY_PROOF_FAILED'
    }

    if (degradedRequiredChecks.length > 0 || degradedOptionalChecks.length > 0) {
        return 'COMPATIBILITY_PROOF_PARTIAL'
    }

    return 'COMPATIBILITY_PROOF_COMPLETE'
}

function mapChildOverallStatusToCheckStatus(overallStatus, complete, partial) {
    if (overallStatus === complete) {
        return 'PASSED'
    }

    if (overallStatus === partial) {
        return 'PARTIAL'
    }

    return 'FAILED'
}

function parseUrlTarget(value) {
    if (!value) {
        return {
            configured: false,
            scope: 'UNCONFIGURED',
            hostname: null,
        }
    }

    try {
        const parsed = new URL(value)
        const hostname = parsed.hostname || null

        return {
            configured: true,
            scope: LOOPBACK_HOSTS.has(hostname) ? 'LOCAL' : 'EXTERNAL',
            hostname,
        }
    } catch (_error) {
        return {
            configured: true,
            scope: 'UNKNOWN',
            hostname: null,
        }
    }
}

function buildManagedDbProofArtifact(artifactPath) {
    if (!artifactPath) {
        return {
            provided: false,
            exists: false,
            path: null,
            fileName: null,
        }
    }

    const resolvedPath = path.resolve(artifactPath)

    return {
        provided: true,
        exists: fs.existsSync(resolvedPath),
        path: resolvedPath,
        fileName: path.basename(resolvedPath),
        validationStatus: 'UNVALIDATED',
        overallStatus: null,
    }
}

function buildManagedSignoffAssessment({
    compatibilityStatus,
    managedRedisTarget,
    stagingApiTarget,
    managedDbProofArtifact,
    managedDbProofCheck,
    checks,
}) {
    const compatibilityGaps = checks
        .filter((check) => check.required && check.status !== 'PASSED')
        .map((check) =>
            check.status === 'PARTIAL'
                ? `${check.label} is partial`
                : check.status === 'SKIPPED'
                  ? `${check.label} is skipped`
                  : `${check.label} failed`,
        )
    const gaps = [...compatibilityGaps]

    if (!managedRedisTarget.configured) {
        gaps.push('Managed Redis target is not configured')
    } else if (managedRedisTarget.scope !== 'EXTERNAL') {
        gaps.push(`Managed Redis target is ${managedRedisTarget.scope.toLowerCase()}`)
    }

    if (!stagingApiTarget.configured) {
        gaps.push('Deployed staging API target is not configured')
    } else if (stagingApiTarget.scope !== 'EXTERNAL') {
        gaps.push(`Deployed staging API target is ${stagingApiTarget.scope.toLowerCase()}`)
    }

    if (!managedDbProofArtifact.provided) {
        gaps.push('Provider-managed Postgres backup/PITR proof artifact is missing')
    } else if (!managedDbProofArtifact.exists) {
        gaps.push('Provider-managed Postgres backup/PITR proof artifact path does not exist')
    } else if (!managedDbProofCheck || managedDbProofCheck.status !== 'PASSED') {
        gaps.push('Provider-managed Postgres backup/PITR proof artifact did not validate cleanly')
    }

    if (compatibilityStatus === 'COMPATIBILITY_PROOF_FAILED') {
        return {
            status: 'MANAGED_SIGNOFF_BLOCKED',
            gaps,
        }
    }

    if (gaps.length > 0 || compatibilityStatus === 'COMPATIBILITY_PROOF_PARTIAL') {
        return {
            status: 'MANAGED_SIGNOFF_PENDING',
            gaps,
        }
    }

    return {
        status: 'MANAGED_SIGNOFF_COMPLETE',
        gaps: [],
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const stagingOutputPath =
        readFlag(args, '--staging-output') || DEFAULT_STAGING_OUTPUT_PATH
    const redisOutputPath =
        readFlag(args, '--redis-output') || DEFAULT_REDIS_OUTPUT_PATH
    const stagingApiOutputPath =
        readFlag(args, '--staging-api-output') || DEFAULT_STAGING_API_OUTPUT_PATH
    const performanceOutputPath =
        readFlag(args, '--performance-output') || DEFAULT_PERFORMANCE_OUTPUT_PATH
    const managedDbProofOutputPath =
        readFlag(args, '--managed-db-proof-output') ||
        DEFAULT_MANAGED_DB_PROOF_OUTPUT_PATH

    const sourceMode =
        readFlag(args, '--source-mode') ||
        process.env.RELEASE_EVIDENCE_SOURCE_MODE ||
        'existing'
    const sourceDbUrl =
        readFlag(args, '--source-db-url') ||
        process.env.RELEASE_EVIDENCE_SOURCE_DB_URL ||
        process.env.DATABASE_URL
    const targetDbUrl =
        readFlag(args, '--target-db-url') || process.env.RELEASE_EVIDENCE_TARGET_DB_URL
    const targetDatabase =
        readFlag(args, '--target-database') ||
        process.env.RELEASE_EVIDENCE_TARGET_DATABASE
    const smokeUserId =
        readFlag(args, '--smoke-user-id') ||
        process.env.RELEASE_EVIDENCE_SMOKE_USER_ID
    const managedRedisUrl =
        readFlag(args, '--managed-redis-url') ||
        process.env.RELEASE_EVIDENCE_MANAGED_REDIS_URL ||
        process.env.REDIS_URL
    const stagingApiUrl =
        readFlag(args, '--staging-api-url') ||
        process.env.RELEASE_EVIDENCE_STAGING_API_URL
    const stagingUserEmail =
        readFlag(args, '--staging-user-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_EMAIL
    const stagingUserPassword =
        readFlag(args, '--staging-user-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_PASSWORD
    const stagingAdminEmail =
        readFlag(args, '--staging-admin-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL
    const stagingAdminPassword =
        readFlag(args, '--staging-admin-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD
    const stagingTimeoutMs =
        readFlag(args, '--staging-timeout-ms') ||
        process.env.RELEASE_EVIDENCE_STAGING_TIMEOUT_MS
    const stagingInsecureTls =
        hasFlag(args, '--staging-insecure-tls') ||
        process.env.RELEASE_EVIDENCE_STAGING_INSECURE_TLS === 'true'
    const managedDbProofArtifactPath =
        readFlag(args, '--managed-db-proof-artifact') ||
        process.env.RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT
    const includePerformanceProof =
        hasFlag(args, '--include-performance-proof') ||
        process.env.RELEASE_EVIDENCE_INCLUDE_PERFORMANCE_PROOF === 'true'
    const performanceScaleUrl =
        readFlag(args, '--performance-scale-url') ||
        process.env.RELEASE_EVIDENCE_PERFORMANCE_SCALE_URL
    const requireManagedSignoff =
        hasFlag(args, '--require-managed-signoff') ||
        process.env.RELEASE_EVIDENCE_REQUIRE_MANAGED_SIGNOFF === 'true'

    const restaurantSlugs = [
        ...readFlags(args, '--restaurant-slug'),
        ...((process.env.RELEASE_EVIDENCE_RESTAURANT_SLUGS || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)),
    ]

    const startedAt = new Date()
    const checks = []

    const managedRedisArgs = [
        '--output',
        redisOutputPath,
        '--timeout-ms',
        '20000',
    ]
    if (managedRedisUrl) {
        managedRedisArgs.push('--redis-url', managedRedisUrl)
    }

    const managedRedisRun = runNodeScript('managed-redis-proof.js', managedRedisArgs)
    checks.push({
        key: 'managedRedis',
        label: 'Managed Redis BullMQ proof',
        required: true,
        status: managedRedisRun.ok ? 'PASSED' : 'FAILED',
        artifactFileName: path.basename(redisOutputPath),
        stdout: managedRedisRun.stdout.trim(),
        stderr: managedRedisRun.stderr.trim(),
        detail:
            managedRedisRun.ok && fs.existsSync(path.resolve(redisOutputPath))
                ? readJsonFile(path.resolve(redisOutputPath))
                : null,
    })

    const stagingRecoveryArgs = [
        '--source-mode',
        sourceMode,
        '--output',
        stagingOutputPath,
    ]

    if (sourceDbUrl) {
        stagingRecoveryArgs.push('--source-db-url', sourceDbUrl)
    }

    if (targetDbUrl) {
        stagingRecoveryArgs.push('--target-db-url', targetDbUrl)
    }

    if (targetDatabase) {
        stagingRecoveryArgs.push('--target-database', targetDatabase)
    }

    if (smokeUserId) {
        stagingRecoveryArgs.push('--smoke-user-id', smokeUserId)
    }

    for (const slug of restaurantSlugs) {
        stagingRecoveryArgs.push('--restaurant-slug', slug)
    }

    const stagingRecoveryRun = runNodeScript(
        'staging-recovery-drill.js',
        stagingRecoveryArgs,
    )
    checks.push({
        key: 'backupRestoreRollback',
        label: 'Staging recovery and rollback proof',
        required: true,
        status: stagingRecoveryRun.ok ? 'PASSED' : 'FAILED',
        artifactFileName: path.basename(stagingOutputPath),
        stdout: stagingRecoveryRun.stdout.trim(),
        stderr: stagingRecoveryRun.stderr.trim(),
        detail:
            stagingRecoveryRun.ok && fs.existsSync(path.resolve(stagingOutputPath))
                ? readJsonFile(path.resolve(stagingOutputPath))
                : null,
    })

    if (stagingApiUrl) {
        const stagingApiArgs = [
            '--base-url',
            stagingApiUrl,
            '--output',
            stagingApiOutputPath,
        ]

        if (stagingTimeoutMs) {
            stagingApiArgs.push('--timeout-ms', String(stagingTimeoutMs))
        }

        if (stagingUserEmail) {
            stagingApiArgs.push('--user-email', stagingUserEmail)
        }

        if (stagingUserPassword) {
            stagingApiArgs.push('--user-password', stagingUserPassword)
        }

        if (stagingAdminEmail) {
            stagingApiArgs.push('--admin-email', stagingAdminEmail)
        }

        if (stagingAdminPassword) {
            stagingApiArgs.push('--admin-password', stagingAdminPassword)
        }

        if (stagingInsecureTls) {
            stagingApiArgs.push('--insecure-tls')
        }

        const stagingApiRun = runNodeScript(
            'staging-api-proof.js',
            stagingApiArgs,
        )
        const stagingApiDetail =
            fs.existsSync(path.resolve(stagingApiOutputPath))
                ? readJsonFile(path.resolve(stagingApiOutputPath))
                : null
        const stagingApiStatus =
            stagingApiRun.ok && stagingApiDetail
                ? mapChildOverallStatusToCheckStatus(
                      stagingApiDetail.overallStatus,
                      'STAGING_PROOF_COMPLETE',
                      'STAGING_PROOF_PARTIAL',
                  )
                : 'FAILED'

        checks.push({
            key: 'stagingApi',
            label: 'Deployed staging API proof',
            required: true,
            status: stagingApiStatus,
            artifactFileName: path.basename(stagingApiOutputPath),
            stdout: stagingApiRun.stdout.trim(),
            stderr: stagingApiRun.stderr.trim(),
            detail: stagingApiDetail,
        })
    } else {
        checks.push({
            key: 'stagingApi',
            label: 'Deployed staging API proof',
            required: false,
            status: 'SKIPPED',
            detail: {
                message:
                    'No staging API URL was supplied. Recovery proof was executed through local app boots against the source and restored databases.',
            },
        })
    }

    if (includePerformanceProof) {
        const performanceArgs = [
            '--output',
            performanceOutputPath,
            '--skip-db-reset',
        ]

        if (performanceScaleUrl) {
            performanceArgs.push('--scale-url', performanceScaleUrl)
        }

        const performanceRun = runNodeScript(
            'performance-proof.js',
            performanceArgs,
        )
        const performanceDetail =
            fs.existsSync(path.resolve(performanceOutputPath))
                ? readJsonFile(path.resolve(performanceOutputPath))
                : null
        const performanceStatus =
            performanceRun.ok && performanceDetail
                ? mapChildOverallStatusToCheckStatus(
                      performanceDetail.overallStatus,
                      'PERFORMANCE_PROOF_COMPLETE',
                      'PERFORMANCE_PROOF_PARTIAL',
                  )
                : 'FAILED'

        checks.push({
            key: 'performanceProof',
            label: 'Local performance and scale proof',
            required: false,
            status: performanceStatus,
            artifactFileName: path.basename(performanceOutputPath),
            stdout: performanceRun.stdout.trim(),
            stderr: performanceRun.stderr.trim(),
            detail: performanceDetail,
        })
    } else {
        checks.push({
            key: 'performanceProof',
            label: 'Local performance and scale proof',
            required: false,
            status: 'SKIPPED',
            detail: {
                message:
                    'Performance proof was not requested. Use --include-performance-proof to aggregate merchant read and worker-pressure evidence.',
            },
        })
    }

    let managedDbProofCheck = null

    if (managedDbProofArtifactPath) {
        const managedDbProofArgs = [
            '--artifact',
            managedDbProofArtifactPath,
            '--output',
            managedDbProofOutputPath,
        ]
        const managedDbProofRun = runNodeScript(
            'managed-db-proof-validate.js',
            managedDbProofArgs,
        )
        const managedDbProofDetail =
            fs.existsSync(path.resolve(managedDbProofOutputPath))
                ? readJsonFile(path.resolve(managedDbProofOutputPath))
                : null
        const managedDbProofStatus =
            managedDbProofRun.ok && managedDbProofDetail
                ? mapChildOverallStatusToCheckStatus(
                      managedDbProofDetail.overallStatus,
                      'MANAGED_DB_PROOF_COMPLETE',
                      'MANAGED_DB_PROOF_PARTIAL',
                  )
                : 'FAILED'

        managedDbProofCheck = {
            key: 'managedDbProof',
            label: 'Provider-managed Postgres backup/PITR proof',
            required: false,
            status: managedDbProofStatus,
            artifactFileName: path.basename(managedDbProofOutputPath),
            stdout: managedDbProofRun.stdout.trim(),
            stderr: managedDbProofRun.stderr.trim(),
            detail: managedDbProofDetail,
        }
        checks.push(managedDbProofCheck)
    } else {
        managedDbProofCheck = {
            key: 'managedDbProof',
            label: 'Provider-managed Postgres backup/PITR proof',
            required: false,
            status: 'SKIPPED',
            detail: {
                message:
                    'No provider-managed Postgres proof artifact was supplied. Managed sign-off remains pending.',
            },
        }
        checks.push(managedDbProofCheck)
    }

    const compatibilityStatus = buildCompatibilityStatus(checks)
    const managedRedisTarget = parseUrlTarget(managedRedisUrl)
    const stagingApiTarget = parseUrlTarget(stagingApiUrl)
    const managedDbProofArtifact = buildManagedDbProofArtifact(
        managedDbProofArtifactPath,
    )
    managedDbProofArtifact.validationStatus = managedDbProofCheck.status
    managedDbProofArtifact.overallStatus =
        managedDbProofCheck.detail?.overallStatus || null
    const managedSignoff = buildManagedSignoffAssessment({
        compatibilityStatus,
        managedRedisTarget,
        stagingApiTarget,
        managedDbProofArtifact,
        managedDbProofCheck,
        checks,
    })
    const finishedAt = new Date()

    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'managed_release_evidence_bundle',
        },
        inputs: {
            sourceMode,
            sourceDatabaseConfigured: Boolean(sourceDbUrl),
            targetDatabaseConfigured: Boolean(targetDbUrl || targetDatabase),
            managedRedisConfigured: Boolean(managedRedisUrl),
            restaurantSlugs,
            stagingApiConfigured: Boolean(stagingApiUrl),
            stagingUserFlowConfigured: Boolean(stagingUserEmail && stagingUserPassword),
            stagingAdminFlowConfigured: Boolean(stagingAdminEmail && stagingAdminPassword),
            managedDbProofArtifactConfigured: Boolean(managedDbProofArtifactPath),
            includePerformanceProof,
            performanceScaleConfigured: Boolean(performanceScaleUrl),
            requireManagedSignoff,
        },
        overallStatus: compatibilityStatus,
        checks,
        targets: {
            managedRedis: managedRedisTarget,
            stagingApi: stagingApiTarget,
            managedDbProofArtifact,
        },
        readiness: {
            localCompatibilityProofStatus: compatibilityStatus,
            managedEnvProofStatus: managedSignoff.status,
            gaps: managedSignoff.gaps,
        },
        notes: [
            'This bundle combines managed Redis BullMQ proof with staging-compatible backup, restore, rollback, and staging API proof.',
            'Provide staging merchant/admin credentials when you want more than health-only remote API proof.',
            'Use --include-performance-proof to attach local merchant-read and worker-pressure evidence to the same release artifact.',
            'Compatibility proof can be complete while managed sign-off is still pending.',
            'Managed sign-off now additionally requires non-loopback Redis and staging API targets plus a provider-managed Postgres backup/PITR proof artifact that validates cleanly.',
        ],
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
                overallStatus: compatibilityStatus,
                managedEnvProofStatus: managedSignoff.status,
                checks: checks.map((check) => ({
                    key: check.key,
                    status: check.status,
                })),
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(`Release evidence report written to ${resolvedOutputPath}\n`)

    if (
        compatibilityStatus === 'COMPATIBILITY_PROOF_FAILED' ||
        (requireManagedSignoff &&
            managedSignoff.status !== 'MANAGED_SIGNOFF_COMPLETE')
    ) {
        process.exitCode = 1
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
}

module.exports = {
    buildCompatibilityStatus,
    buildManagedSignoffAssessment,
    parseUrlTarget,
}
