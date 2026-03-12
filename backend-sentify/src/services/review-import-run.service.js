const env = require('../config/env')
const prisma = require('../lib/prisma')
const { getRestaurantAccess } = require('./restaurant-access.service')
const reviewImportService = require('./review-import.service')

const ACTIVE_IMPORT_STATUSES = ['QUEUED', 'RUNNING']
const activeRestaurantRuns = new Set()
const DEFAULT_IMPORT_HISTORY_LIMIT = 6
const MAX_IMPORT_HISTORY_LIMIT = 20

function buildRunSummary(importRun) {
    if (!importRun) {
        return null
    }

    return {
        id: importRun.id,
        restaurantId: importRun.restaurantId,
        status: importRun.status,
        phase: importRun.phase,
        progressPercent: importRun.progressPercent,
        imported: importRun.imported,
        skipped: importRun.skipped,
        total: importRun.total,
        scrape: {
            source: importRun.scrapeSource,
            advertisedTotalReviews: importRun.advertisedTotalReviews,
            collectedReviewCount: importRun.collectedReviewCount,
            targetReviewCount: importRun.targetReviewCount,
            explicitTarget: importRun.explicitTarget,
            hardMaxReviews: importRun.hardMaxReviews,
            reachedRequestedTarget: importRun.reachedRequestedTarget,
            reachedEndOfFeed: importRun.reachedEndOfFeed,
            coveragePercentage: importRun.coveragePercentage,
            isCompleteSync: importRun.isCompleteSync,
        },
        message: importRun.message,
        errorCode: importRun.errorCode,
        errorMessage: importRun.errorMessage,
        errorDetails: importRun.errorDetails,
        startedAt: importRun.startedAt,
        completedAt: importRun.completedAt,
        failedAt: importRun.failedAt,
        createdAt: importRun.createdAt,
        updatedAt: importRun.updatedAt,
    }
}

function buildExpiredActiveRunWhere({ restaurantId } = {}) {
    const staleCutoff = new Date(Date.now() - env.IMPORT_RUN_STALE_MS)

    return {
        ...(restaurantId ? { restaurantId } : {}),
        OR: [
            {
                status: 'QUEUED',
                updatedAt: {
                    lt: staleCutoff,
                },
            },
            {
                status: 'RUNNING',
                updatedAt: {
                    lt: staleCutoff,
                },
            },
        ],
    }
}

async function failExpiredActiveRuns({ restaurantId } = {}) {
    const failedAt = new Date()

    return prisma.importRun.updateMany({
        where: buildExpiredActiveRunWhere({ restaurantId }),
        data: {
            status: 'FAILED',
            failedAt,
            phase: 'FAILED',
            progressPercent: 100,
            message: 'Import stopped because the worker stopped responding.',
            errorCode: 'IMPORT_WORKER_STALE',
            errorMessage: 'The import worker stopped sending heartbeats before the run could finish.',
        },
    })
}

async function getLatestImportRun({ userId, restaurantId }) {
    await getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })

    await failExpiredActiveRuns({ restaurantId })

    const importRun = await prisma.importRun.findFirst({
        where: {
            restaurantId,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    return buildRunSummary(importRun)
}

async function listImportRuns({ userId, restaurantId, limit = DEFAULT_IMPORT_HISTORY_LIMIT }) {
    await getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })

    await failExpiredActiveRuns({ restaurantId })

    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_IMPORT_HISTORY_LIMIT, 1), MAX_IMPORT_HISTORY_LIMIT)

    const importRuns = await prisma.importRun.findMany({
        where: {
            restaurantId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: safeLimit,
    })

    return importRuns.map(buildRunSummary)
}

async function recoverStaleImportRuns() {
    const now = new Date()

    await prisma.importRun.updateMany({
        where: {
            status: {
                in: ACTIVE_IMPORT_STATUSES,
            },
        },
        data: {
            status: 'FAILED',
            failedAt: now,
            phase: 'FAILED',
            progressPercent: 0,
            message: 'Import stopped before completion because the server restarted.',
            errorCode: 'IMPORT_WORKER_RESTARTED',
            errorMessage: 'The import worker stopped before the run could finish.',
        },
    })
}

function startRunHeartbeat(runId) {
    const heartbeatTimer = setInterval(() => {
        void prisma.importRun
            .updateMany({
                where: {
                    id: runId,
                    status: 'RUNNING',
                },
                data: {
                    updatedAt: new Date(),
                },
            })
            .catch(() => {})
    }, env.IMPORT_RUN_HEARTBEAT_MS)

    heartbeatTimer.unref?.()

    return heartbeatTimer
}

