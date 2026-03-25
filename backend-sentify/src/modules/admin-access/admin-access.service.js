const { conflict, forbidden, notFound } = require('../../lib/app-error')
const prisma = require('../../lib/prisma')
const { INTERNAL_OPERATOR_ROLES } = require('../../lib/user-roles')
const { requestPasswordReset } = require('../../services/password-reset.service')
const { ensureRestaurantExists } = require('../../services/restaurant-access.service')
const { getUserRoleAccess } = require('../../services/user-access.service')

function buildTransaction(prismaClient, operations) {
    if (typeof prismaClient.$transaction === 'function') {
        return prismaClient.$transaction(operations)
    }

    return Promise.all(operations)
}

async function ensureAdminAccess(userId) {
    return getUserRoleAccess({
        userId,
        allowedRoles: INTERNAL_OPERATOR_ROLES,
    })
}

function buildUserAccountState(lockedUntil, now = new Date()) {
    if (lockedUntil && lockedUntil > now) {
        return 'LOCKED'
    }

    return 'ACTIVE'
}

function countActiveRefreshTokens(refreshTokens = [], now = new Date()) {
    return refreshTokens.filter((token) => !token.revokedAt && token.expiresAt > now).length
}

function countPendingPasswordResetTokens(passwordResetTokens = [], now = new Date()) {
    return passwordResetTokens.filter((token) => !token.usedAt && token.expiresAt > now).length
}

function mapUserSummary(user, now = new Date()) {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountState: buildUserAccountState(user.lockedUntil, now),
        restaurantCount: user.restaurants?.length ?? user._count?.restaurants ?? 0,
        activeSessionCount: countActiveRefreshTokens(user.refreshTokens, now),
        pendingPasswordResetCount: countPendingPasswordResetTokens(
            user.passwordResetTokens,
            now,
        ),
        createdIntakeBatchCount: user._count?.intakeBatches ?? 0,
        requestedCrawlRunCount: user._count?.requestedCrawlRuns ?? 0,
        failedLoginCount: user.failedLoginCount ?? 0,
        tokenVersion: user.tokenVersion ?? 0,
        lastLoginAt: user.lastLoginAt ?? null,
        lockedUntil: user.lockedUntil ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

function mapMembership(membership) {
    return {
        id: membership.id,
        createdAt: membership.createdAt,
        user: {
            id: membership.user.id,
            email: membership.user.email,
            fullName: membership.user.fullName,
            role: membership.user.role,
        },
        restaurant: {
            id: membership.restaurant.id,
            name: membership.restaurant.name,
            slug: membership.restaurant.slug,
            address: membership.restaurant.address ?? null,
            googleMapUrl: membership.restaurant.googleMapUrl ?? null,
        },
    }
}

function buildUserWhereClause({ search, role, accountState }) {
    const clauses = []
    const now = new Date()

    if (search) {
        clauses.push({
            OR: [
            {
                email: {
                    contains: search,
                    mode: 'insensitive',
                },
            },
            {
                fullName: {
                    contains: search,
                    mode: 'insensitive',
                },
            },
            ],
        })
    }

    if (role) {
        clauses.push({
            role,
        })
    }

    if (accountState === 'LOCKED') {
        clauses.push({
            lockedUntil: {
                gt: now,
            },
        })
    }

    if (accountState === 'ACTIVE') {
        clauses.push({
            OR: [
                {
                    lockedUntil: null,
                },
                {
                    lockedUntil: {
                        lte: now,
                    },
                },
            ],
        })
    }

    if (clauses.length === 0) {
        return {}
    }

    if (clauses.length === 1) {
        return clauses[0]
    }

    return {
        AND: clauses,
    }
}

async function listAdminUsers({ userId, filters }) {
    await ensureAdminAccess(userId)
    const now = new Date()
    const where = buildUserWhereClause(filters || {})

    const [users, totalUsers, adminCount, userCount, lockedUserCount, membershipCount] =
        await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    restaurants: {
                        select: {
                            id: true,
                        },
                    },
                    refreshTokens: {
                        select: {
                            id: true,
                            revokedAt: true,
                            expiresAt: true,
                        },
                    },
                    passwordResetTokens: {
                        select: {
                            id: true,
                            usedAt: true,
                            expiresAt: true,
                        },
                    },
                    _count: {
                        select: {
                            intakeBatches: true,
                            requestedCrawlRuns: true,
                        },
                    },
                },
                orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.user.count(),
            prisma.user.count({
                where: {
                    role: 'ADMIN',
                },
            }),
            prisma.user.count({
                where: {
                    role: 'USER',
                },
            }),
            prisma.user.count({
                where: {
                    lockedUntil: {
                        gt: now,
                    },
                },
            }),
            prisma.restaurantUser.count(),
        ])

    return {
        summary: {
            totalUsers,
            adminCount,
            userCount,
            lockedUserCount,
            membershipCount,
            visibleUsers: users.length,
        },
        filters: {
            search: filters?.search ?? null,
            role: filters?.role ?? null,
            accountState: filters?.accountState ?? null,
        },
        users: users.map((user) => mapUserSummary(user, now)),
    }
}

