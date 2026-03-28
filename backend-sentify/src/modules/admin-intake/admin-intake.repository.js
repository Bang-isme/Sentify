const prisma = require('../../lib/prisma')

function buildBatchInclude(includeItems = false) {
    return {
        items: includeItems
            ? {
                  orderBy: [{ createdAt: 'asc' }],
              }
            : {
                  select: {
                      id: true,
                      approvalStatus: true,
                      canonicalReviewId: true,
                  },
              },
    }
}

async function createBatch(data) {
    return prisma.reviewIntakeBatch.create({
        data,
        include: buildBatchInclude(false),
    })
}

async function listBatchesByRestaurant(restaurantId) {
    return prisma.reviewIntakeBatch.findMany({
        where: {
            restaurantId,
        },
        include: buildBatchInclude(false),
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
}

async function findBatchById(batchId, options = {}) {
    return prisma.reviewIntakeBatch.findUnique({
        where: {
            id: batchId,
        },
        include: buildBatchInclude(Boolean(options.includeItems)),
    })
}

async function findOpenBatchByCrawlSourceId(crawlSourceId, options = {}) {
    return prisma.reviewIntakeBatch.findFirst({
        where: {
            crawlSourceId,
            status: {
                in: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
            },
        },
        include: buildBatchInclude(Boolean(options.includeItems)),
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
}

async function createItems(batchId, restaurantId, items) {
    if (!items.length) {
        return { count: 0 }
    }

    return prisma.reviewIntakeItem.createMany({
        data: items.map((item) => ({
            batchId,
            restaurantId,
            ...item,
        })),
    })
}

async function updateItem(itemId, data) {
    return prisma.reviewIntakeItem.update({
        where: {
            id: itemId,
        },
        data,
    })
}

async function updateItemsMany(itemIds, data) {
    if (!itemIds.length) {
        return { count: 0 }
    }

    return prisma.reviewIntakeItem.updateMany({
        where: {
            id: {
                in: itemIds,
            },
        },
        data,
    })
}

async function deleteItem(itemId) {
    return prisma.reviewIntakeItem.delete({
        where: {
            id: itemId,
        },
    })
}

async function findItemById(itemId) {
    return prisma.reviewIntakeItem.findUnique({
        where: {
            id: itemId,
        },
        include: {
            batch: {
                include: buildBatchInclude(true),
            },
        },
    })
}

async function updateBatch(batchId, data) {
    return prisma.reviewIntakeBatch.update({
        where: {
            id: batchId,
        },
        data,
        include: buildBatchInclude(true),
    })
}

async function deleteBatch(batchId) {
    return prisma.reviewIntakeBatch.delete({
        where: {
            id: batchId,
        },
    })
}

async function publishApprovedItems({
    batchId,
    restaurantId,
    batchCrawlSourceId,
    batchStatus,
    batchPublishedAt,
    batchPublishedByUserId,
    items,
}) {
    return prisma.$transaction(async (tx) => {
        const publishedReviewIds = []
        const publishLineageRows = []
        const newItems = []
        const reviewPayloads = items
            .filter((item) => !item.canonicalReviewId)
            .map((item) => item.reviewPayload)
        const crawlExternalKeys = batchCrawlSourceId
            ? [...new Set(items.map((item) => item.sourceExternalId).filter(Boolean))]
            : []
        const existingReviewIdByExternalId =
            reviewPayloads.length > 0
                ? new Map(
                      (
                          await tx.review.findMany({
                              where: {
                                  restaurantId: reviewPayloads[0].restaurantId,
                                  externalId: {
                                      in: reviewPayloads.map((payload) => payload.externalId),
                                  },
                              },
                              select: {
                                  id: true,
                                  externalId: true,
                              },
                          })
                      ).map((review) => [review.externalId, review.id]),
                  )
                : new Map()
        const rawReviewByExternalKey =
            batchCrawlSourceId && crawlExternalKeys.length > 0
                ? new Map(
                      (
                          await tx.reviewCrawlRawReview.findMany({
                              where: {
                                  sourceId: batchCrawlSourceId,
                                  externalReviewKey: {
                                      in: crawlExternalKeys,
                                  },
                              },
                              select: {
                                  id: true,
                                  externalReviewKey: true,
                                  firstSeenRunId: true,
                                  lastSeenRunId: true,
                              },
                          })
                      ).map((entry) => [entry.externalReviewKey, entry]),
                  )
                : new Map()

        function appendPublishLineage(item, reviewId) {
            const rawReview =
                batchCrawlSourceId && item.sourceExternalId
                    ? rawReviewByExternalKey.get(item.sourceExternalId) ?? null
                    : null

            publishLineageRows.push({
                reviewId,
                restaurantId,
                batchId,
                intakeItemId: item.id,
                crawlSourceId: batchCrawlSourceId ?? null,
                crawlRunId: rawReview?.lastSeenRunId ?? rawReview?.firstSeenRunId ?? null,
                rawReviewId: rawReview?.id ?? null,
                rawReviewExternalKey: item.sourceExternalId ?? null,
                publishedByUserId: batchPublishedByUserId ?? null,
                publishedAt: batchPublishedAt,
            })
        }

        for (const item of items) {
            const reviewPayload = item.reviewPayload

            if (item.canonicalReviewId) {
                await tx.review.update({
                    where: {
                        id: item.canonicalReviewId,
                    },
                    data: reviewPayload,
                })

                publishedReviewIds.push(item.canonicalReviewId)
                appendPublishLineage(item, item.canonicalReviewId)
                continue
            }

            const existingReviewId = existingReviewIdByExternalId.get(reviewPayload.externalId)

            if (existingReviewId) {
                await tx.review.update({
                    where: {
                        id: existingReviewId,
                    },
                    data: reviewPayload,
                })

                publishedReviewIds.push(existingReviewId)

                await tx.reviewIntakeItem.update({
                    where: { id: item.id },
                    data: { canonicalReviewId: existingReviewId },
                })

                appendPublishLineage(item, existingReviewId)

                continue
            }

            newItems.push(item)
        }

        if (newItems.length > 0) {
            const reviewPayloads = newItems.map((item) => item.reviewPayload)

            await tx.review.createMany({
                data: reviewPayloads,
                skipDuplicates: true,
            })

            const createdReviews = await tx.review.findMany({
                where: {
                    restaurantId: reviewPayloads[0].restaurantId,
                    externalId: {
                        in: reviewPayloads.map((payload) => payload.externalId),
                    },
                },
                select: {
                    id: true,
                    externalId: true,
                },
            })
            const reviewIdByExternalId = new Map(
                createdReviews.map((review) => [review.externalId, review.id]),
            )

            const updatePromises = newItems.map((item) => {
                const reviewId = reviewIdByExternalId.get(item.reviewPayload.externalId)

                if (!reviewId) {
                    throw new Error('Failed to resolve published review id for intake item')
                }

                publishedReviewIds.push(reviewId)
                appendPublishLineage(item, reviewId)

                return tx.reviewIntakeItem.update({
                    where: { id: item.id },
                    data: { canonicalReviewId: reviewId },
                })
            })

            await Promise.all(updatePromises)
        }

        if (publishLineageRows.length > 0) {
            await tx.reviewPublishEvent.createMany({
                data: publishLineageRows,
                skipDuplicates: true,
            })
        }

        const updatedBatch = await tx.reviewIntakeBatch.update({
            where: {
                id: batchId,
            },
            data: {
                status: batchStatus,
                publishedAt: batchPublishedAt,
                publishedByUserId: batchPublishedByUserId ?? null,
            },
            include: buildBatchInclude(true),
        })

        return {
            batch: updatedBatch,
            publishedReviewIds,
        }
    })
}

module.exports = {
    createBatch,
    createItems,
    deleteBatch,
    deleteItem,
    findBatchById,
    findOpenBatchByCrawlSourceId,
    findItemById,
    listBatchesByRestaurant,
    publishApprovedItems,
    updateBatch,
    updateItem,
    updateItemsMany,
}
