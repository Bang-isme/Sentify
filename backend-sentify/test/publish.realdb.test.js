const test = require('node:test')
const assert = require('node:assert/strict')

const prisma = require('../src/lib/prisma')
const adminIntakeService = require('../src/modules/admin-intake/admin-intake.service')
const dashboardService = require('../src/services/dashboard.service')
const restaurantService = require('../src/services/restaurant.service')
const { GOOGLE_MAPS_DEMO_URL, seedDemoData } = require('../prisma/seed-data')

const realDbTest =
    process.env.RUN_REAL_DB_TESTS === 'true' ? test : test.skip

realDbTest('real DB publish smoke updates canonical reviews, dataset status, and dashboard insights', async () => {
    const seedSummary = await seedDemoData({ prisma })
    const userPrimaryId = seedSummary.users.userPrimary.id
    const adminUserId = seedSummary.users.admin.id
    const uniqueSuffix = Date.now()
    let restaurantId = null

    try {
        const restaurant = await restaurantService.createRestaurant({
            userId: userPrimaryId,
            name: `Real DB Smoke ${uniqueSuffix}`,
            address: 'Seeded smoke lane',
            googleMapUrl: GOOGLE_MAPS_DEMO_URL,
        })
        restaurantId = restaurant.id

        const createdBatch = await adminIntakeService.createReviewBatch({
            userId: adminUserId,
            restaurantId,
            sourceType: 'MANUAL',
            title: 'Real DB smoke publish batch',
        })

        const addedBatch = await adminIntakeService.addReviewItemsBulk({
            userId: adminUserId,
            batchId: createdBatch.id,
            items: [
                {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: `realdb-smoke-${uniqueSuffix}-neg`,
                    sourceReviewUrl: `https://www.google.com/maps/review/realdb-smoke-${uniqueSuffix}-neg`,
                    rawAuthorName: 'Smoke Negative',
                    rawRating: 2,
                    rawContent: 'Slow service, noisy room, and tables felt dirty.',
                    rawReviewDate: '2026-03-21T08:00:00.000Z',
                },
                {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: `realdb-smoke-${uniqueSuffix}-pos`,
                    sourceReviewUrl: `https://www.google.com/maps/review/realdb-smoke-${uniqueSuffix}-pos`,
                    rawAuthorName: 'Smoke Positive',
                    rawRating: 5,
                    rawContent: 'Delicious broth, friendly staff, and very clean tables.',
                    rawReviewDate: '2026-03-22T08:00:00.000Z',
                },
            ],
        })

        for (const item of addedBatch.items) {
            await adminIntakeService.updateReviewItem({
                userId: adminUserId,
                itemId: item.id,
                input: {
                    approvalStatus: 'APPROVED',
                },
            })
        }

        const publishResult = await adminIntakeService.publishReviewBatch({
            userId: adminUserId,
            batchId: createdBatch.id,
        })

        assert.equal(publishResult.batch.status, 'PUBLISHED')
        assert.equal(publishResult.publishedCount, 2)

        const totalReviews = await prisma.review.count({
            where: {
                restaurantId,
            },
        })
        assert.equal(totalReviews, 2)

        const reviewRows = await prisma.review.findMany({
            where: {
                restaurantId,
            },
            orderBy: [{ rating: 'asc' }],
            select: {
                externalId: true,
                rating: true,
                sentiment: true,
                keywords: true,
            },
        })

        assert.equal(reviewRows[0].sentiment, 'NEGATIVE')
        assert.ok(reviewRows[0].keywords.includes('slow'))

        const kpi = await dashboardService.getRestaurantKpi({
            userId: userPrimaryId,
            restaurantId,
        })
        assert.equal(kpi.totalReviews, 2)
        assert.equal(kpi.averageRating, 3.5)
        assert.equal(kpi.negativePercentage, 50)

        const complaints = await dashboardService.getComplaintKeywords({
            userId: userPrimaryId,
            restaurantId,
        })
        assert.ok(complaints.some((keyword) => keyword.keyword === 'slow'))

        const detail = await restaurantService.getRestaurantDetail({
            userId: userPrimaryId,
            restaurantId,
        })
        assert.equal(detail.datasetStatus.lastPublishedSourceType, 'MANUAL')
        assert.equal(detail.datasetStatus.pendingBatchCount, 0)
        assert.ok(detail.datasetStatus.lastPublishedAt)
    } finally {
        if (restaurantId) {
            await prisma.restaurant.delete({
                where: {
                    id: restaurantId,
                },
            })
        }
    }
})

