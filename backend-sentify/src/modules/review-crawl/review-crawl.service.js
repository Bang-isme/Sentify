const crypto = require('node:crypto')

const env = require('../../config/env')
const { badRequest, conflict, notFound } = require('../../lib/app-error')
const { INTERNAL_OPERATOR_ROLES } = require('../../lib/user-roles')
const { ensureRestaurantExists } = require('../../services/restaurant-access.service')
const { getUserRoleAccess } = require('../../services/user-access.service')
const adminIntakeDomain = require('../admin-intake/admin-intake.domain')
const adminIntakeRepository = require('../admin-intake/admin-intake.repository')
const googleMapsProvider = require('./google-maps.service')
const {
    ACTIVE_RUN_STATUSES,
    RESUMABLE_RUN_STATUSES,
    buildIntakeBatchTitle,
    clampRunBudget,
    computeFailureRetryAt,
    computeNextScheduledAt,
    mapRun,
    mapSource,
} = require('./review-crawl.domain')
const { enqueueReviewCrawlRun } = require('./review-crawl.queue')
const repository = require('./review-crawl.repository')
const { logReviewCrawlEvent } = require('./review-crawl.runtime')

const TRANSIENT_ERROR_CODES = new Set([
    'GOOGLE_MAPS_FETCH_FAILED',
    'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
    'GOOGLE_MAPS_RATE_LIMITED',
    'GOOGLE_MAPS_SESSION_INIT_FAILED',
])

function generateLeaseToken() {
    return crypto.randomUUID()
}

async function ensureInternalOperatorAccess(userId) {
    return getUserRoleAccess({
        userId,
        allowedRoles: INTERNAL_OPERATOR_ROLES,
    })
}

async function ensureSourceAccess(userId, sourceId) {
    await ensureInternalOperatorAccess(userId)

    const source = await repository.findSourceById(sourceId)

    if (!source) {
        throw notFound('NOT_FOUND', 'Review crawl source not found')
    }

    return source
}

async function ensureRunAccess(userId, runId, options = {}) {
    await ensureInternalOperatorAccess(userId)

    const run = await repository.findRunById(runId, options)

    if (!run) {
        throw notFound('NOT_FOUND', 'Review crawl run not found')
    }

    return run
}

function resolveSourceCreateInput(input, resolved, now) {
    const syncIntervalMinutes = input.syncIntervalMinutes ?? 1440
    const syncEnabled = input.syncEnabled ?? true

    return {
        create: {
            status: 'ACTIVE',
            inputUrl: input.url,
            resolvedUrl: resolved.source.resolvedUrl ?? null,
            placeHexId: resolved.place.identifiers.placeHexId ?? null,
            googlePlaceId: resolved.place.identifiers.googlePlaceId ?? null,
            placeName: resolved.place.name ?? null,
            language: input.language,
            region: input.region,
            syncEnabled,
            syncIntervalMinutes,
            lastReportedTotal: resolved.place.totalReviewCount ?? null,
            nextScheduledAt: syncEnabled ? computeNextScheduledAt(now, syncIntervalMinutes) : null,
        },
        update: {
            inputUrl: input.url,
            resolvedUrl: resolved.source.resolvedUrl ?? null,
            placeHexId: resolved.place.identifiers.placeHexId ?? null,
            googlePlaceId: resolved.place.identifiers.googlePlaceId ?? null,
            placeName: resolved.place.name ?? null,
            language: input.language,
            region: input.region,
            lastReportedTotal: resolved.place.totalReviewCount ?? null,
            ...(Object.prototype.hasOwnProperty.call(input, 'syncEnabled')
                ? {
                      syncEnabled,
                      nextScheduledAt: syncEnabled
                          ? computeNextScheduledAt(now, syncIntervalMinutes)
                          : null,
                  }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(input, 'syncIntervalMinutes')
                ? {
                      syncIntervalMinutes,
                      nextScheduledAt: syncEnabled
                          ? computeNextScheduledAt(now, syncIntervalMinutes)
                          : null,
                  }
                : {}),
        },
    }
}

function mergeMetadata(currentMetadata, nextMetadata) {
    return {
        ...(currentMetadata || {}),
        ...(nextMetadata || {}),
    }
}

function ensureSourceIsSyncable(source) {
    if (source.status === 'DISABLED') {
        throw conflict(
            'REVIEW_CRAWL_SOURCE_DISABLED',
            'This crawl source is disabled and must be re-enabled before syncing',
        )
    }
}

