const test = require('node:test')
const assert = require('node:assert/strict')

const prisma = require('../src/lib/prisma')
const adminIntakeService = require('../src/modules/admin-intake/admin-intake.service')
const dashboardService = require('../src/services/dashboard.service')
const restaurantService = require('../src/services/restaurant.service')
const { GOOGLE_MAPS_DEMO_URL, seedDemoData } = require('../prisma/seed-data')

const realDbTest =
    process.env.RUN_REAL_DB_TESTS === 'true' ? test : test.skip

async function approveBatchItems(userId, batch) {
    let latestBatch = batch

    for (const item of batch.items) {
        latestBatch = await adminIntakeService.updateReviewItem({
            userId,
            itemId: item.id,
            input: {
                approvalStatus: 'APPROVED',
            },
        })
    }

    return latestBatch
}

async function createAndPublishBatch({ userId, restaurantId, title, items }) {
    const createdBatch = await adminIntakeService.createReviewBatch({
        userId,
        restaurantId,
        sourceType: 'GOOGLE_MAPS_CRAWL',
        title,
    })

    const batchWithItems = await adminIntakeService.addReviewItemsBulk({
        userId,
        batchId: createdBatch.id,
        items,
    })

    await approveBatchItems(userId, batchWithItems)

    return adminIntakeService.publishReviewBatch({
        userId,
        batchId: createdBatch.id,
    })
}

realDbTest(
    'real DB duplicate publish regression reuses canonical reviews across batches and keeps insight totals stable',
    async () => {
        const seedSummary = await seedDemoData({ prisma })
        const userPrimaryId = seedSummary.users.userPrimary.id
        const adminUserId = seedSummary.users.admin.id
        const uniqueSuffix = Date.now()
        const sharedSourceExternalId = `duplicate-publish-${uniqueSuffix}-shared`
        const sharedCanonicalExternalId = `source-review:v1:google_maps:${sharedSourceExternalId}`
        let restaurantId = null

        try {
            const restaurant = await restaurantService.createRestaurant({
                userId: userPrimaryId,
                name: `Duplicate Publish Smoke ${uniqueSuffix}`,
                address: 'Duplicate publish lane',
                googleMapUrl: GOOGLE_MAPS_DEMO_URL,
            })
            restaurantId = restaurant.id

            const firstPublish = await createAndPublishBatch({
                userId: adminUserId,
                restaurantId,
                title: 'Duplicate publish batch 1',
                items: [
                    {
                        sourceProvider: 'GOOGLE_MAPS',
                        sourceExternalId: sharedSourceExternalId,
                        sourceReviewUrl: `https://www.google.com/maps/review/${sharedSourceExternalId}`,
                        rawAuthorName: 'Repeat Guest',
                        rawRating: 4,
                        rawContent: 'Friendly staff and tasty pizza.',
                        rawReviewDate: '2026-03-10T08:00:00.000Z',
                    },
                    {
                        sourceProvider: 'GOOGLE_MAPS',
                        sourceExternalId: `duplicate-publish-${uniqueSuffix}-batch1-only`,
                        sourceReviewUrl: `https://www.google.com/maps/review/duplicate-publish-${uniqueSuffix}-batch1-only`,
                        rawAuthorName: 'First Batch Fresh',
                        rawRating: 5,
                        rawContent: 'Excellent pizza, clean tables, fast service.',
                        rawReviewDate: '2026-03-11T08:00:00.000Z',
                    },
                ],
            })

            assert.equal(firstPublish.batch.status, 'PUBLISHED')
            assert.equal(firstPublish.publishedCount, 2)

            const reviewsAfterFirstPublish = await prisma.review.findMany({
                where: {
                    restaurantId,
                },
                orderBy: [{ externalId: 'asc' }],
                select: {
                    id: true,
                    externalId: true,
                    rating: true,
                    content: true,
                    sentiment: true,
                },
            })

            assert.equal(reviewsAfterFirstPublish.length, 2)

            const sharedReviewAfterFirstPublish = reviewsAfterFirstPublish.find(
                (review) => review.externalId === sharedCanonicalExternalId,
            )
            assert.ok(sharedReviewAfterFirstPublish)
            assert.equal(sharedReviewAfterFirstPublish.rating, 4)
            assert.equal(sharedReviewAfterFirstPublish.sentiment, 'POSITIVE')

            const firstBatchSharedItem = await prisma.reviewIntakeItem.findFirst({
                where: {
                    batchId: firstPublish.batch.id,
                    sourceExternalId: sharedSourceExternalId,
                },
                select: {
                    canonicalReviewId: true,
                },
            })
            assert.equal(
                firstBatchSharedItem.canonicalReviewId,
                sharedReviewAfterFirstPublish.id,
            )

            const secondPublish = await createAndPublishBatch({
                userId: adminUserId,
                restaurantId,
                title: 'Duplicate publish batch 2',
                items: [
                    {
                        sourceProvider: 'GOOGLE_MAPS',
                        sourceExternalId: sharedSourceExternalId,
                        sourceReviewUrl: `https://www.google.com/maps/review/${sharedSourceExternalId}`,
                        rawAuthorName: 'Repeat Guest',
                        rawRating: 2,
                        rawContent: 'Service was slow and the room felt noisy on the second visit.',
                        rawReviewDate: '2026-03-18T08:00:00.000Z',
                    },
                    {
                        sourceProvider: 'GOOGLE_MAPS',
                        sourceExternalId: `duplicate-publish-${uniqueSuffix}-batch2-only`,
                        sourceReviewUrl: `https://www.google.com/maps/review/duplicate-publish-${uniqueSuffix}-batch2-only`,
                        rawAuthorName: 'Second Batch Fresh',
                        rawRating: 1,
                        rawContent: 'Cold pizza and dirty table during dinner.',
                        rawReviewDate: '2026-03-19T08:00:00.000Z',
                    },
                ],
            })

            assert.equal(secondPublish.batch.status, 'PUBLISHED')
            assert.equal(secondPublish.publishedCount, 2)

            const finalReviews = await prisma.review.findMany({
                where: {
                    restaurantId,
                },
                orderBy: [{ externalId: 'asc' }],
                select: {
                    id: true,
                    externalId: true,
                    rating: true,
                    content: true,
                    sentiment: true,
                    keywords: true,
                },
            })

            assert.equal(finalReviews.length, 3)

            const sharedReviewAfterSecondPublish = finalReviews.find(
                (review) => review.externalId === sharedCanonicalExternalId,
            )
            assert.ok(sharedReviewAfterSecondPublish)
            assert.equal(
                sharedReviewAfterSecondPublish.id,
                sharedReviewAfterFirstPublish.id,
            )
            assert.equal(sharedReviewAfterSecondPublish.rating, 2)
            assert.equal(
                sharedReviewAfterSecondPublish.content,
                'Service was slow and the room felt noisy on the second visit.',
            )
            assert.equal(sharedReviewAfterSecondPublish.sentiment, 'NEGATIVE')
            assert.ok(sharedReviewAfterSecondPublish.keywords.includes('slow'))

            const secondBatchSharedItem = await prisma.reviewIntakeItem.findFirst({
                where: {
                    batchId: secondPublish.batch.id,
                    sourceExternalId: sharedSourceExternalId,
                },
                select: {
                    canonicalReviewId: true,
                },
            })
            assert.equal(
                secondBatchSharedItem.canonicalReviewId,
                sharedReviewAfterSecondPublish.id,
            )

            const kpi = await dashboardService.getRestaurantKpi({
                userId: userPrimaryId,
                restaurantId,
            })
            assert.deepEqual(kpi, {
                totalReviews: 3,
                averageRating: 2.7,
                positivePercentage: 33.3,
                neutralPercentage: 0,
                negativePercentage: 66.7,
            })

            const complaints = await dashboardService.getComplaintKeywords({
                userId: userPrimaryId,
                restaurantId,
            })
            assert.ok(complaints.some((keyword) => keyword.keyword === 'slow'))

            const canonicalIds = new Set(secondPublish.publishedReviewIds)
            assert.equal(canonicalIds.size, 2)
            assert.ok(canonicalIds.has(sharedReviewAfterSecondPublish.id))
        } finally {
            if (restaurantId) {
                await prisma.restaurant.delete({
                    where: {
                        id: restaurantId,
                    },
                })
            }
        }
    },
)

