const prisma = require('../../lib/prisma')
const { INTERNAL_OPERATOR_ROLES } = require('../../lib/user-roles')
const { appendAuditEvent } = require('../../services/audit-event.service')
const {
    mapRestaurantEntitlement,
    upsertRestaurantEntitlement,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
} = require('../../services/restaurant-entitlement.service')
const { buildInsightSummary } = require('../../services/insight.service')
const { ensureRestaurantExists } = require('../../services/restaurant-access.service')
const {
    buildDatasetStatus,
    fetchIntakeSummary,
} = require('../../services/restaurant-state.service')
const { getUserRoleAccess } = require('../../services/user-access.service')
const { summarizeBatchItems } = require('../admin-intake/admin-intake.domain')
const {
    claimNextSourceSubmissionGroup,
    createSourceFromSubmission,
    fetchSourceSubmissionQueue,
    resolveAdminSourceSubmission,
    updateSourceSubmissionSchedulingLane,
    __private: sourceSubmissionPrivate,
} = require('./admin-restaurants-source-submission.service')

const OPEN_BATCH_STATUSES = ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH']

async function ensureAdminAccess(userId) {
    return getUserRoleAccess({
        userId,
        allowedRoles: INTERNAL_OPERATOR_ROLES,
    })
}

function mapBatchSummary(batch) {
    const counts = summarizeBatchItems(batch.items || [])

    return {
        id: batch.id,
        title: batch.title ?? null,
        sourceType: batch.sourceType,
        status: batch.status,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        counts,
    }
}

function mapLatestRun(run) {
    if (!run) {
        return null
    }

    return {
        id: run.id,
        status: run.status,
        strategy: run.strategy,
        priority: run.priority,
        extractedCount: run.extractedCount,
        validCount: run.validCount,
        warningCount: run.warningCount,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        sourceId: run.sourceId,
        intakeBatchId: run.intakeBatchId ?? null,
    }
}

function buildAdminNextActions({ datasetStatus, sourceStats, latestRun, sourceSubmissionWorkItem = null }) {
    const actions = []

    if (sourceSubmissionWorkItem) {
        actions.push(sourceSubmissionWorkItem.nextAction)
    }

    if (!datasetStatus.lastPublishedAt) {
        actions.push('Create the first draft intake batch or sync a crawl source before merchant dashboards go live.')
    }

    if (sourceStats.totalCount === 0 && !sourceSubmissionWorkItem) {
        actions.push('Register at least one crawl source if this restaurant should ingest Google Maps evidence.')
    }

    if (datasetStatus.pendingBatchCount > 0 && datasetStatus.approvedItemCount === 0) {
        actions.push('Review pending intake items and approve valid evidence before publish.')
    }

    if (datasetStatus.readyBatchCount > 0) {
        actions.push('Publish the ready batch to refresh the canonical merchant dataset.')
    }

    if (latestRun && ['PARTIAL', 'COMPLETED'].includes(latestRun.status) && datasetStatus.pendingBatchCount === 0) {
        actions.push('Materialize the latest crawl run into a draft batch so the intake workflow can continue.')
    }

    return actions
}

