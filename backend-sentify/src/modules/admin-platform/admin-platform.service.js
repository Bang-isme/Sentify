const fs = require('node:fs')
const path = require('node:path')

const env = require('../../config/env')
const prisma = require('../../lib/prisma')
const { INTERNAL_OPERATOR_ROLES } = require('../../lib/user-roles')
const { getUserRoleAccess } = require('../../services/user-access.service')
const {
    getRedisConnection,
    getReviewCrawlQueueHealth,
    isInlineQueueMode,
} = require('../review-crawl/review-crawl.queue')
const { readReviewCrawlWorkerHealth } = require('../review-crawl/review-crawl.runtime')
const {
    getPlatformControls,
    updatePlatformControls,
} = require('../../services/platform-control.service')

const REPORT_DIRECTORY = path.resolve(__dirname, '../../../load-reports')
const PROOF_ARTIFACTS = [
    {
        key: 'merchantReadLoad',
        label: 'Merchant reads local load',
        fileName: 'merchant-reads-smb-local.json',
        scope: 'local',
    },
    {
        key: 'crawlQueueSmoke',
        label: 'Review crawl queue smoke',
        fileName: 'review-crawl-queue-smoke-redis-local.json',
        scope: 'local',
    },
    {
        key: 'operatorDraftSmoke',
        label: 'Review ops sync-to-draft smoke',
        fileName: 'review-ops-sync-draft-smoke-redis-local.json',
        scope: 'local',
    },
    {
        key: 'shadowRecovery',
        label: 'Staging recovery drill',
        fileName: 'staging-recovery-drill-local.json',
        scope: 'local',
    },
    {
        key: 'logicalRecovery',
        label: 'Backend recovery drill',
        fileName: 'backend-recovery-drill-local.json',
        scope: 'local',
    },
    {
        key: 'managedReleaseEvidence',
        label: 'Managed release evidence',
        fileName: 'managed-release-evidence.json',
        scope: 'managed',
        required: false,
    },
    {
        key: 'managedSignoffPreflight',
        label: 'Managed sign-off preflight',
        fileName: 'managed-signoff-preflight.json',
        scope: 'managed',
        required: false,
    },
]

const DEFAULT_LOCAL_PROOF_MAX_AGE_HOURS = 24
const DEFAULT_MANAGED_PROOF_MAX_AGE_HOURS = 72
const LOCAL_PROOF_MAX_AGE_MINUTES =
    readPositiveInteger(
        process.env.ADMIN_PLATFORM_LOCAL_PROOF_MAX_AGE_HOURS,
        DEFAULT_LOCAL_PROOF_MAX_AGE_HOURS,
    ) * 60
const MANAGED_PROOF_MAX_AGE_MINUTES =
    readPositiveInteger(
        process.env.ADMIN_PLATFORM_MANAGED_PROOF_MAX_AGE_HOURS,
        DEFAULT_MANAGED_PROOF_MAX_AGE_HOURS,
    ) * 60

function readPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value ?? '', 10)

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getArtifactFreshnessWindowMinutes(artifact) {
    return (artifact.scope || 'local') === 'managed'
        ? MANAGED_PROOF_MAX_AGE_MINUTES
        : LOCAL_PROOF_MAX_AGE_MINUTES
}

function buildArtifactFreshness(updatedAt, freshnessWindowMinutes) {
    if (!updatedAt) {
        return {
            freshnessStatus: 'MISSING',
            ageMinutes: null,
            freshnessWindowMinutes,
            stale: false,
        }
    }

    const updatedAtTimestamp = new Date(updatedAt).getTime()

    if (!Number.isFinite(updatedAtTimestamp)) {
        return {
            freshnessStatus: 'UNKNOWN',
            ageMinutes: null,
            freshnessWindowMinutes,
            stale: true,
        }
    }

    const ageMinutes = Math.max(
        0,
        Math.floor((Date.now() - updatedAtTimestamp) / 60000),
    )
    const stale = ageMinutes > freshnessWindowMinutes

    return {
        freshnessStatus: stale ? 'STALE' : 'FRESH',
        ageMinutes,
        freshnessWindowMinutes,
        stale,
    }
}

function findProofArtifact(proofArtifacts, key) {
    return proofArtifacts.find((artifact) => artifact.key === key) ?? null
}

