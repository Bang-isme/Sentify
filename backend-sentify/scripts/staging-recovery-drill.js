#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvFiles } = require('./load-env-files')

const jwt = require('jsonwebtoken')
const { Client } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const prisma = require('../src/lib/prisma')
const { countRestaurantState, seedDemoData } = require('../prisma/seed-data')

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-recovery-drill-local.json',
)
const OPEN_BATCH_STATUSES = new Set(['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'])

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
            '  node scripts/staging-recovery-drill.js [options]',
            '',
            'Options:',
            '  --source-mode <mode>       Source mode: seeded-local or existing (default: seeded-local)',
            '  --source-db-url <url>      Optional source database URL override (falls back to DATABASE_URL)',
            '  --restaurant-slug <slug>   Limit the drill to one or more source restaurants',
            '  --smoke-user-id <id>       Optional USER account id for authenticated smoke in existing-source mode',
            '  --target-db-url <url>      Optional restore target database URL',
            '  --target-database <name>   Optional restore target database name when a target DB URL is not provided',
            '  --port <n>                 Optional base port override for smoke servers',
            `  --output <file>            Write the summary report JSON (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --keep-target-database     Keep the migrated restore database after the drill',
            '  --help                     Show this help message',
            '',
            'Default behavior:',
            '  In seeded-local mode, the drill seeds the source DB first.',
            '  In existing mode, the drill reads an existing source DB without seeding it.',
            '  Both modes restore into a shadow database, boot the backend against the restored',
            '  target, verify health plus read routes, then rehearse rollback by booting the',
            '  backend against the source DB again.',
        ].join('\n'),
    )
}

function withConnectionLimit(databaseUrl, connectionLimit) {
    if (!databaseUrl || !connectionLimit) {
        return databaseUrl
    }

    try {
        const url = new URL(databaseUrl)

        if (!url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', String(connectionLimit))
        }

        return url.toString()
    } catch (error) {
        return databaseUrl
    }
}

function createScopedPrismaClient(databaseUrl) {
    const adapter = new PrismaPg({
        connectionString: withConnectionLimit(databaseUrl, process.env.DB_POOL_MAX || 10),
    })

    return new PrismaClient({
        adapter,
        log: ['error'],
    })
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

function getSnapshotCollectionKeys(snapshot) {
    return Object.keys(snapshot).filter((key) => Array.isArray(snapshot[key]))
}

function getSnapshotRowKey(collectionName, row, index) {
    if (row && typeof row === 'object' && row.id) {
        return String(row.id)
    }

    return `${collectionName}:${index}`
}

function buildNormalizedCollectionMap(collectionName, rows = []) {
    const collectionMap = new Map()

    rows.forEach((row, index) => {
        collectionMap.set(
            getSnapshotRowKey(collectionName, row, index),
            normalizeForDigest(row),
        )
    })

    return collectionMap
}

function describeSnapshotMismatch(sourceSnapshot, targetSnapshot) {
    const mismatches = []

    for (const collectionName of getSnapshotCollectionKeys(sourceSnapshot)) {
        const sourceRows = sourceSnapshot[collectionName] || []
        const targetRows = targetSnapshot[collectionName] || []
        const sourceMap = buildNormalizedCollectionMap(collectionName, sourceRows)
        const targetMap = buildNormalizedCollectionMap(collectionName, targetRows)

        if (sourceRows.length !== targetRows.length) {
            mismatches.push({
                collection: collectionName,
                type: 'count_mismatch',
                sourceCount: sourceRows.length,
                targetCount: targetRows.length,
            })
            continue
        }

        const missingKeys = [...sourceMap.keys()].filter((key) => !targetMap.has(key))
        if (missingKeys.length > 0) {
            mismatches.push({
                collection: collectionName,
                type: 'missing_rows',
                rowKeys: missingKeys.slice(0, 5),
            })
            continue
        }

        const differingKey = [...sourceMap.keys()].find((key) => {
            return JSON.stringify(sourceMap.get(key)) !== JSON.stringify(targetMap.get(key))
        })

        if (differingKey) {
            mismatches.push({
                collection: collectionName,
                type: 'row_mismatch',
                rowKey: differingKey,
                source: sourceMap.get(differingKey),
                target: targetMap.get(differingKey),
            })
        }
    }

    return mismatches
}

function safeDatabaseName(value) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid database name "${value}"`)
    }

    return value
}

