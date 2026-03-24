const express = require('express')

const { notFound } = require('../../lib/app-error')
const requirePermission = require('../../middleware/require-permission')
const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./review-crawl.controller')
const repository = require('./review-crawl.repository')

const router = express.Router()
const validateSourceId = validateUuidParam('sourceId')
const validateRunId = validateUuidParam('runId')

async function resolveSourceRestaurantId(req) {
    const source = await repository.findSourceById(req.params.sourceId)

    if (!source) {
        throw notFound('NOT_FOUND', 'Review crawl source not found')
    }

    return source.restaurantId
}

async function resolveRunRestaurantId(req) {
    const run = await repository.findRunById(req.params.runId)

    if (!run) {
        throw notFound('NOT_FOUND', 'Review crawl run not found')
    }

    return run.restaurantId
}

router.post(
    '/review-crawl/google-maps',
    requirePermission(['OWNER', 'MANAGER']),
    controller.previewGoogleMapsReviews,
)
router.post(
    '/review-crawl/sources',
    requirePermission(['OWNER', 'MANAGER']),
    controller.upsertReviewCrawlSource,
)
router.post(
    '/review-crawl/sources/:sourceId/runs',
    validateSourceId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveSourceRestaurantId }),
    controller.createReviewCrawlRun,
)
router.get(
    '/review-crawl/runs/:runId',
    validateRunId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveRunRestaurantId }),
    controller.getReviewCrawlRun,
)
router.post(
    '/review-crawl/runs/:runId/cancel',
    validateRunId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveRunRestaurantId }),
    controller.cancelReviewCrawlRun,
)
router.post(
    '/review-crawl/runs/:runId/resume',
    validateRunId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveRunRestaurantId }),
    controller.resumeReviewCrawlRun,
)
router.post(
    '/review-crawl/runs/:runId/materialize-intake',
    validateRunId,
    requirePermission(['OWNER', 'MANAGER'], { resolveRestaurantId: resolveRunRestaurantId }),
    controller.materializeReviewCrawlRun,
)

module.exports = router
