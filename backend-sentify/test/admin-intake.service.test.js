const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function withMock(modulePath, exports) {
    require.cache[require.resolve(modulePath)] = {
        id: require.resolve(modulePath),
        filename: require.resolve(modulePath),
        loaded: true,
        exports,
    }
}

function restoreModules() {
    clearModule('../src/modules/admin-intake/admin-intake.service')
    clearModule('../src/modules/admin-intake/admin-intake.repository')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/services/sentiment-analyzer.service')
    clearModule('../src/services/insight.service')
}

test('admin intake service creates a batch with editor access', async () => {
    restoreModules()

    let accessArgs = null
    let createdPayload = null

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async (args) => {
            accessArgs = args
            return { restaurant: { id: args.restaurantId } }
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        createBatch: async (payload) => {
            createdPayload = payload
            return {
                id: 'batch-1',
                restaurantId: payload.restaurantId,
                createdByUserId: payload.createdByUserId,
                title: payload.title,
                sourceType: payload.sourceType,
                status: 'DRAFT',
                publishedAt: null,
                createdAt: new Date('2026-03-10T00:00:00Z'),
                updatedAt: new Date('2026-03-10T00:00:00Z'),
                items: [],
            }
        },
    })

    const { createReviewBatch } = require('../src/modules/admin-intake/admin-intake.service')
    const result = await createReviewBatch({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        sourceType: 'MANUAL',
        title: 'March batch',
    })

    assert.equal(accessArgs.userId, 'user-1')
    assert.equal(accessArgs.restaurantId, 'restaurant-1')
    assert.deepEqual(accessArgs.allowedPermissions, ['OWNER', 'MANAGER'])
    assert.equal(createdPayload.title, 'March batch')
    assert.equal(result.status, 'DRAFT')
    assert.equal(result.counts.totalItems, 0)
    assert.equal(result.counts.pendingItems, 0)
    assert.equal(result.counts.approvedItems, 0)
    assert.equal(result.counts.rejectedItems, 0)

    restoreModules()
})

test('admin intake service adds items and updates batch status', async () => {
    restoreModules()

    let accessChecked = false
    let createItemsPayload = null
    let updateStatus = null
    let findCalls = 0

    const baseBatch = {
        id: 'batch-1',
        restaurantId: 'restaurant-1',
        createdByUserId: 'user-1',
        title: null,
        sourceType: 'MANUAL',
        status: 'DRAFT',
        publishedAt: null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    }

    const approvedItem = {
        id: 'item-1',
        batchId: 'batch-1',
        restaurantId: 'restaurant-1',
        rawAuthorName: 'Ana',
        rawRating: 5,
        rawContent: 'Great food',
        rawReviewDate: new Date('2026-03-01T00:00:00Z'),
        normalizedAuthorName: 'Ana',
        normalizedRating: 5,
        normalizedContent: 'Great food',
        normalizedReviewDate: new Date('2026-03-01T00:00:00Z'),
        approvalStatus: 'APPROVED',
        reviewerNote: null,
        canonicalReviewId: null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    }

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => {
            accessChecked = true
            return { restaurant: { id: 'restaurant-1' } }
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findBatchById: async () => {
            findCalls += 1
            if (findCalls === 1) {
                return { ...baseBatch, items: [] }
            }
            return { ...baseBatch, status: 'DRAFT', items: [approvedItem] }
        },
        createItems: async (batchId, restaurantId, items) => {
            createItemsPayload = { batchId, restaurantId, items }
            return items
        },
        updateBatch: async (batchId, data) => {
            updateStatus = data.status
            return { ...baseBatch, status: data.status, items: [approvedItem] }
        },
    })

    const { addReviewItems } = require('../src/modules/admin-intake/admin-intake.service')
    const result = await addReviewItems({
        userId: 'user-1',
        batchId: 'batch-1',
        items: [
            {
                rawAuthorName: 'Ana',
                rawRating: 5,
                rawContent: 'Great food',
                rawReviewDate: new Date('2026-03-01T00:00:00Z'),
            },
        ],
    })

    assert.equal(accessChecked, true)
    assert.equal(createItemsPayload.batchId, 'batch-1')
    assert.equal(createItemsPayload.items.length, 1)
    assert.equal(createItemsPayload.items[0].normalizedAuthorName, 'Ana')
    assert.equal(updateStatus, 'READY_TO_PUBLISH')
    assert.equal(result.status, 'READY_TO_PUBLISH')
    assert.equal(result.counts.approvedItems, 1)
    assert.equal(result.items.length, 1)

    restoreModules()
})

