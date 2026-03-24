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

realDbTest('real DB merchant read smoke returns seeded restaurant, review, and dashboard data', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const ownerToken = createTestToken({
        userId: seedSummary.users.owner.id,
        tokenVersion: 0,
    })
    const managerToken = createTestToken({
        userId: seedSummary.users.manager.id,
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

    const ownerRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: ownerToken,
    })
    assert.equal(ownerRestaurants.status, 200)
    assert.equal(ownerRestaurants.body.data.length, 2)
    assert.deepEqual(sortBySlug(ownerRestaurants.body.data), [
        {
            id: phoHongId,
            name: 'Demo Quan Pho Hong',
            slug: 'demo-quan-pho-hong',
            googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            permission: 'OWNER',
            totalReviews: 10,
        },
        {
            id: tacombiId,
            name: 'Demo Tacombi',
            slug: 'demo-tacombi',
            googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
            permission: 'OWNER',
            totalReviews: 6,
        },
    ])

    const managerRestaurants = await request(server, 'GET', '/api/restaurants', {
        token: managerToken,
    })
    assert.equal(managerRestaurants.status, 200)
    assert.deepEqual(managerRestaurants.body.data, [
        {
            id: phoHongId,
            name: 'Demo Quan Pho Hong',
            slug: 'demo-quan-pho-hong',
            googleMapUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            permission: 'MANAGER',
            totalReviews: 10,
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
        { token: ownerToken },
    )
    assert.equal(phoHongDetail.status, 200)
    assert.equal(phoHongDetail.body.data.name, 'Demo Quan Pho Hong')
    assert.equal(phoHongDetail.body.data.permission, 'OWNER')
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

    const tacombiDetail = await request(
        server,
        'GET',
        `/api/restaurants/${tacombiId}`,
        { token: ownerToken },
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
        { token: ownerToken },
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
        { token: ownerToken },
    )
    assert.equal(reviewsRatingTwo.status, 200)
    assert.equal(reviewsRatingTwo.body.pagination.total, 3)
    assert.equal(reviewsRatingTwo.body.data.length, 3)
    assert.ok(reviewsRatingTwo.body.data.every((review) => review.rating === 2))

    const reviewsDateFiltered = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?from=2026-02-01&to=2026-03-31&page=1&limit=20`,
        { token: ownerToken },
    )
    assert.equal(reviewsDateFiltered.status, 200)
    assert.equal(reviewsDateFiltered.body.pagination.total, 6)

    const kpi = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/kpi`,
        { token: ownerToken },
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
        { token: ownerToken },
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
        { token: ownerToken },
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
        { token: ownerToken },
    )
    assert.equal(complaints.status, 200)
    assert.equal(complaints.body.data[0].keyword, 'chậm')
    assert.equal(complaints.body.data[0].count, 2)
    assert.ok(complaints.body.data.some((keyword) => keyword.keyword === 'slow'))

    const topIssue = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/top-issue`,
        { token: ownerToken },
    )
    assert.equal(topIssue.status, 200)
    assert.equal(topIssue.body.data.keyword, 'chậm')
    assert.equal(topIssue.body.data.count, 2)
    assert.match(topIssue.body.data.action, /Prioritize improving chậm/)
    assert.ok(topIssue.body.data.lastUpdatedAt)
})

realDbTest('real DB merchant read smoke preserves isolation and validation boundaries', async (t) => {
    const seedSummary = await seedDemoData({ prisma })
    const managerToken = createTestToken({
        userId: seedSummary.users.manager.id,
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

    const managerAllowed = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/kpi`,
        { token: managerToken },
    )
    assert.equal(managerAllowed.status, 200)

    const managerForbidden = await request(
        server,
        'GET',
        `/api/restaurants/${tacombiId}/dashboard/kpi`,
        { token: managerToken },
    )
    assert.equal(managerForbidden.status, 404)

    const outsiderForbidden = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}`,
        { token: outsiderToken },
    )
    assert.equal(outsiderForbidden.status, 404)

    const invalidDateRange = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/reviews?from=2026-03-31&to=2026-02-01`,
        { token: managerToken },
    )
    assert.equal(invalidDateRange.status, 400)
    assert.equal(invalidDateRange.body.error.code, 'INVALID_DATE_RANGE')

    const invalidTrendPeriod = await request(
        server,
        'GET',
        `/api/restaurants/${phoHongId}/dashboard/trend?period=year`,
        { token: managerToken },
    )
    assert.equal(invalidTrendPeriod.status, 400)
    assert.equal(invalidTrendPeriod.body.error.code, 'VALIDATION_FAILED')
})
