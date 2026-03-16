const express = require('express')

const { notFound } = require('../../lib/app-error')
const requirePermission = require('../../middleware/require-permission')
const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./admin-intake.controller')
const repository = require('./admin-intake.repository')

const router = express.Router()

const requireAdminAccess = requirePermission(['OWNER', 'MANAGER'])
const validateId = validateUuidParam('id')

async function resolveBatchRestaurantId(req) {
    const batch = await repository.findBatchById(req.params.id)

    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    return batch.restaurantId
}

async function resolveItemRestaurantId(req) {
    const item = await repository.findItemById(req.params.id)

    if (!item) {
        throw notFound('NOT_FOUND', 'Review item not found')
    }

    return item.restaurantId
}

router.post('/review-batches', requireAdminAccess, controller.createReviewBatch)
router.get('/review-batches', requireAdminAccess, controller.listReviewBatches)
router.get(
    '/review-batches/:id',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.getReviewBatch,
)
router.delete(
    '/review-batches/:id',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.deleteReviewBatch,
)
router.post(
    '/review-batches/:id/items',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.addReviewItems,
)
router.post(
    '/review-batches/:id/items/bulk',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.addReviewItemsBulk,
)
router.patch(
    '/review-items/:id',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveItemRestaurantId }),
    controller.updateReviewItem,
)
router.delete(
    '/review-items/:id',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveItemRestaurantId }),
    controller.deleteReviewItem,
)
router.post(
    '/review-batches/:id/publish',
    validateId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.publishReviewBatch,
)

module.exports = router