async function ensureAdminAccess(userId) {
    return getUserRoleAccess({
        userId,
        allowedRoles: INTERNAL_OPERATOR_ROLES,
    })
}

function buildHealthStatus(configured, healthy) {
    if (!configured) {
        return 'UNCONFIGURED'
    }

    return healthy ? 'HEALTHY' : 'DEGRADED'
}

function summarizeProofArtifacts() {
    return PROOF_ARTIFACTS.map((artifact) => {
        const artifactPath = path.join(REPORT_DIRECTORY, artifact.fileName)
        const freshnessWindowMinutes = getArtifactFreshnessWindowMinutes(artifact)

        if (!fs.existsSync(artifactPath)) {
            return {
                key: artifact.key,
                label: artifact.label,
                available: false,
                fileName: artifact.fileName,
                scope: artifact.scope || 'local',
                required: artifact.required !== false,
                updatedAt: null,
                ...buildArtifactFreshness(null, freshnessWindowMinutes),
            }
        }

        const stats = fs.statSync(artifactPath)
        const updatedAt = stats.mtime.toISOString()

        return {
            key: artifact.key,
            label: artifact.label,
            available: true,
            fileName: artifact.fileName,
            scope: artifact.scope || 'local',
            required: artifact.required !== false,
            updatedAt,
            ...buildArtifactFreshness(updatedAt, freshnessWindowMinutes),
        }
    })
}

function readManagedReleaseEvidence() {
    const artifact = PROOF_ARTIFACTS.find((item) => item.key === 'managedReleaseEvidence')

    if (!artifact) {
        return null
    }

    const artifactPath = path.join(REPORT_DIRECTORY, artifact.fileName)

    if (!fs.existsSync(artifactPath)) {
        return null
    }

    try {
        return JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    } catch (error) {
        return {
            overallStatus: 'COMPATIBILITY_PROOF_FAILED',
            readiness: {
                localCompatibilityProofStatus: 'COMPATIBILITY_PROOF_FAILED',
                managedEnvProofStatus: 'MANAGED_SIGNOFF_BLOCKED',
                gaps: ['Managed release evidence artifact could not be parsed'],
            },
        }
    }
}

function readManagedSignoffPreflight() {
    const artifact = PROOF_ARTIFACTS.find((item) => item.key === 'managedSignoffPreflight')

    if (!artifact) {
        return null
    }

    const artifactPath = path.join(REPORT_DIRECTORY, artifact.fileName)

    if (!fs.existsSync(artifactPath)) {
        return null
    }

    try {
        return JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    } catch (_error) {
        return {
            readiness: {
                status: 'MANAGED_SIGNOFF_PENDING',
                blockers: ['Managed sign-off preflight artifact could not be parsed'],
            },
        }
    }
}

