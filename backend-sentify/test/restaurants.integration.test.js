const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000101'
const SUBMISSION_TIMESTAMP = new Date('2026-03-25T10:05:00.000Z')

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

function cloneRestaurantMutationState(state) {
    return structuredClone(state)
}

test('user-facing restaurant mutation endpoints allow USER accounts and stay free of sub-role fields', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const updatedAt = new Date('2026-03-25T11:00:00Z')
    const auditEvents = []
    let persistedSubmission = null

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            findUnique: async ({ where }) => {
                if (where.slug === 'the-59-cafe') {
                    return null
                }

                return null
            },
            update: async ({ where, data }) => ({
                id: where.id,
                name: data.name ?? 'The 59 cafe',
                slug: 'the-59-cafe',
                address: data.address ?? '59 Hai Phong, Da Nang',
                googleMapUrl: data.googleMapUrl ?? 'https://maps.app.goo.gl/the59',
                updatedAt,
            }),
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'The 59 cafe',
                            slug: 'the-59-cafe',
                            address: '59 Hai Phong, Da Nang',
                            googleMapUrl: 'https://maps.app.goo.gl/the59',
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                }

                return null
            },
        },
        $transaction: async (callback) =>
            callback({
                restaurant: {
                    create: async ({ data }) => ({
                        id: RESTAURANT_ID,
                        name: data.name,
                        slug: data.slug,
                        address: data.address,
                        googleMapUrl: data.googleMapUrl,
                        createdAt,
                    }),
                    update: async ({ where, data }) => ({
                        id: where.id,
                        name: data.name ?? 'The 59 cafe',
                        slug: 'the-59-cafe',
                        address: data.address ?? '59 Hai Phong, Da Nang',
                        googleMapUrl:
                            Object.prototype.hasOwnProperty.call(data, 'googleMapUrl')
                                ? data.googleMapUrl
                                : 'https://maps.app.goo.gl/the59',
                        updatedAt,
                    }),
                },
                restaurantUser: {
                    create: async () => ({
                        id: 'membership-1',
                        userId: 'user-1',
                        restaurantId: RESTAURANT_ID,
                    }),
                },
                restaurantEntitlement: {
                    upsert: async ({ create, update = {} }) => ({
                        id: 'restaurant-entitlement-1',
                        ...create,
                        ...update,
                        createdAt,
                        updatedAt: createdAt,
                    }),
                },
                restaurantSourceSubmission: {
                    findUnique: async ({ where }) => {
                        if (where.restaurantId === RESTAURANT_ID) {
                            return persistedSubmission
                        }

                        return null
                    },
                    upsert: async ({ create, update }) => {
                        persistedSubmission = {
                            id: persistedSubmission?.id ?? 'source-submission-1',
                            ...(persistedSubmission ? update : create),
                            submittedAt: SUBMISSION_TIMESTAMP,
                            lastResolvedAt: SUBMISSION_TIMESTAMP,
                        }

                        return persistedSubmission
                    },
                    deleteMany: async ({ where }) => {
                        if (where.restaurantId === RESTAURANT_ID) {
                            const deleted = persistedSubmission ? 1 : 0
                            persistedSubmission = null
                            return { count: deleted }
                        }

                        return { count: 0 }
                    },
                },
                auditEvent: {
                    create: async ({ data }) => {
                        auditEvents.push(data)
                        return {
                            id: `audit-${auditEvents.length}`,
                            ...data,
                            createdAt: new Date('2026-03-25T10:05:00.000Z'),
                        }
                    },
                },
            }),
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-25T10:05:00.000Z'),
                }
            },
            findMany: async () => [],
        },
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID) {
                    return persistedSubmission
                }

                return null
            },
            upsert: async ({ create, update }) => {
                persistedSubmission = {
                    id: persistedSubmission?.id ?? 'source-submission-1',
                    ...(persistedSubmission ? update : create),
                    submittedAt: SUBMISSION_TIMESTAMP,
                    lastResolvedAt: SUBMISSION_TIMESTAMP,
                }

                return persistedSubmission
            },
            deleteMany: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID) {
                    const deleted = persistedSubmission ? 1 : 0
                    persistedSubmission = null
                    return { count: deleted }
                }

                return { count: 0 }
            },
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

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: auth,
        body: {
            name: 'The 59 cafe',
            address: '59 Hai Phong, Da Nang',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    })

    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.data.id, RESTAURANT_ID)
    assert.equal(createResponse.body.data.name, 'The 59 cafe')
    assert.equal(createResponse.body.data.slug, 'the-59-cafe')
    assert.equal(createResponse.body.data.address, '59 Hai Phong, Da Nang')
    assert.equal(createResponse.body.data.googleMapUrl, 'https://maps.app.goo.gl/the59')
    assert.equal(createResponse.body.data.createdAt, '2026-03-25T10:00:00.000Z')
    assert.equal(createResponse.body.data.sourceSubmission.status, 'SUBMITTED')
    assert.equal(
        createResponse.body.data.sourceSubmission.message,
        'Google Maps place identity is confirmed and is waiting for admin to create the crawl source.',
    )
    assert.equal(createResponse.body.data.sourceSubmission.submission.id, 'source-submission-1')
    assert.equal(
        createResponse.body.data.sourceSubmission.submission.status,
        'READY_FOR_SOURCE_LINK',
    )
    assert.equal(
        createResponse.body.data.sourceSubmission.submission.normalizedUrl,
        'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
    )
    assert.deepEqual(createResponse.body.data.sourceSubmission.timeline, {
        currentStage: 'SUBMITTED',
        currentStepCode: 'PLACE_CONFIRMED',
        isLive: false,
        latestEventAt: '2026-03-25T10:05:00.000Z',
        steps: [
            {
                code: 'URL_SUBMITTED',
                label: 'URL submitted',
                state: 'completed',
                at: '2026-03-25T10:05:00.000Z',
                source: 'SUBMISSION',
                message: 'Your Google Maps URL was saved and entered the ingestion pipeline.',
            },
            {
                code: 'PLACE_CONFIRMED',
                label: 'Place confirmed',
                state: 'current',
                at: '2026-03-25T10:05:00.000Z',
                source: 'SUBMISSION',
                message: 'The submitted Google Maps URL was matched to a specific place identity.',
            },
            {
                code: 'SOURCE_CONNECTED',
                label: 'Source linked',
                state: 'pending',
                at: null,
                source: null,
                message: 'A crawl source was linked to this restaurant.',
            },
            {
                code: 'SYNC_QUEUED',
                label: 'Sync queued',
                state: 'pending',
                at: null,
                source: null,
                message: 'A sync run is queued.',
            },
            {
                code: 'SYNC_IN_PROGRESS',
                label: 'Sync in progress',
                state: 'pending',
                at: null,
                source: null,
                message: 'Reviews are being fetched.',
            },
            {
                code: 'EVIDENCE_IN_REVIEW',
                label: 'Evidence in review',
                state: 'pending',
                at: null,
                source: null,
                message: 'New evidence is waiting for admin review.',
            },
            {
                code: 'READY_TO_PUBLISH',
                label: 'Ready to publish',
                state: 'pending',
                at: null,
                source: null,
                message: 'Approved evidence is waiting to be published.',
            },
            {
                code: 'LIVE',
                label: 'Live',
                state: 'pending',
                at: null,
                source: null,
                message: 'Published restaurant intelligence is live.',
            },
        ],
        events: [
            {
                code: 'URL_SUBMITTED',
                title: 'Google Maps URL submitted',
                description: 'Your Google Maps URL was saved and entered the ingestion pipeline.',
                occurredAt: '2026-03-25T10:05:00.000Z',
                actorType: 'USER',
                source: 'SUBMISSION',
                severity: 'INFO',
            },
            {
                code: 'PLACE_CONFIRMED',
                title: 'Place identity confirmed',
                description: 'The submitted Google Maps URL was matched to a specific place identity.',
                occurredAt: '2026-03-25T10:05:00.000Z',
                actorType: 'SYSTEM',
                source: 'SUBMISSION',
                severity: 'INFO',
            },
        ],
    })
    assert.equal('permission' in createResponse.body.data, false)
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'MERCHANT_SOURCE_SUBMITTED')
    assert.equal(
        auditEvents[0].metadataJson.sourceSubmissionSnapshot.inputUrl,
        'https://maps.app.goo.gl/the59',
    )

    const updateResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            name: 'The 59 cafe updated',
            address: '60 Hai Phong, Da Nang',
        },
    })

    assert.equal(updateResponse.status, 200)
    assert.equal(updateResponse.body.data.id, RESTAURANT_ID)
    assert.equal(updateResponse.body.data.name, 'The 59 cafe updated')
    assert.equal(updateResponse.body.data.slug, 'the-59-cafe')
    assert.equal(updateResponse.body.data.address, '60 Hai Phong, Da Nang')
    assert.equal(updateResponse.body.data.googleMapUrl, 'https://maps.app.goo.gl/the59')
    assert.equal(updateResponse.body.data.updatedAt, '2026-03-25T11:00:00.000Z')
    assert.equal(updateResponse.body.data.sourceSubmission.status, 'SUBMITTED')
    assert.equal(
        updateResponse.body.data.sourceSubmission.timeline.currentStepCode,
        'PLACE_CONFIRMED',
    )
    assert.equal(
        updateResponse.body.data.sourceSubmission.timeline.steps[0].state,
        'completed',
    )
    assert.equal(
        updateResponse.body.data.sourceSubmission.timeline.steps[1].state,
        'current',
    )
    assert.equal('permission' in updateResponse.body.data, false)
    assert.equal(auditEvents.length, 1)
})