realDbTest('real DB publish flow rejects republishing a locked batch', async () => {
    const seedSummary = await seedDemoData({ prisma })
    const userPrimaryId = seedSummary.users.userPrimary.id
    const adminUserId = seedSummary.users.admin.id
    const uniqueSuffix = Date.now()
    let restaurantId = null

    try {
        const restaurant = await restaurantService.createRestaurant({
            userId: userPrimaryId,
            name: `Republish Lock Smoke ${uniqueSuffix}`,
            address: 'Republish lock lane',
            googleMapUrl: GOOGLE_MAPS_DEMO_URL,
        })
        restaurantId = restaurant.id

        const publishResult = await createAndPublishBatch({
            userId: adminUserId,
            restaurantId,
            title: 'Republish lock batch',
            items: [
                {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: `duplicate-publish-${uniqueSuffix}-republish`,
                    sourceReviewUrl: `https://www.google.com/maps/review/duplicate-publish-${uniqueSuffix}-republish`,
                    rawAuthorName: 'Republish Guest',
                    rawRating: 5,
                    rawContent: 'Friendly staff and quick service.',
                    rawReviewDate: '2026-03-07T08:00:00.000Z',
                },
            ],
        })

        assert.equal(publishResult.batch.status, 'PUBLISHED')

        await assert.rejects(
            adminIntakeService.publishReviewBatch({
                userId: adminUserId,
                batchId: publishResult.batch.id,
            }),
            (error) => error?.code === 'INTAKE_BATCH_LOCKED',
        )
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

test.after(async () => {
    await prisma.$disconnect()
})

