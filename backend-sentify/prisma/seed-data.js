const bcrypt = require('bcryptjs')

const adminIntakeService = require('../src/modules/admin-intake/admin-intake.service')

const DEMO_PASSWORD = 'DemoPass123!'
const GOOGLE_MAPS_DEMO_URL = 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8'

const DEMO_USERS = {
    userPrimary: {
        email: 'demo.user.primary@sentify.local',
        fullName: 'Sentify Demo User Primary',
        role: 'USER',
    },
    userSecondary: {
        email: 'demo.user.secondary@sentify.local',
        fullName: 'Sentify Demo User Secondary',
        role: 'USER',
    },
    userTacombi: {
        email: 'demo.user.tacombi@sentify.local',
        fullName: 'Sentify Demo User Tacombi',
        role: 'USER',
    },
    outsider: {
        email: 'demo.outsider@sentify.local',
        fullName: 'Sentify Demo Outsider',
        role: 'USER',
    },
    admin: {
        email: 'demo.admin@sentify.local',
        fullName: 'Sentify Demo Admin',
        role: 'ADMIN',
    },
}

const DEMO_RESTAURANTS = {
    phoHong: {
        name: 'Demo Quan Pho Hong',
        slug: 'demo-quan-pho-hong',
        address: '10 Ly Tu Trong, Hai Chau, Da Nang',
        googleMapUrl: GOOGLE_MAPS_DEMO_URL,
    },
    tacombi: {
        name: 'Demo Tacombi',
        slug: 'demo-tacombi',
        address: '267 Elizabeth St, New York, NY',
        googleMapUrl: 'https://www.google.com/maps?cid=12075628976512600470&hl=en&gl=US',
    },
}

const PHO_HONG_PUBLISHED_ITEMS = [
    {
        sourceExternalId: 'demo-phohong-published-001',
        rawAuthorName: 'Lan Anh',
        rawRating: 5,
        rawContent: 'Phở ngon, nước dùng tốt và nhân viên thân thiện.',
        rawReviewDate: '2026-01-08T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-002',
        rawAuthorName: 'Minh',
        rawRating: 2,
        rawContent: 'Phục vụ chậm, bàn hơi bẩn và khá ồn ào lúc tối.',
        rawReviewDate: '2026-01-15T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-003',
        rawAuthorName: 'Huy',
        rawRating: 4,
        rawContent: 'Broth was good and service was quick at lunch.',
        rawReviewDate: '2026-01-22T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-004',
        rawAuthorName: 'Sarah',
        rawRating: 2,
        rawContent: 'Slow service again. We waited long and the place was noisy.',
        rawReviewDate: '2026-01-29T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-005',
        rawAuthorName: 'Phuong',
        rawRating: 5,
        rawContent: 'Quán sạch, đồ ăn ngon, lên món nhanh.',
        rawReviewDate: '2026-02-05T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-006',
        rawAuthorName: 'Kenji',
        rawRating: 1,
        rawContent: 'Nước dùng nguội và nhân viên không thân thiện.',
        rawReviewDate: '2026-02-12T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-007',
        rawAuthorName: 'Alex',
        rawRating: 4,
        rawContent: 'Delicious pho, clean tables, friendly staff.',
        rawReviewDate: '2026-02-19T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-008',
        rawAuthorName: 'Trang',
        rawRating: 2,
        rawContent: 'Phục vụ chậm, giá hơi cao, nhưng phở ổn.',
        rawReviewDate: '2026-02-26T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-009',
        rawAuthorName: 'Hoa',
        rawRating: 3,
        rawContent: 'Broth okay but nothing special.',
        rawReviewDate: '2026-03-05T07:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-phohong-published-010',
        rawAuthorName: 'Nam',
        rawRating: 5,
        rawContent: 'Rất hài lòng, đồ ăn ngon và nhân viên thân thiện.',
        rawReviewDate: '2026-03-12T07:00:00.000Z',
    },
].map((item) => ({
    sourceProvider: 'GOOGLE_MAPS',
    sourceReviewUrl: `https://www.google.com/maps/review/${item.sourceExternalId}`,
    ...item,
}))

