const express = require('express')

const controller = require('./admin-intake.controller')

const router = express.Router()

router.post('/review-batches', controller.createReviewBatch)
router.get('/review-batches', controller.listReviewBatches)
router.get('/review-batches/:id', controller.getReviewBatch)
router.post('/review-batches/:id/items', controller.addReviewItems)
router.patch('/review-items/:id', controller.updateReviewItem)
router.post('/review-batches/:id/publish', controller.publishReviewBatch)

module.exports = router
