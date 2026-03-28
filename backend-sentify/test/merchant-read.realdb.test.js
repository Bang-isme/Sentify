const test = require('node:test')
const assert = require('node:assert/strict')

const app = require('../src/app')
const prisma = require('../src/lib/prisma')
const { seedDemoData } = require('../prisma/seed-data')
const { createTestToken, request } = require('./test-helpers')

const realDbTest =
    process.env.RUN_REAL_DB_TESTS === 'true' ? test : test.skip

async function startRealApp() {
    return app.listen(0)
}

async function stopRealApp(server) {
    if (!server) {
        return
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function sortBySlug(restaurants) {
    return [...restaurants].sort((left, right) => left.slug.localeCompare(right.slug))
}

function assertRestaurantEntitlement(restaurant, {
    planTier,
    sourceSubmissionLane,
    sourceSyncIntervalMinutes,
    actionCardsLimit,
    prioritySync,
    processingClass,
}) {
    assert.ok(restaurant.entitlement)
    assert.equal(restaurant.entitlement.planTier, planTier)
    assert.equal(
        restaurant.entitlement.effectivePolicy.sourceSubmissionLane,
        sourceSubmissionLane,
    )
    assert.equal(
        restaurant.entitlement.effectivePolicy.sourceSyncIntervalMinutes,
        sourceSyncIntervalMinutes,
    )
    assert.equal(
        restaurant.entitlement.effectivePolicy.actionCardsLimit,
        actionCardsLimit,
    )
    assert.equal(
        restaurant.entitlement.effectivePolicy.prioritySync,
        prioritySync,
    )
    assert.equal(
        restaurant.entitlement.effectivePolicy.processingClass,
        processingClass,
    )
}

function assertRestaurantSummary(restaurant, {
    id,
    name,
    slug,
    googleMapUrl,
    totalReviews,
    entitlement,
}) {
    assert.equal(restaurant.id, id)
    assert.equal(restaurant.name, name)
    assert.equal(restaurant.slug, slug)
    assert.equal(restaurant.googleMapUrl, googleMapUrl)
    assert.equal(restaurant.totalReviews, totalReviews)
    assertRestaurantEntitlement(restaurant, entitlement)
}

realDbTest('real DB user read smoke returns seeded restaurant, review, and dashboard data', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const secondaryUserToken = createTestToken({
        userId: seedSummary.users.userSecondary.id,
        tokenVersion: 0,
    })
    const tacombiUserToken = createTestToken({
        userId: seedSummary.users.userTacombi.id,
        tokenVersion: 0,
    })
    const outsiderToken = createTestToken({
        userId: seedSummary.users.outsider.id,
        tokenVersion: 0,
    })
    const phoHongId = seedSummary.restaurants.phoHong.id
    const tacombiId = seedSummary.restaurants.tacombi.id
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const primaryRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: primaryUserToken,
    })
    assert.equal(primaryRestaurants.status, 200)
    assert.ok(primaryRestaurants.body.data.length >= 2)
    const visiblePrimaryRestaurants = sortBySlug(
        primaryRestaurants.body.data.filter(
            (restaurant) => restaurant.id === phoHongId || restaurant.id === tacombiId,
        ),
    )
    assert.equal(visiblePrimaryRestaurants.length, 2)
    assertRestaurantSummary(visiblePrimaryRestaurants[0], {
        id: phoHongId,
        name: 'Demo Quan Pho Hong',
        slug: 'demo-quan-pho-hong',
        googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        totalReviews: 10,
        entitlement: {
            planTier: 'PREMIUM',
            sourceSubmissionLane: 'PRIORITY',
            sourceSyncIntervalMinutes: 360,
            actionCardsLimit: 3,
            prioritySync: true,
            processingClass: 'PRIORITY_QUEUE',
        },
    })
    assertRestaurantSummary(visiblePrimaryRestaurants[1], {
        id: tacombiId,
        name: 'Demo Tacombi',
        slug: 'demo-tacombi',
        googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
        totalReviews: 6,
        entitlement: {
            planTier: 'FREE',
            sourceSubmissionLane: 'STANDARD',
            sourceSyncIntervalMinutes: 1440,
            actionCardsLimit: 1,
            prioritySync: false,
            processingClass: 'STANDARD_QUEUE',
        },
    })

    const secondaryRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: secondaryUserToken,
    })
    assert.equal(secondaryRestaurants.status, 200)
    assert.equal(secondaryRestaurants.body.data.length, 1)
    assertRestaurantSummary(secondaryRestaurants.body.data[0], {
        id: phoHongId,
        name: 'Demo Quan Pho Hong',
        slug: 'demo-quan-pho-hong',
        googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        totalReviews: 10,
        entitlement: {
            planTier: 'PREMIUM',
            sourceSubmissionLane: 'PRIORITY',
            sourceSyncIntervalMinutes: 360,
            actionCardsLimit: 3,
            prioritySync: true,
            processingClass: 'PRIORITY_QUEUE',
        },
    })

    const tacombiRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: tacombiUserToken,
    })
    assert.equal(tacombiRestaurants.status, 200)
    assert.equal(tacombiRestaurants.body.data.length, 1)
    assertRestaurantSummary(tacombiRestaurants.body.data[0], {
        id: tacombiId,
        name: 'Demo Tacombi',
        slug: 'demo-tacombi',
        googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
        totalReviews: 6,
        entitlement: {
            planTier: 'FREE',
            sourceSubmissionLane: 'STANDARD',
            sourceSyncIntervalMinutes: 1440,
            actionCardsLimit: 1,
            prioritySync: false,
            processingClass: 'STANDARD_QUEUE',
        },
    })

    const outsiderRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: outsiderToken,
    })
    assert.equal(outsiderRestaurants.status, 200)
    assert.deepEqual(outsiderRestaurants.body.data, [])

    const phoHongDetail = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}`,
        { token: primaryUserToken },
    )
    assert.equal(phoHongDetail.status, 200)
    assert.equal(phoHongDetail.body.data.name, 'Demo Quan Pho Hong')
    assertRestaurantEntitlement(phoHongDetail.body.data, {
        planTier: 'PREMIUM',
        sourceSubmissionLane: 'PRIORITY',
        sourceSyncIntervalMinutes: 360,
        actionCardsLimit: 3,
        prioritySync: true,
        processingClass: 'PRIORITY_QUEUE',
    })
    assert.equal(phoHongDetail.body.data.datasetStatus.sourcePolicy, 'ADMIN_CURATED')
    assert.equal(phoHongDetail.body.data.datasetStatus.lastPublishedSourceType, 'GOOGLE_MAPS_CRAWL')
    assert.equal(phoHongDetail.body.data.datasetStatus.pendingBatchCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.pendingItemCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.approvedItemCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.rejectedItemCount, 1)
    assert.equal(phoHongDetail.body.data.sourceSubmission.status, 'REVIEWING')
    assert.equal(phoHongDetail.body.data.sourceSubmission.source.status, 'ACTIVE')
    assert.equal(phoHongDetail.body.data.sourceSubmission.latestRun.status, 'PARTIAL')
    assert.equal(phoHongDetail.body.data.sourceSubmission.openBatch.status, 'IN_REVIEW')
    assert.equal(phoHongDetail.body.data.sourceSubmission.publishedFromSource, true)
    assert.equal(
        phoHongDetail.body.data.sourceSubmission.timeline.currentStage,
        'REVIEWING',
    )
    assert.equal(
        phoHongDetail.body.data.sourceSubmission.timeline.currentStepCode,
        'EVIDENCE_IN_REVIEW',
    )
    assert.ok(
        phoHongDetail.body.data.sourceSubmission.timeline.events.some(
            (event) => event.code === 'LIVE',
        ),
    )
    assert.ok(
        phoHongDetail.body.data.sourceSubmission.timeline.events.some(
            (event) => event.code === 'EVIDENCE_IN_REVIEW',
        ),
    )
    assert.equal(phoHongDetail.body.data.insightSummary.totalReviews, 10)
    assert.equal(phoHongDetail.body.data.insightSummary.averageRating, 3.3)
    assert.equal(phoHongDetail.body.data.insightSummary.negativePercentage, 40)
    assert.ok(phoHongDetail.body.data.datasetStatus.lastPublishedAt)

    const secondaryDetail = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}`,
        { token: secondaryUserToken },
    )
    assert.equal(secondaryDetail.status, 200)
    assert.equal(secondaryDetail.body.data.entitlement.planTier, 'PREMIUM')
    assert.equal(secondaryDetail.body.data.datasetStatus.pendingBatchCount, 1)
    assert.equal(secondaryDetail.body.data.insightSummary.totalReviews, 10)

    const tacombiDetail = await request(
        server,
        'GET',
        `/api/restaurants/${tacombiId}`,
        { token: primaryUserToken },
    )
    assert.equal(tacombiDetail.status, 200)
    assertRestaurantEntitlement(tacombiDetail.body.data, {
        planTier: 'FREE',
        sourceSubmissionLane: 'STANDARD',
        sourceSyncIntervalMinutes: 1440,
        actionCardsLimit: 1,
        prioritySync: false,
        processingClass: 'STANDARD_QUEUE',
    })
    assert.equal(tacombiDetail.body.data.datasetStatus.lastPublishedSourceType, 'MANUAL')
    assert.equal(tacombiDetail.body.data.datasetStatus.pendingBatchCount, 0)
    assert.equal(tacombiDetail.body.data.sourceSubmission.status, 'SUBMITTED')
    assert.equal(tacombiDetail.body.data.sourceSubmission.publishedFromSource, false)
    assert.equal(
        tacombiDetail.body.data.sourceSubmission.timeline.currentStage,
        'SUBMITTED',
    )
    assert.equal(tacombiDetail.body.data.insightSummary.totalReviews, 6)
    assert.equal(tacombiDetail.body.data.insightSummary.averageRating, 4.2)
    assert.equal(tacombiDetail.body.data.insightSummary.positivePercentage, 83.3)

    const reviewsPageOne = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?page=1&limit=5`,
        { token: primaryUserToken },
    )
    assert.equal(reviewsPageOne.status, 200)
    assert.equal(reviewsPageOne.body.pagination.total, 10)
    assert.equal(reviewsPageOne.body.pagination.totalPages, 2)
    assert.equal(reviewsPageOne.body.data.length, 5)
    assert.equal(reviewsPageOne.body.data[0].authorName, 'Nam')
    assert.equal(reviewsPageOne.body.data[0].rating, 5)
    assert.equal(reviewsPageOne.body.data[0].sentiment, 'POSITIVE')

    const reviewsRatingTwo = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?rating=2&page=1&limit=20`,
        { token: primaryUserToken },
    )
    assert.equal(reviewsRatingTwo.status, 200)
    assert.equal(reviewsRatingTwo.body.pagination.total, 3)
    assert.equal(reviewsRatingTwo.body.data.length, 3)
    assert.ok(reviewsRatingTwo.body.data.every((review) => review.rating === 2))

    const reviewsDateFiltered = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?from=2026-02-01&to=2026-03-31&page=1&limit=20`,
        { token: primaryUserToken },
    )
    assert.equal(reviewsDateFiltered.status, 200)
    assert.equal(reviewsDateFiltered.body.pagination.total, 6)

    const kpi = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/kpi`,
        { token: primaryUserToken },
    )
    assert.equal(kpi.status, 200)
    assert.deepEqual(kpi.body.data, {
        totalReviews: 10,
        averageRating: 3.3,
        positivePercentage: 50,
        neutralPercentage: 10,
        negativePercentage: 40,
    })

    const sentiment = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/sentiment`,
        { token: primaryUserToken },
    )
    assert.equal(sentiment.status, 200)
    assert.deepEqual(sentiment.body.data, [
        { label: 'POSITIVE', count: 5, percentage: 50 },
        { label: 'NEUTRAL', count: 1, percentage: 10 },
        { label: 'NEGATIVE', count: 4, percentage: 40 },
    ])

    const trendMonth = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/trend?period=month`,
        { token: primaryUserToken },
    )
    assert.equal(trendMonth.status, 200)
    assert.deepEqual(trendMonth.body.data, [
        { label: '2026-01', averageRating: 3.3, reviewCount: 4 },
        { label: '2026-02', averageRating: 3, reviewCount: 4 },
        { label: '2026-03', averageRating: 4, reviewCount: 2 },
    ])

    const complaints = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/complaints`,
        { token: primaryUserToken },
    )
    assert.equal(complaints.status, 200)
    assert.equal(complaints.body.data[0].keyword, 'chậm')
    assert.equal(complaints.body.data[0].count, 2)
    assert.ok(complaints.body.data.some((keyword) => keyword.keyword === 'slow'))

    const topIssue = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/top-issue`,
        { token: primaryUserToken },
    )
    assert.equal(topIssue.status, 200)
    assert.equal(topIssue.body.data.keyword, 'chậm')
    assert.equal(topIssue.body.data.count, 2)
    assert.match(topIssue.body.data.action, /Prioritize improving chậm/)
    assert.ok(topIssue.body.data.lastUpdatedAt)

    const actions = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/actions`,
        { token: primaryUserToken },
    )
    assert.equal(actions.status, 200)
    assert.equal(actions.body.data.entitlement.planTier, 'PREMIUM')
    assert.equal(actions.body.data.capabilities.sourceSubmissionLane, 'PRIORITY')
    assert.equal(actions.body.data.capabilities.sourceSyncIntervalMinutes, 360)
    assert.equal(actions.body.data.capabilities.actionCardsLimit, 3)
    assert.equal(actions.body.data.capabilities.prioritySync, true)
    assert.equal(actions.body.data.capabilities.processingClass, 'PRIORITY_QUEUE')
    assert.equal(actions.body.data.summary.state, 'ACTIONABLE_NOW')
    assert.equal(actions.body.data.snapshot.totalReviews, 10)
    assert.equal(actions.body.data.topIssue.keyword, topIssue.body.data.keyword)
    assert.equal(actions.body.data.actionCards[0].status, 'NOW')
    assert.ok(actions.body.data.actionCards.length >= 1)
    assert.ok(actions.body.data.actionCards[0].evidenceReview)
})

realDbTest('real DB role boundaries separate user flow from admin control plane', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const secondaryUserToken = createTestToken({
        userId: seedSummary.users.userSecondary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const outsiderToken = createTestToken({
        userId: seedSummary.users.outsider.id,
        tokenVersion: 0,
    })
    const phoHongId = seedSummary.restaurants.phoHong.id
    const tacombiId = seedSummary.restaurants.tacombi.id
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const userAllowed = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/kpi`,
        { token: secondaryUserToken },
    )
    assert.equal(userAllowed.status, 200)

    const userForbiddenOtherRestaurant = await request(
        server,
        'GET',
        `/api/restaurants/${tacombiId}/dashboard/kpi`,
        { token: secondaryUserToken },
    )
    assert.equal(userForbiddenOtherRestaurant.status, 404)

    const userAdminForbidden = await request(
        server,
        'GET',
        `/api/admin/review-batches?restaurantId=${phoHongId}`,
        { token: primaryUserToken },
    )
    assert.equal(userAdminForbidden.status, 403)

    const outsiderForbidden = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}`,
        { token: outsiderToken },
    )
    assert.equal(outsiderForbidden.status, 404)

    const adminMerchantForbidden = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/kpi`,
        { token: adminToken },
    )
    assert.equal(adminMerchantForbidden.status, 403)

    const invalidDateRange = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?from=2026-03-31&to=2026-02-01`,
        { token: secondaryUserToken },
    )
    assert.equal(invalidDateRange.status, 400)
    assert.equal(invalidDateRange.body.error.code, 'INVALID_DATE_RANGE')

    const invalidTrendPeriod = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/trend?period=year`,
        { token: secondaryUserToken },
    )
    assert.equal(invalidTrendPeriod.status, 400)
    assert.equal(invalidTrendPeriod.body.error.code, 'VALIDATION_FAILED')
})