test('restaurant create rolls back restaurant and source submission writes when the audit insert fails', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const state = {
        restaurants: [],
        memberships: [],
        submissions: [],
        entitlements: [],
    }

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            findUnique: async ({ where }) => {
                if (where.slug) {
                    return state.restaurants.find((restaurant) => restaurant.slug === where.slug) ?? null
                }

                if (where.id) {
                    return state.restaurants.find((restaurant) => restaurant.id === where.id) ?? null
                }

                return null
            },
        },
        restaurantUser: {
            findFirst: async () => null,
        },
        $transaction: async (callback) => {
            const txState = cloneRestaurantMutationState(state)
            const tx = {
                restaurant: {
                    create: async ({ data }) => {
                        const record = {
                            id: data.id,
                            name: data.name,
                            slug: data.slug,
                            address: data.address,
                            googleMapUrl: data.googleMapUrl,
                            createdAt,
                            updatedAt: createdAt,
                        }
                        txState.restaurants.push(record)
                        return record
                    },
                },
                restaurantUser: {
                    create: async ({ data }) => {
                        const record = {
                            id: `membership-${txState.memberships.length + 1}`,
                            ...data,
                            createdAt,
                        }
                        txState.memberships.push(record)
                        return record
                    },
                },
                restaurantEntitlement: {
                    upsert: async ({ create, update = {} }) => {
                        const record = {
                            id: 'restaurant-entitlement-1',
                            ...create,
                            ...update,
                            createdAt,
                            updatedAt: createdAt,
                        }
                        txState.entitlements = [record]
                        return record
                    },
                },
                restaurantSourceSubmission: {
                    findUnique: async ({ where }) =>
                        txState.submissions.find(
                            (submission) => submission.restaurantId === where.restaurantId,
                        ) ?? null,
                    upsert: async ({ create, update }) => {
                        const existingIndex = txState.submissions.findIndex(
                            (submission) => submission.restaurantId === create.restaurantId,
                        )
                        const record = {
                            id:
                                existingIndex >= 0
                                    ? txState.submissions[existingIndex].id
                                    : 'source-submission-1',
                            ...(existingIndex >= 0 ? update : create),
                            submittedAt: SUBMISSION_TIMESTAMP,
                            lastResolvedAt: SUBMISSION_TIMESTAMP,
                        }

                        if (existingIndex >= 0) {
                            txState.submissions[existingIndex] = record
                        } else {
                            txState.submissions.push(record)
                        }

                        return record
                    },
                    deleteMany: async ({ where }) => {
                        const before = txState.submissions.length
                        txState.submissions = txState.submissions.filter(
                            (submission) => submission.restaurantId !== where.restaurantId,
                        )
                        return { count: before - txState.submissions.length }
                    },
                },
                auditEvent: {
                    create: async () => {
                        throw new Error('audit create failed')
                    },
                },
            }

            const result = await callback(tx)
            Object.assign(state, txState)
            return result
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
    const response = await request(server, 'POST', '/api/restaurants', {
        token: auth,
        body: {
            name: 'Atomic Cafe',
            address: '1 Hai Chau, Da Nang',
            googleMapUrl: 'https://maps.app.goo.gl/atomic-cafe',
        },
    })

    assert.equal(response.status, 500)
    assert.equal(state.restaurants.length, 0)
    assert.equal(state.memberships.length, 0)
    assert.equal(state.submissions.length, 0)
    assert.equal(state.entitlements.length, 0)
})