async function updateActiveRunMetadata(activeRun, metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return repository.findRunById(activeRun.id, {
            includeSource: true,
            includeIntakeBatch: true,
        })
    }

    const mergedMetadata = mergeMetadata(activeRun.metadataJson, metadata)
    const hasChanged =
        JSON.stringify(activeRun.metadataJson || {}) !== JSON.stringify(mergedMetadata)

    if (!hasChanged) {
        return repository.findRunById(activeRun.id, {
            includeSource: true,
            includeIntakeBatch: true,
        })
    }

    return repository.updateRun(
        activeRun.id,
        {
            metadataJson: mergedMetadata,
        },
        {
            includeSource: true,
            includeIntakeBatch: true,
        },
    )
}

async function createQueuedRunForSource({
    source,
    userId,
    input = {},
    trigger = 'manual',
    metadata = {},
    reuseActiveRun = false,
}) {
    ensureSourceIsSyncable(source)

    const strategy = input.strategy ?? 'INCREMENTAL'
    const budget = clampRunBudget(strategy, input)
    const now = new Date()
    const activeRun = await repository.findActiveRunBySourceId(source.id)

    if (activeRun) {
        if (reuseActiveRun) {
            const reusedRun = await updateActiveRunMetadata(activeRun, metadata)
            return {
                run: reusedRun,
                reusedExisting: true,
            }
        }

        throw conflict(
            'REVIEW_CRAWL_RUN_ALREADY_ACTIVE',
            'This crawl source already has an active run',
        )
    }

    let run

    try {
        run = await repository.createRun({
            sourceId: source.id,
            restaurantId: source.restaurantId,
            requestedByUserId: userId ?? null,
            strategy,
            priority: input.priority ?? 'NORMAL',
            status: 'QUEUED',
            pageSize: budget.pageSize,
            delayMs: budget.delayMs,
            maxPages: budget.maxPages,
            maxReviews: budget.maxReviews,
            queuedAt: now,
            metadataJson: mergeMetadata(
                {
                    trigger,
                },
                metadata,
            ),
        })
    } catch (error) {
        if (repository.isActiveRunUniqueViolation(error)) {
            const conflictingRun = await repository.findActiveRunBySourceId(source.id)

            if (conflictingRun && reuseActiveRun) {
                const reusedRun = await updateActiveRunMetadata(conflictingRun, metadata)
                return {
                    run: reusedRun,
                    reusedExisting: true,
                }
            }

            throw conflict(
                'REVIEW_CRAWL_RUN_ALREADY_ACTIVE',
                'This crawl source already has an active run',
            )
        }

        throw error
    }

    try {
        await enqueueReviewCrawlRun(run.id)
    } catch (error) {
        await repository.updateRun(run.id, {
            status: 'FAILED',
            errorCode: error.code || 'REVIEW_CRAWL_ENQUEUE_FAILED',
            errorMessage: error.message,
            finishedAt: new Date(),
        })
        throw error
    }

    logReviewCrawlEvent('run.queued', {
        runId: run.id,
        sourceId: source.id,
        restaurantId: source.restaurantId,
        strategy,
        trigger,
        reusedExisting: false,
    })

    return {
        run,
        reusedExisting: false,
    }
}

async function previewGoogleMapsReviews({ userId, input }) {
    await ensureInternalOperatorAccess(userId)
    await ensureRestaurantExists({ restaurantId: input.restaurantId })
    return googleMapsProvider.crawlGoogleMapsReviews(input)
}

async function upsertReviewCrawlSource({ userId, input }) {
    await ensureInternalOperatorAccess(userId)
    await ensureRestaurantExists({ restaurantId: input.restaurantId })

    const resolved = await googleMapsProvider.resolveGoogleMapsSource(input)
    const canonicalCid = resolved.place.identifiers.cid

    if (!canonicalCid) {
        throw badRequest(
            'REVIEW_CRAWL_SOURCE_IDENTITY_UNAVAILABLE',
            'Could not resolve a canonical crawl identity from the Google Maps URL',
        )
    }

    const now = new Date()
    const nextSourceState = resolveSourceCreateInput(input, resolved, now)
    const source = await repository.upsertSourceByCanonicalIdentity(
        {
            restaurantId: input.restaurantId,
            provider: 'GOOGLE_MAPS',
            canonicalCid,
        },
        nextSourceState.create,
        nextSourceState.update,
    )

    return {
        source: mapSource(source),
        metadata: {
            placeName: resolved.place.name ?? null,
            totalReviewCount: resolved.place.totalReviewCount ?? null,
            googlePlaceId: resolved.place.identifiers.googlePlaceId ?? null,
            placeHexId: resolved.place.identifiers.placeHexId ?? null,
        },
    }
}