function buildReleaseReadiness(proofArtifacts) {
    const requiredLocalArtifacts = proofArtifacts.filter(
        (artifact) => artifact.scope === 'local' && artifact.required,
    )
    const requiredLocalArtifactKeys = requiredLocalArtifacts.map((artifact) => artifact.key)
    const availableKeys = requiredLocalArtifacts
        .filter((artifact) => artifact.available)
        .map((artifact) => artifact.key)
    const missingLocalArtifactKeys = requiredLocalArtifacts
        .filter((artifact) => !artifact.available)
        .map((artifact) => artifact.key)
    const staleLocalArtifactKeys = requiredLocalArtifacts
        .filter((artifact) => artifact.freshnessStatus !== 'FRESH')
        .map((artifact) => artifact.key)
    const freshLocalArtifactKeys = requiredLocalArtifacts
        .filter((artifact) => artifact.freshnessStatus === 'FRESH')
        .map((artifact) => artifact.key)
    const managedReleaseArtifact = findProofArtifact(
        proofArtifacts,
        'managedReleaseEvidence',
    )
    const managedSignoffPreflightArtifact = findProofArtifact(
        proofArtifacts,
        'managedSignoffPreflight',
    )
    const managedReleaseEvidence = readManagedReleaseEvidence()
    const managedSignoffPreflight = readManagedSignoffPreflight()
    const rawCompatibilityProofStatus =
        managedReleaseEvidence?.readiness?.localCompatibilityProofStatus ||
        managedReleaseEvidence?.overallStatus ||
        'PENDING'
    const rawManagedSignoffPreflightStatus =
        managedSignoffPreflight?.readiness?.status || 'PENDING'
    const managedSignoffPreflightBlockers =
        managedSignoffPreflight?.readiness?.blockers ?? []
    const compatibilityProofStatus =
        managedReleaseArtifact?.freshnessStatus === 'STALE' &&
        rawCompatibilityProofStatus !== 'PENDING'
            ? 'COMPATIBILITY_PROOF_STALE'
            : rawCompatibilityProofStatus
    const managedSignoffPreflightStatus =
        managedSignoffPreflightArtifact?.freshnessStatus === 'STALE' &&
        rawManagedSignoffPreflightStatus !== 'PENDING'
            ? 'MANAGED_SIGNOFF_STALE'
            : rawManagedSignoffPreflightStatus
    const managedEnvProofStatus =
        managedReleaseArtifact?.freshnessStatus === 'STALE'
            ? 'MANAGED_SIGNOFF_STALE'
            : !managedReleaseEvidence &&
                managedSignoffPreflightArtifact?.freshnessStatus === 'STALE'
              ? 'MANAGED_SIGNOFF_STALE'
              : managedReleaseEvidence?.readiness?.managedEnvProofStatus ||
                (managedSignoffPreflightStatus === 'MANAGED_SIGNOFF_READY'
                    ? 'MANAGED_SIGNOFF_PENDING'
                    : managedSignoffPreflightStatus) ||
                compatibilityProofStatus ||
                'PENDING'
    const freshnessGaps = []

    if (staleLocalArtifactKeys.length > 0) {
        freshnessGaps.push(
            `Local proof artifacts are stale: ${staleLocalArtifactKeys.join(', ')}`,
        )
    }

    if (managedReleaseArtifact?.freshnessStatus === 'STALE') {
        freshnessGaps.push(
            `Managed release evidence artifact is stale (${managedReleaseArtifact.ageMinutes} minutes old)`,
        )
    }

    if (
        !managedReleaseEvidence &&
        managedSignoffPreflightArtifact?.freshnessStatus === 'STALE'
    ) {
        freshnessGaps.push(
            `Managed sign-off preflight artifact is stale (${managedSignoffPreflightArtifact.ageMinutes} minutes old)`,
        )
    }

    const managedEnvGap =
        freshnessGaps.length > 0
            ? freshnessGaps.join('; ')
            : managedReleaseEvidence
              ? Array.isArray(managedReleaseEvidence?.readiness?.gaps) &&
                managedReleaseEvidence.readiness.gaps.length > 0
                  ? managedReleaseEvidence.readiness.gaps.join('; ')
                  : 'Managed release evidence artifact is present and no open managed-environment gaps were reported.'
              : managedSignoffPreflight
                ? managedSignoffPreflightStatus === 'MANAGED_SIGNOFF_READY'
                    ? 'Managed sign-off preflight is ready. Run the heavy release-evidence bundle against the external targets to complete sign-off.'
                    : managedSignoffPreflightBlockers.join('; ')
                : 'Managed staging or production-like backup, restore, queue, and release evidence has not been verified from this local environment yet.'
    const managedProofTargets =
        managedReleaseEvidence?.targets ?? managedSignoffPreflight?.targets ?? null

    return {
        localProofStatus:
            missingLocalArtifactKeys.length > 0
                ? 'LOCAL_PROOF_PARTIAL'
                : staleLocalArtifactKeys.length > 0
                  ? 'LOCAL_PROOF_STALE'
                  : 'LOCAL_PROOF_COMPLETE',
        localProofCoverage: {
            requiredArtifactKeys: requiredLocalArtifactKeys,
            availableArtifactKeys: availableKeys,
            missingArtifactKeys: missingLocalArtifactKeys,
            freshArtifactKeys: freshLocalArtifactKeys,
            staleArtifactKeys: staleLocalArtifactKeys,
        },
        compatibilityProofStatus,
        compatibilityProofFreshnessStatus:
            managedReleaseArtifact?.freshnessStatus || 'MISSING',
        managedEnvProofStatus,
        managedEnvGap,
        managedProofTargets,
        managedSignoffPreflightStatus,
        managedSignoffPreflightFreshnessStatus:
            managedSignoffPreflightArtifact?.freshnessStatus || 'MISSING',
        managedSignoffPreflightBlockers,
    }
}