async function updateRunAsStarted(runId) {
    const startedAt = new Date()

    const result = await prisma.importRun.updateMany({
        where: {
            id: runId,
            status: 'QUEUED',
        },
        data: {
            status: 'RUNNING',
            startedAt,
            phase: 'SCRAPING',
            progressPercent: 5,
            message: 'Import is running.',
        },
    })

    return result.count > 0
}

async function markRunCompleted(runId, result) {
    const completedAt = new Date()

    await prisma.importRun.updateMany({
        where: {
            id: runId,
            status: 'RUNNING',
        },
        data: {
            status: 'COMPLETED',
            phase: 'COMPLETED',
            progressPercent: 100,
            imported: result.imported,
            skipped: result.skipped,
            total: result.total,
            scrapeSource: result.scrape.source,
            advertisedTotalReviews: result.scrape.advertisedTotalReviews,
            collectedReviewCount: result.scrape.collectedReviewCount,
            targetReviewCount: result.scrape.targetReviewCount,
            explicitTarget: result.scrape.explicitTarget,
            hardMaxReviews: result.scrape.hardMaxReviews,
            reachedRequestedTarget: result.scrape.reachedRequestedTarget,
            reachedEndOfFeed: result.scrape.reachedEndOfFeed,
            coveragePercentage: result.scrape.coveragePercentage,
            isCompleteSync: result.scrape.isCompleteSync,
            message: result.message,
            completedAt,
        },
    })
}

async function markRunFailed(runId, error) {
    const failedAt = new Date()

    await prisma.importRun.updateMany({
        where: {
            id: runId,
            status: {
                in: ACTIVE_IMPORT_STATUSES,
            },
        },
        data: {
            status: 'FAILED',
            failedAt,
            phase: 'FAILED',
            progressPercent: 100,
            message: error?.message || 'Import failed.',
            errorCode: error?.code || 'IMPORT_FAILED',
            errorMessage: error?.message || 'Import failed.',
            errorDetails: error?.details || null,
        },
    })
}

async function runImportJob(importRunId) {
    const importRun = await prisma.importRun.findUnique({
        where: {
            id: importRunId,
        },
        select: {
            id: true,
            restaurantId: true,
            requestedByUserId: true,
        },
    })

    if (!importRun) {
        return
    }

    const lockKey = importRun.restaurantId
    activeRestaurantRuns.add(lockKey)
    let heartbeatTimer = null

    try {
        const wasStarted = await updateRunAsStarted(importRun.id)

        if (!wasStarted) {
            return
        }

        heartbeatTimer = startRunHeartbeat(importRun.id)

        const result = await reviewImportService.importReviews({
            userId: importRun.requestedByUserId,
            restaurantId: importRun.restaurantId,
            onProgress: async (progress) => {
                await prisma.importRun.update({
                    where: {
                        id: importRun.id,
                    },
                    data: {
                        phase: progress.phase,
                        progressPercent: progress.progressPercent,
                        message: progress.message,
                    },
                })
            },
        })

        await markRunCompleted(importRun.id, result)
    } catch (error) {
        await markRunFailed(importRun.id, error)
    } finally {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
        }
        activeRestaurantRuns.delete(lockKey)
    }
}

function scheduleImportRun(importRunId) {
    setImmediate(() => {
        void runImportJob(importRunId)
    })
}

async function queueImportRun({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })

    if (!access.restaurant.googleMapUrl) {
        return reviewImportService.importReviews({ userId, restaurantId })
    }

    await failExpiredActiveRuns({ restaurantId })

    const activeImportRun = await prisma.importRun.findFirst({
        where: {
            restaurantId,
            status: {
                in: ACTIVE_IMPORT_STATUSES,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    if (activeImportRun) {
        return {
            queued: false,
            alreadyActive: true,
            run: buildRunSummary(activeImportRun),
            message: activeImportRun.message || 'An import is already running for this restaurant.',
        }
    }

    const importRun = await prisma.importRun.create({
        data: {
            restaurantId,
            requestedByUserId: userId,
            status: 'QUEUED',
            phase: 'QUEUED',
            progressPercent: 0,
            message: 'Import queued. The worker will start shortly.',
        },
    })

    scheduleImportRun(importRun.id)

    return {
        queued: true,
        alreadyActive: false,
        run: buildRunSummary(importRun),
        message: importRun.message,
    }
}

module.exports = {
    ACTIVE_IMPORT_STATUSES,
    buildRunSummary,
    listImportRuns,
    getLatestImportRun,
    queueImportRun,
    recoverStaleImportRuns,
    __private: {
        buildExpiredActiveRunWhere,
        failExpiredActiveRuns,
        markRunCompleted,
        markRunFailed,
        runImportJob,
        scheduleImportRun,
        startRunHeartbeat,
        updateRunAsStarted,
    },
}
