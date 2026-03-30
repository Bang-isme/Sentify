#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { loadEnvFiles } = require('./load-env-files')
const {
    loginAndReadSession,
    requestJsonWithRetries,
    warmupStagingBaseUrl,
} = require('./staging-proof-helpers')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-api-proof-managed.json',
)

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

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/staging-api-proof.js --base-url <url> [options]',
            '',
            'Options:',
            '  --base-url <url>               Deployed staging API base URL',
            '  --user-email <email>           Optional merchant USER email for authenticated smoke',
            '  --user-password <password>     Optional merchant USER password',
            '  --user-restaurant-id <id>      Optional merchant restaurant id override',
            '  --admin-email <email>          Optional ADMIN email for control-plane smoke',
            '  --admin-password <password>    Optional ADMIN password',
            '  --admin-restaurant-id <id>     Optional admin restaurant id override',
            '  --timeout-ms <ms>              Per-request timeout in milliseconds (default: 90000)',
            '  --insecure-tls                 Disable TLS certificate verification for this probe',
            `  --output <file>                Write JSON report (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --help                         Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_USER_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_USER_RESTAURANT_ID',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_RESTAURANT_ID',
            '  RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
        ].join('\n'),
    )
}

function buildCheck(key, label, status, detail, required = true) {
    return {
        key,
        label,
        status,
        required,
        detail,
    }
}

function buildOverallStatus(checks) {
    if (checks.some((check) => check.required && check.status === 'FAILED')) {
        return 'STAGING_PROOF_FAILED'
    }

    if (checks.some((check) => check.status === 'SKIPPED')) {
        return 'STAGING_PROOF_PARTIAL'
    }

    return 'STAGING_PROOF_COMPLETE'
}

async function runLoginFlow({
    baseUrl,
    email,
    password,
    timeoutMs,
    insecureTls,
}) {
    const auth = await loginAndReadSession({
        baseUrl,
        email,
        password,
        timeoutMs,
        insecureTls,
    })

    if (!auth.passed) {
        return {
            passed: false,
            login: {
                status: auth.loginStatus,
                cookieCount: Object.keys(auth.cookieJar || {}).length,
            },
            session: null,
            cookieNames: auth.cookieNames,
            cookieJar: auth.cookieJar,
        }
    }

    return {
        passed: auth.passed,
        login: {
            status: auth.loginStatus,
            cookieCount: Object.keys(auth.cookieJar || {}).length,
        },
        session: {
            status: auth.sessionStatus,
            role: auth.session?.user?.role ?? null,
            restaurantCount: Array.isArray(auth.session?.user?.restaurants)
                ? auth.session.user.restaurants.length
                : 0,
        },
        cookieJar: auth.cookieJar,
        sessionBody: auth.session ? { data: auth.session } : null,
        cookieNames: auth.cookieNames,
    }
}

async function runMerchantSmoke({
    baseUrl,
    email,
    password,
    restaurantId,
    timeoutMs,
    insecureTls,
}) {
    const auth = await runLoginFlow({
        baseUrl,
        email,
        password,
        timeoutMs,
        insecureTls,
    })

    if (!auth.passed) {
        return {
            passed: false,
            auth,
        }
    }

    const resolvedRestaurantId =
        restaurantId ||
        auth.sessionBody?.data?.user?.restaurants?.[0]?.id ||
        null

    const restaurants = await requestJsonWithRetries(baseUrl, '/api/restaurants', {
        cookieJar: auth.cookieJar,
        timeoutMs,
        insecureTls,
    })
    const detail = resolvedRestaurantId
        ? await requestJsonWithRetries(baseUrl, `/api/restaurants/${resolvedRestaurantId}`, {
              cookieJar: auth.cookieJar,
              timeoutMs,
              insecureTls,
          })
        : null
    const actions = resolvedRestaurantId
        ? await requestJsonWithRetries(
              baseUrl,
              `/api/restaurants/${resolvedRestaurantId}/dashboard/actions`,
              {
                  cookieJar: auth.cookieJar,
                  timeoutMs,
                  insecureTls,
              },
          )
        : null

    const passed =
        auth.session?.role === 'USER' &&
        restaurants.status === 200 &&
        Boolean(resolvedRestaurantId) &&
        detail?.status === 200 &&
        actions?.status === 200

    return {
        passed,
        auth: {
            ...auth,
            cookieJar: undefined,
            sessionBody: undefined,
        },
        restaurantId: resolvedRestaurantId,
        restaurants: {
            status: restaurants.status,
            count: Array.isArray(restaurants.body?.data)
                ? restaurants.body.data.length
                : 0,
        },
        detail: detail
            ? {
                  status: detail.status,
                  entitlementPlanTier:
                      detail.body?.data?.entitlement?.planTier ?? null,
                  sourceSubmissionStatus:
                      detail.body?.data?.sourceSubmission?.status ?? null,
              }
            : null,
        actions: actions
            ? {
                  status: actions.status,
                  summaryState:
                      actions.body?.data?.summary?.state ?? null,
                  actionCardCount: Array.isArray(actions.body?.data?.actionCards)
                      ? actions.body.data.actionCards.length
                      : 0,
                  planTier:
                      actions.body?.data?.entitlement?.planTier ?? null,
              }
            : null,
    }
}

async function runAdminSmoke({
    baseUrl,
    email,
    password,
    restaurantId,
    timeoutMs,
    insecureTls,
}) {
    const auth = await runLoginFlow({
        baseUrl,
        email,
        password,
        timeoutMs,
        insecureTls,
    })

    if (!auth.passed) {
        return {
            passed: false,
            auth,
        }
    }

    const restaurants = await requestJsonWithRetries(baseUrl, '/api/admin/restaurants', {
        cookieJar: auth.cookieJar,
        timeoutMs,
        insecureTls,
    })
    const resolvedRestaurantId =
        restaurantId ||
        restaurants.body?.data?.[0]?.id ||
        null
    const detail = resolvedRestaurantId
        ? await requestJsonWithRetries(baseUrl, `/api/admin/restaurants/${resolvedRestaurantId}`, {
              cookieJar: auth.cookieJar,
              timeoutMs,
              insecureTls,
          })
        : null
    const sourceSubmissionQueue = await requestJsonWithRetries(
        baseUrl,
        '/api/admin/restaurants/source-submissions',
        {
            cookieJar: auth.cookieJar,
            timeoutMs,
            insecureTls,
        },
    )

    const passed =
        auth.session?.role === 'ADMIN' &&
        restaurants.status === 200 &&
        Boolean(resolvedRestaurantId) &&
        detail?.status === 200 &&
        sourceSubmissionQueue.status === 200

    return {
        passed,
        auth: {
            ...auth,
            cookieJar: undefined,
            sessionBody: undefined,
        },
        restaurantId: resolvedRestaurantId,
        restaurants: {
            status: restaurants.status,
            count: Array.isArray(restaurants.body?.data)
                ? restaurants.body.data.length
                : 0,
        },
        detail: detail
            ? {
                  status: detail.status,
                  memberCount:
                      detail.body?.data?.restaurant?.memberCount ?? null,
                  planTier:
                      detail.body?.data?.restaurant?.entitlement?.planTier ?? null,
              }
            : null,
        sourceSubmissionQueue: {
            status: sourceSubmissionQueue.status,
            groupCount: Array.isArray(sourceSubmissionQueue.body?.data?.groups)
                ? sourceSubmissionQueue.body.data.groups.length
                : 0,
        },
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const baseUrl =
        readFlag(args, '--base-url') ||
        process.env.RELEASE_EVIDENCE_STAGING_API_URL

    if (!baseUrl) {
        throw new Error(
            'A base URL is required via --base-url or RELEASE_EVIDENCE_STAGING_API_URL',
        )
    }

    const timeoutMs =
        Number.parseInt(readFlag(args, '--timeout-ms') || '', 10) ||
        Number.parseInt(process.env.RELEASE_EVIDENCE_STAGING_TIMEOUT_MS || '', 10) ||
        90000
    const insecureTls =
        hasFlag(args, '--insecure-tls') ||
        process.env.RELEASE_EVIDENCE_STAGING_INSECURE_TLS === 'true'
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH

    const userEmail =
        readFlag(args, '--user-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_EMAIL
    const userPassword =
        readFlag(args, '--user-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_PASSWORD
    const userRestaurantId =
        readFlag(args, '--user-restaurant-id') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_RESTAURANT_ID

    const adminEmail =
        readFlag(args, '--admin-email') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL
    const adminPassword =
        readFlag(args, '--admin-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD
    const adminRestaurantId =
        readFlag(args, '--admin-restaurant-id') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_RESTAURANT_ID

    const startedAt = new Date()
    const checks = []

    await warmupStagingBaseUrl(baseUrl, {
        timeoutMs,
        insecureTls,
        retryAttempts: 3,
        retryDelayMs: 2000,
    })

    const health = await requestJsonWithRetries(baseUrl, '/health', {
        timeoutMs,
        insecureTls,
        retryAttempts: 4,
        retryDelayMs: 3000,
    })
    const apiHealth = await requestJsonWithRetries(baseUrl, '/api/health', {
        timeoutMs,
        insecureTls,
        retryAttempts: 4,
        retryDelayMs: 3000,
    })

    checks.push(
        buildCheck(
            'health',
            'Root health endpoint',
            health.status === 200 ? 'PASSED' : 'FAILED',
            {
                status: health.status,
                body: health.body,
            },
        ),
        buildCheck(
            'apiHealth',
            'API health endpoint',
            apiHealth.status === 200 ? 'PASSED' : 'FAILED',
            {
                status: apiHealth.status,
                body: apiHealth.body,
            },
        ),
    )

    if (userEmail && userPassword) {
        try {
            const merchantSmoke = await runMerchantSmoke({
                baseUrl,
                email: userEmail,
                password: userPassword,
                restaurantId: userRestaurantId,
                timeoutMs,
                insecureTls,
            })

            checks.push(
                buildCheck(
                    'merchantUserFlow',
                    'Merchant authenticated read smoke',
                    merchantSmoke.passed ? 'PASSED' : 'FAILED',
                    merchantSmoke,
                ),
            )
        } catch (error) {
            checks.push(
                buildCheck(
                    'merchantUserFlow',
                    'Merchant authenticated read smoke',
                    'FAILED',
                    {
                        message: error instanceof Error ? error.message : String(error),
                    },
                ),
            )
        }
    } else {
        checks.push(
            buildCheck(
                'merchantUserFlow',
                'Merchant authenticated read smoke',
                'SKIPPED',
                {
                    message:
                        'Merchant USER credentials were not supplied; only health endpoints were probed.',
                },
                false,
            ),
        )
    }

    if (adminEmail && adminPassword) {
        try {
            const adminSmoke = await runAdminSmoke({
                baseUrl,
                email: adminEmail,
                password: adminPassword,
                restaurantId: adminRestaurantId,
                timeoutMs,
                insecureTls,
            })

            checks.push(
                buildCheck(
                    'adminControlPlaneFlow',
                    'Admin authenticated control-plane smoke',
                    adminSmoke.passed ? 'PASSED' : 'FAILED',
                    adminSmoke,
                ),
            )
        } catch (error) {
            checks.push(
                buildCheck(
                    'adminControlPlaneFlow',
                    'Admin authenticated control-plane smoke',
                    'FAILED',
                    {
                        message: error instanceof Error ? error.message : String(error),
                    },
                ),
            )
        }
    } else {
        checks.push(
            buildCheck(
                'adminControlPlaneFlow',
                'Admin authenticated control-plane smoke',
                'SKIPPED',
                {
                    message:
                        'Admin credentials were not supplied; only health and optional merchant smoke were probed.',
                },
                false,
            ),
        )
    }

    const finishedAt = new Date()
    const overallStatus = buildOverallStatus(checks)
    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'staging_api_proof',
        },
        configuration: {
            baseUrl,
            timeoutMs,
            insecureTls,
            merchantFlowRequested: Boolean(userEmail && userPassword),
            adminFlowRequested: Boolean(adminEmail && adminPassword),
        },
        overallStatus,
        checks,
        notes: [
            'This proof validates staging API health plus optional authenticated merchant and admin read flows.',
            'Provide both merchant and admin credentials when you want more than health-only proof.',
            'The default timeout is intentionally higher on hosted free-tier staging so cold starts do not look like contract failures.',
            'Use --insecure-tls only for controlled staging environments with self-signed certificates.',
        ],
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
    )

    process.stdout.write(
        `${JSON.stringify(
            {
                overallStatus,
                checks: checks.map((check) => ({
                    key: check.key,
                    status: check.status,
                })),
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(`Staging API proof report written to ${resolvedOutputPath}\n`)

    if (overallStatus === 'STAGING_PROOF_FAILED') {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exitCode = 1
})
