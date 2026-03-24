const { notFound } = require('../../lib/app-error')
const { getRestaurantAccess } = require('../../services/restaurant-access.service')
const adminIntakeDomain = require('../admin-intake/admin-intake.domain')
const adminIntakeRepository = require('../admin-intake/admin-intake.repository')
const adminIntakeService = require('../admin-intake/admin-intake.service')
const reviewCrawlDomain = require('../review-crawl/review-crawl.domain')
const {
    getRedisConnection,
    getReviewCrawlJob,
    getReviewCrawlQueueHealth,
} = require('../review-crawl/review-crawl.queue')
const reviewCrawlRepository = require('../review-crawl/review-crawl.repository')
const { readReviewCrawlWorkerHealth } = require('../review-crawl/review-crawl.runtime')
const reviewCrawlService = require('../review-crawl/review-crawl.service')

async function ensureRestaurantEditorAccess(userId, restaurantId) {
    return getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })
}

async function ensureSourceAccess(userId, sourceId, options = {}) {
    const source = await reviewCrawlRepository.findSourceById(sourceId, options)

    if (!source) {
        throw notFound('NOT_FOUND', 'Review crawl source not found')
    }

    await ensureRestaurantEditorAccess(userId, source.restaurantId)
    return source
}

async function ensureBatchAccess(userId, batchId) {
    const batch = await adminIntakeRepository.findBatchById(batchId, {
        includeItems: true,
    })

    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    await ensureRestaurantEditorAccess(userId, batch.restaurantId)
    return batch
}

function mapDraftBatch(batch) {
    if (!batch) {
        return null
    }

    return {
        id: batch.id,
        status: batch.status,
        title: batch.title ?? null,
        createdAt: batch.createdAt ?? null,
        updatedAt: batch.updatedAt ?? null,
    }
}

function buildDraftPolicy(source, run, options = {}) {
    return {
        mode: 'DRAFT',
        publishMode: 'MANUAL',
        appendToOpenDraft: true,
        activeDraftBatchId: run?.intakeBatchId ?? null,
        sourceId: source.id,
        reusedActiveRun: Boolean(options.reusedActiveRun),
    }
}

function determineDefaultStrategy(source, input) {
    if (input.strategy) {
        return input.strategy
    }

    return source.lastSuccessfulRunAt ? 'INCREMENTAL' : 'BACKFILL'
}

async function syncGoogleMapsToDraft({ userId, input }) {
    const sourceResult = await reviewCrawlService.upsertReviewCrawlSource({
        userId,
        input: {
            restaurantId: input.restaurantId,
            url: input.url,
            language: input.language ?? 'en',
            region: input.region ?? 'us',
            ...(Object.prototype.hasOwnProperty.call(input, 'syncEnabled')
                ? { syncEnabled: input.syncEnabled }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(input, 'syncIntervalMinutes')
                ? { syncIntervalMinutes: input.syncIntervalMinutes }
                : {}),
        },
    })

    const strategy = determineDefaultStrategy(sourceResult.source, input)
    const existingActiveRun = await reviewCrawlRepository.findActiveRunBySourceId(
        sourceResult.source.id,
    )
    const run = await reviewCrawlService.createReviewCrawlRun({
        userId,
        sourceId: sourceResult.source.id,
        trigger: 'review_ops',
        reuseActiveRun: true,
        metadata: {
            materializeMode: 'DRAFT',
            requestedVia: 'review_ops_sync_to_draft',
        },
        input: {
            strategy,
            priority: input.priority,
            maxPages: input.maxPages,
            maxReviews: input.maxReviews,
            pageSize: input.pageSize,
            delayMs: input.delayMs,
        },
    })

    return {
        source: sourceResult.source,
        run,
        draftPolicy: buildDraftPolicy(sourceResult.source, run, {
            reusedActiveRun: existingActiveRun,
        }),
    }
}

function mapOperatorSource(source) {
    const latestRun = Array.isArray(source.runs) ? source.runs[0] : null
    const openDraftBatch = Array.isArray(source.intakeBatches)
        ? source.intakeBatches[0]
        : null

    return {
        ...reviewCrawlDomain.mapSource(source),
        latestRun: reviewCrawlDomain.mapRun(latestRun, {
            includeSource: false,
            includeIntakeBatch: true,
        }),
        openDraftBatch: mapDraftBatch(openDraftBatch),
        overdueForSync: Boolean(
            source.syncEnabled &&
                source.status === 'ACTIVE' &&
                source.nextScheduledAt &&
                source.nextScheduledAt <= new Date(),
        ),
    }
}

