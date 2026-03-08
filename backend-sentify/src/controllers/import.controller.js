const { handleControllerError } = require('../lib/controller-error')
const reviewImportRunService = require('../services/review-import-run.service')

async function queueImportReviews(req, res) {
    try {
        const result = await reviewImportRunService.queueImportRun({
            userId: req.user.userId,
            restaurantId: req.params.id,
        })

        const statusCode = result.alreadyActive ? 200 : result.run?.status === 'COMPLETED' ? 200 : 202

        return res.status(statusCode).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getLatestImportRun(req, res) {
    try {
        const result = await reviewImportRunService.getLatestImportRun({
            userId: req.user.userId,
            restaurantId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listImportRuns(req, res) {
    try {
        const result = await reviewImportRunService.listImportRuns({
            userId: req.user.userId,
            restaurantId: req.params.id,
            limit: req.query.limit,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    getLatestImportRun,
    listImportRuns,
    queueImportReviews,
}
