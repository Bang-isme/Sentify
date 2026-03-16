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
    batchStatus,
    batchPublishedAt,
    items,
}) {
    return prisma.$transaction(async (tx) => {
        const publishedReviewIds = []
        const newItems = []

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

                return tx.reviewIntakeItem.update({
                    where: { id: item.id },
                    data: { canonicalReviewId: reviewId },
                })
            })

            await Promise.all(updatePromises)
        }

        const updatedBatch = await tx.reviewIntakeBatch.update({
            where: {
                id: batchId,
            },
            data: {
                status: batchStatus,
                publishedAt: batchPublishedAt,
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
    findItemById,
    listBatchesByRestaurant,
    publishApprovedItems,
    updateBatch,
    updateItem,
}