test('admin intake service updates an item and refreshes batch status', async () => {
    restoreModules()

    let accessChecked = false
    let updatePayload = null
    let updateStatus = null

    const baseBatch = {
        id: 'batch-1',
        restaurantId: 'restaurant-1',
        createdByUserId: 'user-1',
        title: null,
        sourceType: 'MANUAL',
        status: 'DRAFT',
        publishedAt: null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    }

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => {
            accessChecked = true
            return { restaurant: { id: 'restaurant-1' } }
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findItemById: async () => ({
            id: 'item-1',
            batchId: 'batch-1',
            restaurantId: 'restaurant-1',
            approvalStatus: 'PENDING',
            batch: {
                ...baseBatch,
                items: [
                    {
                        id: 'item-1',
                        approvalStatus: 'PENDING',
                        canonicalReviewId: null,
                    },
                ],
            },
        }),
        updateItem: async (itemId, data) => {
            updatePayload = { itemId, data }
            return { id: itemId, ...data }
        },
        findBatchById: async () => ({
            ...baseBatch,
            status: 'DRAFT',
            items: [
                {
                    id: 'item-1',
                    batchId: 'batch-1',
                    restaurantId: 'restaurant-1',
                    rawAuthorName: 'Ana',
                    rawRating: 4,
                    rawContent: 'Good',
                    rawReviewDate: new Date('2026-03-01T00:00:00Z'),
                    normalizedAuthorName: 'Ana',
                    normalizedRating: 4,
                    normalizedContent: 'Good',
                    normalizedReviewDate: new Date('2026-03-01T00:00:00Z'),
                    approvalStatus: 'APPROVED',
                    reviewerNote: null,
                    canonicalReviewId: null,
                    createdAt: new Date('2026-03-10T00:00:00Z'),
                    updatedAt: new Date('2026-03-10T00:00:00Z'),
                },
            ],
        }),
        updateBatch: async (batchId, data) => {
            updateStatus = data.status
            return {
                ...baseBatch,
                status: data.status,
                items: [
                    {
                        id: 'item-1',
                        batchId: 'batch-1',
                        restaurantId: 'restaurant-1',
                        rawAuthorName: 'Ana',
                        rawRating: 4,
                        rawContent: 'Good',
                        rawReviewDate: new Date('2026-03-01T00:00:00Z'),
                        normalizedAuthorName: 'Ana',
                        normalizedRating: 4,
                        normalizedContent: 'Good',
                        normalizedReviewDate: new Date('2026-03-01T00:00:00Z'),
                        approvalStatus: 'APPROVED',
                        reviewerNote: null,
                        canonicalReviewId: null,
                        createdAt: new Date('2026-03-10T00:00:00Z'),
                        updatedAt: new Date('2026-03-10T00:00:00Z'),
                    },
                ],
            }
        },
    })

    const { updateReviewItem } = require('../src/modules/admin-intake/admin-intake.service')
    const result = await updateReviewItem({
        userId: 'user-1',
        itemId: 'item-1',
        input: {
            normalizedRating: 4,
            approvalStatus: 'APPROVED',
        },
    })

    assert.equal(accessChecked, true)
    assert.equal(updatePayload.itemId, 'item-1')
    assert.equal(updatePayload.data.normalizedRating, 4)
    assert.equal(updatePayload.data.approvalStatus, 'APPROVED')
    assert.equal(updateStatus, 'READY_TO_PUBLISH')
    assert.equal(result.status, 'READY_TO_PUBLISH')
    assert.equal(result.counts.approvedItems, 1)

    restoreModules()
})

test('admin intake service rejects publish when no approved items exist', async () => {
    restoreModules()

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurant: { id: 'restaurant-1' } }),
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findBatchById: async () => ({
            id: 'batch-1',
            restaurantId: 'restaurant-1',
            status: 'IN_REVIEW',
            items: [
                {
                    id: 'item-1',
                    approvalStatus: 'PENDING',
                    canonicalReviewId: null,
                },
            ],
        }),
    })

    const { publishReviewBatch } = require('../src/modules/admin-intake/admin-intake.service')

    await assert.rejects(
        () => publishReviewBatch({ userId: 'user-1', batchId: 'batch-1' }),
        (error) => {
            assert.equal(error.code, 'INTAKE_BATCH_NOT_READY')
            return true
        },
    )

    restoreModules()
})