test('restaurant update rolls back restaurant and source submission writes when the audit insert fails', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const originalUpdatedAt = new Date('2026-03-25T11:00:00Z')
    const state = {
        restaurants: [
            {
                id: RESTAURANT_ID,
                name: 'The 59 cafe',
                slug: 'the-59-cafe',
                address: '59 Hai Phong, Da Nang',
                googleMapUrl: 'https://maps.app.goo.gl/the59',
                createdAt,
                updatedAt: originalUpdatedAt,
            },
        ],
        submissions: [
            {
                id: 'source-submission-1',
                restaurantId: RESTAURANT_ID,
                status: 'READY_FOR_SOURCE_LINK',
                inputUrl: 'https://maps.app.goo.gl/the59',
                normalizedUrl:
                    'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
                canonicalCid: '4548797685071303380',
                placeName: 'The 59 cafe',
                googlePlaceId: 'ChIJThe59Cafe',
                placeHexId: '0x123:0x456',
                recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
                recommendationMessage: 'Saved and waiting for admin sync.',
                linkedSourceId: null,
                schedulingLane: 'STANDARD',
                schedulingLaneSource: 'ENTITLEMENT_DEFAULT',
                submittedAt: SUBMISSION_TIMESTAMP,
                lastResolvedAt: SUBMISSION_TIMESTAMP,
                claimedByUserId: null,
                claimedAt: null,
                claimExpiresAt: null,
            },
        ],
    }

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            findUnique: async ({ where }) => {
                if (where.id) {
                    return state.restaurants.find((restaurant) => restaurant.id === where.id) ?? null
                }

                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return {
                        restaurant: state.restaurants[0],
                    }
                }

                return null
            },
        },
        $transaction: async (callback) => {
            const txState = cloneRestaurantMutationState(state)
            const tx = {
                restaurant: {
                    update: async ({ where, data }) => {
                        const existing = txState.restaurants.find(
                            (restaurant) => restaurant.id === where.id,
                        )
                        const next = {
                            ...existing,
                            ...data,
                            updatedAt: new Date('2026-03-25T12:00:00.000Z'),
                        }
                        txState.restaurants = txState.restaurants.map((restaurant) =>
                            restaurant.id === where.id ? next : restaurant,
                        )
                        return next
                    },
                },
                restaurantSourceSubmission: {
                    findUnique: async ({ where }) =>
                        txState.submissions.find(
                            (submission) => submission.restaurantId === where.restaurantId,
                        ) ?? null,
                    upsert: async ({ create, update }) => {
                        const existingIndex = txState.submissions.findIndex(
                            (submission) => submission.restaurantId === create.restaurantId,
                        )
                        const record = {
                            id:
                                existingIndex >= 0
                                    ? txState.submissions[existingIndex].id
                                    : 'source-submission-1',
                            ...(existingIndex >= 0 ? update : create),
                            submittedAt: SUBMISSION_TIMESTAMP,
                            lastResolvedAt: SUBMISSION_TIMESTAMP,
                        }

                        if (existingIndex >= 0) {
                            txState.submissions[existingIndex] = record
                        } else {
                            txState.submissions.push(record)
                        }

                        return record
                    },
                    deleteMany: async ({ where }) => {
                        const before = txState.submissions.length
                        txState.submissions = txState.submissions.filter(
                            (submission) => submission.restaurantId !== where.restaurantId,
                        )
                        return { count: before - txState.submissions.length }
                    },
                },
                restaurantEntitlement: {
                    upsert: async ({ create, update = {} }) => ({
                        id: 'restaurant-entitlement-1',
                        ...create,
                        ...update,
                        createdAt,
                        updatedAt: createdAt,
                    }),
                },
                auditEvent: {
                    create: async () => {
                        throw new Error('audit create failed')
                    },
                },
            }

            const result = await callback(tx)
            Object.assign(state, txState)
            return result
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
    const response = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            googleMapUrl: 'https://maps.app.goo.gl/the59-updated',
        },
    })

    assert.equal(response.status, 500)
    assert.equal(state.restaurants[0].googleMapUrl, 'https://maps.app.goo.gl/the59')
    assert.equal(state.restaurants[0].updatedAt.toISOString(), originalUpdatedAt.toISOString())
    assert.equal(state.submissions.length, 1)
    assert.equal(state.submissions[0].inputUrl, 'https://maps.app.goo.gl/the59')
    assert.equal(state.submissions[0].canonicalCid, '4548797685071303380')
})