const PHO_HONG_DRAFT_ITEMS = [
    {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: 'demo-phohong-published-002',
        sourceReviewUrl: 'https://www.google.com/maps/review/demo-phohong-published-002',
        rawAuthorName: 'Minh',
        rawRating: 2,
        rawContent: 'Phục vụ chậm, bàn hơi bẩn và khá ồn ào lúc tối. Quán nên xử lý sớm.',
        rawReviewDate: '2026-03-18T07:00:00.000Z',
    },
    {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: 'demo-phohong-draft-002',
        sourceReviewUrl: 'https://www.google.com/maps/review/demo-phohong-draft-002',
        rawAuthorName: 'Julia',
        rawRating: 4,
        rawContent: 'Phở ngon nhưng review này cần kiểm tra lại vì nội dung hơi ngắn.',
        rawReviewDate: '2026-03-19T07:00:00.000Z',
    },
    {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: 'demo-phohong-draft-003',
        sourceReviewUrl: 'https://www.google.com/maps/review/demo-phohong-draft-003',
        rawAuthorName: 'Bao',
        rawRating: 2,
        rawContent: 'Slow service and noisy room during dinner.',
        rawReviewDate: '2026-03-20T07:00:00.000Z',
    },
]

const TACOMBI_PUBLISHED_ITEMS = [
    {
        sourceExternalId: 'demo-tacombi-published-001',
        rawAuthorName: 'Mia',
        rawRating: 5,
        rawContent: 'Delicious tacos and friendly staff.',
        rawReviewDate: '2026-01-10T18:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-tacombi-published-002',
        rawAuthorName: 'Oscar',
        rawRating: 4,
        rawContent: 'Great lunch stop, clean room, quick service.',
        rawReviewDate: '2026-01-24T18:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-tacombi-published-003',
        rawAuthorName: 'Lina',
        rawRating: 2,
        rawContent: 'Overpriced for the portion size, but the salsa was good.',
        rawReviewDate: '2026-02-07T18:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-tacombi-published-004',
        rawAuthorName: 'Ethan',
        rawRating: 5,
        rawContent: 'Amazing tortillas and excellent service.',
        rawReviewDate: '2026-02-21T18:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-tacombi-published-005',
        rawAuthorName: 'Chloe',
        rawRating: 4,
        rawContent: 'Good food, quick line, friendly cashier.',
        rawReviewDate: '2026-03-07T18:00:00.000Z',
    },
    {
        sourceExternalId: 'demo-tacombi-published-006',
        rawAuthorName: 'Mateo',
        rawRating: 5,
        rawContent: 'Great vibes, delicious tacos, very clean tables.',
        rawReviewDate: '2026-03-14T18:00:00.000Z',
    },
].map((item) => ({
    sourceProvider: 'GOOGLE_MAPS',
    sourceReviewUrl: `https://www.google.com/maps/review/${item.sourceExternalId}`,
    ...item,
}))

function buildSeedLog(logger, message) {
    if (typeof logger === 'function') {
        logger(message)
    }
}

async function buildPasswordHash() {
    return bcrypt.hash(DEMO_PASSWORD, 10)
}

async function upsertDemoUsers(prisma) {
    const passwordHash = await buildPasswordHash()
    const users = {}

    for (const [key, user] of Object.entries(DEMO_USERS)) {
        users[key] = await prisma.user.upsert({
            where: {
                email: user.email,
            },
            update: {
                fullName: user.fullName,
                role: user.role,
                passwordHash,
                tokenVersion: 0,
                failedLoginCount: 0,
                lockedUntil: null,
            },
            create: {
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                passwordHash,
            },
        })
    }

    return users
}

