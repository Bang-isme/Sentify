const express = require('express')

const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./admin-intake.controller')

const router = express.Router()
const validateId = validateUuidParam('id')

router.post('/review-batches', controller.createReviewBatch)
router.get('/review-batches', controller.listReviewBatches)
router.get('/review-batches/:id', validateId, controller.getReviewBatch)
router.delete('/review-batches/:id', validateId, controller.deleteReviewBatch)
router.post('/review-batches/:id/items', validateId, controller.addReviewItems)
router.post('/review-batches/:id/items/bulk', validateId, controller.addReviewItemsBulk)
router.patch('/review-items/:id', validateId, controller.updateReviewItem)
router.delete('/review-items/:id', validateId, controller.deleteReviewItem)
router.post('/review-batches/:id/publish', validateId, controller.publishReviewBatch)

module.exports = router
