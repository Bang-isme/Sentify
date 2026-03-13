const { z } = require('zod')

const { handleControllerError } = require('../lib/controller-error')
const dashboardService = require('../services/dashboard.service')

const trendQuerySchema = z.object({
    period: z.enum(['week', 'month']).default('week'),
})

async function getKpi(req, res) {
    try {
        const result = await dashboardService.getRestaurantKpi({
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

async function getSentimentBreakdown(req, res) {
    try {
        const result = await dashboardService.getSentimentBreakdown({
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

async function getTrend(req, res) {
    try {
        // Trend is the only dashboard endpoint with query input, so validate period at the controller boundary.
        const query = trendQuerySchema.parse(req.query)
        const result = await dashboardService.getTrend({
            userId: req.user.userId,
            restaurantId: req.params.id,
            period: query.period,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getComplaintKeywords(req, res) {
    try {
        const result = await dashboardService.getComplaintKeywords({
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

async function getTopIssue(req, res) {
    try {
        const result = await dashboardService.getTopIssue({
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

module.exports = {
    getKpi,
    getSentimentBreakdown,
    getTrend,
    getComplaintKeywords,
    getTopIssue,
}
