const crypto = require('node:crypto')

const env = require('../../config/env')
const { badRequest, conflict, notFound } = require('../../lib/app-error')
const { getRestaurantAccess } = require('../../services/restaurant-access.service')
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

async function ensureRestaurantEditorAccess(userId, restaurantId) {
    return getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })
}

async function ensureSourceAccess(userId, sourceId) {
    const source = await repository.findSourceById(sourceId)

    if (!source) {
        throw notFound('NOT_FOUND', 'Review crawl source not found')
    }

    await ensureRestaurantEditorAccess(userId, source.restaurantId)
    return source
}

async function ensureRunAccess(userId, runId, options = {}) {
    const run = await repository.findRunById(runId, options)

    if (!run) {
        throw notFound('NOT_FOUND', 'Review crawl run not found')
    }

    await ensureRestaurantEditorAccess(userId, run.restaurantId)
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

async function previewGoogleMapsReviews({ userId, input }) {
    await ensureRestaurantEditorAccess(userId, input.restaurantId)
    return googleMapsProvider.crawlGoogleMapsReviews(input)
}

async function upsertReviewCrawlSource({ userId, input }) {
    await ensureRestaurantEditorAccess(userId, input.restaurantId)

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

async function createReviewCrawlRun({ userId, sourceId, input, trigger = 'manual' }) {
    const source = await ensureSourceAccess(userId, sourceId)
    const activeRun = await repository.findActiveRunBySourceId(source.id)

    if (activeRun) {
        throw conflict(
            'REVIEW_CRAWL_RUN_ALREADY_ACTIVE',
            'This crawl source already has an active run',
        )
    }

    const strategy = input.strategy ?? 'INCREMENTAL'
    const budget = clampRunBudget(strategy, input)
    const now = new Date()
    const run = await repository.createRun({
        sourceId: source.id,
        restaurantId: source.restaurantId,
        requestedByUserId: userId,
        strategy,
        priority: input.priority ?? 'NORMAL',
        status: 'QUEUED',
        pageSize: budget.pageSize,
        delayMs: budget.delayMs,
        maxPages: budget.maxPages,
        maxReviews: budget.maxReviews,
        queuedAt: now,
        metadataJson: {
            trigger,
        },
    })

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
        const validation = googleMapsProvider.buildValidatedIntakeItems([review])
        const intakeItemPayload = validation.items[0] || null
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
            validationIssues: isValidForIntake ? null : validation.warnings,
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
            ...updates,
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
        const session = await googleMapsProvider.initializeGoogleMapsReviewSession({
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
                const partialRun = await finalizeRunSuccess(currentRun, source, 'PARTIAL', {
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
                const partialRun = await finalizeRunSuccess(currentRun, source, 'PARTIAL', {
                    warningsJson: mergeWarnings(warnings, [
                        'Run stopped because the configured review budget was reached',
                    ]),
                })
                return mapRun(partialRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (Date.now() - startTime >= env.REVIEW_CRAWL_MAX_DURATION_MS) {
                const partialRun = await finalizeRunSuccess(currentRun, source, 'PARTIAL', {
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

            const page = await googleMapsProvider.fetchGoogleMapsReviewPage({
                client: session.client,
                placeHexId: session.place.identifiers.placeHexId,
                sessionToken: session.sessionToken,
                sort: 'newest',
                nextPageToken,
                searchQuery: undefined,
                pageSize: currentRun.pageSize,
                language: source.language,
                region: source.region,
            })

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

            const persisted = await persistPageReviews({
                source,
                run: currentRun,
                reviews: page.reviews,
                warnings: [],
            })

            warnings = mergeWarnings(warnings, persisted.warnings)
            nextPageToken = page.nextPageToken || ''
            exhaustedSource = !page.nextPageToken

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
                    checkpointCursor: page.nextPageToken || null,
                    knownReviewStreak: persisted.knownReviewStreak,
                    warningsJson: warnings,
                    lastCheckpointAt: new Date(),
                },
                {
                    includeSource: true,
                    includeIntakeBatch: true,
                },
            )

            if (
                run.strategy === 'INCREMENTAL' &&
                run.knownReviewStreak >= env.REVIEW_CRAWL_KNOWN_REVIEW_STREAK_LIMIT
            ) {
                const completedRun = await finalizeRunSuccess(run, source, 'COMPLETED', {
                    warningsJson: warnings,
                    metadataJson: {
                        ...(run.metadataJson || {}),
                        stopReason: 'known_review_streak',
                    },
                })
                return mapRun(completedRun, { includeSource: true, includeIntakeBatch: true })
            }

            if (exhaustedSource) {
                const completedRun = await finalizeRunSuccess(run, source, 'COMPLETED', {
                    warningsJson: warnings,
                    metadataJson: {
                        ...(run.metadataJson || {}),
                        stopReason: 'exhausted_source',
                    },
                })
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

async function materializeRunToIntake({ userId, runId }) {
    const run = await ensureRunAccess(userId, runId, {
        includeSource: true,
        includeIntakeBatch: true,
    })

    if (!['COMPLETED', 'PARTIAL'].includes(run.status)) {
        throw conflict(
            'REVIEW_CRAWL_RUN_NOT_MATERIALIZABLE',
            'Only completed or partial crawl runs can be materialized into intake',
        )
    }

    if (run.intakeBatchId) {
        const existingBatch = await adminIntakeRepository.findBatchById(run.intakeBatchId, {
            includeItems: true,
        })

        return {
            run: mapRun(run, { includeSource: true, includeIntakeBatch: true }),
            batch: adminIntakeDomain.mapBatch(existingBatch, { includeItems: true }),
            materializedCount: existingBatch.items.length,
        }
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

    const batch = await adminIntakeRepository.createBatch({
        restaurantId: run.restaurantId,
        createdByUserId: userId,
        sourceType: 'GOOGLE_MAPS_CRAWL',
        title: buildIntakeBatchTitle(run.source, run),
    })

    for (const chunk of chunkItems(materializableItems, 200)) {
        await adminIntakeRepository.createItems(batch.id, run.restaurantId, chunk)
    }

    const persistedBatch = await adminIntakeRepository.findBatchById(batch.id, {
        includeItems: true,
    })

    await repository.updateRun(run.id, {
        intakeBatchId: batch.id,
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
        materializedCount: materializableItems.length,
    }
}

async function scheduleDueReviewCrawlRuns() {
    const now = new Date()
    const dueSources = await repository.listDueSources(now, env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE)
    let scheduledCount = 0

    for (const source of dueSources) {
        const activeRun = await repository.findActiveRunBySourceId(source.id)

        if (activeRun) {
            continue
        }

        const budget = clampRunBudget('INCREMENTAL')
        const run = await repository.createRun({
            sourceId: source.id,
            restaurantId: source.restaurantId,
            strategy: 'INCREMENTAL',
            priority: 'LOW',
            status: 'QUEUED',
            pageSize: budget.pageSize,
            delayMs: budget.delayMs,
            maxPages: budget.maxPages,
            maxReviews: budget.maxReviews,
            queuedAt: now,
            metadataJson: {
                trigger: 'scheduler',
            },
        })

        try {
            await enqueueReviewCrawlRun(run.id)
            scheduledCount += 1
        } catch (error) {
            await repository.updateRun(run.id, {
                status: 'FAILED',
                errorCode: error.code || 'REVIEW_CRAWL_ENQUEUE_FAILED',
                errorMessage: error.message,
                finishedAt: new Date(),
            })
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