async function ensureTargetUserExists(targetUserId) {
    const user = await prisma.user.findUnique({
        where: {
            id: targetUserId,
        },
        include: {
            restaurants: {
                include: {
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            address: true,
                            googleMapUrl: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            },
            refreshTokens: {
                select: {
                    id: true,
                    revokedAt: true,
                    expiresAt: true,
                },
            },
            passwordResetTokens: {
                select: {
                    id: true,
                    usedAt: true,
                    expiresAt: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            },
            _count: {
                select: {
                    intakeBatches: true,
                    requestedCrawlRuns: true,
                },
            },
        },
    })

    if (!user) {
        throw notFound('NOT_FOUND', 'User not found')
    }

    return user
}

async function getAdminUserDetail({ userId, targetUserId }) {
    const actingUser = await ensureAdminAccess(userId)
    const now = new Date()
    const user = await ensureTargetUserExists(targetUserId)

    const [recentIntakeBatches, recentCrawlRuns] = await Promise.all([
        prisma.reviewIntakeBatch.findMany({
            where: {
                createdByUserId: targetUserId,
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
        }),
        prisma.reviewCrawlRun.findMany({
            where: {
                requestedByUserId: targetUserId,
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: {
                queuedAt: 'desc',
            },
            take: 5,
        }),
    ])

    return {
        user: {
            ...mapUserSummary(user, now),
            canEditRole: actingUser.id !== user.id,
            availableRoleTargets: ['USER', 'ADMIN'],
            roleChangePolicy:
                'Changing a user to ADMIN removes restaurant memberships because admins use the control-plane only.',
        },
        memberships: (user.restaurants || []).map((membership) =>
            mapMembership({
                ...membership,
                user,
            }),
        ),
        security: {
            activeSessionCount: countActiveRefreshTokens(user.refreshTokens, now),
            pendingPasswordResetCount: countPendingPasswordResetTokens(
                user.passwordResetTokens,
                now,
            ),
            failedLoginCount: user.failedLoginCount,
            tokenVersion: user.tokenVersion,
            lastLoginAt: user.lastLoginAt ?? null,
            lockedUntil: user.lockedUntil ?? null,
        },
        recentIntakeBatches: recentIntakeBatches.map((batch) => ({
            id: batch.id,
            title: batch.title ?? null,
            status: batch.status,
            sourceType: batch.sourceType,
            createdAt: batch.createdAt,
            publishedAt: batch.publishedAt ?? null,
            restaurant: batch.restaurant,
        })),
        recentCrawlRuns: recentCrawlRuns.map((run) => ({
            id: run.id,
            status: run.status,
            strategy: run.strategy,
            priority: run.priority,
            queuedAt: run.queuedAt,
            finishedAt: run.finishedAt ?? null,
            restaurant: run.restaurant,
        })),
    }
}

async function updateAdminUserRole({ userId, targetUserId, role }) {
    const actingUser = await ensureAdminAccess(userId)
    const targetUser = await ensureTargetUserExists(targetUserId)

    if (actingUser.id === targetUser.id && role !== targetUser.role) {
        throw forbidden(
            'ADMIN_SELF_ROLE_CHANGE_FORBIDDEN',
            'Admins cannot change their own role',
        )
    }

    if (targetUser.role === 'ADMIN' && role === 'USER') {
        const adminCount = await prisma.user.count({
            where: {
                role: 'ADMIN',
            },
        })

        if (adminCount <= 1) {
            throw conflict(
                'LAST_ADMIN_ROLE_CHANGE_FORBIDDEN',
                'At least one ADMIN account must remain',
            )
        }
    }

    const operations = []

    if (role === 'ADMIN') {
        operations.push(
            prisma.restaurantUser.deleteMany({
                where: {
                    userId: targetUserId,
                },
            }),
        )
    }

    operations.push(
        prisma.user.update({
            where: {
                id: targetUserId,
            },
            data: {
                role,
            },
        }),
    )

    await buildTransaction(prisma, operations)

    return getAdminUserDetail({
        userId,
        targetUserId,
    })
}

async function triggerAdminPasswordReset({ userId, targetUserId }) {
    await ensureAdminAccess(userId)
    const targetUser = await prisma.user.findUnique({
        where: {
            id: targetUserId,
        },
        select: {
            id: true,
            email: true,
            fullName: true,
        },
    })

    if (!targetUser) {
        throw notFound('NOT_FOUND', 'User not found')
    }

    const result = await requestPasswordReset(targetUser.email)

    return {
        user: {
            id: targetUser.id,
            email: targetUser.email,
            fullName: targetUser.fullName,
        },
        ...result,
    }
}

async function listMemberships({ userId, filters }) {
    await ensureAdminAccess(userId)

    const where = {
        ...(filters?.userId
            ? {
                  userId: filters.userId,
              }
            : {}),
        ...(filters?.restaurantId
            ? {
                  restaurantId: filters.restaurantId,
              }
            : {}),
    }

    const [memberships, totalMemberships, users, restaurants] = await Promise.all([
        prisma.restaurantUser.findMany({
            where,
            include: {
                user: {
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
                        address: true,
                        googleMapUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        }),
        prisma.restaurantUser.count(),
        prisma.user.findMany({
            where: {
                role: 'USER',
            },
            include: {
                _count: {
                    select: {
                        restaurants: true,
                    },
                },
            },
            orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
        }),
        prisma.restaurant.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        }),
    ])

    return {
        summary: {
            totalMemberships,
            visibleMemberships: memberships.length,
            userCount: users.length,
            restaurantCount: restaurants.length,
        },
        filters: {
            userId: filters?.userId ?? null,
            restaurantId: filters?.restaurantId ?? null,
        },
        memberships: memberships.map((membership) => mapMembership(membership)),
        users: users.map((user) => ({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            restaurantCount: user._count.restaurants,
        })),
        restaurants: restaurants.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            address: restaurant.address ?? null,
            googleMapUrl: restaurant.googleMapUrl ?? null,
            memberCount: restaurant._count.users,
        })),
    }
}

async function createMembership({ userId, input }) {
    await ensureAdminAccess(userId)
    const targetUser = await prisma.user.findUnique({
        where: {
            id: input.userId,
        },
        select: {
            id: true,
            role: true,
        },
    })

    if (!targetUser) {
        throw notFound('NOT_FOUND', 'User not found')
    }

    if (targetUser.role !== 'USER') {
        throw conflict(
            'MEMBERSHIP_USER_ROLE_INVALID',
            'Only USER accounts can be assigned to restaurants',
        )
    }

    await ensureRestaurantExists({
        restaurantId: input.restaurantId,
    })

    const membership = await prisma.restaurantUser.create({
        data: {
            userId: input.userId,
            restaurantId: input.restaurantId,
        },
        include: {
            user: {
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
                    address: true,
                    googleMapUrl: true,
                },
            },
        },
    })

    return {
        membership: mapMembership(membership),
    }
}

async function deleteMembership({ userId, membershipId }) {
    await ensureAdminAccess(userId)
    const membership = await prisma.restaurantUser.findUnique({
        where: {
            id: membershipId,
        },
        include: {
            user: {
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
                    address: true,
                    googleMapUrl: true,
                },
            },
        },
    })

    if (!membership) {
        throw notFound('NOT_FOUND', 'Membership not found')
    }

    await prisma.restaurantUser.delete({
        where: {
            id: membershipId,
        },
    })

    return {
        membership: mapMembership(membership),
    }
}

module.exports = {
    createMembership,
    deleteMembership,
    getAdminUserDetail,
    listAdminUsers,
    listMemberships,
    triggerAdminPasswordReset,
    updateAdminUserRole,
}