realDbTest('real DB admin routes expose restaurant selection and control-plane overview flow', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const phoHongId = seedSummary.restaurants.phoHong.id
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const listRestaurants = await request(server, 'GET', '/api/admin/restaurants', {
        token: adminToken,
    })
    assert.equal(listRestaurants.status, 200)
    assert.ok(Array.isArray(listRestaurants.body.data))
    assert.ok(listRestaurants.body.data.some((restaurant) => restaurant.id === phoHongId))

    const restaurantOverview = await request(
        server,
        'GET',
        `/api/admin/restaurants/${phoHongId}`,
        { token: adminToken },
    )
    assert.equal(restaurantOverview.status, 200)
    assert.equal(restaurantOverview.body.data.restaurant.id, phoHongId)
    assert.equal(restaurantOverview.body.data.userFlow.datasetStatus.pendingBatchCount, 1)
    assert.ok(Array.isArray(restaurantOverview.body.data.adminFlow.openBatches))
    assert.ok(Array.isArray(restaurantOverview.body.data.adminFlow.nextActions))

    const listBatches = await request(
        server,
        'GET',
        `/api/admin/review-batches?restaurantId=${phoHongId}`,
        { token: adminToken },
    )
    assert.equal(listBatches.status, 200)
    assert.ok(Array.isArray(listBatches.body.data))
})

