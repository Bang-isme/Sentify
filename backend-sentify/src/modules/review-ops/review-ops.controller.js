const { handleControllerError } = require('../../lib/controller-error')
const service = require('./review-ops.service')
const {
    approveValidSchema,
    listSourcesQuerySchema,
    listSourceRunsQuerySchema,
    syncToDraftSchema,
} = require('./review-ops.validation')

async function syncGoogleMapsToDraft(req, res) {
    try {
        const input = syncToDraftSchema.parse(req.body)
        const result = await service.syncGoogleMapsToDraft({
            userId: req.user.userId,
            input,
        })

        return res.status(202).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listSources(req, res) {
    try {
        const query = listSourcesQuerySchema.parse(req.query)
        const result = await service.listSources({
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

async function listSourceRuns(req, res) {
    try {
        const query = listSourceRunsQuerySchema.parse(req.query)
        const result = await service.listSourceRuns({
            userId: req.user.userId,
            sourceId: req.params.sourceId,
            page: query.page,
            limit: query.limit,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getRunDetail(req, res) {
    try {
        const result = await service.getRunDetail({
            userId: req.user.userId,
            runId: req.params.runId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function disableSource(req, res) {
    try {
        const result = await service.disableSource({
            userId: req.user.userId,
            sourceId: req.params.sourceId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function enableSource(req, res) {
    try {
        const result = await service.enableSource({
            userId: req.user.userId,
            sourceId: req.params.sourceId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getBatchReadiness(req, res) {
    try {
        const result = await service.getBatchReadiness({
            userId: req.user.userId,
            batchId: req.params.batchId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function approveValidBatchItems(req, res) {
    try {
        const input = approveValidSchema.parse(req.body)
        const result = await service.approveValidBatchItems({
            userId: req.user.userId,
            batchId: req.params.batchId,
            reviewerNote: input.reviewerNote,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function publishBatch(req, res) {
    try {
        const result = await service.publishBatch({
            userId: req.user.userId,
            batchId: req.params.batchId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    approveValidBatchItems,
    disableSource,
    enableSource,
    getBatchReadiness,
    getRunDetail,
    listSourceRuns,
    listSources,
    publishBatch,
    syncGoogleMapsToDraft,
}
