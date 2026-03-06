const { handleControllerError } = require('../lib/controller-error')
const reviewImportService = require('../services/review-import.service')

async function importReviews(req, res) {
    try {
        const result = await reviewImportService.importReviews({
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
    importReviews,
}
