const prisma = require('../../lib/prisma')

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

async function findSourceById(sourceId) {
    return prisma.reviewCrawlSource.findUnique({
        where: { id: sourceId },
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
    return prisma.reviewCrawlRun.create({
        data,
        include: buildRunInclude({ includeSource: true }),
    })
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

module.exports = {
    createRun,
    findActiveRunBySourceId,
    findRawReviewsBySourceAndKeys,
    findRunById,
    findSourceById,
    listDueSources,
    listRunRawReviews,
    updateRun,
    updateRunMany,
    updateSource,
    upsertRawReview,
    upsertSourceByCanonicalIdentity,
}
