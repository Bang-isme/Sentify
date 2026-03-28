const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000101'

function buildRestaurantMembership() {
    return {
        restaurant: {
            id: RESTAURANT_ID,
            name: 'The 59 cafe',
            slug: 'the-59-cafe',
            address: '59 Hai Phong, Da Nang',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
            createdAt: new Date('2026-03-25T10:00:00.000Z'),
            updatedAt: new Date('2026-03-25T10:00:00.000Z'),
        },
    }
}

function buildResolvedGoogleMapsSource() {
    return {
        source: {
            resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
        },
        place: {
            name: 'The 59 cafe',
            totalReviewCount: 124,
            identifiers: {
                cid: '4548797685071303380',
                placeHexId: '0x123:0x456',
                googlePlaceId: 'ChIJThe59Cafe',
            },
        },
    }
}

test('merchant source preview returns ALREADY_CONNECTED when the restaurant already has that canonical place', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return buildRestaurantMembership()
                }

                return null
            },
        },
        reviewCrawlSource: {
            findFirst: async () => null,
            findUnique: async () => ({
                id: 'source-1',
                inputUrl: 'https://maps.app.goo.gl/the59',
                status: 'ACTIVE',
                syncEnabled: true,
                placeName: 'The 59 cafe',
                lastSuccessfulRunAt: new Date('2026-03-26T10:00:00.000Z'),
            }),
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async () => buildResolvedGoogleMapsSource(),
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const response = await request(
        server,
        'POST',
        `/api/restaurants/${RESTAURANT_ID}/source-submission/preview`,
        {
            token: auth,
            body: {
                googleMapUrl: 'https://maps.app.goo.gl/the59',
            },
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.canonicalIdentity.canonicalCid, '4548797685071303380')
    assert.equal(response.body.data.dedupe.sameRestaurantSourceExists, true)
    assert.equal(response.body.data.dedupe.otherRestaurantCount, 0)
    assert.equal(response.body.data.recommendation.code, 'ALREADY_CONNECTED')
    assert.equal(response.body.data.currentRestaurant.exactSavedUrlMatches, true)
})

test('merchant source preview returns REUSE_SHARED_IDENTITY when the place already exists on other restaurants', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return buildRestaurantMembership()
                }

                return null
            },
        },
        reviewCrawlSource: {
            findFirst: async () => null,
            findUnique: async () => null,
            findMany: async () => [{ restaurantId: 'restaurant-2' }, { restaurantId: 'restaurant-3' }],
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async () => buildResolvedGoogleMapsSource(),
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const response = await request(
        server,
        'POST',
        `/api/restaurants/${RESTAURANT_ID}/source-submission/preview`,
        {
            token: auth,
            body: {
                googleMapUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            },
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.dedupe.sameRestaurantSourceExists, false)
    assert.equal(response.body.data.dedupe.otherRestaurantCount, 2)
    assert.equal(response.body.data.dedupe.sharedPlaceAlreadyKnown, true)
    assert.equal(response.body.data.recommendation.code, 'REUSE_SHARED_IDENTITY')
    assert.equal(response.body.data.recommendation.canSubmit, true)
})

test('merchant source preview rejects non-Google Maps URLs', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return buildRestaurantMembership()
                }

                return null
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const response = await request(
        server,
        'POST',
        `/api/restaurants/${RESTAURANT_ID}/source-submission/preview`,
        {
            token: auth,
            body: {
                googleMapUrl: 'https://example.com/not-google-maps',
            },
        },
    )

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_FAILED')
    assert.ok(
        response.body.error.details.some((issue) =>
            String(issue.message).includes('Google Maps URL'),
        ),
    )
})
