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
    clearModule('../src/modules/admin-intake/admin-intake.repository')
    clearModule('../src/lib/prisma')
}

test('admin intake repository reuses and updates canonical reviews for matching external ids', async () => {
    restoreModules()

    const reviewUpdates = []
    const intakeUpdates = []
    const createManyCalls = []

    const tx = {
        review: {
            findMany: async ({ where }) => {
                const requestedExternalIds = where.externalId.in

                if (requestedExternalIds.includes('manual-intake:v1:existing')) {
                    return [
                        {
                            id: 'review-existing',
                            externalId: 'manual-intake:v1:existing',
                        },
                    ]
                }

                return [
                    {
                        id: 'review-new',
                        externalId: 'manual-intake:v1:new',
                    },
                ]
            },
            update: async (args) => {
                reviewUpdates.push(args)
                return { id: args.where.id, ...args.data }
            },
            createMany: async (args) => {
                createManyCalls.push(args)
                return { count: args.data.length }
            },
        },
        reviewIntakeItem: {
            update: async (args) => {
                intakeUpdates.push(args)
                return { id: args.where.id, canonicalReviewId: args.data.canonicalReviewId }
            },
        },
        reviewIntakeBatch: {
            update: async (args) => ({
                id: args.where.id,
                status: args.data.status,
                publishedAt: args.data.publishedAt,
                items: [],
            }),
        },
    }

    withMock('../src/lib/prisma', {
        $transaction: async (callback) => callback(tx),
    })

    const repository = require('../src/modules/admin-intake/admin-intake.repository')
    const result = await repository.publishApprovedItems({
        batchId: 'batch-1',
        batchStatus: 'PUBLISHED',
        batchPublishedAt: new Date('2026-03-24T00:00:00Z'),
        items: [
            {
                id: 'item-existing',
                canonicalReviewId: null,
                reviewPayload: {
                    restaurantId: 'restaurant-1',
                    externalId: 'manual-intake:v1:existing',
                    authorName: 'Ana',
                    rating: 4,
                    content: 'Updated existing review',
                    sentiment: 'POSITIVE',
                    keywords: ['friendly'],
                    reviewDate: new Date('2026-03-01T00:00:00Z'),
                },
            },
            {
                id: 'item-new',
                canonicalReviewId: null,
                reviewPayload: {
                    restaurantId: 'restaurant-1',
                    externalId: 'manual-intake:v1:new',
                    authorName: 'Bo',
                    rating: 5,
                    content: 'Brand new review',
                    sentiment: 'POSITIVE',
                    keywords: ['great'],
                    reviewDate: new Date('2026-03-02T00:00:00Z'),
                },
            },
        ],
    })

    assert.equal(reviewUpdates.length, 1)
    assert.equal(reviewUpdates[0].where.id, 'review-existing')
    assert.equal(reviewUpdates[0].data.content, 'Updated existing review')

    assert.equal(createManyCalls.length, 1)
    assert.equal(createManyCalls[0].data.length, 1)
    assert.equal(createManyCalls[0].data[0].externalId, 'manual-intake:v1:new')

    assert.deepEqual(
        intakeUpdates.map((entry) => ({
            itemId: entry.where.id,
            canonicalReviewId: entry.data.canonicalReviewId,
        })),
        [
            { itemId: 'item-existing', canonicalReviewId: 'review-existing' },
            { itemId: 'item-new', canonicalReviewId: 'review-new' },
        ],
    )

    assert.deepEqual(result.publishedReviewIds, ['review-existing', 'review-new'])

    restoreModules()
})