test('admin intake service publishes approved items and rebuilds insights', async () => {
    restoreModules()

    let accessChecked = false
    let publishArgs = null
    let recalculatedRestaurantId = null

    const batch = {
        id: 'batch-1',
        restaurantId: 'restaurant-1',
        createdByUserId: 'user-1',
        title: null,
        sourceType: 'MANUAL',
        status: 'IN_REVIEW',
        publishedAt: null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
        items: [
            {
                id: 'item-1',
                batchId: 'batch-1',
                restaurantId: 'restaurant-1',
                rawAuthorName: 'Sam',
                rawRating: 4,
                rawContent: 'Friendly staff',
                rawReviewDate: new Date('2026-03-01T00:00:00Z'),
                normalizedAuthorName: null,
                normalizedRating: 4,
                normalizedContent: null,
                normalizedReviewDate: null,
                approvalStatus: 'APPROVED',
                reviewerNote: null,
                canonicalReviewId: null,
                createdAt: new Date('2026-03-10T00:00:00Z'),
                updatedAt: new Date('2026-03-10T00:00:00Z'),
            },
            {
                id: 'item-2',
                batchId: 'batch-1',
                restaurantId: 'restaurant-1',
                rawAuthorName: 'Lee',
                rawRating: 2,
                rawContent: 'Slow service',
                rawReviewDate: new Date('2026-03-02T00:00:00Z'),
                normalizedAuthorName: 'Lee',
                normalizedRating: 2,
                normalizedContent: 'Slow service',
                normalizedReviewDate: new Date('2026-03-02T00:00:00Z'),
                approvalStatus: 'REJECTED',
                reviewerNote: null,
                canonicalReviewId: null,
                createdAt: new Date('2026-03-10T00:00:00Z'),
                updatedAt: new Date('2026-03-10T00:00:00Z'),
            },
        ],
    }

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => {
            accessChecked = true
            return { restaurant: { id: 'restaurant-1' } }
        },
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: ({ rating }) => ({
            label: rating >= 4 ? 'POSITIVE' : 'NEGATIVE',
            keywords: rating >= 4 ? ['friendly'] : ['slow'],
        }),
    })
    withMock('../src/services/insight.service', {
        recalculateRestaurantInsights: async ({ restaurantId }) => {
            recalculatedRestaurantId = restaurantId
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findBatchById: async () => batch,
        publishApprovedItems: async (args) => {
            publishArgs = args
            return {
                batch: {
                    ...batch,
                    status: args.batchStatus,
                    publishedAt: args.batchPublishedAt,
                },
                publishedReviewIds: ['review-1'],
            }
        },
    })

    const { publishReviewBatch } = require('../src/modules/admin-intake/admin-intake.service')
    const result = await publishReviewBatch({ userId: 'user-1', batchId: 'batch-1' })

    assert.equal(accessChecked, true)
    assert.equal(publishArgs.batchStatus, 'PUBLISHED')
    assert.equal(publishArgs.items.length, 1)
    assert.equal(publishArgs.items[0].reviewPayload.restaurantId, 'restaurant-1')
    assert.equal(publishArgs.items[0].reviewPayload.externalId, 'manual-intake:item-1')
    assert.equal(publishArgs.items[0].reviewPayload.sentiment, 'POSITIVE')
    assert.equal(publishArgs.items[0].reviewPayload.content, 'Friendly staff')
    assert.equal(recalculatedRestaurantId, 'restaurant-1')
    assert.equal(result.publishedCount, 1)
    assert.deepEqual(result.publishedReviewIds, ['review-1'])

    restoreModules()
})

test('admin intake review payload rejects invalid ratings', async () => {
    restoreModules()

    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: () => ({
            label: 'POSITIVE',
            keywords: [],
        }),
    })

    const { __private } = require('../src/modules/admin-intake/admin-intake.service')

    assert.throws(
        () =>
            __private.buildReviewPayload('restaurant-1', {
                id: 'item-1',
                normalizedRating: 6,
                rawRating: 6,
            }),
        (error) => {
            assert.equal(error.code, 'INTAKE_REVIEW_INVALID_RATING')
            return true
        },
    )

    restoreModules()
})