test('restaurant mutation endpoints reject non-Google Maps URLs for merchant source submission', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')

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
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'The 59 cafe',
                            slug: 'the-59-cafe',
                            address: '59 Hai Phong, Da Nang',
                            googleMapUrl: 'https://maps.app.goo.gl/the59',
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
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

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: auth,
        body: {
            name: 'The 59 cafe',
            googleMapUrl: 'https://example.com/not-google-maps',
        },
    })

    assert.equal(createResponse.status, 400)
    assert.equal(createResponse.body.error.code, 'VALIDATION_FAILED')
    assert.ok(
        createResponse.body.error.details.some((issue) =>
            String(issue.message).includes('Google Maps URL'),
        ),
    )

    const updateResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            googleMapUrl: 'https://example.com/not-google-maps',
        },
    })

    assert.equal(updateResponse.status, 400)
    assert.equal(updateResponse.body.error.code, 'VALIDATION_FAILED')
    assert.ok(
        updateResponse.body.error.details.some((issue) =>
            String(issue.message).includes('Google Maps URL'),
        ),
    )
})

test('restaurant creation still persists a pending source submission when Google Maps resolution is unavailable', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    let persistedSubmission = null

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            findUnique: async () => null,
        },
        $transaction: async (callback) =>
            callback({
                restaurant: {
                    create: async ({ data }) => ({
                        id: RESTAURANT_ID,
                        name: data.name,
                        slug: data.slug,
                        address: data.address,
                        googleMapUrl: data.googleMapUrl,
                        createdAt,
                    }),
                },
                restaurantUser: {
                    create: async () => ({
                        id: 'membership-1',
                        userId: 'user-1',
                        restaurantId: RESTAURANT_ID,
                    }),
                },
                restaurantEntitlement: {
                    upsert: async ({ create, update = {} }) => ({
                        id: 'restaurant-entitlement-1',
                        ...create,
                        ...update,
                        createdAt,
                        updatedAt: createdAt,
                    }),
                },
                restaurantSourceSubmission: {
                    findUnique: async ({ where }) => {
                        if (where.restaurantId === RESTAURANT_ID) {
                            return persistedSubmission
                        }

                        return null
                    },
                    upsert: async ({ create, update }) => {
                        persistedSubmission = {
                            id: persistedSubmission?.id ?? 'source-submission-1',
                            ...(persistedSubmission ? update : create),
                            submittedAt: SUBMISSION_TIMESTAMP,
                            lastResolvedAt: null,
                        }

                        return persistedSubmission
                    },
                    deleteMany: async () => ({ count: 0 }),
                },
                auditEvent: {
                    create: async ({ data }) => ({
                        id: 'audit-1',
                        ...data,
                        createdAt: new Date('2026-03-25T10:05:00.000Z'),
                    }),
                },
            }),
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID) {
                    return persistedSubmission
                }

                return null
            },
            upsert: async ({ create, update }) => {
                persistedSubmission = {
                    id: persistedSubmission?.id ?? 'source-submission-1',
                    ...(persistedSubmission ? update : create),
                    submittedAt: SUBMISSION_TIMESTAMP,
                    lastResolvedAt: null,
                }

                return persistedSubmission
            },
            deleteMany: async () => ({ count: 0 }),
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async () => {
                    throw new Error('upstream unavailable')
                },
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const response = await request(server, 'POST', '/api/restaurants', {
        token: auth,
        body: {
            name: 'The 59 cafe',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.data.sourceSubmission.status, 'SUBMITTED')
    assert.equal(response.body.data.sourceSubmission.submission.status, 'PENDING_IDENTITY_RESOLUTION')
    assert.equal(response.body.data.sourceSubmission.submission.canonicalCid, null)
    assert.equal(
        response.body.data.sourceSubmission.submission.recommendationMessage,
        'Google Maps URL was saved. Admin still needs to confirm the exact place before sync can start.',
    )
    assert.equal(response.body.data.sourceSubmission.submission.lastResolvedAt, null)
})