async function listAdminRestaurants({ userId }) {
    await ensureAdminAccess(userId)

    const [restaurants, openBatchCounts, activeSourceCounts] = await Promise.all([
        prisma.restaurant.findMany({
            include: {
                entitlement: true,
                insight: true,
                _count: {
                    select: {
                        reviews: true,
                        users: true,
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.groupBy({
            by: ['restaurantId'],
            where: {
                status: {
                    in: OPEN_BATCH_STATUSES,
                },
            },
            _count: {
                _all: true,
            },
        }),
        prisma.reviewCrawlSource.groupBy({
            by: ['restaurantId'],
            where: {
                status: 'ACTIVE',
            },
            _count: {
                _all: true,
            },
        }),
    ])

    const openBatchCountByRestaurantId = new Map(
        openBatchCounts.map((row) => [row.restaurantId, row._count._all]),
    )
    const activeSourceCountByRestaurantId = new Map(
        activeSourceCounts.map((row) => [row.restaurantId, row._count._all]),
    )

    return restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        googleMapUrl: restaurant.googleMapUrl,
        totalReviews: restaurant._count.reviews,
        memberCount: restaurant._count.users,
        entitlement: mapRestaurantEntitlement({
            id: restaurant.entitlement?.id ?? null,
            restaurantId: restaurant.id,
            planTier: restaurant.entitlement?.planTier ?? null,
            createdAt: restaurant.entitlement?.createdAt ?? null,
            updatedAt: restaurant.entitlement?.updatedAt ?? null,
        }),
        pendingBatchCount: openBatchCountByRestaurantId.get(restaurant.id) ?? 0,
        activeSourceCount: activeSourceCountByRestaurantId.get(restaurant.id) ?? 0,
        insightSummary: buildInsightSummary(restaurant.insight),
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
    }))
}

async function listAdminSourceSubmissions({ userId }) {
    await ensureAdminAccess(userId)

    const queue = await fetchSourceSubmissionQueue()

    return {
        summary: queue.summary,
        groups: queue.groups,
    }
}

async function getAdminRestaurantDetail({ userId, restaurantId }) {
    await ensureAdminAccess(userId)

    const restaurantAccess = await ensureRestaurantExists({
        restaurantId,
        restaurantInclude: {
            entitlement: true,
            insight: true,
            _count: {
                select: {
                    reviews: true,
                    users: true,
                },
            },
        },
    })

    const [intakeSummary, openBatches, sourceStats, latestRun, sourceSubmissionQueue] = await Promise.all([
            fetchIntakeSummary(restaurantId),
        prisma.reviewIntakeBatch.findMany({
            where: {
                restaurantId,
                status: {
                    in: OPEN_BATCH_STATUSES,
                },
            },
            include: {
                items: {
                    select: {
                        approvalStatus: true,
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: 10,
        }),
        Promise.all([
            prisma.reviewCrawlSource.count({ where: { restaurantId } }),
            prisma.reviewCrawlSource.count({ where: { restaurantId, status: 'ACTIVE' } }),
            prisma.reviewCrawlSource.count({ where: { restaurantId, status: 'DISABLED' } }),
        ]).then(([totalCount, activeCount, disabledCount]) => ({
            totalCount,
            activeCount,
            disabledCount,
        })),
        prisma.reviewCrawlRun.findFirst({
            where: {
                restaurantId,
            },
            orderBy: [{ createdAt: 'desc' }],
        }),
        fetchSourceSubmissionQueue({ restaurantId }),
    ])

    const datasetStatus = buildDatasetStatus(intakeSummary)
    const sourceSubmissionWorkItem = sourceSubmissionQueue.restaurantItems.get(restaurantId) ?? null

    return {
        restaurant: {
            id: restaurantAccess.restaurant.id,
            name: restaurantAccess.restaurant.name,
            slug: restaurantAccess.restaurant.slug,
            address: restaurantAccess.restaurant.address,
            googleMapUrl: restaurantAccess.restaurant.googleMapUrl,
            totalReviews: restaurantAccess.restaurantWithRelations._count.reviews,
            memberCount: restaurantAccess.restaurantWithRelations._count.users,
            entitlement: mapRestaurantEntitlement({
                id: restaurantAccess.restaurantWithRelations.entitlement?.id ?? null,
                restaurantId,
                planTier:
                    restaurantAccess.restaurantWithRelations.entitlement?.planTier ??
                    null,
                createdAt:
                    restaurantAccess.restaurantWithRelations.entitlement?.createdAt ??
                    null,
                updatedAt:
                    restaurantAccess.restaurantWithRelations.entitlement?.updatedAt ??
                    null,
            }),
            createdAt: restaurantAccess.restaurant.createdAt,
            updatedAt: restaurantAccess.restaurant.updatedAt,
        },
        userFlow: {
            datasetStatus,
            insightSummary: buildInsightSummary(restaurantAccess.restaurantWithRelations.insight),
        },
        adminFlow: {
            sourceStats,
            latestRun: mapLatestRun(latestRun),
            openBatches: openBatches.map((batch) => mapBatchSummary(batch)),
            sourceSubmissionQueue: {
                summary: sourceSubmissionQueue.summary,
                item: sourceSubmissionWorkItem,
            },
            nextActions: buildAdminNextActions({
                datasetStatus,
                sourceStats,
                latestRun,
                sourceSubmissionWorkItem,
            }),
        },
    }
}

async function updateRestaurantEntitlement({ userId, restaurantId, input = {} }) {
    await ensureAdminAccess(userId)

    const restaurantAccess = await ensureRestaurantExists({
        restaurantId,
        restaurantInclude: {
            entitlement: true,
        },
    })

    const previousEntitlement = mapRestaurantEntitlement({
        id: restaurantAccess.restaurantWithRelations.entitlement?.id ?? null,
        restaurantId,
        planTier:
            restaurantAccess.restaurantWithRelations.entitlement?.planTier ?? null,
        createdAt:
            restaurantAccess.restaurantWithRelations.entitlement?.createdAt ?? null,
        updatedAt:
            restaurantAccess.restaurantWithRelations.entitlement?.updatedAt ?? null,
    })
    const entitlement = await upsertRestaurantEntitlement({
        restaurantId,
        planTier: input.planTier,
    })

    await prisma.restaurantSourceSubmission.updateMany({
        where: {
            restaurantId,
            schedulingLaneSource:
                RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ENTITLEMENT_DEFAULT,
        },
        data: {
            schedulingLane: entitlement.effectivePolicy.sourceSubmissionLane,
        },
    })

    await appendAuditEvent({
        action: 'ADMIN_RESTAURANT_ENTITLEMENT_UPDATED',
        resourceType: 'restaurant',
        resourceId: restaurantId,
        restaurantId,
        actorUserId: userId,
        summary: `Admin set ${restaurantAccess.restaurant.name} to the ${entitlement.planTier.toLowerCase()} plan tier.`,
        metadata: {
            previous: previousEntitlement,
            current: entitlement,
        },
    })

    return {
        restaurantId,
        entitlement,
    }
}

module.exports = {
    claimNextSourceSubmissionGroup,
    createSourceFromSubmission,
    fetchSourceSubmissionQueue,
    getAdminRestaurantDetail,
    updateRestaurantEntitlement,
    resolveAdminSourceSubmission,
    listAdminSourceSubmissions,
    listAdminRestaurants,
    updateSourceSubmissionSchedulingLane,
    __private: {
        ...sourceSubmissionPrivate,
    },
}
