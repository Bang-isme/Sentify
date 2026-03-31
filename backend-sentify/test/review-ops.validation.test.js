const test = require('node:test')
const assert = require('node:assert/strict')

const {
    listSourcesQuerySchema,
    syncToDraftSchema,
} = require('../src/modules/review-ops/review-ops.validation')

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'

test('review ops validation accepts uuid restaurant ids for source queries and sync requests', () => {
    const query = listSourcesQuerySchema.parse({
        restaurantId: RESTAURANT_ID,
    })
    const input = syncToDraftSchema.parse({
        restaurantId: RESTAURANT_ID,
        url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
    })

    assert.equal(query.restaurantId, RESTAURANT_ID)
    assert.equal(input.restaurantId, RESTAURANT_ID)
})

test('review ops validation rejects non-uuid restaurant ids', () => {
    assert.throws(() => {
        listSourcesQuerySchema.parse({
            restaurantId: 'restaurant-1',
        })
    })

    assert.throws(() => {
        syncToDraftSchema.parse({
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        })
    })
})
