const env = require('../../config/env')

const ACTIVE_RUN_STATUSES = new Set(['QUEUED', 'RUNNING'])
const RESUMABLE_RUN_STATUSES = new Set(['FAILED', 'PARTIAL'])
const TERMINAL_RUN_STATUSES = new Set(['PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED'])
const CRAWL_COVERAGE_COMPLETENESS = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    PARTIAL: 'PARTIAL',
    PUBLIC_CHAIN_EXHAUSTED: 'PUBLIC_CHAIN_EXHAUSTED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
})
const CRAWL_COVERAGE_MISMATCH_STATUS = Object.freeze({
    UNAVAILABLE: 'UNAVAILABLE',
    MATCHED: 'MATCHED',
    REPORTED_TOTAL_EXCEEDS_EXTRACTED: 'REPORTED_TOTAL_EXCEEDS_EXTRACTED',
    EXTRACTED_EXCEEDS_REPORTED_TOTAL: 'EXTRACTED_EXCEEDS_REPORTED_TOTAL',
})
const CRAWL_COVERAGE_POLICY = Object.freeze({
    NONE: 'NONE',
    WAIT_FOR_TERMINAL_RUN: 'WAIT_FOR_TERMINAL_RUN',
    REPORTED_TOTAL_IS_ADVISORY: 'REPORTED_TOTAL_IS_ADVISORY',
    RESUME_FROM_CHECKPOINT: 'RESUME_FROM_CHECKPOINT',
    REVIEW_PARTIAL_RUN: 'REVIEW_PARTIAL_RUN',
    REVIEW_FAILED_RUN: 'REVIEW_FAILED_RUN',
    RUN_CANCELLED: 'RUN_CANCELLED',
})

function resolveRunStopReason(run) {
    const metadata = run?.metadataJson && typeof run.metadataJson === 'object' ? run.metadataJson : {}
    return typeof metadata.stopReason === 'string' ? metadata.stopReason : null
}

function resolveReportedTotal(run, source) {
    if (typeof run?.reportedTotal === 'number') {
        return run.reportedTotal
    }

    if (typeof source?.lastReportedTotal === 'number') {
        return source.lastReportedTotal
    }

    if (typeof run?.source?.lastReportedTotal === 'number') {
        return run.source.lastReportedTotal
    }

    return null
}

function resolveCoverageCompleteness(run, stopReason) {
    if (!run) {
        return CRAWL_COVERAGE_COMPLETENESS.UNKNOWN
    }

    if (ACTIVE_RUN_STATUSES.has(run.status)) {
        return CRAWL_COVERAGE_COMPLETENESS.IN_PROGRESS
    }

    if (run.status === 'FAILED') {
        return CRAWL_COVERAGE_COMPLETENESS.FAILED
    }

    if (run.status === 'CANCELLED') {
        return CRAWL_COVERAGE_COMPLETENESS.CANCELLED
    }

    if (stopReason === 'exhausted_source') {
        return CRAWL_COVERAGE_COMPLETENESS.PUBLIC_CHAIN_EXHAUSTED
    }

    if (run.status === 'PARTIAL') {
        return CRAWL_COVERAGE_COMPLETENESS.PARTIAL
    }

    if (run.status === 'COMPLETED') {
        return CRAWL_COVERAGE_COMPLETENESS.COMPLETED
    }

    return CRAWL_COVERAGE_COMPLETENESS.UNKNOWN
}

function resolveMismatchStatus(reportedTotal, extractedCount) {
    if (typeof reportedTotal !== 'number') {
        return CRAWL_COVERAGE_MISMATCH_STATUS.UNAVAILABLE
    }

    if (reportedTotal === extractedCount) {
        return CRAWL_COVERAGE_MISMATCH_STATUS.MATCHED
    }

    if (reportedTotal > extractedCount) {
        return CRAWL_COVERAGE_MISMATCH_STATUS.REPORTED_TOTAL_EXCEEDS_EXTRACTED
    }

    return CRAWL_COVERAGE_MISMATCH_STATUS.EXTRACTED_EXCEEDS_REPORTED_TOTAL
}

