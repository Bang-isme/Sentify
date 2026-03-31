#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { loadEnvFiles } = require('./load-env-files')
const {
    loginAndReadSession,
    requestJsonWithRetries,
} = require('./staging-proof-helpers')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-review-ops-proof-managed.json',
)

const ACTIVE_RUN_STATUSES = new Set(['QUEUED', 'RUNNING'])
const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'])
const SETTLED_QUEUE_JOB_STATES = new Set(['completed', 'failed', 'unknown'])

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

function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

function round(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null
    }

    const factor = 10 ** digits
    return Math.round(value * factor) / factor
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/staging-review-ops-proof.js [options]',
            '',
            'Options:',
            '  --base-url <url>                Deployed staging API base URL',
            '  --admin-email <email>           ADMIN email for operator proof',
            '  --admin-password <password>     ADMIN password for operator proof',
            '  --restaurant-id <id>            Optional restaurant id override',
            '  --restaurant-slug <slug>        Optional restaurant slug override',
            '  --source-id <id>                Optional source id override',
            '  --url <google-maps-url>         Optional source URL override',
            '  --allow-url-bootstrap           Fall back to sync-to-draft URL bootstrap when no seeded source exists',
            '  --strategy <value>              Default: INCREMENTAL',
            '  --priority <value>              Default: NORMAL',
            '  --language <code>               Default: en',
            '  --region <code>                 Default: us',
            '  --page-size <n>                 Default: 10',
            '  --max-pages <n>                 Default: 3',
            '  --max-reviews <n>               Default: 60',
            '  --delay-ms <n>                  Default: 0',
            '  --poll-ms <ms>                  Default: 1000',
            '  --settle-ms <ms>                Default: 5000',
            '  --timeout-ms <ms>               Default: 600000',
            '  --max-total-wallclock-ms <ms>   Default: 300000',
            '  --min-extracted-count <n>       Default: 1',
            '  --insecure-tls                  Disable TLS verification',
            `  --output <file>                 Write JSON report (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --help                          Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_RESTAURANT_ID',
            '  RELEASE_EVIDENCE_RESTAURANT_SLUGS',
            '  RELEASE_EVIDENCE_STAGING_TIMEOUT_MS',
            '  RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
        ].join('\n'),
    )
}

function selectRestaurant(restaurants, selection = {}) {
    const restaurantId = selection.restaurantId ?? null
    const restaurantSlug = selection.restaurantSlug ?? null

    if (restaurantId) {
        return restaurants.find((restaurant) => restaurant.id === restaurantId) || null
    }

    if (restaurantSlug) {
        return restaurants.find((restaurant) => restaurant.slug === restaurantSlug) || null
    }

    return restaurants[0] || null
}

function selectProofSource(sources, selection = {}) {
    const sourceId = selection.sourceId ?? null
    const sourceUrl = selection.sourceUrl ?? null

    if (sourceId) {
        return sources.find((source) => source.id === sourceId) || null
    }

    if (sourceUrl) {
        const exactMatch = sources.find((source) => source.inputUrl === sourceUrl)
        if (exactMatch) {
            return exactMatch
        }
    }

    const eligibleSources = sources.filter(
        (source) =>
            source.status === 'ACTIVE' &&
            source.inputUrl &&
            !ACTIVE_RUN_STATUSES.has(source.latestRun?.status || ''),
    )

    if (eligibleSources.length > 0) {
        return eligibleSources[0]
    }

    return (
        sources.find((source) => source.status === 'ACTIVE' && source.inputUrl) || null
    )
}

function snapshotRunState(runDetail) {
    return {
        status: runDetail.run?.status ?? null,
        updatedAt: runDetail.run?.updatedAt ?? null,
        extractedCount: runDetail.run?.extractedCount ?? null,
        validCount: runDetail.run?.validCount ?? null,
        pagesFetched: runDetail.run?.pagesFetched ?? null,
        intakeBatchId:
            runDetail.run?.intakeBatch?.id ?? runDetail.run?.intakeBatchId ?? null,
        queueJobState: runDetail.queueJob?.state ?? null,
    }
}

function isStableTerminalRun(runDetail) {
    if (!TERMINAL_RUN_STATUSES.has(runDetail.run?.status)) {
        return false
    }

    const queueJobState = runDetail.queueJob?.state
    return queueJobState === null || SETTLED_QUEUE_JOB_STATES.has(queueJobState)
}

async function waitForStableTerminalRun({
    baseUrl,
    runId,
    cookieJar,
    timeoutMs,
    pollMs,
    settleMs,
    insecureTls,
}) {
    const startedAt = Date.now()
    let pollCount = 0
    let lastStableSnapshot = null
    let lastStableSeenAt = 0

    while (Date.now() - startedAt < timeoutMs) {
        const response = await requestJsonWithRetries(baseUrl, `/api/admin/review-ops/runs/${runId}`, {
            cookieJar,
            timeoutMs,
            insecureTls,
        })

        pollCount += 1

        if (response.status !== 200 || !response.body?.data) {
            throw new Error(
                `Review-ops run detail failed with status ${response.status}`,
            )
        }

        const runDetail = response.body.data

        if (!isStableTerminalRun(runDetail)) {
            lastStableSnapshot = null
            lastStableSeenAt = 0
            await sleep(pollMs)
            continue
        }

        const currentSnapshot = snapshotRunState(runDetail)

        if (
            lastStableSnapshot &&
            JSON.stringify(lastStableSnapshot) === JSON.stringify(currentSnapshot)
        ) {
            if (Date.now() - lastStableSeenAt >= settleMs) {
                return {
                    runDetail,
                    pollCount,
                    totalWallClockMs: Date.now() - startedAt,
                    terminalSnapshot: currentSnapshot,
                }
            }
        } else {
            lastStableSnapshot = currentSnapshot
            lastStableSeenAt = Date.now()
        }

        await sleep(pollMs)
    }

    throw new Error(
        `Timed out waiting for review-ops run ${runId} to settle after ${timeoutMs}ms`,
    )
}

function evaluateReviewOpsProof(result, thresholds) {
    const status = result.run?.status ?? null
    const intakeBatchId =
        result.run?.intakeBatch?.id ??
        result.run?.intakeBatchId ??
        result.batch?.id ??
        result.batchReadiness?.batch?.id ??
        null
    const extractedCount = result.run?.extractedCount ?? 0
    const rawReviewsPerSecond =
        result.totalWallClockMs > 0
            ? round(extractedCount / (result.totalWallClockMs / 1000), 2)
            : null
    const reusedActiveRun = Boolean(result.draftPolicy?.reusedActiveRun)
    const passed =
        !reusedActiveRun &&
        ['COMPLETED', 'PARTIAL'].includes(status) &&
        Boolean(intakeBatchId) &&
        result.totalWallClockMs <= thresholds.maxTotalWallClockMs &&
        extractedCount >= thresholds.minExtractedCount

    return {
        passed,
        observed: {
            status,
            intakeBatchId,
            extractedCount,
            validCount: result.run?.validCount ?? null,
            pagesFetched: result.run?.pagesFetched ?? null,
            totalWallClockMs: result.totalWallClockMs,
            rawReviewsPerSecond,
            reusedActiveRun,
            queueJobState: result.queueJob?.state ?? null,
            crawlCoveragePolicyCode:
                result.run?.crawlCoverage?.operatorPolicy?.code ?? null,
        },
        thresholds,
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const baseUrl =
        readFlag(args, '--base-url') || process.env.RELEASE_EVIDENCE_STAGING_API_URL
    const adminEmail =
        readFlag(args, '--admin-email') || process.env.RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL
    const adminPassword =
        readFlag(args, '--admin-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD
    const restaurantId =
        readFlag(args, '--restaurant-id') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_RESTAURANT_ID
    const restaurantSlug =
        readFlag(args, '--restaurant-slug') ||
        (process.env.RELEASE_EVIDENCE_RESTAURANT_SLUGS || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)[0] ||
        null
    const sourceId = readFlag(args, '--source-id')
    const sourceUrl = readFlag(args, '--url')
    const allowUrlBootstrap = hasFlag(args, '--allow-url-bootstrap')
    const requestTimeoutMs = parsePositiveInt(
        readFlag(args, '--timeout-ms') || process.env.RELEASE_EVIDENCE_STAGING_TIMEOUT_MS,
        600000,
    )
    const pollMs = parsePositiveInt(readFlag(args, '--poll-ms'), 1000)
    const settleMs = parsePositiveInt(readFlag(args, '--settle-ms'), 5000)
    const thresholds = {
        maxTotalWallClockMs: parsePositiveInt(
            readFlag(args, '--max-total-wallclock-ms'),
            300000,
        ),
        minExtractedCount: parsePositiveInt(readFlag(args, '--min-extracted-count'), 1),
    }
    const runSettleTimeoutMs = Math.max(
        requestTimeoutMs,
        thresholds.maxTotalWallClockMs + settleMs,
    )
    const insecureTls =
        hasFlag(args, '--insecure-tls') ||
        process.env.RELEASE_EVIDENCE_STAGING_INSECURE_TLS === 'true'
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH

    if (!baseUrl) {
        throw new Error('Staging base URL is required')
    }

    if (!adminEmail || !adminPassword) {
        throw new Error('Admin staging credentials are required')
    }

    const auth = await loginAndReadSession({
        baseUrl,
        email: adminEmail,
        password: adminPassword,
        timeoutMs: requestTimeoutMs,
        insecureTls,
    })

    if (!auth.passed) {
        throw new Error(`Admin staging login failed with status ${auth.loginStatus}`)
    }

    const restaurantsResponse = await requestJsonWithRetries(baseUrl, '/api/admin/restaurants', {
        cookieJar: auth.cookieJar,
        timeoutMs: requestTimeoutMs,
        insecureTls,
    })

    if (restaurantsResponse.status !== 200 || !Array.isArray(restaurantsResponse.body?.data)) {
        throw new Error(
            `Admin restaurant list failed with status ${restaurantsResponse.status}`,
        )
    }

    const allRestaurants = restaurantsResponse.body.data
    const fetchSourcesForRestaurant = async (candidateRestaurant) => {
        const response = await requestJsonWithRetries(
            baseUrl,
            `/api/admin/review-ops/sources?restaurantId=${encodeURIComponent(candidateRestaurant.id)}`,
            {
                cookieJar: auth.cookieJar,
                timeoutMs: requestTimeoutMs,
                insecureTls,
            },
        )

        if (
            response.status !== 200 ||
            !Array.isArray(response.body?.data?.sources)
        ) {
            throw new Error(
                `Review-ops source list failed with status ${response.status}`,
            )
        }

        return response.body.data.sources
    }

    let restaurant = selectRestaurant(allRestaurants, {
        restaurantId,
        restaurantSlug,
    })
    let availableSources = null
    let proofSource = null

    if (!restaurant) {
        throw new Error(
            restaurantId || restaurantSlug
                ? 'Target restaurant was not found in admin restaurant list'
                : 'No admin-visible restaurant was available for review-ops proof',
        )
    }

    if (restaurantId || restaurantSlug) {
        availableSources = await fetchSourcesForRestaurant(restaurant)
        proofSource = selectProofSource(availableSources, {
            sourceId,
            sourceUrl,
        })
    } else {
        for (const candidateRestaurant of allRestaurants) {
            const candidateSources = await fetchSourcesForRestaurant(candidateRestaurant)
            const candidateProofSource = selectProofSource(candidateSources, {
                sourceId,
                sourceUrl,
            })

            if (candidateProofSource) {
                restaurant = candidateRestaurant
                availableSources = candidateSources
                proofSource = candidateProofSource
                break
            }

            if (!availableSources) {
                availableSources = candidateSources
                restaurant = candidateRestaurant
            }
        }

        if (!availableSources) {
            availableSources = await fetchSourcesForRestaurant(restaurant)
        }
    }

    const effectiveSourceUrl =
        sourceUrl || proofSource?.inputUrl || restaurant.googleMapUrl || null
    const bootstrapRequired = !proofSource

    if (bootstrapRequired && (!allowUrlBootstrap || !effectiveSourceUrl)) {
        throw new Error(
            'No seeded active crawl source was available for external review-ops proof. Re-run with --allow-url-bootstrap only when you intentionally want Google-dependent source creation in the proof path.',
        )
    }

    const runPayload = {
        strategy: (readFlag(args, '--strategy') || 'INCREMENTAL').toUpperCase(),
        priority: (readFlag(args, '--priority') || 'NORMAL').toUpperCase(),
        pageSize: parsePositiveInt(readFlag(args, '--page-size'), 10),
        maxPages: parsePositiveInt(readFlag(args, '--max-pages'), 3),
        maxReviews: parsePositiveInt(readFlag(args, '--max-reviews'), 60),
        delayMs: parsePositiveInt(readFlag(args, '--delay-ms'), 0),
    }

    const triggerStartedAt = Date.now()
    let proofMode = 'direct-source-run'
    let triggerResult = null

    if (bootstrapRequired) {
        proofMode = 'url-bootstrap-sync-to-draft'

        const syncPayload = {
            restaurantId: restaurant.id,
            url: effectiveSourceUrl,
            language: readFlag(args, '--language') || 'en',
            region: readFlag(args, '--region') || 'us',
            ...runPayload,
        }
        const syncResponse = await requestJsonWithRetries(
            baseUrl,
            '/api/admin/review-ops/google-maps/sync-to-draft',
            {
                method: 'POST',
                body: syncPayload,
                cookieJar: auth.cookieJar,
                timeoutMs: requestTimeoutMs,
                insecureTls,
            },
        )

        if (syncResponse.status !== 202 || !syncResponse.body?.data) {
            throw new Error(
                `Review-ops sync-to-draft failed with status ${syncResponse.status}: ${JSON.stringify(syncResponse.body)}`,
            )
        }

        triggerResult = {
            request: syncPayload,
            source: syncResponse.body.data.source,
            run: syncResponse.body.data.run,
            draftPolicy: syncResponse.body.data.draftPolicy,
            acceptedWallClockMs: Date.now() - triggerStartedAt,
        }
    } else {
        const createRunResponse = await requestJsonWithRetries(
            baseUrl,
            `/api/admin/review-crawl/sources/${proofSource.id}/runs`,
            {
                method: 'POST',
                body: runPayload,
                cookieJar: auth.cookieJar,
                timeoutMs: requestTimeoutMs,
                insecureTls,
            },
        )

        if (createRunResponse.status === 409) {
            const refreshedSources = await fetchSourcesForRestaurant(restaurant)
            const refreshedSource =
                refreshedSources.find((source) => source.id === proofSource.id) || proofSource
            const activeRun = refreshedSource.latestRun

            if (!ACTIVE_RUN_STATUSES.has(activeRun?.status || '') || !activeRun?.id) {
                throw new Error(
                    `Review-crawl create-run returned 409 without a reusable active run: ${JSON.stringify(createRunResponse.body)}`,
                )
            }

            triggerResult = {
                request: runPayload,
                source: refreshedSource,
                run: activeRun,
                draftPolicy: {
                    reusedActiveRun: true,
                    reason: createRunResponse.body?.error?.code || 'REVIEW_CRAWL_RUN_ALREADY_ACTIVE',
                },
                acceptedWallClockMs: Date.now() - triggerStartedAt,
                triggerConflict: createRunResponse.body ?? null,
            }
        } else if (createRunResponse.status !== 202 || !createRunResponse.body?.data) {
            throw new Error(
                `Review-crawl create-run failed with status ${createRunResponse.status}: ${JSON.stringify(createRunResponse.body)}`,
            )
        } else {
            triggerResult = {
                request: runPayload,
                source: proofSource,
                run: createRunResponse.body.data,
                draftPolicy: null,
                acceptedWallClockMs: Date.now() - triggerStartedAt,
                triggerConflict: null,
            }
        }
    }

    const terminalResult = await waitForStableTerminalRun({
        baseUrl,
        runId: triggerResult.run.id,
        cookieJar: auth.cookieJar,
        timeoutMs: runSettleTimeoutMs,
        pollMs,
        settleMs,
        insecureTls,
    })

    let batchId =
        terminalResult.runDetail.run?.intakeBatch?.id ??
        terminalResult.runDetail.run?.intakeBatchId ??
        null
    let materialization = null

    if (!batchId && ['COMPLETED', 'PARTIAL'].includes(terminalResult.runDetail.run?.status)) {
        const materializeResponse = await requestJsonWithRetries(
            baseUrl,
            `/api/admin/review-crawl/runs/${terminalResult.runDetail.run.id}/materialize-intake`,
            {
                method: 'POST',
                cookieJar: auth.cookieJar,
                timeoutMs: requestTimeoutMs,
                insecureTls,
            },
        )

        if (materializeResponse.status !== 200 || !materializeResponse.body?.data) {
            throw new Error(
                `Review-crawl materialize-intake failed with status ${materializeResponse.status}: ${JSON.stringify(materializeResponse.body)}`,
            )
        }

        materialization = materializeResponse.body.data
        batchId =
            materialization.run?.intakeBatch?.id ??
            materialization.run?.intakeBatchId ??
            materialization.batch?.id ??
            batchId
    }

    let batchReadiness = null

    if (batchId) {
        const batchReadinessResponse = await requestJsonWithRetries(
            baseUrl,
            `/api/admin/review-ops/batches/${batchId}/readiness`,
            {
                cookieJar: auth.cookieJar,
                timeoutMs: requestTimeoutMs,
                insecureTls,
            },
        )

        if (batchReadinessResponse.status === 200) {
            batchReadiness = batchReadinessResponse.body?.data ?? null
        }
    }

    const evaluation = evaluateReviewOpsProof(
        {
            run: materialization?.run ?? terminalResult.runDetail.run,
            batch: materialization?.batch ?? null,
            batchReadiness,
            queueJob: terminalResult.runDetail.queueJob,
            totalWallClockMs: terminalResult.totalWallClockMs,
            draftPolicy: triggerResult.draftPolicy,
        },
        thresholds,
    )

    const report = {
        generatedAt: new Date().toISOString(),
        target: {
            baseUrl,
            restaurantId: restaurant.id,
            restaurantSlug: restaurant.slug ?? null,
            sourceId: proofSource?.id ?? null,
            proofMode,
        },
        authentication: {
            adminEmail,
            loginStatus: auth.loginStatus,
            sessionStatus: auth.sessionStatus,
            cookieNames: auth.cookieNames,
        },
        configuration: {
            requestTimeoutMs,
            runSettleTimeoutMs,
            pollMs,
            settleMs,
            thresholds,
            allowUrlBootstrap,
            request: triggerResult.request,
        },
        sourceSelection: {
            requestedSourceId: sourceId || null,
            requestedSourceUrl: sourceUrl || null,
            selectedSource: proofSource
                ? {
                      id: proofSource.id,
                      status: proofSource.status,
                      inputUrl: proofSource.inputUrl,
                      latestRunStatus: proofSource.latestRun?.status ?? null,
                      openDraftBatchId: proofSource.openDraftBatch?.id ?? null,
                  }
                : null,
            fallbackRestaurantGoogleMapUrl: restaurant.googleMapUrl ?? null,
            effectiveSourceUrl,
        },
        triggerResult: {
            source: triggerResult.source,
            run: triggerResult.run,
            draftPolicy: triggerResult.draftPolicy,
            acceptedWallClockMs: triggerResult.acceptedWallClockMs,
            triggerConflict: triggerResult.triggerConflict ?? null,
        },
        terminalResult: {
            run: terminalResult.runDetail.run,
            queueJob: terminalResult.runDetail.queueJob,
            totalWallClockMs: terminalResult.totalWallClockMs,
            pollCount: terminalResult.pollCount,
            terminalSnapshot: terminalResult.terminalSnapshot,
        },
        materialization,
        batchReadiness,
        evaluation,
        overallStatus: evaluation.passed
            ? 'STAGING_REVIEW_OPS_PROOF_COMPLETE'
            : 'STAGING_REVIEW_OPS_PROOF_FAILED',
        notes: [
            'This proof traverses the deployed admin crawl queue and worker path on external staging, then materializes the finished run into intake readiness.',
            'Render free staging remains a weak throughput benchmark. Treat this as external path proof plus coarse wall-clock regression evidence, not as a production capacity SLA.',
            bootstrapRequired
                ? 'This run required URL bootstrap because no seeded source existed. That path is intentionally optional because Google rate limits can dominate the result.'
                : 'This run used a pre-seeded source id, so it avoids Google re-resolution noise and is the preferred operator proof mode.',
            proofSource
                ? 'The script preferred an existing idle active source when one was available.'
                : 'No idle active source was available, so the script fell back to the restaurant Google Maps URL and let sync-to-draft upsert the source first.',
            evaluation.observed.reusedActiveRun
                ? 'The run reused an already active crawl run, so the result is not clean operator-triggered throughput evidence.'
                : bootstrapRequired
                  ? 'The proof used URL bootstrap, so the observed wall-clock includes source upsert plus crawl scheduling.'
                  : 'The proof used an idle active source so the observed wall-clock isolates a fresh operator-triggered run plus materialization.',
        ],
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
    )

    process.stdout.write(
        `${JSON.stringify(
            {
                overallStatus: report.overallStatus,
                restaurantSlug: restaurant.slug ?? null,
                runId: terminalResult.runDetail.run?.id ?? null,
                observed: evaluation.observed,
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(
        `Staging review-ops proof report written to ${resolvedOutputPath}\n`,
    )

    if (!evaluation.passed) {
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
    ACTIVE_RUN_STATUSES,
    evaluateReviewOpsProof,
    isStableTerminalRun,
    selectProofSource,
    selectRestaurant,
    snapshotRunState,
}