async function createReviewCrawlRun({
    userId,
    sourceId,
    input,
    trigger = 'manual',
    metadata,
    reuseActiveRun = false,
}) {
    const source = await ensureSourceAccess(userId, sourceId)
    const { run } = await createQueuedRunForSource({
        source,
        userId,
        input,
        trigger,
        metadata,
        reuseActiveRun,
    })

    return mapRun(run, { includeSource: true })
}

async function getReviewCrawlRun({ userId, runId }) {
    const run = await ensureRunAccess(userId, runId, {
        includeSource: true,
        includeIntakeBatch: true,
    })

    return mapRun(run, { includeSource: true, includeIntakeBatch: true })
}

async function cancelReviewCrawlRun({ userId, runId }) {
    const run = await ensureRunAccess(userId, runId)

    if (!ACTIVE_RUN_STATUSES.has(run.status)) {
        throw conflict(
            'REVIEW_CRAWL_RUN_NOT_CANCELLABLE',
            'Only queued or running crawl runs can be cancelled',
        )
    }

    const now = new Date()
    const cancelledRun =
        run.status === 'QUEUED'
            ? await repository.updateRun(run.id, {
                  status: 'CANCELLED',
                  cancelRequestedAt: now,
                  finishedAt: now,
              })
            : await repository.updateRun(run.id, {
                  cancelRequestedAt: now,
              })

    return mapRun(cancelledRun)
}

async function resumeReviewCrawlRun({ userId, runId }) {
    const run = await ensureRunAccess(userId, runId)

    if (!RESUMABLE_RUN_STATUSES.has(run.status)) {
        throw conflict(
            'REVIEW_CRAWL_RUN_NOT_RESUMABLE',
            'Only failed or partial runs can be resumed',
        )
    }

    const activeRun = await repository.findActiveRunBySourceId(run.sourceId)

    if (activeRun && activeRun.id !== run.id) {
        throw conflict(
            'REVIEW_CRAWL_RUN_ALREADY_ACTIVE',
            'This crawl source already has an active run',
        )
    }

    const resumedRun = await repository.updateRun(
        run.id,
        {
            status: 'QUEUED',
            errorCode: null,
            errorMessage: null,
            cancelRequestedAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
            finishedAt: null,
            queuedAt: new Date(),
        },
        {
            includeSource: true,
            includeIntakeBatch: true,
        },
    )

    await enqueueReviewCrawlRun(run.id)

    return mapRun(resumedRun, { includeSource: true, includeIntakeBatch: true })
}

function mergeWarnings(existingWarnings, nextWarnings) {
    return [...new Set([...(Array.isArray(existingWarnings) ? existingWarnings : []), ...nextWarnings])].slice(
        -100,
    )
}

function getAutoResumeChainCount(metadataJson) {
    return Number.isInteger(metadataJson?.autoResumeChainCount)
        ? metadataJson.autoResumeChainCount
        : 0
}

function shouldAutoResumePrematureBackfill(run) {
    if (!run || run.strategy !== 'BACKFILL' || run.status !== 'PARTIAL') {
        return false
    }

    if (run.metadataJson?.stopReason !== 'premature_exhaustion') {
        return false
    }

    if (!run.checkpointCursor) {
        return false
    }

    return getAutoResumeChainCount(run.metadataJson) < env.REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS
}

async function queueAutoResumeRun(run, source) {
    const autoResumeChainCount = getAutoResumeChainCount(run.metadataJson) + 1
    const warnings = mergeWarnings(
        Array.isArray(run.warningsJson) ? run.warningsJson : [],
        [
            `Queued automatic backfill resume ${autoResumeChainCount}/${env.REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS} from saved cursor`,
        ],
    )
    const metadataJson = mergeMetadata(run.metadataJson, {
        autoResumeChainCount,
        lastAutoResumeQueuedAt: new Date().toISOString(),
    })

    const resumedRun = await repository.updateRun(
        run.id,
        {
            status: 'QUEUED',
            queuedAt: new Date(),
            startedAt: null,
            finishedAt: null,
            cancelRequestedAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
            warningCount: warnings.length,
            warningsJson: warnings,
            metadataJson,
        },
        {
            includeSource: true,
            includeIntakeBatch: true,
        },
    )

    await enqueueReviewCrawlRun(run.id)

    logReviewCrawlEvent('run.auto_resumed', {
        runId: run.id,
        sourceId: source.id,
        checkpointCursor: resumedRun.checkpointCursor,
        autoResumeChainCount,
    })

    return resumedRun
}

