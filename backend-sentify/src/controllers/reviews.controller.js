const { z } = require('zod')

const { handleControllerError } = require('../lib/controller-error')
const reviewService = require('../services/review.service')

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const listReviewsQuerySchema = z.object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})

async function listReviews(req, res) {
    try {
        const query = listReviewsQuerySchema.parse(req.query)
        const result = await reviewService.listReviews({
            userId: req.user.userId,
            restaurantId: req.params.id,
            ...query,
        })

        return res.status(200).json(result)
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    listReviews,
}
