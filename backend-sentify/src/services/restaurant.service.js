const { getRestaurantAccess } = require('./restaurant-access.service')
const { buildInsightSummary } = require('./insight.service')
const prisma = require('../lib/prisma')

function buildDatasetStatus({ latestPublishedBatch, openBatches }) {
    const sourcePolicy = latestPublishedBatch ? 'ADMIN_CURATED' : 'UNCONFIGURED'
    const openBatchSummary = (openBatches || []).reduce(
        (summary, batch) => {
            summary.pendingBatchCount += 1

            for (const item of batch.items || []) {
                if (item.approvalStatus === 'APPROVED') {
                    summary.approvedItemCount += 1
                } else if (item.approvalStatus === 'REJECTED') {
                    summary.rejectedItemCount += 1
                } else {
                    summary.pendingItemCount += 1
                }
            }

            if (batch.status === 'READY_TO_PUBLISH') {
                summary.readyBatchCount += 1
            }

            return summary
        },
        {
            pendingBatchCount: 0,
            readyBatchCount: 0,
            pendingItemCount: 0,
            approvedItemCount: 0,
            rejectedItemCount: 0,
        },
    )

    return {
        sourcePolicy,
        lastPublishedAt: latestPublishedBatch?.publishedAt ?? null,
        lastPublishedSourceType: latestPublishedBatch?.sourceType ?? null,
        pendingBatchCount: openBatchSummary.pendingBatchCount,
        readyBatchCount: openBatchSummary.readyBatchCount,
        pendingItemCount: openBatchSummary.pendingItemCount,
        approvedItemCount: openBatchSummary.approvedItemCount,
        rejectedItemCount: openBatchSummary.rejectedItemCount,
    }
}

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

async function fetchIntakeSummary(restaurantId) {
    const openStatuses = ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH']

    const [latestPublishedBatch, openBatches, approvalCounts] = await Promise.all([
        prisma.reviewIntakeBatch.findFirst({
            where: {
                restaurantId,
                status: 'PUBLISHED',
            },
            orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
            select: {
                sourceType: true,
                publishedAt: true,
            },
        }),
        prisma.reviewIntakeBatch.findMany({
            where: {
                restaurantId,
                status: {
                    in: openStatuses,
                },
            },
            select: {
                status: true,
                _count: {
                    select: { items: true },
                },
            },
        }),
        prisma.reviewIntakeItem.groupBy({
            by: ['approvalStatus'],
            where: {
                restaurantId,
                batch: {
                    status: {
                        in: openStatuses,
                    },
                },
            },
            _count: { _all: true },
        }),
    ])

    // Merge the batch status counts and approval counts into the expected format
    const mergedBatches = openBatches.map((batch) => ({
        status: batch.status,
        items: [],
    }))

    // Build a mock items array from approvalCounts for buildDatasetStatus compatibility
    const mockItems = []
    for (const group of approvalCounts) {
        for (let i = 0; i < group._count._all; i++) {
            mockItems.push({ approvalStatus: group.approvalStatus })
        }
    }

    // Attach items to the first batch for counting (buildDatasetStatus iterates all batch items)
    if (mergedBatches.length > 0) {
        mergedBatches[0].items = mockItems
    }

    return { latestPublishedBatch, openBatches: mergedBatches }
}

async function createRestaurant(input) {
    const name = input.name.trim()
    const address = input.address?.trim() || null
    const googleMapUrl = input.googleMapUrl?.trim() || null
    const slug = await generateUniqueSlug(name)

    // Restaurant creation and membership insertion must commit together so the user can land in the
    // merchant flow immediately after onboarding.
    const result = await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
            data: {
                name,
                slug,
                address,
                googleMapUrl,
            },
        })

        await tx.restaurantUser.create({
            data: {
                userId: input.userId,
                restaurantId: restaurant.id,
            },
        })

        return {
            restaurant,
        }
    })

    return {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        address: result.restaurant.address,
        googleMapUrl: result.restaurant.googleMapUrl,
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
    const { latestPublishedBatch, openBatches } = await fetchIntakeSummary(restaurantId)

    return {
        id: access.restaurant.id,
        name: access.restaurant.name,
        slug: access.restaurant.slug,
        address: access.restaurant.address,
        googleMapUrl: access.restaurant.googleMapUrl,
        datasetStatus: buildDatasetStatus({ latestPublishedBatch, openBatches }),
        insightSummary: buildInsightSummary(access.restaurantWithRelations.insight),
    }
}

async function updateRestaurant(input) {
    const access = await getRestaurantAccess({
        userId: input.userId,
        restaurantId: input.restaurantId,
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
        updatedAt: restaurant.updatedAt,
    }
}

module.exports = {
    createRestaurant,
    getRestaurantDetail,
    listRestaurants,
    updateRestaurant,
    __private: {
        buildDatasetStatus,
        fetchIntakeSummary,
    },
}