async function persistPageReviews({ source, run, reviews, warnings }) {
    const existingRows = await repository.findRawReviewsBySourceAndKeys(
        source.id,
        reviews.map((review) => review.externalReviewKey),
    )
    const existingByKey = new Map(existingRows.map((row) => [row.externalReviewKey, row]))

    let duplicateCount = 0
    let newCount = 0
    let validCount = 0
    let skippedCount = 0
    let knownReviewStreak = run.knownReviewStreak ?? 0
    const pageWarnings = [...warnings]

    for (const review of reviews) {
        const existing = existingByKey.get(review.externalReviewKey)
        const validation = googleMapsProvider.validateReviewForIntake(review)
        const intakeItemPayload = validation.item || null
        const isValidForIntake = Boolean(intakeItemPayload)

        if (existing) {
            duplicateCount += 1
            knownReviewStreak += 1
        } else {
            newCount += 1
            knownReviewStreak = 0
        }

        if (isValidForIntake) {
            validCount += 1
        } else {
            skippedCount += 1
        }

        if (validation.warnings.length > 0) {
            pageWarnings.push(...validation.warnings)
        }

        await repository.upsertRawReview(source.id, review.externalReviewKey, {
            firstSeenRunId: existing?.firstSeenRunId || run.id,
            lastSeenRunId: run.id,
            providerReviewId: review.reviewId ?? null,
            reviewUrl: review.reviewUrl ?? null,
            authorName: review.author?.name ?? null,
            rating: review.rating ?? null,
            content: review.text ?? null,
            reviewDate: review.publishedAt ? new Date(review.publishedAt) : null,
            language: review.language ?? null,
            ownerResponseText: review.ownerResponse?.text ?? null,
            validForIntake: isValidForIntake,
            validationIssues: isValidForIntake ? null : validation.issues,
            intakeItemPayload,
            payload: review,
        })
    }

    return {
        duplicateCount,
        newCount,
        validCount,
        skippedCount,
        knownReviewStreak,
        warnings: pageWarnings,
    }
}

async function finalizeRunSuccess(run, source, status, updates = {}) {
    const now = new Date()
    const nextScheduledAt =
        source.syncEnabled && status !== 'CANCELLED'
            ? computeNextScheduledAt(now, source.syncIntervalMinutes)
            : source.nextScheduledAt
    const normalizedUpdates = {
        ...updates,
    }

    if (
        Array.isArray(normalizedUpdates.warningsJson) &&
        !Object.prototype.hasOwnProperty.call(normalizedUpdates, 'warningCount')
    ) {
        normalizedUpdates.warningCount = normalizedUpdates.warningsJson.length
    }

    await repository.updateSource(source.id, {
        lastReportedTotal: run.reportedTotal ?? source.lastReportedTotal ?? null,
        lastSyncedAt: now,
        lastSuccessfulRunAt: status === 'FAILED' ? source.lastSuccessfulRunAt : now,
        nextScheduledAt,
    })

    const persistedRun = await repository.updateRun(
        run.id,
        {
            status,
            finishedAt: now,
            leaseToken: null,
            leaseExpiresAt: null,
            ...normalizedUpdates,
        },
        {
            includeSource: true,
            includeIntakeBatch: true,
        },
    )

    logReviewCrawlEvent('run.completed', {
        runId: persistedRun.id,
        sourceId: source.id,
        status,
        pagesFetched: persistedRun.pagesFetched,
        extractedCount: persistedRun.extractedCount,
        validCount: persistedRun.validCount,
    })

    return persistedRun
}

async function finalizeAndMaybeMaterializeRun(run, source, status, updates = {}) {
    let persistedRun = await finalizeRunSuccess(run, source, status, updates)
    const materializeMode = persistedRun.metadataJson?.materializeMode
    const materializeUserId = persistedRun.requestedByUserId

    if (materializeMode !== 'DRAFT' || !materializeUserId) {
        return persistedRun
    }

    try {
        const result = await materializeRunToIntakeInternal({
            run: persistedRun,
            userId: materializeUserId,
        })

        logReviewCrawlEvent('run.auto_materialized', {
            runId: persistedRun.id,
            batchId: result.batch.id,
            materializedCount: result.materializedCount,
        })

        return repository.findRunById(persistedRun.id, {
            includeSource: true,
            includeIntakeBatch: true,
        })
    } catch (error) {
        const warnings = mergeWarnings(
            Array.isArray(persistedRun.warningsJson) ? persistedRun.warningsJson : [],
            [`Auto materialization failed: ${error.message}`],
        )

        persistedRun = await repository.updateRun(
            persistedRun.id,
            {
                warningCount: warnings.length,
                warningsJson: warnings,
                metadataJson: mergeMetadata(persistedRun.metadataJson, {
                    autoMaterializeError: {
                        code: error.code || 'REVIEW_CRAWL_AUTO_MATERIALIZE_FAILED',
                        message: error.message,
                        failedAt: new Date().toISOString(),
                    },
                }),
            },
            {
                includeSource: true,
                includeIntakeBatch: true,
            },
        )

        logReviewCrawlEvent('run.auto_materialize_failed', {
            runId: persistedRun.id,
            errorCode: error.code || 'REVIEW_CRAWL_AUTO_MATERIALIZE_FAILED',
            message: error.message,
        })

        return persistedRun
    }
}

