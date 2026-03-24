#!/usr/bin/env node

require('dotenv').config()

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const prisma = require('../src/lib/prisma')
const dashboardService = require('../src/services/dashboard.service')
const restaurantService = require('../src/services/restaurant.service')
const {
    countRestaurantState,
    seedDemoData,
} = require('../prisma/seed-data')

const OPEN_BATCH_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'])
const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'backend-recovery-drill-local.json',
)

function readFlag(args, name) {
    const inline = args.find((value) => value.startsWith(`${name}=`))

    if (inline) {
        return inline.slice(`${name}=`.length)
    }

    const index = args.findIndex((value) => value === name)
    if (index === -1) {
        return undefined
    }

    return args[index + 1]
}

function readFlags(args, name) {
    const values = []

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index]

        if (value === name) {
            if (args[index + 1]) {
                values.push(args[index + 1])
            }

            index += 1
            continue
        }

        if (value.startsWith(`${name}=`)) {
            values.push(value.slice(`${name}=`.length))
        }
    }

    return values
}

function hasFlag(args, name) {
    return args.includes(name)
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/recovery-drill.js [options]',
            '',
            'Options:',
            '  --restaurant-slug <slug>  Limit the drill to one or more seeded demo restaurants',
            `  --output <file>           Write the recovery report JSON (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --help                    Show this help message',
            '',
            'Notes:',
            '  The drill seeds the demo dataset, snapshots logical restaurant state,',
            '  simulates destructive loss, restores from the snapshot, and verifies that',
            '  the restored semantic fingerprint matches the baseline.',
        ].join('\n'),
    )
}

function sanitizeRow(row) {
    if (!row) {
        return row
    }

    const { createdAt, updatedAt, ...rest } = row
    return rest
}

function normalizeForDigest(value) {
    if (value instanceof Date) {
        return value.toISOString()
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeForDigest(item))
    }

    if (value && typeof value === 'object') {
        const normalized = {}

        for (const key of Object.keys(value).sort()) {
            if (key === 'createdAt' || key === 'updatedAt') {
                continue
            }

            normalized[key] = normalizeForDigest(value[key])
        }

        return normalized
    }

    return value
}

function createDigest(value) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(normalizeForDigest(value)))
        .digest('hex')
}

function summarizeSnapshot(snapshot) {
    return {
        reviews: snapshot.reviews.length,
        publishedBatches: snapshot.batches.filter((batch) => batch.status === 'PUBLISHED').length,
        openBatches: snapshot.batches.filter((batch) => OPEN_BATCH_STATUSES.has(batch.status)).length,
        intakeItems: snapshot.items.length,
        approvedItems: snapshot.items.filter((item) => item.approvalStatus === 'APPROVED').length,
        pendingItems: snapshot.items.filter((item) => item.approvalStatus === 'PENDING').length,
        rejectedItems: snapshot.items.filter((item) => item.approvalStatus === 'REJECTED').length,
        crawlSources: snapshot.sources.length,
        crawlRuns: snapshot.runs.length,
        rawReviews: snapshot.rawReviews.length,
        complaintKeywords: snapshot.keywords.length,
        insightPresent: Boolean(snapshot.insight),
    }
}

async function snapshotRestaurantState(restaurantId) {
    const [restaurant, reviews, insight, keywords, batches, items, sources, runs] =
        await Promise.all([
            prisma.restaurant.findUnique({
                where: { id: restaurantId },
            }),
            prisma.review.findMany({
                where: { restaurantId },
                orderBy: [{ reviewDate: 'asc' }, { id: 'asc' }],
            }),
            prisma.insightSummary.findUnique({
                where: { restaurantId },
            }),
            prisma.complaintKeyword.findMany({
                where: { restaurantId },
                orderBy: [{ keyword: 'asc' }],
            }),
            prisma.reviewIntakeBatch.findMany({
                where: { restaurantId },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
            prisma.reviewIntakeItem.findMany({
                where: { restaurantId },
                orderBy: [{ batchId: 'asc' }, { id: 'asc' }],
            }),
            prisma.reviewCrawlSource.findMany({
                where: { restaurantId },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
            prisma.reviewCrawlRun.findMany({
                where: { restaurantId },
                orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }],
            }),
        ])

    const sourceIds = sources.map((source) => source.id)
    const rawReviews =
        sourceIds.length > 0
            ? await prisma.reviewCrawlRawReview.findMany({
                  where: {
                      sourceId: {
                          in: sourceIds,
                      },
                  },
                  orderBy: [{ sourceId: 'asc' }, { externalReviewKey: 'asc' }],
              })
            : []

    if (!restaurant) {
        throw new Error(`Restaurant ${restaurantId} was not found for snapshot`)
    }

    return {
        restaurant,
        reviews,
        insight,
        keywords,
        batches,
        items,
        sources,
        runs,
        rawReviews,
    }
}

async function readLiveStateSummary(restaurantId) {
    const [coreCounts, intakeItems, crawlSources, rawReviews, complaintKeywords, insight] =
        await Promise.all([
            countRestaurantState(prisma, restaurantId),
            prisma.reviewIntakeItem.count({
                where: { restaurantId },
            }),
            prisma.reviewCrawlSource.count({
                where: { restaurantId },
            }),
            prisma.reviewCrawlRawReview.count({
                where: {
                    source: {
                        restaurantId,
                    },
                },
            }),
            prisma.complaintKeyword.count({
                where: { restaurantId },
            }),
            prisma.insightSummary.count({
                where: { restaurantId },
            }),
        ])

    return {
        ...coreCounts,
        intakeItems,
        crawlSources,
        rawReviews,
        complaintKeywords,
        insightRows: insight,
    }
}

async function captureServiceProof(userId, restaurantId) {
    const [detail, kpi, complaints, topIssue, latestReviews] = await Promise.all([
        restaurantService.getRestaurantDetail({
            userId,
            restaurantId,
        }),
        dashboardService.getRestaurantKpi({
            userId,
            restaurantId,
        }),
        dashboardService.getComplaintKeywords({
            userId,
            restaurantId,
        }),
        dashboardService.getTopIssue({
            userId,
            restaurantId,
        }),
        prisma.review.findMany({
            where: { restaurantId },
            orderBy: [{ reviewDate: 'desc' }, { id: 'desc' }],
            take: 3,
            select: {
                externalId: true,
                authorName: true,
                rating: true,
                sentiment: true,
            },
        }),
    ])

    return {
        detail: {
            id: detail.id,
            name: detail.name,
            slug: detail.slug,
            googleMapUrl: detail.googleMapUrl,
            datasetStatus: detail.datasetStatus,
            insightSummary: detail.insightSummary,
        },
        kpi,
        complaints: complaints.slice(0, 5),
        topIssue,
        latestReviews,
    }
}

async function damageRestaurants(targets) {
    const restaurantIds = targets.map((target) => target.restaurantId)
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
    })

    for (const target of targets) {
        await prisma.restaurant.update({
            where: {
                id: target.restaurantId,
            },
            data: {
                name: `${target.name} [damaged]`,
                address: 'DISASTER RECOVERY DRILL',
                googleMapUrl: null,
            },
        })
    }
}

async function restoreSnapshot(snapshot) {
    await prisma.$transaction(async (tx) => {
        await tx.restaurant.update({
            where: {
                id: snapshot.restaurant.id,
            },
            data: {
                name: snapshot.restaurant.name,
                address: snapshot.restaurant.address,
                googleMapUrl: snapshot.restaurant.googleMapUrl,
            },
        })

        for (const source of snapshot.sources) {
            await tx.reviewCrawlSource.create({
                data: sanitizeRow(source),
            })
        }

        for (const batch of snapshot.batches) {
            await tx.reviewIntakeBatch.create({
                data: sanitizeRow(batch),
            })
        }

        for (const run of snapshot.runs) {
            await tx.reviewCrawlRun.create({
                data: sanitizeRow(run),
            })
        }

        for (const rawReview of snapshot.rawReviews) {
            await tx.reviewCrawlRawReview.create({
                data: sanitizeRow(rawReview),
            })
        }

        for (const review of snapshot.reviews) {
            await tx.review.create({
                data: sanitizeRow(review),
            })
        }

        for (const item of snapshot.items) {
            await tx.reviewIntakeItem.create({
                data: sanitizeRow(item),
            })
        }

        if (snapshot.insight) {
            await tx.insightSummary.create({
                data: sanitizeRow(snapshot.insight),
            })
        }

        for (const keyword of snapshot.keywords) {
            await tx.complaintKeyword.create({
                data: sanitizeRow(keyword),
            })
        }
    })
}

function selectTargets(seedSummary, slugs) {
    const availableTargets = Object.values(seedSummary.restaurants)

    if (!slugs.length) {
        return availableTargets.map((restaurant) => ({
            restaurantId: restaurant.id,
            slug: restaurant.slug,
        }))
    }

    return slugs.map((slug) => {
        const match = availableTargets.find((restaurant) => restaurant.slug === slug)

        if (!match) {
            throw new Error(
                `Unknown seeded restaurant slug "${slug}". Available slugs: ${availableTargets
                    .map((restaurant) => restaurant.slug)
                    .join(', ')}`,
            )
        }

        return {
            restaurantId: match.id,
            slug: match.slug,
        }
    })
}

async function buildRestaurantReport(userId, target) {
    const snapshot = await snapshotRestaurantState(target.restaurantId)
    const state = await readLiveStateSummary(target.restaurantId)
    const serviceProof = await captureServiceProof(userId, target.restaurantId)

    return {
        restaurantId: target.restaurantId,
        slug: target.slug,
        name: snapshot.restaurant.name,
        snapshot,
        snapshotSummary: summarizeSnapshot(snapshot),
        liveState: state,
        serviceProof,
        semanticDigest: createDigest(snapshot),
        serviceDigest: createDigest(serviceProof),
    }
}

function buildStageReport(restaurantReports) {
    return restaurantReports.map((report) => ({
        restaurantId: report.restaurantId,
        slug: report.slug,
        name: report.name,
        snapshotSummary: report.snapshotSummary,
        liveState: report.liveState,
        semanticDigest: report.semanticDigest,
        serviceDigest: report.serviceDigest,
        serviceProof: report.serviceProof,
    }))
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const restaurantSlugs = readFlags(args, '--restaurant-slug')
    const startedAt = new Date()

    process.stdout.write('Seeding demo dataset for recovery drill...\n')
    const seedSummary = await seedDemoData({ prisma })
    const targets = selectTargets(seedSummary, restaurantSlugs)
    const targetDetails = await Promise.all(
        targets.map(async (target) => {
            const restaurant = await prisma.restaurant.findUnique({
                where: {
                    id: target.restaurantId,
                },
                select: {
                    name: true,
                },
            })

            return {
                ...target,
                name: restaurant?.name ?? target.slug,
            }
        }),
    )

    process.stdout.write(
        `Capturing baseline snapshot for ${targetDetails
            .map((target) => target.slug)
            .join(', ')}...\n`,
    )
    const baseline = await Promise.all(
        targetDetails.map((target) =>
            buildRestaurantReport(seedSummary.users.owner.id, target),
        ),
    )

    process.stdout.write('Simulating destructive restaurant-state loss...\n')
    await damageRestaurants(targetDetails)

    const damaged = await Promise.all(
        targetDetails.map((target) =>
            buildRestaurantReport(seedSummary.users.owner.id, target),
        ),
    )

    const baselineDigest = createDigest(buildStageReport(baseline))
    const damagedDigest = createDigest(buildStageReport(damaged))

    if (baselineDigest === damagedDigest) {
        throw new Error('Recovery drill damage step did not change the semantic dataset')
    }

    process.stdout.write('Restoring restaurant state from logical snapshot...\n')
    for (const report of baseline) {
        await restoreSnapshot(report.snapshot)
    }

    const restored = await Promise.all(
        targetDetails.map((target) =>
            buildRestaurantReport(seedSummary.users.owner.id, target),
        ),
    )

    const restoredDigest = createDigest(buildStageReport(restored))

    if (baselineDigest !== restoredDigest) {
        throw new Error(
            `Restored semantic digest mismatch. baseline=${baselineDigest} restored=${restoredDigest}`,
        )
    }

    const finishedAt = new Date()
    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'logical_restaurant_state_restore',
            targetRestaurantCount: targetDetails.length,
        },
        seedSummary: {
            users: seedSummary.users,
            restaurants: Object.fromEntries(
                Object.entries(seedSummary.restaurants).map(([key, value]) => [
                    key,
                    {
                        id: value.id,
                        slug: value.slug,
                        state: value.state,
                    },
                ]),
            ),
        },
        result: {
            baselineDigest,
            damagedDigest,
            restoredDigest,
            restoredMatchesBaseline: baselineDigest === restoredDigest,
        },
        stages: {
            baseline: buildStageReport(baseline),
            damaged: buildStageReport(damaged),
            restored: buildStageReport(restored),
        },
        notes: [
            'This drill proves logical restaurant-state recovery on the shared demo dataset without relying on pg_dump or pg_restore availability.',
            'The restore step preserves semantic restaurant data, review intake state, canonical reviews, crawl runtime rows, and dashboard aggregates.',
            'Managed-environment backup, restore, and rollback evidence is still required separately for staging or production posture.',
        ],
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), {
        recursive: true,
    })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
    )

    process.stdout.write(`${JSON.stringify(report.result, null, 2)}\n`)
    process.stdout.write(`Recovery drill report written to ${resolvedOutputPath}\n`)
}

main()
    .catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.disconnect()
    })