test('restaurant update clears the persisted source submission when the Google Maps URL is removed', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const updatedAt = new Date('2026-03-25T11:00:00Z')
    const auditEvents = []
    let deletedSubmissionCount = 0

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            update: async ({ where, data }) => ({
                id: where.id,
                name: data.name ?? 'The 59 cafe',
                slug: 'the-59-cafe',
                address: data.address ?? '59 Hai Phong, Da Nang',
                googleMapUrl: data.googleMapUrl ?? null,
                updatedAt,
            }),
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'The 59 cafe',
                            slug: 'the-59-cafe',
                            address: '59 Hai Phong, Da Nang',
                            googleMapUrl: 'https://maps.app.goo.gl/the59',
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async () => ({
                id: 'source-submission-1',
                restaurantId: RESTAURANT_ID,
                provider: 'GOOGLE_MAPS',
                status: 'READY_FOR_SOURCE_LINK',
                inputUrl: 'https://maps.app.goo.gl/the59',
                normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
                canonicalCid: '4548797685071303380',
                placeName: 'The 59 cafe',
                googlePlaceId: 'ChIJThe59Cafe',
                placeHexId: '0x123:0x456',
                dedupeKey: 'cid:4548797685071303380',
                schedulingLane: 'STANDARD',
                recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
                recommendationMessage: 'Known place.',
                linkedSourceId: null,
                submittedAt: SUBMISSION_TIMESTAMP,
                lastResolvedAt: SUBMISSION_TIMESTAMP,
            }),
            upsert: async ({ create }) => create,
            deleteMany: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID) {
                    deletedSubmissionCount += 1
                    return { count: 1 }
                }

                return { count: 0 }
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: SUBMISSION_TIMESTAMP,
                }
            },
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const response = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            googleMapUrl: null,
        },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.googleMapUrl, null)
    assert.equal(response.body.data.sourceSubmission.status, 'UNCONFIGURED')
    assert.equal(response.body.data.sourceSubmission.submission, null)
    assert.deepEqual(response.body.data.sourceSubmission.timeline, {
        currentStage: 'UNCONFIGURED',
        currentStepCode: null,
        isLive: false,
        latestEventAt: null,
        steps: [
            {
                code: 'URL_SUBMITTED',
                label: 'URL submitted',
                state: 'pending',
                at: null,
                source: null,
                message: 'Google Maps URL was saved.',
            },
            {
                code: 'PLACE_CONFIRMED',
                label: 'Place confirmed',
                state: 'pending',
                at: null,
                source: null,
                message: 'Canonical Google Maps place was identified.',
            },
            {
                code: 'SOURCE_CONNECTED',
                label: 'Source linked',
                state: 'pending',
                at: null,
                source: null,
                message: 'A crawl source was linked to this restaurant.',
            },
            {
                code: 'SYNC_QUEUED',
                label: 'Sync queued',
                state: 'pending',
                at: null,
                source: null,
                message: 'A sync run is queued.',
            },
            {
                code: 'SYNC_IN_PROGRESS',
                label: 'Sync in progress',
                state: 'pending',
                at: null,
                source: null,
                message: 'Reviews are being fetched.',
            },
            {
                code: 'EVIDENCE_IN_REVIEW',
                label: 'Evidence in review',
                state: 'pending',
                at: null,
                source: null,
                message: 'New evidence is waiting for admin review.',
            },
            {
                code: 'READY_TO_PUBLISH',
                label: 'Ready to publish',
                state: 'pending',
                at: null,
                source: null,
                message: 'Approved evidence is waiting to be published.',
            },
            {
                code: 'LIVE',
                label: 'Live',
                state: 'pending',
                at: null,
                source: null,
                message: 'Published restaurant intelligence is live.',
            },
        ],
        events: [],
    })
    assert.equal(deletedSubmissionCount, 1)
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'MERCHANT_SOURCE_CLEARED')
    assert.equal(
        auditEvents[0].metadataJson.sourceSubmissionSnapshot.inputUrl,
        'https://maps.app.goo.gl/the59',
    )
})