async function upsertDemoRestaurants(prisma) {
    const restaurants = {}

    for (const [key, restaurant] of Object.entries(DEMO_RESTAURANTS)) {
        restaurants[key] = await prisma.restaurant.upsert({
            where: {
                slug: restaurant.slug,
            },
            update: {
                name: restaurant.name,
                address: restaurant.address,
                googleMapUrl: restaurant.googleMapUrl,
            },
            create: restaurant,
        })
    }

    return restaurants
}

async function resetRestaurantState(prisma, restaurantIds) {
    if (!restaurantIds.length) {
        return
    }

    const crawlSources = await prisma.reviewCrawlSource.findMany({
        where: {
            restaurantId: {
                in: restaurantIds,
            },
        },
        select: {
            id: true,
        },
    })

    const crawlSourceIds = crawlSources.map((source) => source.id)

    await prisma.$transaction(async (tx) => {
        if (crawlSourceIds.length > 0) {
            await tx.reviewCrawlRawReview.deleteMany({
                where: {
                    sourceId: {
                        in: crawlSourceIds,
                    },
                },
            })

            await tx.reviewCrawlRun.deleteMany({
                where: {
                    sourceId: {
                        in: crawlSourceIds,
                    },
                },
            })

            await tx.reviewCrawlSource.deleteMany({
                where: {
                    id: {
                        in: crawlSourceIds,
                    },
                },
            })
        }

        await tx.reviewIntakeBatch.deleteMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
        })

        await tx.review.deleteMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
        })

        await tx.complaintKeyword.deleteMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
        })

        await tx.insightSummary.deleteMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
        })

        await tx.restaurantUser.deleteMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
        })
    })
}

async function createMemberships(prisma, users, restaurants) {
    await prisma.restaurantUser.createMany({
        data: [
            {
                userId: users.userPrimary.id,
                restaurantId: restaurants.phoHong.id,
            },
            {
                userId: users.userSecondary.id,
                restaurantId: restaurants.phoHong.id,
            },
            {
                userId: users.userPrimary.id,
                restaurantId: restaurants.tacombi.id,
            },
            {
                userId: users.userTacombi.id,
                restaurantId: restaurants.tacombi.id,
            },
        ],
        skipDuplicates: true,
    })
}

