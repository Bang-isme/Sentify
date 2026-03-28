const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const ADMIN_ID = '66666666-6666-4666-8666-666666666666'
const USER_ID = '77777777-7777-4777-8777-777777777777'
const RESTAURANT_ID = '88888888-8888-4888-8888-888888888888'
const MANAGED_RELEASE_EVIDENCE_PATH = path.resolve(
    __dirname,
    '../load-reports/managed-release-evidence.json',
)
const MANAGED_SIGNOFF_PREFLIGHT_PATH = path.resolve(
    __dirname,
    '../load-reports/managed-signoff-preflight.json',
)
const LOCAL_PROOF_ARTIFACTS = {
    merchantReadLoad: path.resolve(
        __dirname,
        '../load-reports/merchant-reads-smb-local.json',
    ),
    crawlQueueSmoke: path.resolve(
        __dirname,
        '../load-reports/review-crawl-queue-smoke-redis-local.json',
    ),
    operatorDraftSmoke: path.resolve(
        __dirname,
        '../load-reports/review-ops-sync-draft-smoke-redis-local.json',
    ),
    shadowRecovery: path.resolve(
        __dirname,
        '../load-reports/staging-recovery-drill-local.json',
    ),
    logicalRecovery: path.resolve(
        __dirname,
        '../load-reports/backend-recovery-drill-local.json',
    ),
}

function captureFileState(filePath) {
    if (!fs.existsSync(filePath)) {
        return {
            exists: false,
        }
    }

    const stats = fs.statSync(filePath)

    return {
        exists: true,
        content: fs.readFileSync(filePath, 'utf8'),
        mtime: stats.mtime,
    }
}

function restoreFileState(filePath, state) {
    if (!state?.exists) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }

        return
    }

    fs.mkdirSync(path.dirname(filePath), {
        recursive: true,
    })
    fs.writeFileSync(filePath, state.content)
    fs.utimesSync(filePath, state.mtime, state.mtime)
}

function writeJsonArtifact(filePath, payload, updatedAt) {
    fs.mkdirSync(path.dirname(filePath), {
        recursive: true,
    })
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2))

    if (updatedAt) {
        const timestamp = new Date(updatedAt)
        fs.utimesSync(filePath, timestamp, timestamp)
    }
}

function createReviewCrawlRuntimeModuleOverrides() {
    return {
        '../src/modules/review-crawl/review-crawl.queue': {
            getRedisConnection: () => null,
            getReviewCrawlQueueHealth: async () => ({
                configured: true,
                counts: {
                    waiting: 1,
                    active: 0,
                    completed: 2,
                    failed: 0,
                    delayed: 0,
                },
            }),
            isInlineQueueMode: () => false,
        },
        '../src/modules/review-crawl/review-crawl.runtime': {
            readReviewCrawlWorkerHealth: async () => ({
                configured: true,
                scheduler: {
                    lastHeartbeatAt: new Date('2026-03-26T00:59:30Z').toISOString(),
                },
                processors: [
                    {
                        workerId: 'worker-1',
                        lastHeartbeatAt: new Date('2026-03-26T00:59:45Z').toISOString(),
                    },
                ],
            }),
        },
    }
}

