const { getRestaurantAccess } = require('./restaurant-access.service')
const { buildInsightSummary } = require('./insight.service')
const prisma = require('../lib/prisma')

function slugifyName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
}

async function generateUniqueSlug(name) {
    const baseSlug = slugifyName(name) || 'restaurant'

    for (let attempt = 0; attempt < 100; attempt += 1) {
        // Retry with numeric suffixes so restaurant URLs stay stable without manual slug input.
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
        const existingRestaurant = await prisma.restaurant.findUnique({
            where: { slug },
            select: { id: true },
        })

        if (!existingRestaurant) {
            return slug
        }
    }

    throw new Error('Unable to generate a unique restaurant slug')
}

async function createRestaurant(input) {
    const name = input.name.trim()
    const address = input.address?.trim() || null
    const googleMapUrl = input.googleMapUrl?.trim() || null
    const slug = await generateUniqueSlug(name)

    // Restaurant creation and OWNER membership must succeed together or rollback together.
    const result = await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
            data: {
                name,
                slug,
                address,
                googleMapUrl,
            },
        })

        const membership = await tx.restaurantUser.create({
            data: {
                userId: input.userId,
                restaurantId: restaurant.id,
                permission: 'OWNER',
            },
        })

        return {
            restaurant,
            membership,
        }
    })

    return {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        address: result.restaurant.address,
        googleMapUrl: result.restaurant.googleMapUrl,
        permission: result.membership.permission,
        createdAt: result.restaurant.createdAt,
    }
}

async function listRestaurants({ userId }) {
    const memberships = await prisma.restaurantUser.findMany({
        where: {
            userId,
        },
        include: {
            restaurant: {
                include: {
                    _count: {
                        select: {
                            reviews: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    // Include review counts here so the restaurant picker can render lightweight summary data directly.
    return memberships.map((membership) => ({
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
        googleMapUrl: membership.restaurant.googleMapUrl,
        permission: membership.permission,
        totalReviews: membership.restaurant._count.reviews,
    }))
}

async function getRestaurantDetail({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        restaurantInclude: {
            insight: true,
        },
    })

    return {
        id: access.restaurant.id,
        name: access.restaurant.name,
        slug: access.restaurant.slug,
        address: access.restaurant.address,
        googleMapUrl: access.restaurant.googleMapUrl,
        permission: access.permission,
        insightSummary: buildInsightSummary(access.restaurantWithRelations.insight),
    }
}

async function updateRestaurant(input) {
    // Only OWNER can change restaurant profile data in Sprint 1.
    const access = await getRestaurantAccess({
        userId: input.userId,
        restaurantId: input.restaurantId,
        allowedPermissions: ['OWNER'],
    })

    const data = {}

    if (typeof input.name === 'string') {
        data.name = input.name.trim()
    }

    if (Object.prototype.hasOwnProperty.call(input, 'address')) {
        data.address = input.address?.trim() || null
    }

    if (Object.prototype.hasOwnProperty.call(input, 'googleMapUrl')) {
        data.googleMapUrl = input.googleMapUrl?.trim() || null
    }

    // Keep slug stable after creation so existing frontend links and references do not drift.
    const restaurant = await prisma.restaurant.update({
        where: {
            id: access.restaurant.id,
        },
        data,
    })

    return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        googleMapUrl: restaurant.googleMapUrl,
        permission: access.permission,
        updatedAt: restaurant.updatedAt,
    }
}

module.exports = {
    createRestaurant,
    getRestaurantDetail,
    listRestaurants,
    updateRestaurant,
}