async function approveAllItems(userId, batch) {
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

async function createPublishedBatch({
    userId,
    restaurantId,
    title,
    sourceType,
    items,
}) {
    const batch = await adminIntakeService.createReviewBatch({
        userId,
        restaurantId,
        title,
        sourceType,
    })
    const addedBatch = await adminIntakeService.addReviewItemsBulk({
        userId,
        batchId: batch.id,
        items,
    })

    await approveAllItems(userId, addedBatch)

    return adminIntakeService.publishReviewBatch({
        userId,
        batchId: batch.id,
    })
}

async function createOpenBatch({
    userId,
    restaurantId,
    title,
    items,
}) {
    const batch = await adminIntakeService.createReviewBatch({
        userId,
        restaurantId,
        title,
        sourceType: 'GOOGLE_MAPS_CRAWL',
    })

    const addedBatch = await adminIntakeService.addReviewItemsBulk({
        userId,
        batchId: batch.id,
        items,
    })

    await adminIntakeService.updateReviewItem({
        userId,
        itemId: addedBatch.items[0].id,
        input: {
            approvalStatus: 'APPROVED',
            reviewerNote: 'Matches an existing source review and is ready for publish.',
        },
    })

    return adminIntakeService.updateReviewItem({
        userId,
        itemId: addedBatch.items[1].id,
        input: {
            approvalStatus: 'REJECTED',
            reviewerNote: 'Rejected during curation because the evidence is too weak.',
        },
    })
}

function toIntakePayload(item) {
    return {
        sourceProvider: item.sourceProvider,
        sourceExternalId: item.sourceExternalId,
        sourceReviewUrl: item.sourceReviewUrl,
        rawAuthorName: item.rawAuthorName,
        rawRating: item.rawRating,
        rawContent: item.rawContent,
        rawReviewDate: item.rawReviewDate ? item.rawReviewDate.toISOString() : null,
    }
}

async function seedReviewCrawlRuntime(prisma, { userId, restaurant, batch }) {
    const source = await prisma.reviewCrawlSource.create({
        data: {
            restaurantId: restaurant.id,
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            inputUrl: GOOGLE_MAPS_DEMO_URL,
            resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            canonicalCid: '4548797685071303380',
            placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
            googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
            placeName: 'Quán Phở Hồng',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
            lastReportedTotal: 4743,
            lastSyncedAt: new Date('2026-03-20T08:10:00.000Z'),
            lastSuccessfulRunAt: new Date('2026-03-20T08:10:00.000Z'),
            nextScheduledAt: new Date('2026-03-25T08:10:00.000Z'),
        },
    })

    const run = await prisma.reviewCrawlRun.create({
        data: {
            sourceId: source.id,
            restaurantId: restaurant.id,
            requestedByUserId: userId,
            intakeBatchId: batch.id,
            strategy: 'BACKFILL',
            status: 'PARTIAL',
            priority: 'NORMAL',
            reportedTotal: 4743,
            extractedCount: 4,
            validCount: 3,
            skippedCount: 1,
            duplicateCount: 0,
            warningCount: 1,
            pagesFetched: 1,
            pageSize: 20,
            delayMs: 250,
            maxPages: 1,
            checkpointCursor: 'seed-next-page-token',
            knownReviewStreak: 0,
            warningsJson: ['Run stopped because the configured page budget was reached'],
            metadataJson: {
                trigger: 'seed',
            },
            queuedAt: new Date('2026-03-20T08:00:00.000Z'),
            startedAt: new Date('2026-03-20T08:00:05.000Z'),
            lastCheckpointAt: new Date('2026-03-20T08:10:00.000Z'),
            finishedAt: new Date('2026-03-20T08:10:02.000Z'),
        },
    })

    const itemsByExternalId = new Map(
        batch.items.map((item) => [item.sourceExternalId, item]),
    )
    const validDraftItem = itemsByExternalId.get('demo-phohong-published-002')
    const rejectedDraftItem = itemsByExternalId.get('demo-phohong-draft-002')
    const pendingDraftItem = itemsByExternalId.get('demo-phohong-draft-003')

    const rawReviewRows = [
        {
            sourceId: source.id,
            firstSeenRunId: run.id,
            lastSeenRunId: run.id,
            externalReviewKey: 'google-maps:review:demo-phohong-published-002',
            providerReviewId: 'demo-phohong-published-002',
            reviewUrl: validDraftItem.sourceReviewUrl,
            authorName: validDraftItem.rawAuthorName,
            rating: validDraftItem.rawRating,
            content: validDraftItem.rawContent,
            reviewDate: validDraftItem.rawReviewDate,
            language: 'vi',
            ownerResponseText: null,
            validForIntake: true,
            validationIssues: null,
            intakeItemPayload: toIntakePayload(validDraftItem),
            payload: {
                reviewId: 'demo-phohong-published-002',
                reviewUrl: validDraftItem.sourceReviewUrl,
                publishedAt: validDraftItem.rawReviewDate.toISOString(),
                author: { name: validDraftItem.rawAuthorName },
                rating: validDraftItem.rawRating,
                text: validDraftItem.rawContent,
                externalReviewKey: 'google-maps:review:demo-phohong-published-002',
            },
        },
        {
            sourceId: source.id,
            firstSeenRunId: run.id,
            lastSeenRunId: run.id,
            externalReviewKey: 'google-maps:review:demo-phohong-draft-002',
            providerReviewId: 'demo-phohong-draft-002',
            reviewUrl: rejectedDraftItem.sourceReviewUrl,
            authorName: rejectedDraftItem.rawAuthorName,
            rating: rejectedDraftItem.rawRating,
            content: rejectedDraftItem.rawContent,
            reviewDate: rejectedDraftItem.rawReviewDate,
            language: 'vi',
            ownerResponseText: null,
            validForIntake: true,
            validationIssues: null,
            intakeItemPayload: toIntakePayload(rejectedDraftItem),
            payload: {
                reviewId: 'demo-phohong-draft-002',
                reviewUrl: rejectedDraftItem.sourceReviewUrl,
                publishedAt: rejectedDraftItem.rawReviewDate.toISOString(),
                author: { name: rejectedDraftItem.rawAuthorName },
                rating: rejectedDraftItem.rawRating,
                text: rejectedDraftItem.rawContent,
                externalReviewKey: 'google-maps:review:demo-phohong-draft-002',
            },
        },
        {
            sourceId: source.id,
            firstSeenRunId: run.id,
            lastSeenRunId: run.id,
            externalReviewKey: 'google-maps:review:demo-phohong-draft-003',
            providerReviewId: 'demo-phohong-draft-003',
            reviewUrl: pendingDraftItem.sourceReviewUrl,
            authorName: pendingDraftItem.rawAuthorName,
            rating: pendingDraftItem.rawRating,
            content: pendingDraftItem.rawContent,
            reviewDate: pendingDraftItem.rawReviewDate,
            language: 'en',
            ownerResponseText: null,
            validForIntake: true,
            validationIssues: null,
            intakeItemPayload: toIntakePayload(pendingDraftItem),
            payload: {
                reviewId: 'demo-phohong-draft-003',
                reviewUrl: pendingDraftItem.sourceReviewUrl,
                publishedAt: pendingDraftItem.rawReviewDate.toISOString(),
                author: { name: pendingDraftItem.rawAuthorName },
                rating: pendingDraftItem.rawRating,
                text: pendingDraftItem.rawContent,
                externalReviewKey: 'google-maps:review:demo-phohong-draft-003',
            },
        },
        {
            sourceId: source.id,
            firstSeenRunId: run.id,
            lastSeenRunId: run.id,
            externalReviewKey: 'google-maps:review:demo-phohong-invalid-001',
            providerReviewId: 'demo-phohong-invalid-001',
            reviewUrl: 'https://www.google.com/maps/review/demo-phohong-invalid-001',
            authorName: 'Future Guest',
            rating: 4,
            content: 'Looks fine but the review date is in the future.',
            reviewDate: new Date('2026-12-20T10:00:00.000Z'),
            language: 'en',
            ownerResponseText: null,
            validForIntake: false,
            validationIssues: ['Review date cannot be in the future'],
            intakeItemPayload: null,
            payload: {
                reviewId: 'demo-phohong-invalid-001',
                reviewUrl: 'https://www.google.com/maps/review/demo-phohong-invalid-001',
                publishedAt: '2026-12-20T10:00:00.000Z',
                author: { name: 'Future Guest' },
                rating: 4,
                text: 'Looks fine but the review date is in the future.',
                externalReviewKey: 'google-maps:review:demo-phohong-invalid-001',
            },
        },
    ]

    for (const row of rawReviewRows) {
        await prisma.reviewCrawlRawReview.create({
            data: row,
        })
    }

    return {
        source,
        run,
        rawReviewCount: rawReviewRows.length,
    }
}

async function countRestaurantState(prisma, restaurantId) {
    const [reviews, publishedBatches, openBatches, crawlRuns] = await Promise.all([
        prisma.review.count({
            where: {
                restaurantId,
            },
        }),
        prisma.reviewIntakeBatch.count({
            where: {
                restaurantId,
                status: 'PUBLISHED',
            },
        }),
        prisma.reviewIntakeBatch.count({
            where: {
                restaurantId,
                status: {
                    in: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
                },
            },
        }),
        prisma.reviewCrawlRun.count({
            where: {
                restaurantId,
            },
        }),
    ])

    return {
        reviews,
        publishedBatches,
        openBatches,
        crawlRuns,
    }
}

async function seedDemoData(options = {}) {
    const prisma = options.prisma || require('../src/lib/prisma')
    const log = options.logger || null

    buildSeedLog(log, 'Upserting demo users and restaurants...')

    const users = await upsertDemoUsers(prisma)
    const restaurants = await upsertDemoRestaurants(prisma)

    await resetRestaurantState(prisma, [restaurants.phoHong.id, restaurants.tacombi.id])
    await createMemberships(prisma, users, restaurants)

    buildSeedLog(log, 'Creating published baseline batches...')

    const phoHongPublished = await createPublishedBatch({
        userId: users.admin.id,
        restaurantId: restaurants.phoHong.id,
        title: 'Google Maps baseline publish',
        sourceType: 'GOOGLE_MAPS_CRAWL',
        items: PHO_HONG_PUBLISHED_ITEMS,
    })

    const tacombiPublished = await createPublishedBatch({
        userId: users.admin.id,
        restaurantId: restaurants.tacombi.id,
        title: 'Manual quality baseline',
        sourceType: 'MANUAL',
        items: TACOMBI_PUBLISHED_ITEMS,
    })

    buildSeedLog(log, 'Creating open Google Maps curation batch...')

    const draftBatch = await createOpenBatch({
        userId: users.admin.id,
        restaurantId: restaurants.phoHong.id,
        title: 'Google Maps draft triage',
        items: PHO_HONG_DRAFT_ITEMS,
    })

    buildSeedLog(log, 'Creating review crawl source, run, and raw review audit trail...')

    const crawlRuntime = await seedReviewCrawlRuntime(prisma, {
        userId: users.admin.id,
        restaurant: restaurants.phoHong,
        batch: draftBatch,
    })

    const summary = {
        credentials: {
            password: DEMO_PASSWORD,
            userPrimary: {
                email: DEMO_USERS.userPrimary.email,
                role: DEMO_USERS.userPrimary.role,
            },
            internalAdmin: {
                email: DEMO_USERS.admin.email,
                role: DEMO_USERS.admin.role,
            },
        },
        users: {
            userPrimary: {
                id: users.userPrimary.id,
                email: users.userPrimary.email,
                role: users.userPrimary.role,
            },
            userSecondary: {
                id: users.userSecondary.id,
                email: users.userSecondary.email,
                role: users.userSecondary.role,
            },
            userTacombi: {
                id: users.userTacombi.id,
                email: users.userTacombi.email,
                role: users.userTacombi.role,
            },
            outsider: {
                id: users.outsider.id,
                email: users.outsider.email,
                role: users.outsider.role,
            },
            admin: {
                id: users.admin.id,
                email: users.admin.email,
                role: users.admin.role,
            },
        },
        restaurants: {
            phoHong: {
                id: restaurants.phoHong.id,
                slug: restaurants.phoHong.slug,
                state: await countRestaurantState(prisma, restaurants.phoHong.id),
                latestPublishedBatchId: phoHongPublished.batch.id,
                draftBatchId: draftBatch.id,
                crawlSourceId: crawlRuntime.source.id,
                crawlRunId: crawlRuntime.run.id,
            },
            tacombi: {
                id: restaurants.tacombi.id,
                slug: restaurants.tacombi.slug,
                state: await countRestaurantState(prisma, restaurants.tacombi.id),
                latestPublishedBatchId: tacombiPublished.batch.id,
            },
        },
    }

    buildSeedLog(log, 'Demo dataset is ready.')
    return summary
}

module.exports = {
    DEMO_PASSWORD,
    DEMO_RESTAURANTS,
    DEMO_USERS,
    GOOGLE_MAPS_DEMO_URL,
    countRestaurantState,
    resetRestaurantState,
    seedDemoData,
}