async function listSources({ userId, restaurantId }) {
    await ensureRestaurantEditorAccess(userId, restaurantId)

    const [sources, queueHealth, workerHealth, overdueSourceCount] = await Promise.all([
        reviewCrawlRepository.listSourcesByRestaurant(restaurantId),
        getReviewCrawlQueueHealth(),
        readReviewCrawlWorkerHealth(getRedisConnection()),
        reviewCrawlRepository.countDueSources(new Date(), restaurantId),
    ])

    return {
        restaurantId,
        queueHealth,
        workerHealth,
        overdueSourceCount,
        sources: sources.map((source) => mapOperatorSource(source)),
    }
}

async function listSourceRuns({ userId, sourceId, page, limit }) {
    const source = await ensureSourceAccess(userId, sourceId)
    const safePage = page ?? 1
    const safeLimit = limit ?? 20
    const skip = (safePage - 1) * safeLimit
    const result = await reviewCrawlRepository.listRunsBySource(sourceId, {
        skip,
        take: safeLimit,
    })

    return {
        source: reviewCrawlDomain.mapSource(source),
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalCount: result.totalCount,
            totalPages: Math.max(1, Math.ceil(result.totalCount / safeLimit)),
        },
        runs: result.runs.map((run) =>
            reviewCrawlDomain.mapRun(run, {
                includeSource: true,
                includeIntakeBatch: true,
            }),
        ),
    }
}

async function getRunDetail({ userId, runId }) {
    const run = await reviewCrawlService.getReviewCrawlRun({
        userId,
        runId,
    })

    const queueJob = await getReviewCrawlJob(runId)
    const queueState = queueJob ? await queueJob.getState() : null

    return {
        run: {
            ...run,
            resumable: reviewCrawlDomain.RESUMABLE_RUN_STATUSES.has(run.status),
            materializable: ['COMPLETED', 'PARTIAL'].includes(run.status),
        },
        queueJob: queueJob
            ? {
                  id: queueJob.id,
                  name: queueJob.name,
                  state: queueState,
                  attemptsMade: queueJob.attemptsMade,
                  timestamp: queueJob.timestamp,
                  processedOn: queueJob.processedOn ?? null,
                  finishedOn: queueJob.finishedOn ?? null,
              }
            : null,
    }
}

async function disableSource({ userId, sourceId }) {
    const source = await ensureSourceAccess(userId, sourceId)
    const updated = await reviewCrawlRepository.updateSource(source.id, {
        status: 'DISABLED',
        nextScheduledAt: null,
    })

    return {
        source: reviewCrawlDomain.mapSource(updated),
    }
}

async function enableSource({ userId, sourceId }) {
    const source = await ensureSourceAccess(userId, sourceId)
    const nextScheduledAt =
        source.syncEnabled && source.syncIntervalMinutes
            ? reviewCrawlDomain.computeNextScheduledAt(new Date(), source.syncIntervalMinutes)
            : null
    const updated = await reviewCrawlRepository.updateSource(source.id, {
        status: 'ACTIVE',
        nextScheduledAt,
    })

    return {
        source: reviewCrawlDomain.mapSource(updated),
    }
}

function normalizeIssueCode(issue) {
    if (!issue) {
        return 'UNKNOWN_VALIDATION_ISSUE'
    }

    if (typeof issue === 'string') {
        return issue
    }

    if (typeof issue.code === 'string' && issue.code.trim() !== '') {
        return issue.code
    }

    return 'UNKNOWN_VALIDATION_ISSUE'
}

