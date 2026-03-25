const express = require('express')

const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./review-crawl.controller')

const router = express.Router()
const validateSourceId = validateUuidParam('sourceId')
const validateRunId = validateUuidParam('runId')

router.post('/review-crawl/google-maps', controller.previewGoogleMapsReviews)
router.post('/review-crawl/sources', controller.upsertReviewCrawlSource)
router.post('/review-crawl/sources/:sourceId/runs', validateSourceId, controller.createReviewCrawlRun)
router.get('/review-crawl/runs/:runId', validateRunId, controller.getReviewCrawlRun)
router.post('/review-crawl/runs/:runId/cancel', validateRunId, controller.cancelReviewCrawlRun)
router.post('/review-crawl/runs/:runId/resume', validateRunId, controller.resumeReviewCrawlRun)
router.post(
    '/review-crawl/runs/:runId/materialize-intake',
    validateRunId,
    controller.materializeReviewCrawlRun,
)

module.exports = router
