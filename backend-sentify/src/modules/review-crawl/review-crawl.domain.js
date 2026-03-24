const env = require('../../config/env')

const ACTIVE_RUN_STATUSES = new Set(['QUEUED', 'RUNNING'])
const RESUMABLE_RUN_STATUSES = new Set(['FAILED', 'PARTIAL'])
const TERMINAL_RUN_STATUSES = new Set(['PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'])

function mapSource(source) {
    if (!source) {
        return null
    }

    return {
        id: source.id,
        restaurantId: source.restaurantId,
        provider: source.provider,
        status: source.status,
        inputUrl: source.inputUrl,
        resolvedUrl: source.resolvedUrl ?? null,
        canonicalCid: source.canonicalCid,
        placeHexId: source.placeHexId ?? null,
        googlePlaceId: source.googlePlaceId ?? null,
        placeName: source.placeName ?? null,
        language: source.language,
        region: source.region,
        syncEnabled: source.syncEnabled,
        syncIntervalMinutes: source.syncIntervalMinutes,
        lastReportedTotal: source.lastReportedTotal ?? null,
        lastSyncedAt: source.lastSyncedAt ?? null,
        lastSuccessfulRunAt: source.lastSuccessfulRunAt ?? null,
        nextScheduledAt: source.nextScheduledAt ?? null,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    }
}

function mapRun(run, options = {}) {
    if (!run) {
        return null
    }

    return {
        id: run.id,
        sourceId: run.sourceId,
        restaurantId: run.restaurantId,
        requestedByUserId: run.requestedByUserId ?? null,
        intakeBatchId: run.intakeBatchId ?? null,
        strategy: run.strategy,
        status: run.status,
        priority: run.priority,
        reportedTotal: run.reportedTotal ?? null,
        extractedCount: run.extractedCount,
        validCount: run.validCount,
        skippedCount: run.skippedCount,
        duplicateCount: run.duplicateCount,
        warningCount: run.warningCount,
        pagesFetched: run.pagesFetched,
        pageSize: run.pageSize,
        delayMs: run.delayMs,
        maxPages: run.maxPages ?? null,
        maxReviews: run.maxReviews ?? null,
        checkpointCursor: run.checkpointCursor ?? null,
        knownReviewStreak: run.knownReviewStreak,
        cancelRequestedAt: run.cancelRequestedAt ?? null,
        leaseExpiresAt: run.leaseExpiresAt ?? null,
        errorCode: run.errorCode ?? null,
        errorMessage: run.errorMessage ?? null,
        warnings: Array.isArray(run.warningsJson) ? run.warningsJson : [],
        metadata: run.metadataJson ?? {},
        queuedAt: run.queuedAt,
        startedAt: run.startedAt ?? null,
        lastCheckpointAt: run.lastCheckpointAt ?? null,
        finishedAt: run.finishedAt ?? null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        ...(options.includeSource ? { source: mapSource(run.source) } : {}),
        ...(options.includeIntakeBatch
            ? {
                  intakeBatch: run.intakeBatch
                      ? {
                            id: run.intakeBatch.id,
                            status: run.intakeBatch.status,
                            title: run.intakeBatch.title ?? null,
                        }
                      : null,
              }
            : {}),
    }
}

function clampRunBudget(strategy, input = {}) {
    if (strategy === 'BACKFILL') {
        return {
            pageSize: input.pageSize ?? 20,
            delayMs: input.delayMs ?? 500,
            maxPages: Math.min(
                input.maxPages ?? env.REVIEW_CRAWL_BACKFILL_MAX_PAGES,
                env.REVIEW_CRAWL_BACKFILL_MAX_PAGES,
            ),
            maxReviews: input.maxReviews ?? null,
        }
    }

    return {
        pageSize: input.pageSize ?? 20,
        delayMs: input.delayMs ?? 250,
        maxPages: Math.min(
            input.maxPages ?? env.REVIEW_CRAWL_INCREMENTAL_MAX_PAGES,
            env.REVIEW_CRAWL_INCREMENTAL_MAX_PAGES,
        ),
        maxReviews: input.maxReviews ?? null,
    }
}

function computeNextScheduledAt(now, syncIntervalMinutes) {
    return new Date(now.getTime() + syncIntervalMinutes * 60 * 1000)
}

function computeFailureRetryAt(now) {
    return new Date(now.getTime() + env.REVIEW_CRAWL_FAILURE_COOLDOWN_MINUTES * 60 * 1000)
}

function buildIntakeBatchTitle(source, run) {
    const placeLabel = source.placeName || source.googlePlaceId || source.canonicalCid
    return `Google Maps crawl - ${placeLabel} - ${run.strategy.toLowerCase()} - ${run.id.slice(0, 8)}`
}

module.exports = {
    ACTIVE_RUN_STATUSES,
    RESUMABLE_RUN_STATUSES,
    TERMINAL_RUN_STATUSES,
    buildIntakeBatchTitle,
    clampRunBudget,
    computeFailureRetryAt,
    computeNextScheduledAt,
    mapRun,
    mapSource,
}