function summarizeValidationIssues(rawReviews) {
    const issueCounts = new Map()
    let invalidCount = 0

    for (const rawReview of rawReviews) {
        if (rawReview.validForIntake) {
            continue
        }

        invalidCount += 1
        const issues = Array.isArray(rawReview.validationIssues)
            ? rawReview.validationIssues
            : rawReview.validationIssues
              ? [rawReview.validationIssues]
              : []

        if (issues.length === 0) {
            issueCounts.set(
                'INTAKE_VALIDATION_FAILED',
                (issueCounts.get('INTAKE_VALIDATION_FAILED') ?? 0) + 1,
            )
            continue
        }

        for (const issue of issues) {
            const code = normalizeIssueCode(issue)
            issueCounts.set(code, (issueCounts.get(code) ?? 0) + 1)
        }
    }

    const topValidationIssues = [...issueCounts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
        .slice(0, 10)

    return {
        skippedInvalidCount: invalidCount,
        topValidationIssues,
    }
}

function buildPublishBlockingReasons(batch, items) {
    const blockingReasons = []
    const approvedItems = items.filter((item) => item.approvalStatus === 'APPROVED')
    const approvedItemErrors = []

    if (['PUBLISHED', 'ARCHIVED'].includes(batch.status)) {
        blockingReasons.push({
            code: 'BATCH_LOCKED',
            message: 'This batch is already published or archived',
        })
    }

    if (approvedItems.length === 0) {
        blockingReasons.push({
            code: 'NO_APPROVED_ITEMS',
            message: 'Approve at least one valid review item before publishing',
        })
    }

    for (const item of approvedItems) {
        try {
            adminIntakeDomain.buildReviewPayload(batch.restaurantId, item)
        } catch (error) {
            approvedItemErrors.push({
                itemId: item.id,
                code: error.code || 'INTAKE_ITEM_NOT_PUBLISHABLE',
                message: error.message,
            })
        }
    }

    if (approvedItemErrors.length > 0) {
        blockingReasons.push({
            code: 'APPROVED_ITEM_INVALID',
            message: 'One or more approved items no longer satisfy publish validation',
            count: approvedItemErrors.length,
            items: approvedItemErrors,
        })
    }

    return {
        publishAllowed: blockingReasons.length === 0,
        blockingReasons,
        approvedItemErrors,
    }
}

async function getBatchReadiness({ userId, batchId }) {
    const batch = await ensureBatchAccess(userId, batchId)
    const counts = adminIntakeDomain.summarizeBatchItems(batch.items || [])
    let bulkApprovableCount = 0

    for (const item of batch.items || []) {
        if (item.approvalStatus !== 'PENDING') {
            continue
        }

        try {
            adminIntakeDomain.buildReviewPayload(batch.restaurantId, item)
            bulkApprovableCount += 1
        } catch {}
    }

    const publishState = buildPublishBlockingReasons(batch, batch.items || [])
    const crawlDiagnostics =
        batch.crawlSourceId
            ? summarizeValidationIssues(
                  await reviewCrawlRepository.listSourceRawReviewsSince(
                      batch.crawlSourceId,
                      batch.createdAt,
                  ),
              )
            : {
                  skippedInvalidCount: 0,
                  topValidationIssues: [],
              }

    return {
        batch: adminIntakeDomain.mapBatch(batch, { includeItems: false }),
        counts,
        bulkApprovableCount,
        publishAllowed: publishState.publishAllowed,
        blockingReasons: publishState.blockingReasons,
        crawlDiagnostics,
    }
}

async function approveValidBatchItems({ userId, batchId, reviewerNote }) {
    const batch = await ensureBatchAccess(userId, batchId)
    adminIntakeDomain.resolveEditableBatch(batch)

    const approvableItemIds = []

    for (const item of batch.items || []) {
        if (item.approvalStatus !== 'PENDING') {
            continue
        }

        try {
            adminIntakeDomain.buildReviewPayload(batch.restaurantId, item)
            approvableItemIds.push(item.id)
        } catch {}
    }

    if (approvableItemIds.length > 0) {
        await adminIntakeRepository.updateItemsMany(approvableItemIds, {
            approvalStatus: 'APPROVED',
            ...(reviewerNote ? { reviewerNote } : {}),
        })
    }

    let persistedBatch = await adminIntakeRepository.findBatchById(batch.id, {
        includeItems: true,
    })
    const nextStatus = adminIntakeDomain.deriveBatchStatus(persistedBatch, persistedBatch.items)

    if (nextStatus !== persistedBatch.status) {
        persistedBatch = await adminIntakeRepository.updateBatch(batch.id, {
            status: nextStatus,
        })
    }

    return {
        batch: adminIntakeDomain.mapBatch(persistedBatch, { includeItems: true }),
        approvedCount: approvableItemIds.length,
        skippedCount: (batch.items || []).filter((item) => item.approvalStatus === 'PENDING')
            .length - approvableItemIds.length,
    }
}

async function publishBatch({ userId, batchId }) {
    return adminIntakeService.publishReviewBatch({
        userId,
        batchId,
    })
}

module.exports = {
    approveValidBatchItems,
    disableSource,
    enableSource,
    getBatchReadiness,
    getRunDetail,
    listSourceRuns,
    listSources,
    publishBatch,
    syncGoogleMapsToDraft,
}
