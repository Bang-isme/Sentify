const prisma = require('../../lib/prisma')

const ACTIVE_RUN_UNIQUE_INDEX = 'ReviewCrawlRun_sourceId_active_unique'

function buildRunInclude(options = {}) {
    return {
        source: Boolean(options.includeSource),
        intakeBatch: Boolean(options.includeIntakeBatch)
            ? {
                  select: {
                      id: true,
                      status: true,
                      title: true,
                  },
              }
            : false,
    }
}

function buildSourceInclude(options = {}) {
    return {
        runs: options.includeLatestRun
            ? {
                  include: buildRunInclude({
                      includeSource: false,
                      includeIntakeBatch: true,
                  }),
                  orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }],
                  take: 1,
              }
            : false,
        intakeBatches: options.includeOpenDraftBatch
            ? {
                  where: {
                      status: {
                          in: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
                      },
                  },
                  orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                  take: 1,
                  select: {
                      id: true,
                      status: true,
                      title: true,
                      updatedAt: true,
                      createdAt: true,
                  },
              }
            : false,
    }
}

function isActiveRunUniqueViolation(error) {
    if (!error) {
        return false
    }

    const message = `${error.message ?? ''} ${error.meta?.database_error ?? ''}`
    return (
        error.code === 'P2002' ||
        message.includes(ACTIVE_RUN_UNIQUE_INDEX) ||
        message.includes('duplicate key value violates unique constraint')
    )
}

async function upsertSourceByCanonicalIdentity(identity, createData, updateData) {
    return prisma.reviewCrawlSource.upsert({
        where: {
            restaurantId_provider_canonicalCid: identity,
        },
        create: {
            ...identity,
            ...createData,
        },
        update: updateData,
    })
}

async function findSourceByCanonicalIdentity(identity, options = {}) {
    return prisma.reviewCrawlSource.findUnique({
        where: {
            restaurantId_provider_canonicalCid: identity,
        },
        include: buildSourceInclude(options),
    })
}

async function findSourceById(sourceId, options = {}) {
    return prisma.reviewCrawlSource.findUnique({
        where: { id: sourceId },
        include: buildSourceInclude(options),
    })
}

async function listSourcesByRestaurant(restaurantId) {
    return prisma.reviewCrawlSource.findMany({
        where: {
            restaurantId,
        },
        include: buildSourceInclude({
            includeLatestRun: true,
            includeOpenDraftBatch: true,
        }),
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
}

async function listDueSources(now, limit) {
    return prisma.reviewCrawlSource.findMany({
        where: {
            status: 'ACTIVE',
            syncEnabled: true,
            nextScheduledAt: {
                lte: now,
            },
        },
        orderBy: [{ nextScheduledAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
    })
}

async function findActiveRunBySourceId(sourceId) {
    return prisma.reviewCrawlRun.findFirst({
        where: {
            sourceId,
            status: {
                in: ['QUEUED', 'RUNNING'],
            },
        },
        orderBy: [{ queuedAt: 'desc' }],
    })
}

async function createRun(data) {
    try {
        return await prisma.reviewCrawlRun.create({
            data,
            include: buildRunInclude({ includeSource: true }),
        })
    } catch (error) {
        if (isActiveRunUniqueViolation(error)) {
            error.isActiveRunUniqueViolation = true
        }

        throw error
    }
}

async function findRunById(runId, options = {}) {
    return prisma.reviewCrawlRun.findUnique({
        where: { id: runId },
        include: buildRunInclude(options),
    })
}

async function updateRun(runId, data, options = {}) {
    return prisma.reviewCrawlRun.update({
        where: { id: runId },
        data,
        include: buildRunInclude(options),
    })
}

async function updateRunMany(where, data) {
    return prisma.reviewCrawlRun.updateMany({
        where,
        data,
    })
}

async function updateSource(sourceId, data) {
    return prisma.reviewCrawlSource.update({
        where: { id: sourceId },
        data,
    })
}

async function listRunsBySource(sourceId, options = {}) {
    const take = options.take ?? 20
    const skip = options.skip ?? 0

    const [runs, totalCount] = await prisma.$transaction([
        prisma.reviewCrawlRun.findMany({
            where: {
                sourceId,
            },
            include: buildRunInclude({
                includeSource: true,
                includeIntakeBatch: true,
            }),
            orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.reviewCrawlRun.count({
            where: {
                sourceId,
            },
        }),
    ])

    return {
        runs,
        totalCount,
    }
}

async function findRawReviewsBySourceAndKeys(sourceId, externalReviewKeys) {
    if (externalReviewKeys.length === 0) {
        return []
    }

    return prisma.reviewCrawlRawReview.findMany({
        where: {
            sourceId,
            externalReviewKey: {
                in: externalReviewKeys,
            },
        },
    })
}

async function upsertRawReview(sourceId, externalReviewKey, data) {
    return prisma.reviewCrawlRawReview.upsert({
        where: {
            sourceId_externalReviewKey: {
                sourceId,
                externalReviewKey,
            },
        },
        create: {
            sourceId,
            externalReviewKey,
            ...data,
        },
        update: data,
    })
}

async function listRunRawReviews(runId) {
    return prisma.reviewCrawlRawReview.findMany({
        where: {
            lastSeenRunId: runId,
        },
        orderBy: [{ reviewDate: 'desc' }, { updatedAt: 'desc' }],
    })
}

async function listSourceRawReviewsSince(sourceId, sinceDate) {
    return prisma.reviewCrawlRawReview.findMany({
        where: {
            sourceId,
            ...(sinceDate
                ? {
                      updatedAt: {
                          gte: sinceDate,
                      },
                  }
                : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { reviewDate: 'desc' }],
    })
}

async function countDueSources(now, restaurantId = null) {
    return prisma.reviewCrawlSource.count({
        where: {
            ...(restaurantId ? { restaurantId } : {}),
            status: 'ACTIVE',
            syncEnabled: true,
            nextScheduledAt: {
                lte: now,
            },
        },
    })
}

module.exports = {
    countDueSources,
    createRun,
    findActiveRunBySourceId,
    findRawReviewsBySourceAndKeys,
    findRunById,
    findSourceByCanonicalIdentity,
    findSourceById,
    isActiveRunUniqueViolation,
    listDueSources,
    listRunRawReviews,
    listSourceRawReviewsSince,
    listRunsBySource,
    listSourcesByRestaurant,
    updateRun,
    updateRunMany,
    updateSource,
    upsertRawReview,
    upsertSourceByCanonicalIdentity,
}
