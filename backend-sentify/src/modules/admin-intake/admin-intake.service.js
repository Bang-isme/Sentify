const { badRequest, conflict, notFound } = require('../../lib/app-error')
const { getRestaurantAccess } = require('../../services/restaurant-access.service')
const { analyzeReviewSync } = require('../../services/sentiment-analyzer.service')
const { recalculateRestaurantInsights } = require('../../services/insight.service')
const repository = require('./admin-intake.repository')

function summarizeBatchItems(items) {
    return items.reduce(
        (summary, item) => {
            summary.totalItems += 1

            if (item.approvalStatus === 'APPROVED') {
                summary.approvedItems += 1
            } else if (item.approvalStatus === 'REJECTED') {
                summary.rejectedItems += 1
            } else {
                summary.pendingItems += 1
            }

            if (item.canonicalReviewId) {
                summary.publishedItems += 1
            }

            return summary
        },
        {
            totalItems: 0,
            pendingItems: 0,
            approvedItems: 0,
            rejectedItems: 0,
            publishedItems: 0,
        },
    )
}

function deriveBatchStatus(batch, items) {
    if (!items.length) {
        return 'DRAFT'
    }

    if (batch.status === 'PUBLISHED') {
        return 'PUBLISHED'
    }

    const summary = summarizeBatchItems(items)

    if (summary.approvedItems > 0 && summary.pendingItems === 0) {
        return 'READY_TO_PUBLISH'
    }

    if (summary.approvedItems > 0 || summary.rejectedItems > 0) {
        return 'IN_REVIEW'
    }

    return 'DRAFT'
}

function mapBatch(batch, options = {}) {
    const items = Array.isArray(batch.items) ? batch.items : []
    const counts = summarizeBatchItems(items)

    return {
        id: batch.id,
        restaurantId: batch.restaurantId,
        createdByUserId: batch.createdByUserId,
        title: batch.title ?? null,
        sourceType: batch.sourceType,
        status: batch.status,
        publishedAt: batch.publishedAt,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        counts,
        ...(options.includeItems
            ? {
                  items: items.map((item) => ({
                      id: item.id,
                      batchId: item.batchId,
                      restaurantId: item.restaurantId,
                      rawAuthorName: item.rawAuthorName ?? null,
                      rawRating: item.rawRating ?? null,
                      rawContent: item.rawContent ?? null,
                      rawReviewDate: item.rawReviewDate ?? null,
                      normalizedAuthorName: item.normalizedAuthorName ?? null,
                      normalizedRating: item.normalizedRating ?? null,
                      normalizedContent: item.normalizedContent ?? null,
                      normalizedReviewDate: item.normalizedReviewDate ?? null,
                      approvalStatus: item.approvalStatus,
                      reviewerNote: item.reviewerNote ?? null,
                      canonicalReviewId: item.canonicalReviewId ?? null,
                      createdAt: item.createdAt,
                      updatedAt: item.updatedAt,
                  })),
              }
            : {}),
    }
}

function resolveEditableBatch(batch) {
    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    if (batch.status === 'PUBLISHED' || batch.status === 'ARCHIVED') {
        throw conflict(
            'INTAKE_BATCH_LOCKED',
            'This review batch is already published or archived',
        )
    }
}

function normalizeIncomingItem(item) {
    return {
        rawAuthorName: item.rawAuthorName ?? null,
        rawRating: item.rawRating,
        rawContent: item.rawContent ?? null,
        rawReviewDate: item.rawReviewDate ?? null,
        normalizedAuthorName: item.rawAuthorName ?? null,
        normalizedRating: item.rawRating,
        normalizedContent: item.rawContent ?? null,
        normalizedReviewDate: item.rawReviewDate ?? null,
    }
}

function buildRawItemKey(item) {
    const dateValue =
        item.rawReviewDate instanceof Date
            ? item.rawReviewDate.toISOString()
            : item.rawReviewDate || ''

    return [
        item.rawAuthorName ?? '',
        item.rawRating ?? '',
        item.rawContent ?? '',
        dateValue,
    ].join('|')
}

function resolveDeletableBatch(batch) {
    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    if (!['DRAFT', 'IN_REVIEW'].includes(batch.status)) {
        throw conflict(
            'INTAKE_BATCH_NOT_DELETABLE',
            'Only draft or in-review batches can be deleted',
        )
    }
}

function resolvePublishedField(preferredValue, fallbackValue = null) {
    if (preferredValue === undefined || preferredValue === null) {
        return fallbackValue
    }

    return preferredValue
}

function pickDefined(input, fieldMap) {
    return Object.entries(fieldMap).reduce((accumulator, [field, mapper]) => {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
            const value = input[field]
            accumulator[field] = typeof mapper === 'function' ? mapper(value, input) : value
        }

        return accumulator
    }, {})
}

function buildReviewPayload(restaurantId, item) {
    const rating = resolvePublishedField(item.normalizedRating, item.rawRating)

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw badRequest(
            'INTAKE_REVIEW_INVALID_RATING',
            'Each approved review item must have a rating between 1 and 5',
        )
    }

    const content = resolvePublishedField(item.normalizedContent, item.rawContent)
    const authorName = resolvePublishedField(item.normalizedAuthorName, item.rawAuthorName)
    const reviewDate = resolvePublishedField(item.normalizedReviewDate, item.rawReviewDate)
    const analysis = analyzeReviewSync({
        content,
        rating,
    })

    return {
        restaurantId,
        externalId: `manual-intake:${item.id}`,
        authorName,
        rating,
        content,
        sentiment: analysis.label,
        keywords: analysis.keywords,
        reviewDate,
    }
}

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
            buildRawItemKey({
                rawAuthorName: item.rawAuthorName,
                rawRating: item.rawRating,
                rawContent: item.rawContent,
                rawReviewDate: item.rawReviewDate,
            }),
        ),
    )

    const uniqueItems = []
    for (const item of items) {
        const key = buildRawItemKey(item)
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