function normalizeSourceMode(value) {
    const mode = (value || 'seeded-local').toLowerCase()

    if (mode === 'seeded-local' || mode === 'seeded' || mode === 'local') {
        return 'seeded-local'
    }

    if (mode === 'existing') {
        return 'existing'
    }

    throw new Error(
        `Unsupported source mode "${value}". Expected "seeded-local" or "existing".`,
    )
}

function buildShadowDatabaseName() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
    return `sentify_stage_recovery_${stamp}`
}

function applyDatabaseToUrl(databaseUrl, databaseName) {
    const url = new URL(databaseUrl)
    url.pathname = `/${databaseName}`
    return url.toString()
}

function parseDatabaseFromUrl(databaseUrl) {
    try {
        const url = new URL(databaseUrl)
        return url.pathname.replace(/^\//, '')
    } catch (error) {
        return 'unknown'
    }
}

function normalizeDatabaseIdentity(databaseUrl) {
    const url = new URL(databaseUrl)

    return JSON.stringify({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || '',
        username: decodeURIComponent(url.username || ''),
        database: url.pathname.replace(/^\//, ''),
    })
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer()

        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve(address.port)
            })
        })
    })
}

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

async function requestJson(baseUrl, requestPath, options = {}) {
    const url = new URL(requestPath, baseUrl)
    const method = options.method || 'GET'

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                method,
                headers: options.headers || {},
            },
            (res) => {
                let body = ''
                res.on('data', (chunk) => {
                    body += chunk
                })
                res.on('end', () => {
                    let parsedBody = null

                    if (body) {
                        try {
                            parsedBody = JSON.parse(body)
                        } catch (error) {
                            parsedBody = body
                        }
                    }

                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsedBody,
                    })
                })
            },
        )

        req.on('error', reject)
        req.end()
    })
}

async function waitForHttpOk(baseUrl, requestPath, timeoutMs) {
    const startedAt = Date.now()
    let lastError = null

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await requestJson(baseUrl, requestPath)

            if (response.status && response.status < 500) {
                return response
            }

            lastError = new Error(
                `Unexpected status ${response.status} from ${requestPath}`,
            )
        } catch (error) {
            lastError = error
        }

        await wait(500)
    }

    throw lastError || new Error(`Timed out waiting for ${requestPath}`)
}

function createAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            tokenVersion: user.tokenVersion,
        },
        process.env.JWT_SECRET,
        {
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE,
            subject: user.id,
            expiresIn: '15m',
            jwtid: 'staging-recovery-drill',
        },
    )
}

function summarizeHttpResponse(response) {
    return {
        status: response.status,
        body: response.body,
    }
}

async function captureSmokeSuite(baseUrl, seededUser, targetRestaurantId) {
    const token = createAccessToken(seededUser)
    const headers = {
        Authorization: `Bearer ${token}`,
    }

    const [rootHealth, apiHealth, restaurants, detail, kpi] = await Promise.all([
        requestJson(baseUrl, '/health'),
        requestJson(baseUrl, '/api/health'),
        requestJson(baseUrl, '/api/restaurants', { headers }),
        requestJson(baseUrl, `/api/restaurants/${targetRestaurantId}`, { headers }),
        requestJson(baseUrl, `/api/restaurants/${targetRestaurantId}/dashboard/kpi`, { headers }),
    ])

    return {
        rootHealth: summarizeHttpResponse(rootHealth),
        apiHealth: summarizeHttpResponse(apiHealth),
        restaurants: summarizeHttpResponse(restaurants),
        detail: summarizeHttpResponse(detail),
        kpi: summarizeHttpResponse(kpi),
    }
}

