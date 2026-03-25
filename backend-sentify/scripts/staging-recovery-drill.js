#!/usr/bin/env node

require('dotenv').config()

const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const jwt = require('jsonwebtoken')
const { Client } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

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
            '  --restaurant-slug <slug>   Limit the drill to one or more seeded demo restaurants',
            '  --target-db-url <url>      Optional restore target database URL',
            '  --target-database <name>   Optional restore target database name when a target DB URL is not provided',
            '  --port <n>                 Optional base port override for smoke servers',
            `  --output <file>            Write the summary report JSON (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --keep-target-database     Keep the migrated restore database after the drill',
            '  --help                     Show this help message',
            '',
            'Default behavior:',
            '  The drill seeds the source DB, restores into a shadow database, boots the backend',
            '  against the restored target, verifies health plus read routes, then rehearses',
            '  rollback by booting the backend against the source DB again.',
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

function safeDatabaseName(value) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid database name "${value}"`)
    }

    return value
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

async function backupSeededSlice(sourceClient, seedSummary, targets) {
    const restaurantIds = targets.map((target) => target.restaurantId)
    const restaurants = await sourceClient.restaurant.findMany({
        where: {
            id: {
                in: restaurantIds,
            },
        },
        orderBy: [{ slug: 'asc' }],
    })
    const restaurantUsers = await sourceClient.restaurantUser.findMany({
        where: {
            restaurantId: {
                in: restaurantIds,
            },
        },
        orderBy: [{ restaurantId: 'asc' }, { userId: 'asc' }],
    })
    const batches = await sourceClient.reviewIntakeBatch.findMany({
        where: {
            restaurantId: {
                in: restaurantIds,
            },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const runs = await sourceClient.reviewCrawlRun.findMany({
        where: {
            restaurantId: {
                in: restaurantIds,
            },
        },
        orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }],
    })

    const userIds = [
        ...new Set(
            [
                ...Object.values(seedSummary.users).map((user) => user.id),
                ...restaurantUsers.map((membership) => membership.userId),
                ...batches.map((batch) => batch.createdByUserId),
                ...runs.map((run) => run.requestedByUserId).filter(Boolean),
            ].filter(Boolean),
        ),
    ]

    const sourceIds = [...new Set(runs.map((run) => run.sourceId))]

    const [users, reviews, insightRows, keywords, items, sources, rawReviews] =
        await Promise.all([
            sourceClient.user.findMany({
                where: {
                    id: {
                        in: userIds,
                    },
                },
                orderBy: [{ email: 'asc' }],
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
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            }),
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
        ])

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
    }
}

async function summarizeState(client, restaurantIds) {
    const perRestaurant = []

    for (const restaurantId of restaurantIds) {
        const [coreCounts, intakeItems, crawlSources, rawReviews, complaintKeywords, insightRows] =
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
    }
}

async function restoreSeededSlice(targetClient, snapshot) {
    await targetClient.$transaction(async (tx) => {
        for (const user of snapshot.users) {
            await tx.user.create({
                data: sanitizeRow(user),
            })
        }

        for (const restaurant of snapshot.restaurants) {
            await tx.restaurant.create({
                data: sanitizeRow(restaurant),
            })
        }

        for (const restaurantUser of snapshot.restaurantUsers) {
            await tx.restaurantUser.create({
                data: sanitizeRow(restaurantUser),
            })
        }

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

        for (const insightRow of snapshot.insightRows) {
            await tx.insightSummary.create({
                data: sanitizeRow(insightRow),
            })
        }

        for (const keyword of snapshot.keywords) {
            await tx.complaintKeyword.create({
                data: sanitizeRow(keyword),
            })
        }
    })
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
        reviews,
        batches,
        items,
        sources,
        runs,
        rawReviews,
        insightRows,
        complaintKeywords,
    ] = await Promise.all([
        targetClient.user.count(),
        targetClient.restaurant.count(),
        targetClient.review.count(),
        targetClient.reviewIntakeBatch.count(),
        targetClient.reviewIntakeItem.count(),
        targetClient.reviewCrawlSource.count(),
        targetClient.reviewCrawlRun.count(),
        targetClient.reviewCrawlRawReview.count(),
        targetClient.insightSummary.count(),
        targetClient.complaintKeyword.count(),
    ])

    const occupied = {
        users,
        restaurants,
        reviews,
        batches,
        items,
        sources,
        runs,
        rawReviews,
        insightRows,
        complaintKeywords,
    }

    const nonZeroEntries = Object.entries(occupied).filter(([, value]) => value > 0)

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

    const sourceDbUrl = process.env.DATABASE_URL

    if (!sourceDbUrl) {
        throw new Error('DATABASE_URL is required')
    }

    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const explicitTargetDbUrl = readFlag(args, '--target-db-url')
    const explicitTargetDatabase =
        readFlag(args, '--target-database') || readFlag(args, '--target-schema')
    const keepTargetDatabase =
        hasFlag(args, '--keep-target-database') || hasFlag(args, '--keep-target-schema')
    const restaurantSlugs = readFlags(args, '--restaurant-slug')
    const startedAt = new Date()

    process.stdout.write('Seeding source database for staging-compatible drill...\n')
    const seedSummary = await seedDemoData({ prisma })
    const targets = selectTargets(seedSummary, restaurantSlugs)
    const sourceSnapshot = await backupSeededSlice(prisma, seedSummary, targets)
    const sourceDigest = createDigest(sourceSnapshot)
    const sourceState = await summarizeState(
        prisma,
        targets.map((target) => target.restaurantId),
    )
    const seededUser = sourceSnapshot.users.find(
        (user) => user.id === seedSummary.users.userPrimary.id,
    )

    if (!seededUser) {
        throw new Error('Seeded user was not found in the backup slice')
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

        const targetSnapshot = await backupSeededSlice(targetClient, seedSummary, targets)
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
            seededUser,
            targets[0].restaurantId,
        )

        process.stdout.write('Rehearsing rollback against the source database...\n')
        rollbackServer = await startServer(sourceDbUrl, rollbackPort)
        const rollbackHttpSmoke = await captureSmokeSuite(
            rollbackServer.baseUrl,
            seededUser,
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
                sourceDatabase: parseDatabaseFromUrl(sourceDbUrl),
                targetDatabase,
                targetDatabaseUrlProvided: Boolean(explicitTargetDbUrl),
                createdShadowDatabase,
                keepTargetDatabase,
            },
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
                'This drill restores a seeded demo backup slice into a separately migrated Postgres database and verifies backend health plus authenticated read routes there.',
                'Rollback in this drill means falling back to the original source database URL after the target smoke completes. It is a shadow-database rollback rehearsal, not an infrastructure deploy rollback.',
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