async function getDatabaseHealth() {
    if (env.NODE_ENV === 'test' || typeof prisma.$queryRaw !== 'function') {
        return {
            status: 'SKIPPED',
            checkedAt: new Date().toISOString(),
        }
    }

    try {
        await prisma.$queryRaw`SELECT 1`

        return {
            status: 'UP',
            checkedAt: new Date().toISOString(),
        }
    } catch (error) {
        return {
            status: 'DOWN',
            checkedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Database probe failed',
        }
    }
}

function summarizeWorkerHealth(workerHealth) {
    const processorCount = workerHealth.processors?.length ?? 0
    const hasScheduler = Boolean(workerHealth.scheduler)
    const healthy = hasScheduler && processorCount > 0

    return {
        status: buildHealthStatus(workerHealth.configured, healthy),
        configured: workerHealth.configured,
        scheduler: workerHealth.scheduler,
        processors: workerHealth.processors ?? [],
        processorCount,
    }
}

function summarizeQueueHealth(queueHealth) {
    const counts = queueHealth.counts ?? null
    const healthy =
        queueHealth.configured &&
        counts &&
        Number(counts.failed || 0) === 0

    return {
        status: queueHealth.configured
            ? healthy
                ? 'HEALTHY'
                : 'DEGRADED'
            : isInlineQueueMode()
              ? 'INLINE'
              : 'UNCONFIGURED',
        configured: queueHealth.configured,
        inlineMode: isInlineQueueMode(),
        queueName: env.REVIEW_CRAWL_QUEUE_NAME,
        counts,
    }
}

async function getHealthJobs({ userId }) {
    await ensureAdminAccess(userId)

    const redis = getRedisConnection()
    const [
        database,
        queueHealth,
        workerHealth,
        recentRuns,
        queuedCount,
        runningCount,
        failedCount,
        completedCount,
        controls,
    ] = await Promise.all([
        getDatabaseHealth(),
        getReviewCrawlQueueHealth(),
        readReviewCrawlWorkerHealth(redis),
        prisma.reviewCrawlRun.findMany({
            take: 8,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                requestedBy: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        role: true,
                    },
                },
            },
        }),
        prisma.reviewCrawlRun.count({ where: { status: 'QUEUED' } }),
        prisma.reviewCrawlRun.count({ where: { status: 'RUNNING' } }),
        prisma.reviewCrawlRun.count({ where: { status: 'FAILED' } }),
        prisma.reviewCrawlRun.count({
            where: {
                status: {
                    in: ['COMPLETED', 'PARTIAL'],
                },
            },
        }),
        getPlatformControls(),
    ])

    const mappedQueueHealth = summarizeQueueHealth(queueHealth)
    const mappedWorkerHealth = summarizeWorkerHealth(workerHealth)
    const proofArtifacts = summarizeProofArtifacts()

    return {
        generatedAt: new Date().toISOString(),
        services: {
            api: {
                status: 'UP',
                checkedAt: new Date().toISOString(),
                uptimeSeconds: Math.round(process.uptime()),
                nodeEnv: env.NODE_ENV,
            },
            database,
            queue: mappedQueueHealth,
            workers: mappedWorkerHealth,
        },
        jobs: {
            queueName: env.REVIEW_CRAWL_QUEUE_NAME,
            runtimeMode: env.REVIEW_CRAWL_RUNTIME_MODE,
            concurrency: env.REVIEW_CRAWL_WORKER_CONCURRENCY,
            counts: {
                queued: queuedCount,
                running: runningCount,
                failed: failedCount,
                completed: completedCount,
            },
            recentRuns: recentRuns.map((run) => ({
                id: run.id,
                restaurant: run.restaurant,
                requestedBy: run.requestedBy ?? null,
                status: run.status,
                strategy: run.strategy,
                priority: run.priority,
                queuedAt: run.queuedAt,
                startedAt: run.startedAt ?? null,
                finishedAt: run.finishedAt ?? null,
                warningCount: run.warningCount,
                extractedCount: run.extractedCount,
                validCount: run.validCount,
                })),
        },
        controls,
        recovery: {
            proofArtifacts,
            releaseReadiness: buildReleaseReadiness(proofArtifacts),
        },
    }
}