function selectSeededTargets(seedSummary, slugs) {
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

async function selectExistingTargets(sourceClient, slugs) {
    if (!slugs.length) {
        throw new Error(
            'At least one --restaurant-slug is required when --source-mode=existing',
        )
    }

    const restaurants = await sourceClient.restaurant.findMany({
        where: {
            slug: {
                in: slugs,
            },
        },
        orderBy: [{ slug: 'asc' }],
        select: {
            id: true,
            slug: true,
        },
    })

    return slugs.map((slug) => {
        const match = restaurants.find((restaurant) => restaurant.slug === slug)

        if (!match) {
            throw new Error(
                `Unknown source restaurant slug "${slug}". Available matches: ${restaurants
                    .map((restaurant) => restaurant.slug)
                    .join(', ') || 'none'}`,
            )
        }

        return {
            restaurantId: match.id,
            slug: match.slug,
        }
    })
}

async function selectSmokeUser(sourceClient, restaurantId, explicitUserId) {
    if (explicitUserId) {
        const [user, membership] = await Promise.all([
            sourceClient.user.findUnique({
                where: { id: explicitUserId },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    role: true,
                    tokenVersion: true,
                    deactivatedAt: true,
                    manuallyLockedAt: true,
                },
            }),
            sourceClient.restaurantUser.findFirst({
                where: {
                    userId: explicitUserId,
                    restaurantId,
                },
            }),
        ])

        if (!user) {
            throw new Error(`Smoke user ${explicitUserId} was not found in the source database`)
        }

        if (user.role !== 'USER') {
            throw new Error(`Smoke user ${explicitUserId} must have role USER`)
        }

        if (user.deactivatedAt || user.manuallyLockedAt) {
            throw new Error(`Smoke user ${explicitUserId} must be active and unlocked`)
        }

        if (!membership) {
            throw new Error(
                `Smoke user ${explicitUserId} does not belong to restaurant ${restaurantId}`,
            )
        }

        return user
    }

    const memberships = await sourceClient.restaurantUser.findMany({
        where: {
            restaurantId,
        },
        orderBy: [{ createdAt: 'asc' }],
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    role: true,
                    tokenVersion: true,
                    deactivatedAt: true,
                    manuallyLockedAt: true,
                },
            },
        },
    })

    const smokeUser = memberships
        .map((membership) => membership.user)
        .find(
            (user) =>
                user.role === 'USER' && !user.deactivatedAt && !user.manuallyLockedAt,
        )

    if (!smokeUser) {
        throw new Error(
            `Could not find an active USER membership for restaurant ${restaurantId} in existing-source mode`,
        )
    }

    return smokeUser
}

