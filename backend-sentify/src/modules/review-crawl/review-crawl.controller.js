const { handleControllerError } = require('../../lib/controller-error')
const service = require('./review-crawl.service')
const {
    createReviewCrawlRunSchema,
    crawlGoogleMapsRequestSchema,
    upsertReviewCrawlSourceSchema,
} = require('./google-maps.validation')

async function previewGoogleMapsReviews(req, res) {
    try {
        const input = crawlGoogleMapsRequestSchema.parse(req.body)
        const result = await service.previewGoogleMapsReviews({
            userId: req.user.userId,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function upsertReviewCrawlSource(req, res) {
    try {
        const input = upsertReviewCrawlSourceSchema.parse(req.body)
        const result = await service.upsertReviewCrawlSource({
            userId: req.user.userId,
            input,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function createReviewCrawlRun(req, res) {
    try {
        const input = createReviewCrawlRunSchema.parse(req.body)
        const result = await service.createReviewCrawlRun({
            userId: req.user.userId,
            sourceId: req.params.sourceId,
            input,
        })

        return res.status(202).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getReviewCrawlRun(req, res) {
    try {
        const result = await service.getReviewCrawlRun({
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

async function cancelReviewCrawlRun(req, res) {
    try {
        const result = await service.cancelReviewCrawlRun({
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

async function resumeReviewCrawlRun(req, res) {
    try {
        const result = await service.resumeReviewCrawlRun({
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

async function materializeReviewCrawlRun(req, res) {
    try {
        const result = await service.materializeRunToIntake({
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

module.exports = {
    cancelReviewCrawlRun,
    createReviewCrawlRun,
    getReviewCrawlRun,
    materializeReviewCrawlRun,
    previewGoogleMapsReviews,
    resumeReviewCrawlRun,
    upsertReviewCrawlSource,
}