async function getIntegrationsPolicies({ userId }) {
    await ensureAdminAccess(userId)

    const [
        restaurantCount,
        sourceCount,
        activeSourceCount,
        disabledSourceCount,
        googleMapLinkedRestaurants,
        controls,
    ] = await Promise.all([
        prisma.restaurant.count(),
        prisma.reviewCrawlSource.count(),
        prisma.reviewCrawlSource.count({
            where: {
                status: 'ACTIVE',
            },
        }),
        prisma.reviewCrawlSource.count({
            where: {
                status: 'DISABLED',
            },
        }),
        prisma.restaurant.count({
            where: {
                googleMapUrl: {
                    not: null,
                },
            },
        }),
        getPlatformControls(),
    ])

    return {
        generatedAt: new Date().toISOString(),
        roleModel: {
            systemRoles: ['USER', 'ADMIN'],
            restaurantMembershipModel: 'BINARY_MEMBERSHIP',
            membershipPermissions: false,
            adminRequiresRestaurantMembership: false,
            userRequiresRestaurantMembership: true,
        },
        routeBoundary: {
            merchantBasePath: '/api/restaurants',
            adminBasePath: '/api/admin',
            merchantRole: 'USER',
            adminRole: 'ADMIN',
        },
        integrations: [
            {
                key: 'database',
                label: 'PostgreSQL via Prisma',
                status: 'CONFIGURED',
                detail:
                    'Canonical reviews, intake staging, crawl runtime, and auth state live in PostgreSQL.',
            },
            {
                key: 'redisQueue',
                label: 'BullMQ / Redis queue',
                status: env.REDIS_URL
                    ? 'CONFIGURED'
                    : isInlineQueueMode()
                      ? 'INLINE'
                      : 'UNCONFIGURED',
                detail:
                    'Review crawl jobs use BullMQ when Redis is configured and can fall back to inline mode locally.',
            },
            {
                key: 'googleMaps',
                label: 'Google Maps crawl integration',
                status: sourceCount > 0 ? 'ACTIVE' : 'AVAILABLE',
                detail:
                    'Google Maps sources back preview, runtime crawl jobs, and sync-to-draft orchestration.',
            },
            {
                key: 'email',
                label: 'Email provider',
                status: env.EMAIL_PROVIDER === 'console' ? 'LOCAL_ONLY' : 'CONFIGURED',
                detail:
                    'Password reset and admin-issued reset flows use the configured email provider.',
            },
        ],
        policies: {
            sourcePolicy: 'ADMIN_CURATED',
            publishPolicy: 'MANUAL_PUBLISH',
            sourceSubmissionIngress: {
                autoBootstrapEnabled:
                    controls.sourceSubmissionAutoBootstrapEnabled,
                autoBootstrapMaxPerTick:
                    controls.sourceSubmissionAutoBootstrapMaxPerTick,
                laneOrder: ['PRIORITY', 'STANDARD'],
                laneRunPriority: {
                    PRIORITY: 'HIGH',
                    STANDARD: 'NORMAL',
                },
            },
            crawlDefaults: {
                queueName: env.REVIEW_CRAWL_QUEUE_NAME,
                runtimeMode: env.REVIEW_CRAWL_RUNTIME_MODE,
                workerConcurrency: env.REVIEW_CRAWL_WORKER_CONCURRENCY,
                incrementalMaxPages: env.REVIEW_CRAWL_INCREMENTAL_MAX_PAGES,
                backfillMaxPages: env.REVIEW_CRAWL_BACKFILL_MAX_PAGES,
                heartbeatIntervalMs: env.REVIEW_CRAWL_HEARTBEAT_INTERVAL_MS,
                leaseSeconds: env.REVIEW_CRAWL_LEASE_SECONDS,
                schedulerIntervalMs: env.REVIEW_CRAWL_SCHEDULER_INTERVAL_MS,
                failureCooldownMinutes: env.REVIEW_CRAWL_FAILURE_COOLDOWN_MINUTES,
            },
            sourceCoverage: {
                restaurantCount,
                googleMapLinkedRestaurants,
                sourceCount,
                activeSourceCount,
                disabledSourceCount,
                restaurantsWithoutSourceCount: Math.max(restaurantCount - sourceCount, 0),
            },
            runtimeControls: controls,
        },
        environment: {
            nodeEnv: env.NODE_ENV,
            appUrl: env.APP_URL,
            corsOrigins: env.CORS_ORIGINS,
            bodyLimit: env.BODY_LIMIT,
            authCookieSameSite: env.AUTH_COOKIE_SAME_SITE,
            emailProvider: env.EMAIL_PROVIDER,
        },
    }
}