async function backupSourceSlice(sourceClient, targets, options = {}) {
    const restaurantIds = targets.map((target) => target.restaurantId)
    const [restaurants, restaurantUsers, batches, runs, reviews, insightRows, keywords, items, sources, platformControls] =
        await Promise.all([
            sourceClient.restaurant.findMany({
                where: {
                    id: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ slug: 'asc' }],
            }),
            sourceClient.restaurantUser.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ restaurantId: 'asc' }, { userId: 'asc' }],
            }),
            sourceClient.reviewIntakeBatch.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ id: 'asc' }],
            }),
            sourceClient.reviewCrawlRun.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }],
            }),
            sourceClient.review.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ restaurantId: 'asc' }, { reviewDate: 'asc' }, { id: 'asc' }],
            }),
            sourceClient.insightSummary.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ restaurantId: 'asc' }],
            }),
            sourceClient.complaintKeyword.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ restaurantId: 'asc' }, { keyword: 'asc' }],
            }),
            sourceClient.reviewIntakeItem.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ batchId: 'asc' }, { id: 'asc' }],
            }),
            sourceClient.reviewCrawlSource.findMany({
                where: {
                    restaurantId: {
                        in: restaurantIds,
                    },
                },
                orderBy: [{ id: 'asc' }],
            }),
            options.includePlatformControls
                ? sourceClient.platformControl.findMany({
                      orderBy: [{ id: 'asc' }],
                  })
                : [],
        ])

    const sourceIds = [...new Set(sources.map((source) => source.id))]

    const [rawReviews, auditEvents, publishEvents] = await Promise.all([
        sourceIds.length > 0
            ? sourceClient.reviewCrawlRawReview.findMany({
                  where: {
                      sourceId: {
                          in: sourceIds,
                      },
                  },
                  orderBy: [{ sourceId: 'asc' }, { externalReviewKey: 'asc' }],
              })
            : [],
        sourceClient.auditEvent.findMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
            orderBy: [{ id: 'asc' }],
        }),
        sourceClient.reviewPublishEvent.findMany({
            where: {
                restaurantId: {
                    in: restaurantIds,
                },
            },
            orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
        }),
    ])

    const userIds = [
        ...new Set(
            [
                ...(options.explicitUserIds || []),
                ...restaurantUsers.map((membership) => membership.userId),
                ...batches.flatMap((batch) => [
                    batch.createdByUserId,
                    batch.publishedByUserId,
                ]),
                ...runs.map((run) => run.requestedByUserId),
                ...items.map((item) => item.lastReviewedByUserId),
                ...auditEvents.map((event) => event.actorUserId),
                ...publishEvents.map((event) => event.publishedByUserId),
                ...platformControls.map((control) => control.updatedByUserId),
            ].filter(Boolean),
        ),
    ]

    const users = userIds.length
        ? await sourceClient.user.findMany({
              where: {
                  id: {
                      in: userIds,
                  },
              },
              orderBy: [{ email: 'asc' }],
          })
        : []

    return {
        users,
        restaurants,
        restaurantUsers,
        reviews,
        insightRows,
        keywords,
        batches,
        items,
        sources,
        runs,
        rawReviews,
        auditEvents,
        publishEvents,
        platformControls,
    }
}

async function summarizeState(client, restaurantIds) {
    const perRestaurant = []

    for (const restaurantId of restaurantIds) {
        const [coreCounts, intakeItems, crawlSources, rawReviews, complaintKeywords, insightRows, auditEvents, publishEvents] =
            await Promise.all([
                countRestaurantState(client, restaurantId),
                client.reviewIntakeItem.count({
                    where: { restaurantId },
                }),
                client.reviewCrawlSource.count({
                    where: { restaurantId },
                }),
                client.reviewCrawlRawReview.count({
                    where: {
                        source: {
                            restaurantId,
                        },
                    },
                }),
                client.complaintKeyword.count({
                    where: { restaurantId },
                }),
                client.insightSummary.count({
                    where: { restaurantId },
                }),
                client.auditEvent.count({
                    where: { restaurantId },
                }),
                client.reviewPublishEvent.count({
                    where: { restaurantId },
                }),
            ])

        perRestaurant.push({
            restaurantId,
            state: {
                ...coreCounts,
                intakeItems,
                crawlSources,
                rawReviews,
                complaintKeywords,
                insightRows,
                auditEvents,
                publishEvents,
            },
        })
    }

    return perRestaurant
}

function summarizeBackup(snapshot) {
    return {
        users: snapshot.users.length,
        restaurants: snapshot.restaurants.length,
        memberships: snapshot.restaurantUsers.length,
        reviews: snapshot.reviews.length,
        batches: snapshot.batches.length,
        openBatches: snapshot.batches.filter((batch) => OPEN_BATCH_STATUSES.has(batch.status)).length,
        items: snapshot.items.length,
        sources: snapshot.sources.length,
        runs: snapshot.runs.length,
        rawReviews: snapshot.rawReviews.length,
        insightRows: snapshot.insightRows.length,
        complaintKeywords: snapshot.keywords.length,
        auditEvents: snapshot.auditEvents.length,
        reviewPublishEvents: snapshot.publishEvents.length,
        platformControls: snapshot.platformControls.length,
    }
}

