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
    assert.equal(primaryRestaurants.body.data.length, 2)
    assert.deepEqual(sortBySlug(primaryRestaurants.body.data), [
        {
            id: phoHongId,
            name: 'Demo Quan Pho Hong',
            slug: 'demo-quan-pho-hong',
            googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            totalReviews: 10,
        },
        {
            id: tacombiId,
            name: 'Demo Tacombi',
            slug: 'demo-tacombi',
            googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
            totalReviews: 6,
        },
    ])

    const secondaryRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: secondaryUserToken,
    })
    assert.equal(secondaryRestaurants.status, 200)
    assert.deepEqual(secondaryRestaurants.body.data, [
        {
            id: phoHongId,
            name: 'Demo Quan Pho Hong',
            slug: 'demo-quan-pho-hong',
            googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            totalReviews: 10,
        },
    ])

    const tacombiRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: tacombiUserToken,
    })
    assert.equal(tacombiRestaurants.status, 200)
    assert.deepEqual(tacombiRestaurants.body.data, [
        {
            id: tacombiId,
            name: 'Demo Tacombi',
            slug: 'demo-tacombi',
            googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
            totalReviews: 6,
        },
    ])

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
    assert.equal(phoHongDetail.body.data.datasetStatus.sourcePolicy, 'ADMIN_CURATED')
    assert.equal(phoHongDetail.body.data.datasetStatus.lastPublishedSourceType, 'GOOGLE_MAPS_CRAWL')
    assert.equal(phoHongDetail.body.data.datasetStatus.pendingBatchCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.pendingItemCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.approvedItemCount, 1)
    assert.equal(phoHongDetail.body.data.datasetStatus.rejectedItemCount, 1)
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
    assert.equal(secondaryDetail.body.data.datasetStatus.pendingBatchCount, 1)
    assert.equal(secondaryDetail.body.data.insightSummary.totalReviews, 10)

    const tacombiDetail = await request(
        server,
        'GET',
        `/api/restaurants/${tacombiId}`,
        { token: primaryUserToken },
    )
    assert.equal(tacombiDetail.status, 200)
    assert.equal(tacombiDetail.body.data.datasetStatus.lastPublishedSourceType, 'MANUAL')
    assert.equal(tacombiDetail.body.data.datasetStatus.pendingBatchCount, 0)
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
