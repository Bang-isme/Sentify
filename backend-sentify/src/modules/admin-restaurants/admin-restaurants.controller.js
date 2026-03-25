const { handleControllerError } = require('../../lib/controller-error')
const service = require('./admin-restaurants.service')

async function listAdminRestaurants(req, res) {
    try {
        const result = await service.listAdminRestaurants({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getAdminRestaurantDetail(req, res) {
    try {
        const result = await service.getAdminRestaurantDetail({
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
    getAdminRestaurantDetail,
    listAdminRestaurants,
}
