const { badRequest, notFound } = require('../../lib/app-error')
const { getRestaurantAccess } = require('../../services/restaurant-access.service')
const { recalculateRestaurantInsights } = require('../../services/insight.service')
const {
    buildIntakeItemDedupKey,
    buildReviewPayload,
    buildRawItemKey,
    deriveBatchStatus,
    mapBatch,
    normalizeIncomingItem,
    pickDefined,
    resolveDeletableBatch,
    resolveEditableBatch,
    summarizeBatchItems,
} = require('./admin-intake.domain')
const repository = require('./admin-intake.repository')

async function ensureRestaurantEditorAccess(userId, restaurantId) {
    return getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })
}

async function createReviewBatch({ userId, restaurantId, sourceType, title }) {
    await ensureRestaurantEditorAccess(userId, restaurantId)

    const batch = await repository.createBatch({
        restaurantId,
        createdByUserId: userId,
        sourceType,
        title: title ?? null,
    })

    return mapBatch(batch)
}

async function listReviewBatches({ userId, restaurantId }) {
    await ensureRestaurantEditorAccess(userId, restaurantId)

    const batches = await repository.listBatchesByRestaurant(restaurantId)
    return batches.map((batch) => mapBatch(batch))
}

async function getReviewBatch({ userId, batchId }) {
    const batch = await repository.findBatchById(batchId, {
        includeItems: true,
    })

    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    await ensureRestaurantEditorAccess(userId, batch.restaurantId)
    return mapBatch(batch, { includeItems: true })
}

async function addReviewItems({ userId, batchId, items }) {
    const batch = await repository.findBatchById(batchId, {
        includeItems: true,
    })

    resolveEditableBatch(batch)
    await ensureRestaurantEditorAccess(userId, batch.restaurantId)

    await repository.createItems(
        batch.id,
        batch.restaurantId,
        items.map(normalizeIncomingItem),
    )

    const updatedBatch = await repository.findBatchById(batchId, {
        includeItems: true,
    })
    const nextStatus = deriveBatchStatus(updatedBatch, updatedBatch.items)

    const persistedBatch =
        nextStatus === updatedBatch.status
            ? updatedBatch
            : await repository.updateBatch(batchId, {
                  status: nextStatus,
              })

    return mapBatch(persistedBatch, { includeItems: true })
}

async function addReviewItemsBulk({ userId, batchId, items }) {
    const batch = await repository.findBatchById(batchId, {
        includeItems: true,
    })

    resolveEditableBatch(batch)
    await ensureRestaurantEditorAccess(userId, batch.restaurantId)

    const existingKeys = new Set(
        (batch.items || []).map((item) =>
            buildIntakeItemDedupKey({
                sourceProvider: item.sourceProvider,
                sourceExternalId: item.sourceExternalId,
                rawAuthorName: item.rawAuthorName,
                rawRating: item.rawRating,
                rawContent: item.rawContent,
                rawReviewDate: item.rawReviewDate,
            }),
        ),
    )

    const uniqueItems = []
    for (const item of items) {
        const key = buildIntakeItemDedupKey(item)
        if (existingKeys.has(key)) {
            continue
        }

        existingKeys.add(key)
        uniqueItems.push(item)
    }

    if (uniqueItems.length > 0) {
        await repository.createItems(
            batch.id,
            batch.restaurantId,
            uniqueItems.map(normalizeIncomingItem),
        )
    }

    const updatedBatch = await repository.findBatchById(batchId, {
        includeItems: true,
    })
    const nextStatus = deriveBatchStatus(updatedBatch, updatedBatch.items)

    const persistedBatch =
        nextStatus === updatedBatch.status
            ? updatedBatch
            : await repository.updateBatch(batchId, {
                  status: nextStatus,
              })

    return mapBatch(persistedBatch, { includeItems: true })
}

