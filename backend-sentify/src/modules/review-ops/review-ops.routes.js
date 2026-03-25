const express = require('express')

const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./review-ops.controller')

const router = express.Router()
const validateSourceId = validateUuidParam('sourceId')
const validateRunId = validateUuidParam('runId')
const validateBatchId = validateUuidParam('batchId')

router.post('/review-ops/google-maps/sync-to-draft', controller.syncGoogleMapsToDraft)
router.get('/review-ops/sources', controller.listSources)
router.get('/review-ops/sources/:sourceId/runs', validateSourceId, controller.listSourceRuns)
router.get('/review-ops/runs/:runId', validateRunId, controller.getRunDetail)
router.post('/review-ops/sources/:sourceId/disable', validateSourceId, controller.disableSource)
router.post('/review-ops/sources/:sourceId/enable', validateSourceId, controller.enableSource)
router.get('/review-ops/batches/:batchId/readiness', validateBatchId, controller.getBatchReadiness)
router.post(
    '/review-ops/batches/:batchId/approve-valid',
    validateBatchId,
    controller.approveValidBatchItems,
)
router.post('/review-ops/batches/:batchId/publish', validateBatchId, controller.publishBatch)

module.exports = router