async function restoreSeededSlice(targetClient, snapshot) {
    const sanitized = {
        users: snapshot.users.map((row) => sanitizeRow(row)),
        restaurants: snapshot.restaurants.map((row) => sanitizeRow(row)),
        platformControls: snapshot.platformControls.map((row) => sanitizeRow(row)),
        restaurantUsers: snapshot.restaurantUsers.map((row) => sanitizeRow(row)),
        sources: snapshot.sources.map((row) => sanitizeRow(row)),
        batches: snapshot.batches.map((row) => sanitizeRow(row)),
        runs: snapshot.runs.map((row) => sanitizeRow(row)),
        rawReviews: snapshot.rawReviews.map((row) => sanitizeRow(row)),
        reviews: snapshot.reviews.map((row) => sanitizeRow(row)),
        items: snapshot.items.map((row) => sanitizeRow(row)),
        insightRows: snapshot.insightRows.map((row) => sanitizeRow(row)),
        keywords: snapshot.keywords.map((row) => sanitizeRow(row)),
        auditEvents: snapshot.auditEvents.map((row) => sanitizeRow(row)),
        publishEvents: snapshot.publishEvents.map((row) => sanitizeRow(row)),
    }

    async function createRowsInBatches(rows, batchSize, createRow) {
        for (let index = 0; index < rows.length; index += batchSize) {
            const batch = rows.slice(index, index + batchSize)
            await Promise.all(batch.map((row) => createRow(row)))
        }
    }

    await createRowsInBatches(sanitized.users, 25, (row) =>
        targetClient.user.create({ data: row }),
    )
    await createRowsInBatches(sanitized.restaurants, 25, (row) =>
        targetClient.restaurant.create({ data: row }),
    )

    if (sanitized.platformControls.length > 0) {
        await targetClient.platformControl.deleteMany({})
        await createRowsInBatches(sanitized.platformControls, 10, (row) =>
            targetClient.platformControl.create({ data: row }),
        )
    }

    await createRowsInBatches(sanitized.restaurantUsers, 25, (row) =>
        targetClient.restaurantUser.create({ data: row }),
    )
    await createRowsInBatches(sanitized.sources, 25, (row) =>
        targetClient.reviewCrawlSource.create({ data: row }),
    )
    await createRowsInBatches(sanitized.batches, 25, (row) =>
        targetClient.reviewIntakeBatch.create({ data: row }),
    )
    await createRowsInBatches(sanitized.runs, 25, (row) =>
        targetClient.reviewCrawlRun.create({ data: row }),
    )
    await createRowsInBatches(sanitized.rawReviews, 50, (row) =>
        targetClient.reviewCrawlRawReview.create({ data: row }),
    )
    await createRowsInBatches(sanitized.reviews, 25, (row) =>
        targetClient.review.create({ data: row }),
    )
    await createRowsInBatches(sanitized.items, 25, (row) =>
        targetClient.reviewIntakeItem.create({ data: row }),
    )
    await createRowsInBatches(sanitized.insightRows, 25, (row) =>
        targetClient.insightSummary.create({ data: row }),
    )
    await createRowsInBatches(sanitized.keywords, 25, (row) =>
        targetClient.complaintKeyword.create({ data: row }),
    )
    await createRowsInBatches(sanitized.auditEvents, 50, (row) =>
        targetClient.auditEvent.create({ data: row }),
    )
    await createRowsInBatches(sanitized.publishEvents, 50, (row) =>
        targetClient.reviewPublishEvent.create({ data: row }),
    )
}

async function getAdminClient(databaseUrl) {
    return new Client({
        connectionString: applyDatabaseToUrl(databaseUrl, 'postgres'),
    })
}

async function ensureTargetDatabase(databaseUrl, databaseName) {
    const client = await getAdminClient(databaseUrl)
    await client.connect()

    try {
        const exists = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [safeDatabaseName(databaseName)],
        )

        if (exists.rowCount === 0) {
            await client.query(`CREATE DATABASE "${safeDatabaseName(databaseName)}"`)
        }
    } finally {
        await client.end()
    }
}