function createAdminPlatformPrismaOverrides() {
    const platformControl = {
        id: 'platform',
        crawlQueueWritesEnabled: true,
        crawlMaterializationEnabled: true,
        intakePublishEnabled: true,
        sourceSubmissionAutoBootstrapEnabled: true,
        sourceSubmissionAutoBootstrapMaxPerTick: 20,
        note: null,
        updatedByUserId: null,
        createdAt: new Date('2026-03-25T00:00:00Z'),
        updatedAt: new Date('2026-03-25T00:00:00Z'),
    }
    const auditEvents = []

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === ADMIN_ID) {
                    return {
                        id: ADMIN_ID,
                        email: 'admin@sentify.local',
                        fullName: 'Admin One',
                        role: 'ADMIN',
                        tokenVersion: 0,
                        lockedUntil: null,
                        manuallyLockedAt: null,
                        deactivatedAt: null,
                    }
                }

                return null
            },
            count: async ({ where } = {}) => {
                if (where?.role === 'ADMIN') {
                    return 1
                }

                if (where?.role === 'USER') {
                    return 2
                }

                return 3
            },
            findMany: async () => [
                {
                    id: USER_ID,
                    email: 'member@sentify.local',
                    fullName: 'Morgan Member',
                    role: 'USER',
                    createdAt: new Date('2026-03-21T00:00:00Z'),
                },
            ],
        },
        restaurant: {
            count: async ({ where } = {}) => {
                if (where?.googleMapUrl?.not === null) {
                    return 2
                }

                return 2
            },
        },
        restaurantUser: {
            count: async () => 2,
            findMany: async () => [
                {
                    id: 'membership-1',
                    createdAt: new Date('2026-03-22T00:00:00Z'),
                    user: {
                        id: USER_ID,
                        email: 'member@sentify.local',
                        fullName: 'Morgan Member',
                        role: 'USER',
                    },
                    restaurant: {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                    },
                },
            ],
        },
        reviewCrawlSource: {
            count: async ({ where } = {}) => {
                if (where?.status === 'ACTIVE') {
                    return 1
                }

                if (where?.status === 'DISABLED') {
                    return 0
                }

                return 1
            },
            findMany: async () => [
                {
                    id: 'source-1',
                    provider: 'GOOGLE_MAPS',
                    canonicalCid: 'cid-1',
                    placeName: 'Cafe One',
                    status: 'ACTIVE',
                    syncEnabled: true,
                    updatedAt: new Date('2026-03-24T00:00:00Z'),
                    restaurant: {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                    },
                },
            ],
        },
        reviewCrawlRun: {
            count: async ({ where } = {}) => {
                if (where?.status === 'QUEUED') {
                    return 1
                }

                if (where?.status === 'RUNNING') {
                    return 0
                }

                if (where?.status === 'FAILED') {
                    return 0
                }

                if (where?.status?.in) {
                    return 2
                }

                return 0
            },
            findMany: async () => [
                {
                    id: 'run-1',
                    status: 'PARTIAL',
                    strategy: 'INCREMENTAL',
                    priority: 'NORMAL',
                    queuedAt: new Date('2026-03-24T00:00:00Z'),
                    startedAt: new Date('2026-03-24T00:00:05Z'),
                    finishedAt: new Date('2026-03-24T00:02:00Z'),
                    warningCount: 1,
                    extractedCount: 25,
                    validCount: 20,
                    createdAt: new Date('2026-03-24T00:00:00Z'),
                    restaurant: {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                    },
                    requestedBy: {
                        id: ADMIN_ID,
                        email: 'admin@sentify.local',
                        fullName: 'Admin One',
                        role: 'ADMIN',
                    },
                },
            ],
        },
        reviewIntakeBatch: {
            findMany: async () => [
                {
                    id: 'batch-1',
                    title: 'Draft batch',
                    status: 'DRAFT',
                    sourceType: 'GOOGLE_MAPS_CRAWL',
                    createdAt: new Date('2026-03-24T02:00:00Z'),
                    publishedAt: new Date('2026-03-24T03:00:00Z'),
                    createdBy: {
                        id: ADMIN_ID,
                        email: 'admin@sentify.local',
                        fullName: 'Admin One',
                        role: 'ADMIN',
                    },
                    restaurant: {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                    },
                },
            ],
        },
        auditEvent: {
            create: async ({ data }) => {
                const created = {
                    id: `audit-${auditEvents.length + 1}`,
                    action: data.action,
                    resourceType: data.resourceType,
                    resourceId: data.resourceId,
                    summary: data.summary,
                    restaurantId: data.restaurantId ?? null,
                    actorUserId: data.actorUserId ?? null,
                    metadataJson: data.metadataJson ?? {},
                    createdAt: new Date('2026-03-26T01:00:30Z'),
                    actor:
                        data.actorUserId === ADMIN_ID
                            ? {
                                  id: ADMIN_ID,
                                  email: 'admin@sentify.local',
                                  fullName: 'Admin One',
                                  role: 'ADMIN',
                              }
                            : null,
                    restaurant:
                        data.restaurantId === RESTAURANT_ID
                            ? {
                                  id: RESTAURANT_ID,
                                  name: 'Cafe One',
                                  slug: 'cafe-one',
                              }
                            : null,
                }
                auditEvents.unshift(created)
                return created
            },
            findMany: async ({ take }) => auditEvents.slice(0, take),
        },
        platformControl: {
            upsert: async ({ update, create }) => {
                Object.assign(platformControl, create, update, {
                    updatedAt: new Date('2026-03-26T01:00:00Z'),
                })
                return { ...platformControl }
            },
            findMany: async () => [{ ...platformControl }],
        },
    }

    return {
        prismaOverrides,
        state: {
            auditEvents,
            platformControl,
        },
    }
}

