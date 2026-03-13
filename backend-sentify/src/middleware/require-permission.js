const { badRequest } = require('../lib/app-error')
const { getRestaurantAccess } = require('../services/restaurant-access.service')

function normalizePermissions(allowedPermissions) {
    if (!allowedPermissions) {
        return []
    }

    return Array.isArray(allowedPermissions) ? allowedPermissions : [allowedPermissions]
}

function resolveRestaurantIdFromRequest(req) {
    return (
        req?.body?.restaurantId ||
        req?.query?.restaurantId ||
        req?.params?.restaurantId ||
        null
    )
}

function requirePermission(allowedPermissions, options = {}) {
    const normalizedPermissions = normalizePermissions(allowedPermissions)
    const resolveRestaurantId =
        options.resolveRestaurantId || resolveRestaurantIdFromRequest

    return async function requirePermissionMiddleware(req, res, next) {
        try {
            const restaurantId = await resolveRestaurantId(req)

            if (!restaurantId) {
                throw badRequest('RESTAURANT_ID_REQUIRED', 'restaurantId is required')
            }

            const access = await getRestaurantAccess({
                userId: req.user?.userId,
                restaurantId,
                allowedPermissions: normalizedPermissions,
            })

            req.restaurantAccess = access
            return next()
        } catch (error) {
            return next(error)
        }
    }
}

module.exports = requirePermission