realDbTest('real DB merchant source submission create flow persists a submission record even before admin sync', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const response = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Source Submission ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.data.sourceSubmission.status, 'SUBMITTED')
    assert.equal(response.body.data.sourceSubmission.submission.inputUrl, 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7')
    assert.equal(response.body.data.sourceSubmission.submission.status, 'READY_FOR_SOURCE_LINK')

    const persistedSubmission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            restaurantId: response.body.data.id,
        },
    })

    assert.ok(persistedSubmission)
    assert.equal(persistedSubmission.inputUrl, 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7')
    assert.equal(persistedSubmission.status, 'READY_FOR_SOURCE_LINK')
    assert.equal(persistedSubmission.schedulingLane, 'STANDARD')
    assert.equal(persistedSubmission.dedupeKey, 'cid:7818750409929595867')

    const detail = await request(
        server,
        'GET',
        `/api/restaurants/${response.body.data.id}`,
        { token: primaryUserToken },
    )

    assert.equal(detail.status, 200)
    assert.equal(
        detail.body.data.sourceSubmission.submission.inputUrl,
        'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
    )

    const adminQueue = await request(
        server,
        'GET',
        '/api/admin/restaurants/source-submissions',
        { token: adminToken },
    )

    assert.equal(adminQueue.status, 200)
    assert.ok(adminQueue.body.data.summary.actionableCount >= 1)
    assert.equal(adminQueue.body.data.summary.priorityLaneCount, 0)
    assert.ok(
        adminQueue.body.data.groups.some((group) =>
            group.restaurants.some((restaurant) => restaurant.restaurantId === response.body.data.id),
        ),
    )
})