test('admin platform endpoints expose health, policies, controls, and audit history', async (t) => {
    const previousManagedReleaseEvidence = fs.existsSync(MANAGED_RELEASE_EVIDENCE_PATH)
        ? fs.readFileSync(MANAGED_RELEASE_EVIDENCE_PATH, 'utf8')
        : null
    const previousManagedSignoffPreflight = fs.existsSync(MANAGED_SIGNOFF_PREFLIGHT_PATH)
        ? fs.readFileSync(MANAGED_SIGNOFF_PREFLIGHT_PATH, 'utf8')
        : null

    fs.mkdirSync(path.dirname(MANAGED_RELEASE_EVIDENCE_PATH), {
        recursive: true,
    })
    fs.writeFileSync(
        MANAGED_RELEASE_EVIDENCE_PATH,
        JSON.stringify(
            {
                overallStatus: 'COMPATIBILITY_PROOF_COMPLETE',
                readiness: {
                    localCompatibilityProofStatus: 'COMPATIBILITY_PROOF_COMPLETE',
                    managedEnvProofStatus: 'MANAGED_SIGNOFF_PENDING',
                    gaps: [
                        'Managed Redis target is local',
                        'Deployed staging API target is local',
                        'Provider-managed Postgres backup/PITR proof artifact is missing',
                    ],
                },
                targets: {
                    managedRedis: {
                        configured: true,
                        scope: 'LOCAL',
                        hostname: '127.0.0.1',
                    },
                    stagingApi: {
                        configured: true,
                        scope: 'LOCAL',
                        hostname: '127.0.0.1',
                    },
                    managedDbProofArtifact: {
                        provided: false,
                        exists: false,
                        path: null,
                        fileName: null,
                    },
                },
            },
            null,
            2,
        ),
    )
    fs.writeFileSync(
        MANAGED_SIGNOFF_PREFLIGHT_PATH,
        JSON.stringify(
            {
                readiness: {
                    status: 'MANAGED_SIGNOFF_PENDING',
                    blockers: [
                        'Managed Redis target is local',
                        'Staging API target is local',
                    ],
                },
            },
            null,
            2,
        ),
    )

    t.after(() => {
        if (previousManagedReleaseEvidence === null) {
            if (fs.existsSync(MANAGED_RELEASE_EVIDENCE_PATH)) {
                fs.unlinkSync(MANAGED_RELEASE_EVIDENCE_PATH)
            }
            return
        }

        fs.writeFileSync(MANAGED_RELEASE_EVIDENCE_PATH, previousManagedReleaseEvidence)
    })
    t.after(() => {
        if (previousManagedSignoffPreflight === null) {
            if (fs.existsSync(MANAGED_SIGNOFF_PREFLIGHT_PATH)) {
                fs.unlinkSync(MANAGED_SIGNOFF_PREFLIGHT_PATH)
            }
            return
        }

        fs.writeFileSync(
            MANAGED_SIGNOFF_PREFLIGHT_PATH,
            previousManagedSignoffPreflight,
        )
    })

    const { prismaOverrides, state } = createAdminPlatformPrismaOverrides()
    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: createReviewCrawlRuntimeModuleOverrides(),
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })

    const healthResponse = await request(server, 'GET', '/api/admin/platform/health-jobs', {
        token: auth,
    })
    assert.equal(healthResponse.status, 200)
    assert.equal(healthResponse.body.data.services.api.status, 'UP')
    assert.equal(healthResponse.body.data.services.database.status, 'SKIPPED')
    assert.equal(healthResponse.body.data.jobs.counts.queued, 1)
    assert.equal(healthResponse.body.data.controls.intakePublishEnabled, true)
    assert.equal(
        typeof healthResponse.body.data.recovery.releaseReadiness.localProofStatus,
        'string',
    )
    assert.equal(
        healthResponse.body.data.recovery.releaseReadiness.compatibilityProofStatus,
        'COMPATIBILITY_PROOF_COMPLETE',
    )
    assert.equal(
        healthResponse.body.data.recovery.releaseReadiness.managedEnvProofStatus,
        'MANAGED_SIGNOFF_PENDING',
    )
    assert.equal(
        healthResponse.body.data.recovery.releaseReadiness.managedProofTargets.managedRedis.scope,
        'LOCAL',
    )
    assert.equal(
        healthResponse.body.data.recovery.releaseReadiness.managedSignoffPreflightStatus,
        'MANAGED_SIGNOFF_PENDING',
    )
    assert.equal(
        healthResponse.body.data.recovery.releaseReadiness.managedSignoffPreflightBlockers.includes(
            'Managed Redis target is local',
        ),
        true,
    )
    assert.equal(Array.isArray(healthResponse.body.data.recovery.proofArtifacts), true)

    const policiesResponse = await request(
        server,
        'GET',
        '/api/admin/platform/integrations-policies',
        { token: auth },
    )
    assert.equal(policiesResponse.status, 200)
    assert.deepEqual(policiesResponse.body.data.roleModel.systemRoles, ['USER', 'ADMIN'])
    assert.equal(policiesResponse.body.data.routeBoundary.adminRole, 'ADMIN')
    assert.equal(policiesResponse.body.data.policies.sourceCoverage.sourceCount, 1)
    assert.equal(
        policiesResponse.body.data.policies.runtimeControls.crawlQueueWritesEnabled,
        true,
    )
    assert.equal(
        policiesResponse.body.data.policies.sourceSubmissionIngress.autoBootstrapEnabled,
        true,
    )
    assert.equal(
        policiesResponse.body.data.policies.sourceSubmissionIngress.autoBootstrapMaxPerTick,
        20,
    )
    assert.equal(
        policiesResponse.body.data.policies.sourceSubmissionIngress.laneRunPriority.PRIORITY,
        'HIGH',
    )

    const updateControlsResponse = await request(
        server,
        'PATCH',
        '/api/admin/platform/controls',
        {
            token: auth,
            body: {
                crawlQueueWritesEnabled: false,
                sourceSubmissionAutoBootstrapEnabled: false,
                sourceSubmissionAutoBootstrapMaxPerTick: 4,
                note: 'Maintenance window',
            },
        },
    )
    assert.equal(updateControlsResponse.status, 200)
    assert.equal(updateControlsResponse.body.data.controls.crawlQueueWritesEnabled, false)
    assert.equal(
        updateControlsResponse.body.data.controls.sourceSubmissionAutoBootstrapEnabled,
        false,
    )
    assert.equal(
        updateControlsResponse.body.data.controls.sourceSubmissionAutoBootstrapMaxPerTick,
        4,
    )
    assert.equal(updateControlsResponse.body.data.controls.note, 'Maintenance window')
    assert.equal(state.platformControl.updatedByUserId, ADMIN_ID)

    const auditResponse = await request(server, 'GET', '/api/admin/platform/audit?limit=10', {
        token: auth,
    })
    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.data.limit, 10)
    assert.ok(auditResponse.body.data.summary.totalEvents >= 1)
    assert.equal(Array.isArray(auditResponse.body.data.items), true)
    assert.equal(
        auditResponse.body.data.items.some(
            (item) => item.action === 'PLATFORM_CONTROLS_UPDATED',
        ),
        true,
    )
})