function buildOperatorPolicy(run, mismatchStatus, stopReason) {
    if (!run) {
        return {
            code: CRAWL_COVERAGE_POLICY.NONE,
            actionRequired: false,
            summary: 'No crawl coverage policy is available for this run.',
        }
    }

    if (ACTIVE_RUN_STATUSES.has(run.status)) {
        return {
            code: CRAWL_COVERAGE_POLICY.WAIT_FOR_TERMINAL_RUN,
            actionRequired: false,
            summary:
                'Wait for this active crawl run to reach a terminal state before interpreting reported-total coverage.',
        }
    }

    if (run.status === 'FAILED') {
        return {
            code: CRAWL_COVERAGE_POLICY.REVIEW_FAILED_RUN,
            actionRequired: true,
            summary:
                'This crawl run failed before coverage could be determined. Inspect the failure and retry or resume if needed.',
        }
    }

    if (run.status === 'CANCELLED') {
        return {
            code: CRAWL_COVERAGE_POLICY.RUN_CANCELLED,
            actionRequired: false,
            summary:
                'This crawl run was cancelled intentionally, so its reported-total coverage remains incomplete by design.',
        }
    }

    if (stopReason === 'premature_exhaustion') {
        return {
            code: CRAWL_COVERAGE_POLICY.RESUME_FROM_CHECKPOINT,
            actionRequired: true,
            summary:
                'Google Maps stopped returning pages before the public review chain could be fully traversed. Resume from the saved checkpoint if deeper backfill coverage is still required.',
        }
    }

    if (
        mismatchStatus === CRAWL_COVERAGE_MISMATCH_STATUS.REPORTED_TOTAL_EXCEEDS_EXTRACTED &&
        stopReason === 'exhausted_source'
    ) {
        return {
            code: CRAWL_COVERAGE_POLICY.REPORTED_TOTAL_IS_ADVISORY,
            actionRequired: false,
            summary:
                'The public review chain was exhausted before the Google-reported total was reached. Treat reportedTotal as advisory rather than as proof that more crawlable public reviews remain.',
        }
    }

    if (run.status === 'PARTIAL') {
        return {
            code: CRAWL_COVERAGE_POLICY.REVIEW_PARTIAL_RUN,
            actionRequired: true,
            summary:
                'This crawl run ended partially. Review its warnings before deciding whether a larger budget or a resume action is needed.',
        }
    }

    return {
        code: CRAWL_COVERAGE_POLICY.NONE,
        actionRequired: false,
        summary:
            mismatchStatus === CRAWL_COVERAGE_MISMATCH_STATUS.MATCHED
                ? 'Reported total and extracted public coverage are aligned for this run.'
                : 'No special operator action is required for this run.',
    }
}

function buildRunCoverage(run, source = run?.source) {
    if (!run) {
        return null
    }

    const reportedTotal = resolveReportedTotal(run, source)
    const extractedCount = typeof run.extractedCount === 'number' ? run.extractedCount : 0
    const reportedTotalDelta =
        typeof reportedTotal === 'number' ? reportedTotal - extractedCount : null
    const stopReason = resolveRunStopReason(run)
    const mismatchStatus = resolveMismatchStatus(reportedTotal, extractedCount)
    const completeness = resolveCoverageCompleteness(run, stopReason)

    return {
        completeness,
        reportedTotal,
        extractedCount,
        reportedTotalDelta,
        mismatchStatus,
        mismatchDetected:
            mismatchStatus === CRAWL_COVERAGE_MISMATCH_STATUS.REPORTED_TOTAL_EXCEEDS_EXTRACTED ||
            mismatchStatus === CRAWL_COVERAGE_MISMATCH_STATUS.EXTRACTED_EXCEEDS_REPORTED_TOTAL,
        publicReviewChainExhausted: stopReason === 'exhausted_source',
        stopReason,
        operatorPolicy: buildOperatorPolicy(run, mismatchStatus, stopReason),
    }
}

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
        crawlCoverage: buildRunCoverage(run, options.source || run.source),
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
            delayMs: input.delayMs ?? 0,
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
    CRAWL_COVERAGE_COMPLETENESS,
    CRAWL_COVERAGE_MISMATCH_STATUS,
    CRAWL_COVERAGE_POLICY,
    RESUMABLE_RUN_STATUSES,
    TERMINAL_RUN_STATUSES,
    buildIntakeBatchTitle,
    buildRunCoverage,
    clampRunBudget,
    computeFailureRetryAt,
    computeNextScheduledAt,
    mapRun,
    mapSource,
}
