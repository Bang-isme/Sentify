const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const ADMIN_ID = '66666666-6666-4666-8666-666666666666'
const USER_ID = '77777777-7777-4777-8777-777777777777'
const RESTAURANT_ID = '88888888-8888-4888-8888-888888888888'

function createAdminPlatformPrismaOverrides() {
    const platformControl = {
        id: 'platform',
        crawlQueueWritesEnabled: true,
        crawlMaterializationEnabled: true,
        intakePublishEnabled: true,
        note: null,
        updatedByUserId: null,
        createdAt: new Date('2026-03-25T00:00:00Z'),
        updatedAt: new Date('2026-03-25T00:00:00Z'),
    }

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
            platformControl,
        },
    }
}

test('admin platform endpoints expose health, policies, controls, and audit history', async (t) => {
    const { prismaOverrides, state } = createAdminPlatformPrismaOverrides()
    const { server } = await startApp(prismaOverrides)

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

    const updateControlsResponse = await request(
        server,
        'PATCH',
        '/api/admin/platform/controls',
        {
            token: auth,
            body: {
                crawlQueueWritesEnabled: false,
                note: 'Maintenance window',
            },
        },
    )
    assert.equal(updateControlsResponse.status, 200)
    assert.equal(updateControlsResponse.body.data.controls.crawlQueueWritesEnabled, false)
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
                note: null,
                updatedByUserId: null,
                createdAt: new Date('2026-03-25T00:00:00Z'),
                updatedAt: new Date('2026-03-25T00:00:00Z'),
            }),
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: USER_ID, tokenVersion: 0 })
    const response = await request(server, 'GET', '/api/admin/platform/health-jobs', {
        token: auth,
    })
    assert.equal(response.status, 403)
})