test('admin platform endpoints stay hidden from non-admin users', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === USER_ID) {
                    return {
                        id: USER_ID,
                        role: 'USER',
                        tokenVersion: 0,
                        lockedUntil: null,
                        manuallyLockedAt: null,
                        deactivatedAt: null,
                    }
                }

                return null
            },
        },
        platformControl: {
            upsert: async () => ({
                id: 'platform',
                crawlQueueWritesEnabled: true,
                crawlMaterializationEnabled: true,
                intakePublishEnabled: true,
                sourceSubmissionAutoBootstrapEnabled: true,
                sourceSubmissionAutoBootstrapMaxPerTick: 20,
                note: null,
                updatedByUserId: null,
                createdAt: new Date('2026-03-25T00:00:00Z'),
                updatedAt: new Date('2026-03-25T00:00:00Z'),
            }),
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: createReviewCrawlRuntimeModuleOverrides(),
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: USER_ID, tokenVersion: 0 })
    const response = await request(server, 'GET', '/api/admin/platform/health-jobs', {
        token: auth,
    })
    assert.equal(response.status, 403)
})

test('admin platform release readiness falls back to managed-signoff preflight when no heavy bundle exists', async (t) => {
    const artifactPaths = [
        MANAGED_RELEASE_EVIDENCE_PATH,
        MANAGED_SIGNOFF_PREFLIGHT_PATH,
        ...Object.values(LOCAL_PROOF_ARTIFACTS),
    ]
    const previousStates = new Map(
        artifactPaths.map((filePath) => [filePath, captureFileState(filePath)]),
    )

    fs.mkdirSync(path.dirname(MANAGED_RELEASE_EVIDENCE_PATH), {
        recursive: true,
    })
    if (fs.existsSync(MANAGED_RELEASE_EVIDENCE_PATH)) {
        fs.unlinkSync(MANAGED_RELEASE_EVIDENCE_PATH)
    }
    writeJsonArtifact(
        MANAGED_SIGNOFF_PREFLIGHT_PATH,
        {
            targets: {
                managedRedis: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'managed.example.internal',
                },
                stagingApi: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'staging.sentify.example',
                },
                managedDbProofArtifact: {
                    provided: true,
                    validationStatus: 'PASSED',
                },
            },
            readiness: {
                status: 'MANAGED_SIGNOFF_READY',
                blockers: [],
            },
        },
        new Date(),
    )
    for (const filePath of Object.values(LOCAL_PROOF_ARTIFACTS)) {
        writeJsonArtifact(filePath, { ok: true }, new Date())
    }

    t.after(() => {
        for (const [filePath, state] of previousStates.entries()) {
            restoreFileState(filePath, state)
        }
    })

    const { prismaOverrides } = createAdminPlatformPrismaOverrides()
    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: createReviewCrawlRuntimeModuleOverrides(),
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })
    const response = await request(server, 'GET', '/api/admin/platform/health-jobs', {
        token: auth,
    })

    assert.equal(response.status, 200)
    assert.equal(
        response.body.data.recovery.releaseReadiness.compatibilityProofStatus,
        'PENDING',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedEnvProofStatus,
        'MANAGED_SIGNOFF_PENDING',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedSignoffPreflightStatus,
        'MANAGED_SIGNOFF_READY',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedEnvGap,
        'Managed sign-off preflight is ready. Run the heavy release-evidence bundle against the external targets to complete sign-off.',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedProofTargets.managedRedis.scope,
        'EXTERNAL',
    )
})

