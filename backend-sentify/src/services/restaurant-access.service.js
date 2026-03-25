const prisma = require('../lib/prisma')
const { notFound } = require('../lib/app-error')

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
    restaurantInclude,
}) {
    // Merchant routes stay restaurant-scoped, but membership no longer carries sub-roles.
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

    return {
        restaurant: buildRestaurantSummary(membership.restaurant),
        restaurantWithRelations: membership.restaurant,
    }
}

async function ensureRestaurantExists({ restaurantId, restaurantInclude }) {
    const restaurant = await prisma.restaurant.findUnique({
        where: {
            id: restaurantId,
        },
        ...(restaurantInclude
            ? {
                  include: restaurantInclude,
              }
            : {}),
    })

    if (!restaurant) {
        throw notFound('NOT_FOUND', 'Restaurant not found')
    }

    return {
        restaurant: buildRestaurantSummary(restaurant),
        restaurantWithRelations: restaurant,
    }
}

module.exports = {
    ensureRestaurantExists,
    getRestaurantAccess,
}
