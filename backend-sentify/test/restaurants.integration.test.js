const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000101'

test('user-facing restaurant mutation endpoints allow USER accounts and stay free of sub-role fields', async (t) => {
    const createdAt = new Date('2026-03-25T10:00:00Z')
    const updatedAt = new Date('2026-03-25T11:00:00Z')

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
                },
                restaurantUser: {
                    create: async () => ({
                        id: 'membership-1',
                        userId: 'user-1',
                        restaurantId: RESTAURANT_ID,
                    }),
                },
            }),
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
            address: '59 Hai Phong, Da Nang',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    })

    assert.equal(createResponse.status, 201)
    assert.deepEqual(createResponse.body.data, {
        id: RESTAURANT_ID,
        name: 'The 59 cafe',
        slug: 'the-59-cafe',
        address: '59 Hai Phong, Da Nang',
        googleMapUrl: 'https://maps.app.goo.gl/the59',
        createdAt: '2026-03-25T10:00:00.000Z',
    })
    assert.equal('permission' in createResponse.body.data, false)

    const updateResponse = await request(server, 'PATCH', `/api/restaurants/${RESTAURANT_ID}`, {
        token: auth,
        body: {
            name: 'The 59 cafe updated',
            address: '60 Hai Phong, Da Nang',
        },
    })

    assert.equal(updateResponse.status, 200)
    assert.deepEqual(updateResponse.body.data, {
        id: RESTAURANT_ID,
        name: 'The 59 cafe updated',
        slug: 'the-59-cafe',
        address: '60 Hai Phong, Da Nang',
        googleMapUrl: 'https://maps.app.goo.gl/the59',
        updatedAt: '2026-03-25T11:00:00.000Z',
    })
    assert.equal('permission' in updateResponse.body.data, false)
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