test('admin platform release readiness marks stale proof artifacts as stale instead of complete', async (t) => {
    const artifactPaths = [
        MANAGED_RELEASE_EVIDENCE_PATH,
        MANAGED_SIGNOFF_PREFLIGHT_PATH,
        ...Object.values(LOCAL_PROOF_ARTIFACTS),
    ]
    const previousStates = new Map(
        artifactPaths.map((filePath) => [filePath, captureFileState(filePath)]),
    )

    const staleTimestamp = new Date('2026-03-20T00:00:00.000Z')

    writeJsonArtifact(
        MANAGED_RELEASE_EVIDENCE_PATH,
        {
            overallStatus: 'COMPATIBILITY_PROOF_COMPLETE',
            readiness: {
                localCompatibilityProofStatus: 'COMPATIBILITY_PROOF_COMPLETE',
                managedEnvProofStatus: 'MANAGED_SIGNOFF_COMPLETE',
                gaps: [],
            },
            targets: {
                managedRedis: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'redis.managed.example',
                },
                stagingApi: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'staging.sentify.example',
                },
                managedDbProofArtifact: {
                    provided: true,
                    exists: true,
                    path: '/tmp/managed-proof.json',
                    fileName: 'managed-proof.json',
                },
            },
        },
        staleTimestamp,
    )
    writeJsonArtifact(
        MANAGED_SIGNOFF_PREFLIGHT_PATH,
        {
            readiness: {
                status: 'MANAGED_SIGNOFF_READY',
                blockers: [],
            },
            targets: {
                managedRedis: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'redis.managed.example',
                },
                stagingApi: {
                    configured: true,
                    scope: 'EXTERNAL',
                    hostname: 'staging.sentify.example',
                },
                managedDbProofArtifact: {
                    provided: true,
                    exists: true,
                    path: '/tmp/managed-proof.json',
                    fileName: 'managed-proof.json',
                },
            },
        },
        staleTimestamp,
    )

    for (const filePath of Object.values(LOCAL_PROOF_ARTIFACTS)) {
        writeJsonArtifact(filePath, { ok: true }, staleTimestamp)
    }

    t.after(() => {
        for (const [filePath, state] of previousStates.entries()) {
            restoreFileState(filePath, state)
        }
    })

    const { prismaOverrides } = createAdminPlatformPrismaOverrides()
    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: createReviewCrawlRuntimeModuleOverrides(),
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })
    const response = await request(server, 'GET', '/api/admin/platform/health-jobs', {
        token: auth,
    })

    assert.equal(response.status, 200)
    assert.equal(
        response.body.data.recovery.releaseReadiness.localProofStatus,
        'LOCAL_PROOF_STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.localProofCoverage.staleArtifactKeys.includes(
            'merchantReadLoad',
        ),
        true,
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.compatibilityProofStatus,
        'COMPATIBILITY_PROOF_STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.compatibilityProofFreshnessStatus,
        'STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedEnvProofStatus,
        'MANAGED_SIGNOFF_STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedSignoffPreflightStatus,
        'MANAGED_SIGNOFF_STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedSignoffPreflightFreshnessStatus,
        'STALE',
    )
    assert.equal(
        response.body.data.recovery.releaseReadiness.managedEnvGap.includes(
            'Managed release evidence artifact is stale',
        ),
        true,
    )
})