function buildAuditActor(user) {
    if (!user) {
        return null
    }

    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
    }
}

function buildAuditEvent({
    id,
    timestamp,
    action,
    resourceType,
    resourceId,
    restaurant,
    actor,
    summary,
    metadata,
}) {
    return {
        id,
        timestamp,
        action,
        resourceType,
        resourceId,
        restaurant: restaurant
            ? {
                  id: restaurant.id,
                  name: restaurant.name,
                  slug: restaurant.slug,
              }
            : null,
        actor: buildAuditActor(actor),
        summary,
        metadata: metadata ?? {},
    }
}

async function getAuditFeed({ userId, limit = 25 }) {
    await ensureAdminAccess(userId)

    const [auditEvents, users, crawlRuns] = await Promise.all([
        prisma.auditEvent.findMany({
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                actor: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        role: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        }),
        prisma.user.findMany({
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
            },
        }),
        prisma.reviewCrawlRun.findMany({
            take: limit,
            orderBy: {
                queuedAt: 'desc',
            },
            include: {
                requestedBy: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        role: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        }),
    ])

    const events = []

    for (const event of auditEvents) {
        events.push(
            buildAuditEvent({
                id: event.id,
                timestamp: event.createdAt,
                action: event.action,
                resourceType: event.resourceType,
                resourceId: event.resourceId,
                restaurant: event.restaurant ?? null,
                actor: event.actor ?? null,
                summary: event.summary,
                metadata: event.metadataJson ?? {},
            }),
        )
    }

    for (const user of users) {
        events.push(
            buildAuditEvent({
                id: `user-created:${user.id}`,
                timestamp: user.createdAt,
                action: 'USER_CREATED',
                resourceType: 'user',
                resourceId: user.id,
                actor: null,
                restaurant: null,
                summary: `User ${user.email} was created with role ${user.role}.`,
                metadata: {
                    role: user.role,
                },
            }),
        )
    }

    for (const run of crawlRuns) {
        events.push(
            buildAuditEvent({
                id: `crawl-run-queued:${run.id}`,
                timestamp: run.queuedAt,
                action: 'CRAWL_RUN_QUEUED',
                resourceType: 'crawlRun',
                resourceId: run.id,
                actor: run.requestedBy,
                restaurant: run.restaurant,
                summary: `Crawl run ${run.id} was queued with ${run.strategy} strategy.`,
                metadata: {
                    status: run.status,
                    priority: run.priority,
                },
            }),
        )

        if (run.finishedAt) {
            events.push(
                buildAuditEvent({
                    id: `crawl-run-finished:${run.id}`,
                    timestamp: run.finishedAt,
                    action: `CRAWL_RUN_${run.status}`,
                    resourceType: 'crawlRun',
                    resourceId: run.id,
                    actor: null,
                    restaurant: run.restaurant,
                    summary: `Crawl run ${run.id} finished with status ${run.status}.`,
                    metadata: {
                        extractedCount: run.extractedCount,
                        validCount: run.validCount,
                        warningCount: run.warningCount,
                    },
                }),
            )
        }
    }

    const sorted = events
        .filter((event) => Boolean(event.timestamp))
        .sort(
            (left, right) =>
                new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
        )

    const items = sorted.slice(0, limit)
    const summary = items.reduce(
        (accumulator, event) => {
            accumulator.totalEvents += 1
            accumulator.byAction[event.action] =
                (accumulator.byAction[event.action] ?? 0) + 1
            return accumulator
        },
        {
            totalEvents: 0,
            byAction: {},
        },
    )

    return {
        generatedAt: new Date().toISOString(),
        limit,
        summary,
        items,
    }
}

async function updateControls({ userId, input }) {
    await ensureAdminAccess(userId)

    const controls = await updatePlatformControls({
        updatedByUserId: userId,
        changes: input,
    })

    return {
        controls,
    }
}

module.exports = {
    getAuditFeed,
    getHealthJobs,
    getIntegrationsPolicies,
    updateControls,
}