async function dropTargetDatabase(databaseUrl, databaseName) {
    const client = await getAdminClient(databaseUrl)
    await client.connect()

    try {
        const safeName = safeDatabaseName(databaseName)

        await client.query(
            `
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1
                  AND pid <> pg_backend_pid()
            `,
            [safeName],
        )
        await client.query(`DROP DATABASE IF EXISTS "${safeName}"`)
    } finally {
        await client.end()
    }
}

async function assertTargetDatabaseIsEmpty(targetClient) {
    const [
        users,
        restaurants,
        platformControls,
        reviews,
        batches,
        items,
        sources,
        runs,
        rawReviews,
        insightRows,
        complaintKeywords,
        auditEvents,
        reviewPublishEvents,
    ] = await Promise.all([
        targetClient.user.count(),
        targetClient.restaurant.count(),
        targetClient.platformControl.count(),
        targetClient.review.count(),
        targetClient.reviewIntakeBatch.count(),
        targetClient.reviewIntakeItem.count(),
        targetClient.reviewCrawlSource.count(),
        targetClient.reviewCrawlRun.count(),
        targetClient.reviewCrawlRawReview.count(),
        targetClient.insightSummary.count(),
        targetClient.complaintKeyword.count(),
        targetClient.auditEvent.count(),
        targetClient.reviewPublishEvent.count(),
    ])

    const occupied = {
        users,
        restaurants,
        platformControls,
        reviews,
        batches,
        items,
        sources,
        runs,
        rawReviews,
        insightRows,
        complaintKeywords,
        auditEvents,
        reviewPublishEvents,
    }

    if (platformControls > 1) {
        throw new Error(
            `Target database must not contain multiple platform control rows before restore. Found platformControls=${platformControls}`,
        )
    }

    const nonZeroEntries = Object.entries(occupied).filter(
        ([key, value]) => key !== 'platformControls' && value > 0,
    )

    if (nonZeroEntries.length > 0) {
        throw new Error(
            `Target database must be empty before restore. Found existing rows: ${nonZeroEntries
                .map(([key, value]) => `${key}=${value}`)
                .join(', ')}`,
        )
    }

    return occupied
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        windowsHide: true,
    })

    if (result.error || result.status !== 0) {
        throw new Error(
            [
                `Command failed: ${command} ${args.join(' ')}`,
                result.error ? String(result.error) : '',
                result.stdout || '',
                result.stderr || '',
            ]
                .filter(Boolean)
                .join('\n'),
        )
    }

    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    }
}

