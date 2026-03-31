const test = require('node:test')
const assert = require('node:assert/strict')
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'

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
    clearModule('../src/modules/review-ops/review-ops.controller')
    clearModule('../src/modules/review-ops/review-ops.service')
    clearModule('../src/lib/controller-error')
}

function createRes() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            this.body = payload
            return this
        },
    }
}

test('review ops controller syncs a google maps source to draft with 202', async () => {
    restoreModules()

    let receivedPayload = null
    const handledErrors = []

    withMock('../src/lib/controller-error', {
        handleControllerError: (_req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/review-ops/review-ops.service', {
        syncGoogleMapsToDraft: async (payload) => {
            receivedPayload = payload
            return {
                source: { id: 'source-1' },
                run: { id: 'run-1' },
            }
        },
    })

    const controller = require('../src/modules/review-ops/review-ops.controller')
    const req = {
        body: {
            restaurantId: RESTAURANT_ID,
            url: 'https://maps.app.goo.gl/example',
            language: 'en',
            region: 'us',
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.syncGoogleMapsToDraft(req, res)

    assert.equal(res.statusCode, 202)
    assert.deepEqual(res.body, { data: { source: { id: 'source-1' }, run: { id: 'run-1' } } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.input.restaurantId, RESTAURANT_ID)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('review ops controller lists sources with 200', async () => {
    restoreModules()

    let receivedPayload = null
    const handledErrors = []

    withMock('../src/lib/controller-error', {
        handleControllerError: (_req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/review-ops/review-ops.service', {
        listSources: async (payload) => {
            receivedPayload = payload
            return { sources: [] }
        },
    })

    const controller = require('../src/modules/review-ops/review-ops.controller')
    const req = {
        query: {
            restaurantId: RESTAURANT_ID,
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.listSources(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: { sources: [] } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.restaurantId, RESTAURANT_ID)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('review ops controller reports validation errors for sync-to-draft', async () => {
    restoreModules()

    let serviceCalled = false
    const handledErrors = []

    withMock('../src/lib/controller-error', {
        handleControllerError: (_req, res, error) => {
            handledErrors.push(error)
            return res.status(400).json({ error: { code: 'VALIDATION_FAILED' } })
        },
    })
    withMock('../src/modules/review-ops/review-ops.service', {
        syncGoogleMapsToDraft: async () => {
            serviceCalled = true
        },
    })

    const controller = require('../src/modules/review-ops/review-ops.controller')
    const req = {
        body: {
            restaurantId: 'restaurant-1',
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.syncGoogleMapsToDraft(req, res)

    assert.equal(serviceCalled, false)
    assert.equal(res.statusCode, 400)
    assert.equal(handledErrors.length, 1)

    restoreModules()
})
