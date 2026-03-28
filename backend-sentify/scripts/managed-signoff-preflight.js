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
    'managed-signoff-preflight.json',
)
const DEFAULT_DB_VALIDATION_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-db-proof-validation-preflight.json',
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

function hasFlag(args, name) {
    return args.includes(name)
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/managed-signoff-preflight.js [options]',
            '',
            'Options:',
            '  --managed-redis-url <url>       Managed Redis URL override',
            '  --staging-api-url <url>         Deployed staging API URL override',
            '  --staging-user-email <email>    Merchant staging email override',
            '  --staging-user-password <pwd>   Merchant staging password override',
            '  --staging-admin-email <email>   Admin staging email override',
            '  --staging-admin-password <pwd>  Admin staging password override',
            '  --managed-db-proof-artifact <file> Provider-managed DB proof artifact',
            '  --managed-db-proof-output <file>  DB proof validation output path',
            '  --require-ready                 Exit non-zero unless managed sign-off inputs are ready',
            '  --output <file>                 Write preflight JSON report',
            '  --help                          Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_MANAGED_REDIS_URL',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_USER_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            '  RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT',
            '  RELEASE_EVIDENCE_REQUIRE_MANAGED_SIGNOFF',
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

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0
}

function parseUrlTarget(value) {
    if (!value) {
        return {
            configured: false,
            scope: 'UNCONFIGURED',
            hostname: null,
            url: null,
        }
    }

    try {
        const parsed = new URL(value)
        const hostname = parsed.hostname || null

        return {
            configured: true,
            scope: LOOPBACK_HOSTS.has(hostname) ? 'LOCAL' : 'EXTERNAL',
            hostname,
            url: value,
        }
    } catch (_error) {
        return {
            configured: true,
            scope: 'UNKNOWN',
            hostname: null,
            url: value,
        }
    }
}

function validateCredentialPair(email, password) {
    return {
        configured: isNonEmptyString(email) && isNonEmptyString(password),
        emailConfigured: isNonEmptyString(email),
        passwordConfigured: isNonEmptyString(password),
    }
}

function runDbProofValidator({ artifactPath, outputPath }) {
    if (!artifactPath) {
        return {
            status: 'SKIPPED',
            detail: {
                message: 'No provider-managed DB proof artifact was supplied.',
            },
        }
    }

    const scriptPath = path.resolve(__dirname, 'managed-db-proof-validate.js')
    const child = spawnSync(
        process.execPath,
        [scriptPath, '--artifact', artifactPath, '--output', outputPath],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
            env: process.env,
            windowsHide: true,
        },
    )

    const resolvedOutputPath = path.resolve(outputPath)
    const detail = fs.existsSync(resolvedOutputPath)
        ? JSON.parse(fs.readFileSync(resolvedOutputPath, 'utf8'))
        : null

    return {
        status:
            !child.error && (child.status ?? 1) === 0 && detail?.overallStatus === 'MANAGED_DB_PROOF_COMPLETE'
                ? 'PASSED'
                : 'FAILED',
        stdout: child.stdout || '',
        stderr: child.stderr || '',
        detail,
    }
}