async function failRun(run, source, error, job) {
    const now = new Date()
    const hasRetryLeft =
        job &&
        typeof job.attemptsMade === 'number' &&
        typeof job.opts?.attempts === 'number' &&
        job.attemptsMade + 1 < job.opts.attempts
    const isTransient = TRANSIENT_ERROR_CODES.has(error.code)

    const nextScheduledAt = source.syncEnabled ? computeFailureRetryAt(now) : source.nextScheduledAt

    await repository.updateSource(source.id, {
        nextScheduledAt,
    })

    const failureStatus = isTransient && hasRetryLeft ? 'QUEUED' : 'FAILED'
    const persistedRun = await repository.updateRun(
        run.id,
        {
            status: failureStatus,
            errorCode: error.code || 'REVIEW_CRAWL_FAILED',
            errorMessage: error.message || 'Review crawl failed',
            leaseToken: null,
            leaseExpiresAt: null,
            ...(failureStatus === 'FAILED' ? { finishedAt: now } : {}),
        },
        {
            includeSource: true,
            includeIntakeBatch: true,
        },
    )

    logReviewCrawlEvent('run.failed', {
        runId: run.id,
        sourceId: source.id,
        status: failureStatus,
        errorCode: error.code || 'REVIEW_CRAWL_FAILED',
        message: error.message,
        attemptsMade: job?.attemptsMade ?? null,
    })

    if (failureStatus === 'QUEUED') {
        throw error
    }

    return persistedRun
}

