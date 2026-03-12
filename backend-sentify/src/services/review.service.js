const { badRequest } = require('../lib/app-error')
const prisma = require('../lib/prisma')
const { getRestaurantAccess } = require('./restaurant-access.service')

function parseStartDate(dateString) {
    return new Date(`${dateString}T00:00:00.000Z`)
}

function parseEndDate(dateString) {
    return new Date(`${dateString}T23:59:59.999Z`)
}

async function listReviews({ userId, restaurantId, rating, from, to, page = 1, limit = 20 }) {
    // Keep review queries restaurant-scoped; list endpoints must never bypass membership checks.
    await getRestaurantAccess({
        userId,
        restaurantId,
    })

    if (from && to && parseStartDate(from) > parseEndDate(to)) {
        throw badRequest('INVALID_DATE_RANGE', '`from` must be before or equal to `to`')
    }

    const where = {
        restaurantId,
    }

    if (typeof rating === 'number') {
        where.rating = rating
    }

    if (from || to) {
        where.reviewDate = {}

        if (from) {
            where.reviewDate.gte = parseStartDate(from)
        }

        if (to) {
            where.reviewDate.lte = parseEndDate(to)
        }
    }

    const skip = (page - 1) * limit

    // Count + page query run together so pagination metadata matches the same filter set.
    const [total, reviews] = await prisma.$transaction([
        prisma.review.count({ where }),
        prisma.review.findMany({
            where,
            orderBy: [{ reviewDate: 'desc' }, { createdAt: 'desc' }],
            skip,
            take: limit,
            select: {
                id: true,
                externalId: true,
                authorName: true,
                rating: true,
                content: true,
                sentiment: true,
                reviewDate: true,
            },
        }),
    ])

    return {
        data: reviews,
        pagination: {
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
    }
}

module.exports = {
    listReviews,
}