async function updateReviewItem({ userId, itemId, input }) {
    const item = await repository.findItemById(itemId)

    if (!item) {
        throw notFound('NOT_FOUND', 'Review item not found')
    }

    resolveEditableBatch(item.batch)
    await ensureRestaurantEditorAccess(userId, item.restaurantId)

    const updates = pickDefined(input, {
        normalizedAuthorName: (value) => value ?? null,
        normalizedRating: (value) => value ?? null,
        normalizedContent: (value) => value ?? null,
        normalizedReviewDate: (value) => value ?? null,
        approvalStatus: (value) => value,
        reviewerNote: (value) => value ?? null,
    })

    const candidateItem = {
        ...item,
        ...updates,
    }
    const nextApprovalStatus = updates.approvalStatus ?? item.approvalStatus

    if (nextApprovalStatus === 'APPROVED') {
        buildReviewPayload(item.restaurantId, candidateItem)
    }

    await repository.updateItem(itemId, updates)

    const updatedBatch = await repository.findBatchById(item.batchId, {
        includeItems: true,
    })
    const nextStatus = deriveBatchStatus(updatedBatch, updatedBatch.items)

    const persistedBatch =
        nextStatus === updatedBatch.status
            ? updatedBatch
            : await repository.updateBatch(updatedBatch.id, {
                  status: nextStatus,
              })

    return mapBatch(persistedBatch, { includeItems: true })
}

async function deleteReviewItem({ userId, itemId }) {
    const item = await repository.findItemById(itemId)

    if (!item) {
        throw notFound('NOT_FOUND', 'Review item not found')
    }

    resolveEditableBatch(item.batch)
    await ensureRestaurantEditorAccess(userId, item.restaurantId)

    await repository.deleteItem(itemId)

    const updatedBatch = await repository.findBatchById(item.batchId, {
        includeItems: true,
    })
    const nextStatus = deriveBatchStatus(updatedBatch, updatedBatch.items)

    const persistedBatch =
        nextStatus === updatedBatch.status
            ? updatedBatch
            : await repository.updateBatch(updatedBatch.id, {
                  status: nextStatus,
              })

    return mapBatch(persistedBatch, { includeItems: true })
}

async function deleteReviewBatch({ userId, batchId }) {
    const batch = await repository.findBatchById(batchId)

    resolveDeletableBatch(batch)
    await ensureRestaurantEditorAccess(userId, batch.restaurantId)

    await repository.deleteBatch(batchId)

    return {
        id: batch.id,
        restaurantId: batch.restaurantId,
        status: batch.status,
        deleted: true,
    }
}

async function publishReviewBatch({ userId, batchId }) {
    const batch = await repository.findBatchById(batchId, {
        includeItems: true,
    })

    resolveEditableBatch(batch)
    await ensureRestaurantEditorAccess(userId, batch.restaurantId)

    const approvedItems = batch.items.filter((item) => item.approvalStatus === 'APPROVED')

    if (approvedItems.length === 0) {
        throw badRequest(
            'INTAKE_BATCH_NOT_READY',
            'Approve at least one review item before publishing the batch',
        )
    }

    const publishResult = await repository.publishApprovedItems({
        batchId: batch.id,
        batchStatus: 'PUBLISHED',
        batchPublishedAt: new Date(),
        items: approvedItems.map((item) => ({
            ...item,
            reviewPayload: buildReviewPayload(batch.restaurantId, item),
        })),
    })

    await recalculateRestaurantInsights({
        restaurantId: batch.restaurantId,
    })

    return {
        batch: mapBatch(publishResult.batch, { includeItems: true }),
        publishedCount: approvedItems.length,
        publishedReviewIds: publishResult.publishedReviewIds,
    }
}

module.exports = {
    addReviewItems,
    addReviewItemsBulk,
    createReviewBatch,
    deleteReviewBatch,
    deleteReviewItem,
    getReviewBatch,
    listReviewBatches,
    publishReviewBatch,
    updateReviewItem,
    __private: {
        buildReviewPayload,
        buildRawItemKey,
        deriveBatchStatus,
        mapBatch,
        normalizeIncomingItem,
        summarizeBatchItems,
    },
}