test('restaurant source-submission history endpoint exposes durable attempt keys and snapshots across URL changes', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const currentSubmission = {
        id: 'source-submission-1',
        restaurantId: RESTAURANT_ID,
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/current',
        normalizedUrl: null,
        canonicalCid: null,
        placeHexId: null,
        googlePlaceId: null,
        placeName: null,
        dedupeKey: 'url:https://maps.app.goo.gl/current',
        status: 'PENDING_IDENTITY_RESOLUTION',
        schedulingLane: 'STANDARD',
        recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
        recommendationMessage: 'Needs resolution.',
        linkedSourceId: null,
        submittedAt: new Date('2026-03-27T12:00:00.000Z'),
        lastResolvedAt: null,
    }
    const auditEvents = [
        {
            id: 'audit-current',
            action: 'MERCHANT_SOURCE_UPDATED',
            resourceId: RESTAURANT_ID,
            actorUserId: 'user-1',
            summary: 'Merchant updated the Google Maps URL for The 59 cafe.',
            createdAt: new Date('2026-03-27T12:00:00.000Z'),
            metadataJson: {
                previousGoogleMapUrl: 'https://maps.app.goo.gl/previous',
                nextGoogleMapUrl: 'https://maps.app.goo.gl/current',
                sourceSubmissionSnapshot: {
                    submissionId: 'source-submission-1',
                    provider: 'GOOGLE_MAPS',
                    inputUrl: 'https://maps.app.goo.gl/current',
                    normalizedUrl: null,
                    canonicalCid: null,
                    placeHexId: null,
                    googlePlaceId: null,
                    placeName: null,
                    dedupeKey: 'url:https://maps.app.goo.gl/current',
                    persistedStatus: 'PENDING_IDENTITY_RESOLUTION',
                    schedulingLane: 'STANDARD',
                    linkedSourceId: null,
                    recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
                    recommendationMessage: 'Needs resolution.',
                    submittedAt: '2026-03-27T12:00:00.000Z',
                    lastResolvedAt: null,
                },
            },
            actor: {
                id: 'user-1',
                role: 'USER',
            },
        },
        {
            id: 'audit-previous',
            action: 'ADMIN_SOURCE_SUBMISSION_RESOLVED',
            resourceId: 'source-submission-1',
            actorUserId: 'admin-1',
            summary: 'Admin resolved the previous place.',
            createdAt: new Date('2026-03-26T09:02:00.000Z'),
            metadataJson: {
                sourceSubmissionSnapshot: {
                    submissionId: 'source-submission-1',
                    provider: 'GOOGLE_MAPS',
                    inputUrl: 'https://maps.app.goo.gl/previous',
                    normalizedUrl: 'https://www.google.com/maps?cid=cid-1',
                    canonicalCid: 'cid-1',
                    placeHexId: '0x123:0x456',
                    googlePlaceId: 'place-1',
                    placeName: 'Cafe One',
                    dedupeKey: 'cid:cid-1',
                    persistedStatus: 'READY_FOR_SOURCE_LINK',
                    schedulingLane: 'PRIORITY',
                    linkedSourceId: null,
                    recommendationCode: 'REUSE_SHARED_IDENTITY',
                    recommendationMessage: 'Known place.',
                    submittedAt: '2026-03-26T09:00:00.000Z',
                    lastResolvedAt: '2026-03-26T09:02:00.000Z',
                },
            },
            actor: {
                id: 'admin-1',
                role: 'ADMIN',
            },
        },
    ]

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
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'The 59 cafe',
                            slug: 'the-59-cafe',
                            address: '59 Hai Phong, Da Nang',
                            googleMapUrl: 'https://maps.app.goo.gl/current',
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async () => currentSubmission,
            upsert: async ({ create }) => create,
            deleteMany: async () => ({ count: 0 }),
        },
        reviewIntakeBatch: {
            findFirst: async () => null,
            findMany: async () => [],
            findUnique: async () => null,
        },
        reviewIntakeItem: {
            groupBy: async () => [],
        },
        reviewCrawlSource: {
            findUnique: async () => null,
            findFirst: async () => null,
        },
        reviewCrawlRun: {
            findFirst: async () => null,
        },
        auditEvent: {
            create: async ({ data }) => ({
                id: 'audit-created',
                ...data,
                createdAt: SUBMISSION_TIMESTAMP,
            }),
            findMany: async () => auditEvents,
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })
    const response = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/source-submission/history`,
        {
            token: auth,
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.restaurant.id, RESTAURANT_ID)
    assert.equal(
        response.body.data.current.sourceSubmission.submission.inputUrl,
        'https://maps.app.goo.gl/current',
    )
    assert.equal(response.body.data.history.attempts.length, 2)
    assert.equal(response.body.data.history.events.length, 2)
    assert.equal(
        response.body.data.history.attempts[0].attemptKey,
        response.body.data.current.attemptKey,
    )
    assert.equal(response.body.data.history.attempts[0].isCurrentAttempt, true)
    assert.equal(
        response.body.data.history.events[0].snapshot.inputUrl,
        'https://maps.app.goo.gl/current',
    )
    assert.equal(
        response.body.data.history.events[1].timelineCode,
        'PLACE_CONFIRMED',
    )
})

test('restaurant update preserves active claim metadata on same-url resave and clears it when the Google Maps URL changes', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const updatedAt = new Date('2026-03-25T11:00:00Z')
    let persistedSubmission = {
        id: 'source-submission-1',
        restaurantId: RESTAURANT_ID,
        submittedByUserId: 'user-1',
        claimedByUserId: 'admin-1',
        claimedAt: new Date('2026-03-25T10:30:00Z'),
        claimExpiresAt: new Date('2026-03-25T11:30:00Z'),
        linkedSourceId: null,
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/the59',
        normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
        canonicalCid: '4548797685071303380',
        placeHexId: '0x123:0x456',
        googlePlaceId: 'ChIJThe59Cafe',
        placeName: 'The 59 cafe',
        dedupeKey: 'cid:4548797685071303380',
        status: 'READY_FOR_SOURCE_LINK',
        schedulingLane: 'PRIORITY',
        schedulingLaneSource: 'ADMIN_OVERRIDE',
        recommendationCode: 'REUSE_SHARED_IDENTITY',
        recommendationMessage: 'Known canonical place.',
        submittedAt: SUBMISSION_TIMESTAMP,
        lastResolvedAt: SUBMISSION_TIMESTAMP,
        createdAt: SUBMISSION_TIMESTAMP,
        updatedAt: SUBMISSION_TIMESTAMP,
    }

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            update: async ({ where, data }) => ({
                id: where.id,
                name: data.name ?? 'The 59 cafe',
                slug: 'the-59-cafe',
                address: data.address ?? '59 Hai Phong, Da Nang',
                googleMapUrl: data.googleMapUrl ?? 'https://maps.app.goo.gl/the59',
                updatedAt,
            }),
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'The 59 cafe',
                            slug: 'the-59-cafe',
                            address: '59 Hai Phong, Da Nang',
                            googleMapUrl: persistedSubmission.inputUrl,
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID) {
                    return persistedSubmission
                }

                return null
            },
            upsert: async ({ create, update }) => {
                persistedSubmission = {
                    id: persistedSubmission?.id ?? 'source-submission-1',
                    ...(persistedSubmission ? update : create),
                    submittedAt: persistedSubmission?.submittedAt ?? SUBMISSION_TIMESTAMP,
                    createdAt: persistedSubmission?.createdAt ?? SUBMISSION_TIMESTAMP,
                    updatedAt: SUBMISSION_TIMESTAMP,
                }

                return persistedSubmission
            },
            deleteMany: async () => ({ count: 0 }),
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async ({ url }) => {
                    if (url === 'https://maps.app.goo.gl/the59') {
                        return buildResolvedGoogleMapsSource()
                    }

                    throw new Error('transient resolution failure')
                },
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const sameUrlResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    })

    assert.equal(sameUrlResponse.status, 200)
    assert.equal(sameUrlResponse.body.data.sourceSubmission.submission.status, 'READY_FOR_SOURCE_LINK')
    assert.equal(persistedSubmission.schedulingLane, 'PRIORITY')
    assert.equal(persistedSubmission.claimedByUserId, 'admin-1')
    assert.equal(
        persistedSubmission.claimExpiresAt?.toISOString(),
        '2026-03-25T11:30:00.000Z',
    )

    const changedUrlResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            googleMapUrl: 'https://maps.app.goo.gl/different-demo-url',
        },
    })

    assert.equal(changedUrlResponse.status, 200)
    assert.equal(
        changedUrlResponse.body.data.sourceSubmission.submission.status,
        'PENDING_IDENTITY_RESOLUTION',
    )
    assert.equal(persistedSubmission.schedulingLane, 'STANDARD')
    assert.equal(persistedSubmission.dedupeKey, 'url:https://maps.app.goo.gl/different-demo-url')
    assert.equal(persistedSubmission.claimedByUserId, null)
    assert.equal(persistedSubmission.claimedAt, null)
    assert.equal(persistedSubmission.claimExpiresAt, null)
})

test('admin accounts cannot use user-facing restaurant mutation endpoints', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: auth,
        body: {
            name: 'Blocked admin write',
        },
    })
    assert.equal(createResponse.status, 403)

    const updateResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            name: 'Blocked admin update',
        },
    })
    assert.equal(updateResponse.status, 403)
})