realDbTest('real DB merchant source-submission history survives URL replacement and clear operations', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Source History ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(createResponse.status, 201)
    const restaurantId = createResponse.body.data.id

    const replaceResponse = await request(
        server,
        'PATCH',
        `/api/restaurants/${restaurantId}`,
        {
            token: primaryUserToken,
            body: {
                googleMapUrl: 'https://maps.app.goo.gl/different-demo-url',
            },
        },
    )

    assert.equal(replaceResponse.status, 200)
    assert.equal(
        replaceResponse.body.data.sourceSubmission.submission.status,
        'PENDING_IDENTITY_RESOLUTION',
    )

    const clearResponse = await request(
        server,
        'PATCH',
        `/api/restaurants/${restaurantId}`,
        {
            token: primaryUserToken,
            body: {
                googleMapUrl: null,
            },
        },
    )

    assert.equal(clearResponse.status, 200)
    assert.equal(clearResponse.body.data.sourceSubmission.status, 'UNCONFIGURED')

    const historyResponse = await request(
        server,
        'GET',
        `/api/restaurants/${restaurantId}/source-submission/history`,
        {
            token: primaryUserToken,
        },
    )

    assert.equal(historyResponse.status, 200)
    assert.equal(historyResponse.body.data.current.attemptKey, null)
    assert.equal(historyResponse.body.data.current.sourceSubmission.status, 'UNCONFIGURED')
    assert.equal(historyResponse.body.data.history.attempts.length, 2)
    assert.equal(historyResponse.body.data.history.events.length, 3)
    assert.equal(historyResponse.body.data.history.events[0].action, 'MERCHANT_SOURCE_CLEARED')
    assert.equal(
        historyResponse.body.data.history.events[0].timelineCode,
        'URL_CLEARED',
    )
    assert.equal(
        historyResponse.body.data.history.events[0].snapshot.inputUrl,
        'https://maps.app.goo.gl/different-demo-url',
    )
    assert.ok(
        historyResponse.body.data.history.events.every(
            (event) => event.snapshot && event.attemptKey,
        ),
    )
})