async function processReviewCrawlRun(runId, job) {
    let run = await repository.findRunById(runId, {
        includeSource: true,
        includeIntakeBatch: true,
    })

    if (!run) {
        return { skipped: 'run_not_found' }
    }

    if (run.status === 'CANCELLED' || run.status === 'COMPLETED') {
        return { skipped: `run_${run.status.toLowerCase()}` }
    }

    const source = run.source
    const leaseToken = generateLeaseToken()
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + env.REVIEW_CRAWL_LEASE_SECONDS * 1000)
    const claimed = await repository.updateRunMany(
        {
            id: run.id,
            status: {
                in: ['QUEUED', 'RUNNING'],
            },
            OR: [
                { leaseExpiresAt: null },
                { leaseExpiresAt: { lt: now } },
            ],
        },
        {
            status: 'RUNNING',
            leaseToken,
            leaseExpiresAt,
            startedAt: now,
            errorCode: null,
            errorMessage: null,
        },
    )

    if (claimed.count === 0) {
        return { skipped: 'lease_not_acquired' }
    }

    run = await repository.findRunById(runId, {
        includeSource: true,
        includeIntakeBatch: true,
    })

    try {
        let session = await googleMapsProvider.initializeGoogleMapsReviewSession({
            url: source.inputUrl,
            language: source.language,
            region: source.region,
        })

        await repository.updateSource(source.id, {
            inputUrl: source.inputUrl,
            resolvedUrl: session.source.resolvedUrl ?? source.resolvedUrl,
            placeHexId: session.place.identifiers.placeHexId ?? source.placeHexId,
            googlePlaceId: session.place.identifiers.googlePlaceId ?? source.googlePlaceId,
            placeName: session.place.name ?? source.placeName,
            lastReportedTotal: session.place.totalReviewCount ?? source.lastReportedTotal,
        })

        let nextPageToken = run.checkpointCursor ?? ''
        let exhaustedSource = false
        let prematureExhaustionDetected = false
        let warnings = Array.isArray(run.warningsJson) ? [...run.warningsJson] : []
        const startTime = Date.now()

        // Google Maps often returns empty review payloads if the RPC call is sent immediately.
        await googleMapsProvider.sleep(2000)

        while (true) {
            const currentRun = await repository.findRunById(run.id)

            if (!currentRun) {
                return { skipped: 'run_deleted' }
            }

            if (currentRun.status === 'CANCELLED' || currentRun.cancelRequestedAt) {
                const cancelledRun = await finalizeRunSuccess(currentRun, source, 'CANCELLED')
                return mapRun(cancelledRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (
                currentRun.maxPages &&
                currentRun.pagesFetched >= currentRun.maxPages
            ) {
                const partialRun = await finalizeAndMaybeMaterializeRun(currentRun, source, 'PARTIAL', {
                    warningsJson: mergeWarnings(warnings, [
                        'Run stopped because the configured page budget was reached',
                    ]),
                })
                return mapRun(partialRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (
                currentRun.maxReviews &&
                currentRun.extractedCount >= currentRun.maxReviews
            ) {
                const partialRun = await finalizeAndMaybeMaterializeRun(currentRun, source, 'PARTIAL', {
                    warningsJson: mergeWarnings(warnings, [
                        'Run stopped because the configured review budget was reached',
                    ]),
                })
                return mapRun(partialRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (Date.now() - startTime >= env.REVIEW_CRAWL_MAX_DURATION_MS) {
                const partialRun = await finalizeAndMaybeMaterializeRun(currentRun, source, 'PARTIAL', {
                    warningsJson: mergeWarnings(warnings, [
                        'Run stopped because the configured duration budget was reached',
                    ]),
                })
                return mapRun(partialRun, { includeSource: true, includeIntakeBatch: true })
            }

            await repository.updateRun(run.id, {
                leaseToken,
                leaseExpiresAt: new Date(Date.now() + env.REVIEW_CRAWL_LEASE_SECONDS * 1000),
            })

            const pageResult = googleMapsProvider.fetchGoogleMapsReviewPageWithRecovery
                ? await googleMapsProvider.fetchGoogleMapsReviewPageWithRecovery(
                      {
                          client: session.client,
                          placeHexId: session.place.identifiers.placeHexId,
                          sessionToken: session.sessionToken,
                          sort: 'newest',
                          nextPageToken,
                          searchQuery: undefined,
                          pageSize: currentRun.pageSize,
                          language: source.language,
                          region: source.region,
                      },
                      {
                          reportedTotal: session.place.totalReviewCount ?? currentRun.reportedTotal ?? 0,
                          searchQuery: undefined,
                          extractedCount: currentRun.extractedCount,
                      },
                  )
                : {
                      page: await googleMapsProvider.fetchGoogleMapsReviewPage({
                          client: session.client,
                          placeHexId: session.place.identifiers.placeHexId,
                          sessionToken: session.sessionToken,
                          sort: 'newest',
                          nextPageToken,
                          searchQuery: undefined,
                          pageSize: currentRun.pageSize,
                          language: source.language,
                          region: source.region,
                      }),
                      attempts: 1,
                      suspiciousEmpty: false,
                  }
            if (currentRun.pagesFetched > 0 && pageResult.suspiciousEmpty) {
                const recoveredCursor = await googleMapsProvider.recoverCursorWithFreshSessions({
                    session,
                    input: {
                        url: source.inputUrl,
                        language: source.language,
                        region: source.region,
                        sort: 'newest',
                        searchQuery: undefined,
                        pageSize: currentRun.pageSize,
                    },
                    nextPageToken,
                    extractedCount: currentRun.extractedCount,
                    reportedTotal: session.place.totalReviewCount ?? currentRun.reportedTotal ?? 0,
                })

                if (recoveredCursor.recovered) {
                    session = recoveredCursor.session
                    pageResult = recoveredCursor.pageResult
                    warnings = mergeWarnings(warnings, [
                        `Recovered queued review cursor for page ${currentRun.pagesFetched + 1} after ${recoveredCursor.attempts} fresh session attempt(s)`,
                    ])
                }
            }

            const page = pageResult.page

            if (
                currentRun.pagesFetched === 0 &&
                (session.place.totalReviewCount || 0) > 0 &&
                page.reviews.length === 0
            ) {
                throw badRequest(
                    'GOOGLE_MAPS_EMPTY_PAGE',
                    'Google Maps returned no reviews for the first crawl page',
                )
            }

            if (pageResult.attempts > 1) {
                warnings = mergeWarnings(warnings, [
                    `Retried queued review page ${currentRun.pagesFetched + 1} ${pageResult.attempts - 1} time(s) before accepting the response`,
                ])
            }

            const persisted = await persistPageReviews({
                source,
                run: currentRun,
                reviews: page.reviews,
                warnings: [],
            })

            warnings = mergeWarnings(warnings, persisted.warnings)
            exhaustedSource = !page.nextPageToken
            prematureExhaustionDetected =
                prematureExhaustionDetected || Boolean(pageResult.suspiciousEmpty)
            const nextCheckpointCursor =
                pageResult.suspiciousEmpty && nextPageToken
                    ? nextPageToken
                    : page.nextPageToken || ''

            if (
                pageResult.suspiciousEmpty &&
                typeof session.place.totalReviewCount === 'number' &&
                currentRun.extractedCount + page.reviews.length < session.place.totalReviewCount
            ) {
                warnings = mergeWarnings(warnings, [
                    `Google Maps reported ${session.place.totalReviewCount} reviews, but only ${currentRun.extractedCount + page.reviews.length} unique reviews were extracted before the queued run exhausted unexpectedly`,
                    'Google Maps stopped returning review pages before the reported total could be reached, so this queued crawl run was marked as partial',
                ])
            }

            run = await repository.updateRun(
                run.id,
                {
                    reportedTotal: session.place.totalReviewCount ?? currentRun.reportedTotal,
                    extractedCount: currentRun.extractedCount + page.reviews.length,
                    validCount: currentRun.validCount + persisted.validCount,
                    skippedCount: currentRun.skippedCount + persisted.skippedCount,
                    duplicateCount: currentRun.duplicateCount + persisted.duplicateCount,
                    warningCount: warnings.length,
                    pagesFetched: currentRun.pagesFetched + 1,
                    checkpointCursor: nextCheckpointCursor || null,
                    knownReviewStreak: persisted.knownReviewStreak,
                    warningsJson: warnings,
                    lastCheckpointAt: new Date(),
                },
                {
                    includeSource: true,
                    includeIntakeBatch: true,
                },
            )

            nextPageToken = nextCheckpointCursor

            if (
                run.strategy === 'INCREMENTAL' &&
                run.knownReviewStreak >= env.REVIEW_CRAWL_KNOWN_REVIEW_STREAK_LIMIT
            ) {
                const completedRun = await finalizeAndMaybeMaterializeRun(run, source, 'COMPLETED', {
                    warningsJson: warnings,
                    metadataJson: {
                        ...(run.metadataJson || {}),
                        stopReason: 'known_review_streak',
                    },
                })
                return mapRun(completedRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (exhaustedSource) {
                if (
                    !prematureExhaustionDetected &&
                    typeof session.place.totalReviewCount === 'number' &&
                    run.extractedCount < session.place.totalReviewCount
                ) {
                    warnings = mergeWarnings(warnings, [
                        `Google Maps reported ${session.place.totalReviewCount} reviews, but only ${run.extractedCount} unique reviews were extracted`,
                    ])
                }

                let completedRun = await finalizeAndMaybeMaterializeRun(
                    run,
                    source,
                    prematureExhaustionDetected ? 'PARTIAL' : 'COMPLETED',
                    {
                        warningsJson: warnings,
                        metadataJson: {
                            ...(run.metadataJson || {}),
                            stopReason: prematureExhaustionDetected
                                ? 'premature_exhaustion'
                                : 'exhausted_source',
                        },
                    },
                )

                if (shouldAutoResumePrematureBackfill(completedRun)) {
                    try {
                        completedRun = await queueAutoResumeRun(completedRun, source)
                    } catch (error) {
                        const warnings = mergeWarnings(
                            Array.isArray(completedRun.warningsJson)
                                ? completedRun.warningsJson
                                : [],
                            [`Automatic backfill resume could not be queued: ${error.message}`],
                        )

                        completedRun = await repository.updateRun(
                            completedRun.id,
                            {
                                warningCount: warnings.length,
                                warningsJson: warnings,
                                metadataJson: mergeMetadata(completedRun.metadataJson, {
                                    autoResumeQueueError: {
                                        code: error.code || 'REVIEW_CRAWL_AUTO_RESUME_ENQUEUE_FAILED',
                                        message: error.message,
                                        failedAt: new Date().toISOString(),
                                    },
                                }),
                            },
                            {
                                includeSource: true,
                                includeIntakeBatch: true,
                            },
                        )
                    }
                }

                return mapRun(completedRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (run.delayMs > 0) {
                await googleMapsProvider.sleep(run.delayMs)
            }
        }
    } catch (error) {
        const failedRun = await failRun(run, source, error, job)
        return mapRun(failedRun, { includeSource: true, includeIntakeBatch: true })
    }
}

function chunkItems(items, size) {
    const chunks = []

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }

    return chunks
}

async function refreshBatchStatus(batch) {
    const nextStatus = adminIntakeDomain.deriveBatchStatus(batch, batch.items || [])

    if (nextStatus === batch.status) {
        return batch
    }

    return adminIntakeRepository.updateBatch(batch.id, {
        status: nextStatus,
    })
}

function getMaterializationKey(item) {
    return adminIntakeDomain.buildIntakeItemDedupKey(item)
}

async function materializeRunToIntakeInternal({ run, userId }) {
    if (!['COMPLETED', 'PARTIAL'].includes(run.status)) {
        throw conflict(
            'REVIEW_CRAWL_RUN_NOT_MATERIALIZABLE',
            'Only completed or partial crawl runs can be materialized into intake',
        )
    }

    let draftBatch = null

    if (run.intakeBatchId) {
        draftBatch = await adminIntakeRepository.findBatchById(run.intakeBatchId, {
            includeItems: true,
        })

        if (
            draftBatch &&
            !['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'].includes(draftBatch.status)
        ) {
            draftBatch = null
        }
    }

    if (
        !draftBatch &&
        run.sourceId &&
        run.source &&
        run.source.provider === 'GOOGLE_MAPS'
    ) {
        draftBatch = await adminIntakeRepository.findOpenBatchByCrawlSourceId(run.sourceId, {
            includeItems: true,
        })
    }

    const rawReviews = await repository.listRunRawReviews(run.id)
    const materializableItems = rawReviews
        .filter((entry) => entry.validForIntake && entry.intakeItemPayload)
        .map((entry) => adminIntakeDomain.normalizeIncomingItem(entry.intakeItemPayload))

    if (materializableItems.length === 0) {
        throw badRequest(
            'REVIEW_CRAWL_NOTHING_TO_MATERIALIZE',
            'This crawl run has no valid review items to materialize',
        )
    }

    if (!draftBatch) {
        draftBatch = await adminIntakeRepository.createBatch({
            restaurantId: run.restaurantId,
            createdByUserId: userId,
            crawlSourceId: run.sourceId ?? null,
            sourceType: 'GOOGLE_MAPS_CRAWL',
            title: buildIntakeBatchTitle(run.source, run),
        })
        draftBatch = await adminIntakeRepository.findBatchById(draftBatch.id, {
            includeItems: true,
        })
    }

    const existingKeys = new Set(
        (draftBatch.items || []).map((item) => getMaterializationKey(item)),
    )
    const newItems = materializableItems.filter((item) => {
        const key = getMaterializationKey(item)

        if (existingKeys.has(key)) {
            return false
        }

        existingKeys.add(key)
        return true
    })

    for (const chunk of chunkItems(newItems, 200)) {
        await adminIntakeRepository.createItems(draftBatch.id, run.restaurantId, chunk)
    }

    let persistedBatch = await adminIntakeRepository.findBatchById(draftBatch.id, {
        includeItems: true,
    })
    persistedBatch = await refreshBatchStatus(persistedBatch)

    await repository.updateRun(run.id, {
        intakeBatchId: draftBatch.id,
    })

    return {
        run: mapRun(
            await repository.findRunById(run.id, {
                includeSource: true,
                includeIntakeBatch: true,
            }),
            {
                includeSource: true,
                includeIntakeBatch: true,
            },
        ),
        batch: adminIntakeDomain.mapBatch(persistedBatch, { includeItems: true }),
        materializedCount: newItems.length,
    }
}

async function materializeRunToIntake({ userId, runId }) {
    const run = await ensureRunAccess(userId, runId, {
        includeSource: true,
        includeIntakeBatch: true,
    })

    return materializeRunToIntakeInternal({
        run,
        userId,
    })
}

async function scheduleDueReviewCrawlRuns() {
    const now = new Date()
    const dueSources = await repository.listDueSources(now, env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE)
    let scheduledCount = 0

    for (const source of dueSources) {
        try {
            await createQueuedRunForSource({
                source,
                userId: null,
                input: {
                    strategy: 'INCREMENTAL',
                    priority: 'LOW',
                },
                trigger: 'scheduler',
            })
            scheduledCount += 1
        } catch (error) {
            if (error.code === 'REVIEW_CRAWL_RUN_ALREADY_ACTIVE') {
                continue
            }

            throw error
        }
    }

    if (scheduledCount > 0) {
        logReviewCrawlEvent('scheduler.enqueued_runs', {
            scheduledCount,
        })
    }

    return {
        scheduledCount,
        scannedCount: dueSources.length,
    }
}

module.exports = {
    cancelReviewCrawlRun,
    createReviewCrawlRun,
    getReviewCrawlRun,
    materializeRunToIntake,
    previewGoogleMapsReviews,
    processReviewCrawlRun,
    resumeReviewCrawlRun,
    scheduleDueReviewCrawlRuns,
    upsertReviewCrawlSource,
}
