const prisma = require('../lib/prisma')

const RESTAURANT_PLAN_TIER = Object.freeze({
    FREE: 'FREE',
    PREMIUM: 'PREMIUM',
})

const RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE = Object.freeze({
    ENTITLEMENT_DEFAULT: 'ENTITLEMENT_DEFAULT',
    ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
})

const RESTAURANT_ENTITLEMENT_POLICY = Object.freeze({
    [RESTAURANT_PLAN_TIER.FREE]: {
        sourceSubmissionLane: 'STANDARD',
        sourceSyncIntervalMinutes: 1440,
        actionCardsLimit: 1,
        prioritySync: false,
        processingClass: 'STANDARD_QUEUE',
    },
    [RESTAURANT_PLAN_TIER.PREMIUM]: {
        sourceSubmissionLane: 'PRIORITY',
        sourceSyncIntervalMinutes: 360,
        actionCardsLimit: 3,
        prioritySync: true,
        processingClass: 'PRIORITY_QUEUE',
    },
})

function normalizeRestaurantPlanTier(value) {
    return RESTAURANT_ENTITLEMENT_POLICY[value]
        ? value
        : RESTAURANT_PLAN_TIER.FREE
}

function resolveRestaurantEntitlementPolicy(planTierOrRecord = null) {
    const planTier =
        typeof planTierOrRecord === 'string'
            ? normalizeRestaurantPlanTier(planTierOrRecord)
            : normalizeRestaurantPlanTier(planTierOrRecord?.planTier)
    const policy = RESTAURANT_ENTITLEMENT_POLICY[planTier]

    return {
        planTier,
        sourceSubmissionLane: policy.sourceSubmissionLane,
        sourceSyncIntervalMinutes: policy.sourceSyncIntervalMinutes,
        actionCardsLimit: policy.actionCardsLimit,
        prioritySync: policy.prioritySync,
        processingClass: policy.processingClass,
    }
}

function mapRestaurantEntitlement(record = null) {
    const effectivePolicy = resolveRestaurantEntitlementPolicy(record)

    return {
        id: record?.id ?? null,
        restaurantId: record?.restaurantId ?? null,
        planTier: effectivePolicy.planTier,
        createdAt: record?.createdAt ?? null,
        updatedAt: record?.updatedAt ?? null,
        effectivePolicy,
    }
}

function resolveEntitlementArgs(input, options = {}) {
    if (typeof input === 'string') {
        return {
            restaurantId: input,
            tx: options.tx ?? prisma,
        }
    }

    return {
        restaurantId: input?.restaurantId,
        tx: input?.tx ?? options.tx ?? prisma,
    }
}

async function ensureRestaurantEntitlement(input, options = {}) {
    const { restaurantId, tx } = resolveEntitlementArgs(input, options)
    const record = await tx.restaurantEntitlement.upsert({
        where: {
            restaurantId,
        },
        update: {},
        create: {
            restaurantId,
            planTier: RESTAURANT_PLAN_TIER.FREE,
        },
    })

    return mapRestaurantEntitlement(record)
}

async function getRestaurantEntitlement(input, options = {}) {
    const { restaurantId, tx } = resolveEntitlementArgs(input, options)
    const record = await tx.restaurantEntitlement.findUnique({
        where: {
            restaurantId,
        },
    })

    return record ? mapRestaurantEntitlement(record) : null
}

async function getEffectiveRestaurantEntitlement(input, options = {}) {
    const entitlement = await ensureRestaurantEntitlement(input, options)

    return entitlement
}

async function upsertRestaurantEntitlement(
    { restaurantId, planTier },
    options = {},
) {
    const tx = options.tx ?? prisma
    const nextPlanTier = normalizeRestaurantPlanTier(planTier)
    const record = await tx.restaurantEntitlement.upsert({
        where: {
            restaurantId,
        },
        update: {
            planTier: nextPlanTier,
        },
        create: {
            restaurantId,
            planTier: nextPlanTier,
        },
    })

    return mapRestaurantEntitlement(record)
}

module.exports = {
    ensureRestaurantEntitlement,
    getEffectiveRestaurantEntitlement,
    getRestaurantEntitlement,
    mapRestaurantEntitlement,
    resolveRestaurantEntitlementPolicy,
    upsertRestaurantEntitlement,
    RESTAURANT_PLAN_TIER,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
    __private: {
        normalizeRestaurantPlanTier,
        RESTAURANT_ENTITLEMENT_POLICY,
    },
}