realDbTest('real DB admin can escalate a merchant source submission into the priority scheduling lane', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Priority Lane ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(createResponse.status, 201)
    const submissionId = createResponse.body.data.sourceSubmission.submission.id

    const laneResponse = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${submissionId}/scheduling-lane`,
        {
            token: adminToken,
            body: {
                schedulingLane: 'PRIORITY',
            },
        },
    )

    assert.equal(laneResponse.status, 200)
    assert.equal(laneResponse.body.data.submission.schedulingLane, 'PRIORITY')

    const persistedSubmission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })

    assert.ok(persistedSubmission)
    assert.equal(persistedSubmission.schedulingLane, 'PRIORITY')

    const adminQueue = await request(
        server,
        'GET',
        '/api/admin/restaurants/source-submissions',
        { token: adminToken },
    )

    assert.equal(adminQueue.status, 200)
    assert.ok(adminQueue.body.data.summary.priorityLaneCount >= 1)
    assert.ok(
        adminQueue.body.data.groups.some(
            (group) =>
                group.restaurants.some((restaurant) => restaurant.submissionId === submissionId) &&
                group.schedulingLane === 'PRIORITY',
        ),
    )
})

realDbTest('real DB admin can upgrade restaurant entitlement and expose premium merchant capabilities', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Premium Tier ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(createResponse.status, 201)
    const restaurantId = createResponse.body.data.id
    const submissionId = createResponse.body.data.sourceSubmission.submission.id
    assert.equal(createResponse.body.data.entitlement.planTier, 'FREE')

    const entitlementResponse = await request(
        server,
        'PATCH',
        `/api/admin/restaurants/${restaurantId}/entitlement`,
        {
            token: adminToken,
            body: {
                planTier: 'PREMIUM',
            },
        },
    )

    assert.equal(entitlementResponse.status, 200)
    assert.equal(entitlementResponse.body.data.entitlement.planTier, 'PREMIUM')
    assert.equal(
        entitlementResponse.body.data.entitlement.effectivePolicy.sourceSubmissionLane,
        'PRIORITY',
    )

    const persistedEntitlement = await prisma.restaurantEntitlement.findUnique({
        where: {
            restaurantId,
        },
    })
    assert.ok(persistedEntitlement)
    assert.equal(persistedEntitlement.planTier, 'PREMIUM')

    const persistedSubmission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })
    assert.ok(persistedSubmission)
    assert.equal(persistedSubmission.schedulingLane, 'PRIORITY')

    const detailResponse = await request(
        server,
        'GET',
        `/api/restaurants/${restaurantId}`,
        {
            token: primaryUserToken,
        },
    )
    assert.equal(detailResponse.status, 200)
    assert.equal(detailResponse.body.data.entitlement.planTier, 'PREMIUM')

    const actionsResponse = await request(
        server,
        'GET',
        `/api/restaurants/${restaurantId}/dashboard/actions`,
        {
            token: primaryUserToken,
        },
    )
    assert.equal(actionsResponse.status, 200)
    assert.equal(actionsResponse.body.data.entitlement.planTier, 'PREMIUM')
    assert.equal(actionsResponse.body.data.capabilities.actionCardsLimit, 3)
    assert.equal(actionsResponse.body.data.capabilities.sourceSubmissionLane, 'PRIORITY')
})

realDbTest('real DB claim leases survive same-URL merchant resubmits and clear when the Google Maps URL changes', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Claim Lease ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(createResponse.status, 201)
    const restaurantId = createResponse.body.data.id
    const submissionId = createResponse.body.data.sourceSubmission.submission.id

    const laneResponse = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${submissionId}/scheduling-lane`,
        {
            token: adminToken,
            body: {
                schedulingLane: 'PRIORITY',
            },
        },
    )
    assert.equal(laneResponse.status, 200)

    const claimResponse = await request(
        server,
        'POST',
        '/api/admin/restaurants/source-submissions/claim-next',
        {
            token: adminToken,
            body: {
                leaseMinutes: 30,
            },
        },
    )

    assert.equal(claimResponse.status, 200)
    assert.ok(claimResponse.body.data.group)
    assert.ok(
        claimResponse.body.data.group.restaurants.some(
            (restaurant) => restaurant.submissionId === submissionId,
        ),
    )

    const claimedBeforeResave = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })

    assert.ok(claimedBeforeResave)
    assert.equal(claimedBeforeResave.schedulingLane, 'PRIORITY')
    assert.equal(claimedBeforeResave.claimedByUserId, seedSummary.users.admin.id)
    assert.ok(claimedBeforeResave.claimExpiresAt)

    const sameUrlUpdate = await request(
        server,
        'PATCH',
        `/api/restaurants/${restaurantId}`,
        {
            token: primaryUserToken,
            body: {
                googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
            },
        },
    )

    assert.equal(sameUrlUpdate.status, 200)

    const claimedAfterSameUrl = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })

    assert.ok(claimedAfterSameUrl)
    assert.equal(claimedAfterSameUrl.schedulingLane, 'PRIORITY')
    assert.equal(claimedAfterSameUrl.claimedByUserId, seedSummary.users.admin.id)
    assert.equal(
        claimedAfterSameUrl.claimExpiresAt?.toISOString(),
        claimedBeforeResave.claimExpiresAt?.toISOString(),
    )

    const changedUrlUpdate = await request(
        server,
        'PATCH',
        `/api/restaurants/${restaurantId}`,
        {
            token: primaryUserToken,
            body: {
                googleMapUrl: 'https://maps.app.goo.gl/different-demo-url',
            },
        },
    )

    assert.equal(changedUrlUpdate.status, 200)
    assert.equal(
        changedUrlUpdate.body.data.sourceSubmission.submission.status,
        'PENDING_IDENTITY_RESOLUTION',
    )

    const changedSubmission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })

    assert.ok(changedSubmission)
    assert.equal(changedSubmission.inputUrl, 'https://maps.app.goo.gl/different-demo-url')
    assert.equal(changedSubmission.status, 'PENDING_IDENTITY_RESOLUTION')
    assert.equal(changedSubmission.schedulingLane, 'STANDARD')
    assert.equal(changedSubmission.claimedByUserId, null)
    assert.equal(changedSubmission.claimedAt, null)
    assert.equal(changedSubmission.claimExpiresAt, null)
    assert.equal(changedSubmission.dedupeKey, 'url:https://maps.app.goo.gl/different-demo-url')
})