function getNpxCommand() {
    return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function runMigrateDeploy(databaseUrl) {
    return runCommand(
        getNpxCommand(),
        ['prisma', 'migrate', 'deploy'],
        {
            cwd: path.resolve(__dirname, '..'),
            env: {
                ...process.env,
                DATABASE_URL: databaseUrl,
            },
        },
    )
}

async function startServer(databaseUrl, port) {
    const child = spawn(process.execPath, ['src/server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            PORT: String(port),
            LOG_FORMAT: 'json',
            REVIEW_CRAWL_INLINE_QUEUE_MODE: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    let logs = ''
    child.stdout.on('data', (chunk) => {
        logs += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
        logs += chunk.toString()
    })

    const baseUrl = `http://127.0.0.1:${port}`

    try {
        await waitForHttpOk(baseUrl, '/health', 20000)
    } catch (error) {
        child.kill('SIGTERM')
        throw new Error(`${error.message}\n${logs}`)
    }

    return {
        child,
        baseUrl,
        getLogs: () => logs,
    }
}

async function stopServer(serverState) {
    if (!serverState?.child) {
        return
    }

    const child = serverState.child
    const exitPromise = new Promise((resolve) => {
        child.once('exit', resolve)
    })

    child.kill('SIGTERM')
    await Promise.race([exitPromise, wait(10000)])
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const sourceDbUrl = readFlag(args, '--source-db-url') || process.env.DATABASE_URL

    if (!sourceDbUrl) {
        throw new Error('A source database URL is required via --source-db-url or DATABASE_URL')
    }

    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const sourceMode = normalizeSourceMode(readFlag(args, '--source-mode'))
    const explicitTargetDbUrl = readFlag(args, '--target-db-url')
    const explicitTargetDatabase =
        readFlag(args, '--target-database') || readFlag(args, '--target-schema')
    const explicitSmokeUserId = readFlag(args, '--smoke-user-id')
    const keepTargetDatabase =
        hasFlag(args, '--keep-target-database') || hasFlag(args, '--keep-target-schema')
    const restaurantSlugs = readFlags(args, '--restaurant-slug')
    const startedAt = new Date()

    let targets = []
    let smokeUser = null
    let sourcePreparation = null

    if (sourceMode === 'seeded-local') {
        process.stdout.write('Seeding source database for staging-compatible drill...\n')
        const seedSummary = await seedDemoData({ prisma })
        targets = selectSeededTargets(seedSummary, restaurantSlugs)
        smokeUser = await selectSmokeUser(
            prisma,
            targets[0].restaurantId,
            seedSummary.users.userPrimary.id,
        )
        sourcePreparation = {
            mode: sourceMode,
            seeded: true,
            seedUsers: seedSummary.users,
        }
    } else {
        process.stdout.write('Reading existing source database for staging-compatible drill...\n')
        targets = await selectExistingTargets(prisma, restaurantSlugs)
        smokeUser = await selectSmokeUser(
            prisma,
            targets[0].restaurantId,
            explicitSmokeUserId,
        )
        sourcePreparation = {
            mode: sourceMode,
            seeded: false,
            sourceDbUrlProvided: Boolean(readFlag(args, '--source-db-url')),
            smokeUserId: smokeUser.id,
        }
    }

    const sourceSnapshot = await backupSourceSlice(prisma, targets, {
        explicitUserIds: smokeUser ? [smokeUser.id] : [],
        includePlatformControls: true,
    })
    const sourceDigest = createDigest(sourceSnapshot)
    const sourceState = await summarizeState(
        prisma,
        targets.map((target) => target.restaurantId),
    )
    const snapshotSmokeUser = sourceSnapshot.users.find(
        (user) => user.id === smokeUser?.id,
    )

    if (!snapshotSmokeUser) {
        throw new Error('Smoke user was not found in the backup slice')
    }

    let targetDatabase = null
    let targetDbUrl = null
    let createdShadowDatabase = false

    if (explicitTargetDbUrl) {
        targetDbUrl = explicitTargetDbUrl
        targetDatabase = parseDatabaseFromUrl(targetDbUrl)

        if (
            explicitTargetDatabase &&
            targetDatabase.toLowerCase() !== explicitTargetDatabase.toLowerCase()
        ) {
            throw new Error(
                `target-db-url database "${targetDatabase}" does not match --target-database "${explicitTargetDatabase}"`,
            )
        }
    } else {
        targetDatabase = safeDatabaseName(
            explicitTargetDatabase || buildShadowDatabaseName(),
        )
        targetDbUrl = applyDatabaseToUrl(sourceDbUrl, targetDatabase)
        createdShadowDatabase = true
    }

    if (normalizeDatabaseIdentity(sourceDbUrl) === normalizeDatabaseIdentity(targetDbUrl)) {
        throw new Error('Target database must be different from the source database')
    }

    process.stdout.write(`Preparing target database ${targetDatabase}...\n`)
    if (createdShadowDatabase) {
        await ensureTargetDatabase(sourceDbUrl, targetDatabase)
    }

    process.stdout.write('Applying Prisma migrations to the target database...\n')
    const migrateResult = runMigrateDeploy(targetDbUrl)

    const targetClient = createScopedPrismaClient(targetDbUrl)
    let targetServer = null
    let rollbackServer = null

    try {
        await assertTargetDatabaseIsEmpty(targetClient)

        process.stdout.write('Restoring backup slice into the target database...\n')
        await restoreSeededSlice(targetClient, sourceSnapshot)

        const targetSnapshot = await backupSourceSlice(targetClient, targets, {
            explicitUserIds: [snapshotSmokeUser.id],
            includePlatformControls: true,
        })
        const targetDigest = createDigest(targetSnapshot)

        if (sourceDigest !== targetDigest) {
            throw new Error(
                `Target restore digest mismatch. source=${sourceDigest} target=${targetDigest}`,
            )
        }

        const basePort = Number.parseInt(readFlag(args, '--port') || '', 10)
        const targetPort = Number.isNaN(basePort) ? await getFreePort() : basePort
        const rollbackPort = Number.isNaN(basePort) ? await getFreePort() : basePort + 1

        process.stdout.write('Booting the backend against the restored target database...\n')
        targetServer = await startServer(targetDbUrl, targetPort)
        const targetHttpSmoke = await captureSmokeSuite(
            targetServer.baseUrl,
            snapshotSmokeUser,
            targets[0].restaurantId,
        )

        process.stdout.write('Rehearsing rollback against the source database...\n')
        rollbackServer = await startServer(sourceDbUrl, rollbackPort)
        const rollbackHttpSmoke = await captureSmokeSuite(
            rollbackServer.baseUrl,
            snapshotSmokeUser,
            targets[0].restaurantId,
        )

        const targetState = await summarizeState(
            targetClient,
            targets.map((target) => target.restaurantId),
        )

        const finishedAt = new Date()
        const report = {
            benchmark: {
                startedAt,
                finishedAt,
                durationMs: finishedAt.getTime() - startedAt.getTime(),
                mode: 'shadow_database_staging_recovery_drill',
                sourceMode,
                sourceDatabase: parseDatabaseFromUrl(sourceDbUrl),
                targetDatabase,
                targetDatabaseUrlProvided: Boolean(explicitTargetDbUrl),
                createdShadowDatabase,
                keepTargetDatabase,
            },
            sourcePreparation,
            backup: {
                summary: summarizeBackup(sourceSnapshot),
                sourceDigest,
                targetDigest,
                sourceState,
                targetState,
            },
            restore: {
                migrationsApplied: true,
                restoredMatchesSource: sourceDigest === targetDigest,
                prismaMigrateDeploy: {
                    stdout: migrateResult.stdout.trim(),
                    stderr: migrateResult.stderr.trim(),
                },
            },
            healthAndSmoke: {
                target: targetHttpSmoke,
                rollback: rollbackHttpSmoke,
            },
            notes: [
                sourceMode === 'seeded-local'
                    ? 'This drill restores a seeded demo backup slice into a separately migrated Postgres database and verifies backend health plus authenticated read routes there.'
                    : 'This drill copies an explicit restaurant slice from an existing source database into a separately migrated Postgres target and verifies backend health plus authenticated read routes there.',
                'Rollback in this drill means falling back to the original source database URL after the target smoke completes. It is a shadow-database rollback rehearsal, not an infrastructure deploy rollback.',
                'This proof now includes durable audit rows, platform controls, and review publish-lineage rows inside the restored slice.',
                'Real deployed staging proof and managed backup or rollback controls are still required separately.',
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

        process.stdout.write(
            `${JSON.stringify(
                {
                    sourceDigest,
                    targetDigest,
                    restoredMatchesSource: sourceDigest === targetDigest,
                    targetDatabase,
                },
                null,
                2,
            )}\n`,
        )
        process.stdout.write(`Staging-compatible drill report written to ${resolvedOutputPath}\n`)
    } finally {
        await stopServer(targetServer)
        await stopServer(rollbackServer)
        await targetClient.$disconnect()

        if (!keepTargetDatabase && createdShadowDatabase) {
            await dropTargetDatabase(sourceDbUrl, targetDatabase)
        }
    }
}

main()
    .catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.disconnect()
    })