function buildNextSteps({
    managedRedisTarget,
    stagingApiTarget,
    merchantAuth,
    adminAuth,
    managedDbProof,
    managedDbProofArtifact,
}) {
    const nextSteps = []

    if (!managedRedisTarget.configured) {
        nextSteps.push({
            key: 'managedRedis',
            envKeys: ['RELEASE_EVIDENCE_MANAGED_REDIS_URL'],
            title: 'Fill the managed Redis connection URL',
            action:
                'Open your Redis managed provider Connect or Endpoint page and paste only the redis:// or rediss:// URL into .env.release-evidence.',
        })
    } else if (managedRedisTarget.scope !== 'EXTERNAL') {
        nextSteps.push({
            key: 'managedRedis',
            envKeys: ['RELEASE_EVIDENCE_MANAGED_REDIS_URL'],
            title: 'Switch Redis proof target to a real managed endpoint',
            action:
                'Replace the local Redis URL with the same managed Redis connection string your staging deployment should use.',
        })
    }

    if (!stagingApiTarget.configured) {
        nextSteps.push({
            key: 'stagingApi',
            envKeys: ['RELEASE_EVIDENCE_STAGING_API_URL'],
            title: 'Fill the deployed staging API base URL',
            action:
                'Use the public backend staging URL from your deploy platform. It must answer /health and /api/health.',
        })
    } else if (stagingApiTarget.scope !== 'EXTERNAL') {
        nextSteps.push({
            key: 'stagingApi',
            envKeys: ['RELEASE_EVIDENCE_STAGING_API_URL'],
            title: 'Switch staging API proof target to a deployed endpoint',
            action:
                'Replace the local staging API URL with the real deployed staging API base URL.',
        })
    }

    if (!merchantAuth.configured) {
        nextSteps.push({
            key: 'merchantAuth',
            envKeys: [
                'RELEASE_EVIDENCE_STAGING_USER_EMAIL',
                'RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
            ],
            title: 'Create or retrieve a staging merchant test account',
            action:
                'Use a dedicated merchant test account on staging and record its email and password in .env.release-evidence.',
        })
    }

    if (!adminAuth.configured) {
        nextSteps.push({
            key: 'adminAuth',
            envKeys: [
                'RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
                'RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            ],
            title: 'Create or retrieve a staging admin test account',
            action:
                'Use a dedicated admin test account on staging and record its email and password in .env.release-evidence.',
        })
    }

    if (managedDbProof.status !== 'PASSED') {
        nextSteps.push({
            key: 'managedDbProof',
            envKeys: ['RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT'],
            title: 'Attach a managed Postgres backup or PITR proof artifact',
            action: managedDbProofArtifact
                ? 'Run a real managed Postgres restore or PITR drill, then update the JSON artifact to match docs/examples/managed-db-proof-artifact.example.json and point RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT to it.'
                : 'Run a real managed Postgres restore or PITR drill, save the proof JSON using docs/examples/managed-db-proof-artifact.example.json as the shape reference, and point RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT to that file.',
        })
    }

    return nextSteps
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const managedRedisUrl =
        readFlag(args, '--managed-redis-url') ||
        process.env.RELEASE_EVIDENCE_MANAGED_REDIS_URL ||
        null
    const stagingApiUrl =
        readFlag(args, '--staging-api-url') ||
        process.env.RELEASE_EVIDENCE_STAGING_API_URL ||
        null
    const stagingUserEmail =
        readFlag(args, '--staging-user-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_EMAIL ||
        null
    const stagingUserPassword =
        readFlag(args, '--staging-user-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_PASSWORD ||
        null
    const stagingAdminEmail =
        readFlag(args, '--staging-admin-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL ||
        null
    const stagingAdminPassword =
        readFlag(args, '--staging-admin-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD ||
        null
    const managedDbProofArtifact =
        readFlag(args, '--managed-db-proof-artifact') ||
        process.env.RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT ||
        null
    const managedDbProofOutput =
        readFlag(args, '--managed-db-proof-output') ||
        DEFAULT_DB_VALIDATION_OUTPUT_PATH
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const requireReady =
        hasFlag(args, '--require-ready') ||
        process.env.RELEASE_EVIDENCE_REQUIRE_MANAGED_SIGNOFF === 'true'

    const startedAt = new Date()

    const managedRedisTarget = parseUrlTarget(managedRedisUrl)
    const stagingApiTarget = parseUrlTarget(stagingApiUrl)
    const merchantAuth = validateCredentialPair(
        stagingUserEmail,
        stagingUserPassword,
    )
    const adminAuth = validateCredentialPair(
        stagingAdminEmail,
        stagingAdminPassword,
    )
    const managedDbProof = runDbProofValidator({
        artifactPath: managedDbProofArtifact,
        outputPath: managedDbProofOutput,
    })

    const blockers = []

    if (!managedRedisTarget.configured) {
        blockers.push('Managed Redis URL is missing')
    } else if (managedRedisTarget.scope !== 'EXTERNAL') {
        blockers.push(`Managed Redis target is ${managedRedisTarget.scope.toLowerCase()}`)
    }

    if (!stagingApiTarget.configured) {
        blockers.push('Staging API URL is missing')
    } else if (stagingApiTarget.scope !== 'EXTERNAL') {
        blockers.push(`Staging API target is ${stagingApiTarget.scope.toLowerCase()}`)
    }

    if (!merchantAuth.configured) {
        blockers.push('Merchant staging credentials are incomplete')
    }

    if (!adminAuth.configured) {
        blockers.push('Admin staging credentials are incomplete')
    }

    if (managedDbProof.status !== 'PASSED') {
        blockers.push('Provider-managed DB proof artifact did not validate cleanly')
    }

    const nextSteps = buildNextSteps({
        managedRedisTarget,
        stagingApiTarget,
        merchantAuth,
        adminAuth,
        managedDbProof,
        managedDbProofArtifact,
    })

    const finishedAt = new Date()
    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'managed_signoff_preflight',
        },
        targets: {
            managedRedis: managedRedisTarget,
            stagingApi: stagingApiTarget,
        },
        credentials: {
            merchantAuth,
            adminAuth,
        },
        managedDbProofArtifact: {
            provided: Boolean(managedDbProofArtifact),
            path: managedDbProofArtifact
                ? path.resolve(managedDbProofArtifact)
                : null,
            validationStatus: managedDbProof.status,
            detail: managedDbProof.detail,
        },
        readiness: {
            status:
                blockers.length === 0
                    ? 'MANAGED_SIGNOFF_READY'
                    : 'MANAGED_SIGNOFF_PENDING',
            blockers,
        },
        nextSteps,
        notes: [
            'This preflight is intentionally fast and does not execute Redis, staging API, or database restore work.',
            'Use it to confirm whether the inputs required for strict managed sign-off are present before running the heavy release-evidence bundle.',
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
                readiness: report.readiness.status,
                blockers: report.readiness.blockers,
                nextSteps: report.nextSteps.map((step) => ({
                    key: step.key,
                    envKeys: step.envKeys,
                    title: step.title,
                })),
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(
        `Managed sign-off preflight report written to ${resolvedOutputPath}\n`,
    )

    if (requireReady && report.readiness.status !== 'MANAGED_SIGNOFF_READY') {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exitCode = 1
})
