const prisma = require('../lib/prisma')
const { forbidden, notFound } = require('../lib/app-error')

function normalizePermissions(allowedPermissions) {
    if (!Array.isArray(allowedPermissions) || allowedPermissions.length === 0) {
        return null
    }

    return new Set(allowedPermissions)
}

function buildRestaurantSummary(restaurant) {
    return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        googleMapUrl: restaurant.googleMapUrl,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
    }
}

async function getRestaurantAccess({
    userId,
    restaurantId,
    allowedPermissions,
    restaurantInclude,
}) {
    const membership = await prisma.restaurantUser.findFirst({
        where: {
            userId,
            restaurantId,
        },
        include: {
            restaurant: restaurantInclude
                ? {
                      include: restaurantInclude,
                  }
                : true,
        },
    })

    if (!membership) {
        throw notFound('NOT_FOUND', 'Restaurant not found')
    }

    const permissionSet = normalizePermissions(allowedPermissions)

    if (permissionSet && !permissionSet.has(membership.permission)) {
        throw forbidden('FORBIDDEN', 'You do not have access to this restaurant action')
    }

    return {
        permission: membership.permission,
        restaurant: buildRestaurantSummary(membership.restaurant),
        restaurantWithRelations: membership.restaurant,
    }
}

module.exports = {
    getRestaurantAccess,
}
