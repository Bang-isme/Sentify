const express = require('express')

const { notFound } = require('../../lib/app-error')
const requirePermission = require('../../middleware/require-permission')
const { validateUuidParam } = require('../../middleware/validate-uuid')
const adminIntakeRepository = require('../admin-intake/admin-intake.repository')
const controller = require('./review-ops.controller')
const reviewCrawlRepository = require('../review-crawl/review-crawl.repository')

const router = express.Router()
const validateSourceId = validateUuidParam('sourceId')
const validateRunId = validateUuidParam('runId')
const validateBatchId = validateUuidParam('batchId')

async function resolveSourceRestaurantId(req) {
    const source = await reviewCrawlRepository.findSourceById(req.params.sourceId)

    if (!source) {
        throw notFound('NOT_FOUND', 'Review crawl source not found')
    }

    return source.restaurantId
}

async function resolveRunRestaurantId(req) {
    const run = await reviewCrawlRepository.findRunById(req.params.runId)

    if (!run) {
        throw notFound('NOT_FOUND', 'Review crawl run not found')
    }

    return run.restaurantId
}

async function resolveBatchRestaurantId(req) {
    const batch = await adminIntakeRepository.findBatchById(req.params.batchId)

    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    return batch.restaurantId
}

router.post(
    '/review-ops/google-maps/sync-to-draft',
    requirePermission(['OWNER', 'MANAGER']),
    controller.syncGoogleMapsToDraft,
)
router.get(
    '/review-ops/sources',
    requirePermission(['OWNER', 'MANAGER']),
    controller.listSources,
)
router.get(
    '/review-ops/sources/:sourceId/runs',
    validateSourceId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveSourceRestaurantId }),
    controller.listSourceRuns,
)
router.get(
    '/review-ops/runs/:runId',
    validateRunId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveRunRestaurantId }),
    controller.getRunDetail,
)
router.post(
    '/review-ops/sources/:sourceId/disable',
    validateSourceId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveSourceRestaurantId }),
    controller.disableSource,
)
router.post(
    '/review-ops/sources/:sourceId/enable',
    validateSourceId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveSourceRestaurantId }),
    controller.enableSource,
)
router.get(
    '/review-ops/batches/:batchId/readiness',
    validateBatchId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.getBatchReadiness,
)
router.post(
    '/review-ops/batches/:batchId/approve-valid',
    validateBatchId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.approveValidBatchItems,
)
router.post(
    '/review-ops/batches/:batchId/publish',
    validateBatchId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveBatchRestaurantId }),
    controller.publishBatch,
)

module.exports = router
