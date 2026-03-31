const test = require('node:test')
const assert = require('node:assert/strict')

const {
    createReviewBatchSchema,
    createReviewItemsSchema,
    listReviewBatchesQuerySchema,
    updateReviewItemSchema,
} = require('../src/modules/admin-intake/admin-intake.validation')

test('admin intake validation rejects raw review dates in the future', () => {
    assert.throws(() => {
        createReviewItemsSchema.parse({
            items: [
                {
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great food',
                    rawReviewDate: '2999-01-01T00:00:00.000Z',
                },
            ],
        })
    })
})

test('admin intake validation rejects normalized review dates in the future', () => {
    assert.throws(() => {
        updateReviewItemSchema.parse({
            normalizedReviewDate: '2999-01-01T00:00:00.000Z',
        })
    })
})

test('admin intake validation requires restaurantId to be a UUID for batch creation and listing', () => {
    assert.throws(() => {
        createReviewBatchSchema.parse({
            restaurantId: 'restaurant-1',
            sourceType: 'MANUAL',
        })
    })

    assert.throws(() => {
        listReviewBatchesQuerySchema.parse({
            restaurantId: 'restaurant-1',
        })
    })
})