realDbTest('real DB admin can consume a merchant source submission queue item and link a crawl source', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const primaryUserToken = createTestToken({
        userId: seedSummary.users.userPrimary.id,
        tokenVersion: 0,
    })
    const adminToken = createTestToken({
        userId: seedSummary.users.admin.id,
        tokenVersion: 0,
    })
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
    })

    const createResponse = await request(server, 'POST', '/api/restaurants', {
        token: primaryUserToken,
        body: {
            name: `Demo Queue Consume ${Date.now()}`,
            googleMapUrl: 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7',
        },
    })

    assert.equal(createResponse.status, 201)
    const restaurantId = createResponse.body.data.id
    const submissionId = createResponse.body.data.sourceSubmission.submission.id

    const createSourceResponse = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${submissionId}/create-source`,
        {
            token: adminToken,
            body: {
                syncEnabled: true,
                syncIntervalMinutes: 360,
            },
        },
    )

    assert.equal(createSourceResponse.status, 200)
    assert.equal(createSourceResponse.body.data.submission.status, 'LINKED_TO_SOURCE')
    assert.equal(createSourceResponse.body.data.source.restaurantId, restaurantId)
    assert.equal(createSourceResponse.body.data.source.canonicalCid, '7818750409929595867')

    const persistedSubmission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
    })

    assert.ok(persistedSubmission)
    assert.equal(persistedSubmission.status, 'LINKED_TO_SOURCE')
    assert.ok(persistedSubmission.linkedSourceId)

    const adminQueue = await request(
        server,
        'GET',
        '/api/admin/restaurants/source-submissions',
        { token: adminToken },
    )

    assert.equal(adminQueue.status, 200)
    assert.ok(
        !adminQueue.body.data.groups.some((group) =>
            group.restaurants.some((restaurant) => restaurant.restaurantId === restaurantId),
        ),
    )

    const adminRestaurantDetail = await request(
        server,
        'GET',
        `/api/admin/restaurants/${restaurantId}`,
        { token: adminToken },
    )

    assert.equal(adminRestaurantDetail.status, 200)
    assert.equal(adminRestaurantDetail.body.data.adminFlow.sourceSubmissionQueue.item, null)
})
