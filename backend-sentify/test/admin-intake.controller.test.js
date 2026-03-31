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
    clearModule('../src/modules/admin-intake/admin-intake.controller')
    clearModule('../src/modules/admin-intake/admin-intake.service')
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

test('admin intake controller creates a batch with 201', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        createReviewBatch: async (payload) => {
            receivedPayload = payload
            return { id: 'batch-1' }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        body: {
            restaurantId: RESTAURANT_ID,
            sourceType: 'MANUAL',
            title: 'March batch',
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.createReviewBatch(req, res)

    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, { data: { id: 'batch-1' } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.restaurantId, RESTAURANT_ID)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller lists batches with 200', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        listReviewBatches: async (payload) => {
            receivedPayload = payload
            return [{ id: 'batch-1' }]
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        query: { restaurantId: RESTAURANT_ID },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.listReviewBatches(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: [{ id: 'batch-1' }] })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.restaurantId, RESTAURANT_ID)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller adds items with 201', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        addReviewItems: async (payload) => {
            receivedPayload = payload
            return { id: 'batch-1' }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'batch-1' },
        body: {
            items: [
                {
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great food',
                    rawReviewDate: new Date('2026-03-01T00:00:00Z'),
                },
            ],
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.addReviewItems(req, res)

    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, { data: { id: 'batch-1' } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.batchId, 'batch-1')
    assert.equal(receivedPayload.items.length, 1)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller bulk adds items with 201', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        addReviewItemsBulk: async (payload) => {
            receivedPayload = payload
            return { id: 'batch-1' }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'batch-1' },
        body: {
            items: [
                {
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great food',
                    rawReviewDate: new Date('2026-03-01T00:00:00Z'),
                },
            ],
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.addReviewItemsBulk(req, res)

    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, { data: { id: 'batch-1' } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.batchId, 'batch-1')
    assert.equal(receivedPayload.items.length, 1)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller updates an item with 200', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        updateReviewItem: async (payload) => {
            receivedPayload = payload
            return { id: 'item-1' }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'item-1' },
        body: {
            normalizedRating: 4,
            approvalStatus: 'APPROVED',
        },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.updateReviewItem(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: { id: 'item-1' } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.itemId, 'item-1')
    assert.equal(receivedPayload.input.normalizedRating, 4)
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller publishes a batch with 200', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        publishReviewBatch: async (payload) => {
            receivedPayload = payload
            return { batch: { id: 'batch-1' }, publishedCount: 1 }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'batch-1' },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.publishReviewBatch(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: { batch: { id: 'batch-1' }, publishedCount: 1 } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.batchId, 'batch-1')
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller deletes a batch with 200', async () => {
    restoreModules()

    const handledErrors = []
    let receivedPayload = null

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(500).json({ error: { code: 'UNEXPECTED' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        deleteReviewBatch: async (payload) => {
            receivedPayload = payload
            return { id: 'batch-1', deleted: true }
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'batch-1' },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.deleteReviewBatch(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: { id: 'batch-1', deleted: true } })
    assert.equal(receivedPayload.userId, 'user-1')
    assert.equal(receivedPayload.batchId, 'batch-1')
    assert.equal(handledErrors.length, 0)

    restoreModules()
})

test('admin intake controller reports validation errors', async () => {
    restoreModules()

    let serviceCalled = false
    const handledErrors = []

    withMock('../src/lib/controller-error', {
        handleControllerError: (req, res, error) => {
            handledErrors.push(error)
            return res.status(400).json({ error: { code: 'BAD_REQUEST' } })
        },
    })
    withMock('../src/modules/admin-intake/admin-intake.service', {
        addReviewItems: async () => {
            serviceCalled = true
        },
    })

    const controller = require('../src/modules/admin-intake/admin-intake.controller')
    const req = {
        params: { id: 'batch-1' },
        body: { items: [] },
        user: { userId: 'user-1' },
    }
    const res = createRes()

    await controller.addReviewItems(req, res)

    assert.equal(serviceCalled, false)
    assert.equal(res.statusCode, 400)
    assert.equal(handledErrors.length, 1)

    restoreModules()
})
