const { handleControllerError } = require('../../lib/controller-error')
const service = require('./admin-intake.service')
const {
    createReviewBatchSchema,
    createReviewItemsSchema,
    listReviewBatchesQuerySchema,
    updateReviewItemSchema,
} = require('./admin-intake.validation')

async function createReviewBatch(req, res) {
    try {
        const input = createReviewBatchSchema.parse(req.body)
        const result = await service.createReviewBatch({
            userId: req.user.userId,
            ...input,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listReviewBatches(req, res) {
    try {
        const query = listReviewBatchesQuerySchema.parse(req.query)
        const result = await service.listReviewBatches({
            userId: req.user.userId,
            restaurantId: query.restaurantId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getReviewBatch(req, res) {
    try {
        const result = await service.getReviewBatch({
            userId: req.user.userId,
            batchId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function addReviewItems(req, res) {
    try {
        const input = createReviewItemsSchema.parse(req.body)
        const result = await service.addReviewItems({
            userId: req.user.userId,
            batchId: req.params.id,
            items: input.items,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateReviewItem(req, res) {
    try {
        const input = updateReviewItemSchema.parse(req.body)
        const result = await service.updateReviewItem({
            userId: req.user.userId,
            itemId: req.params.id,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function publishReviewBatch(req, res) {
    try {
        const result = await service.publishReviewBatch({
            userId: req.user.userId,
            batchId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    addReviewItems,
    createReviewBatch,
    getReviewBatch,
    listReviewBatches,
    publishReviewBatch,
    updateReviewItem,
}
