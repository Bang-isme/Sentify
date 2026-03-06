const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const { conflict, unauthorized } = require('../lib/app-error')
const prisma = require('../lib/prisma')

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60
const PASSWORD_SALT_ROUNDS = 12

function getJwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured')
    }

    return process.env.JWT_SECRET
}

function buildAccessToken(userId) {
    return jwt.sign({ userId }, getJwtSecret(), {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    })
}

function normalizeEmail(email) {
    return email.trim().toLowerCase()
}

function mapRestaurants(memberships) {
    return memberships.map((membership) => ({
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
        permission: membership.permission,
    }))
}

async function register(input) {
    const email = normalizeEmail(input.email)
    const existingUser = await prisma.user.findUnique({
        where: { email },
    })

    if (existingUser) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'Email already exists')
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS)
    const user = await prisma.user.create({
        data: {
            email,
            fullName: input.fullName.trim(),
            passwordHash,
        },
    })

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
        },
        accessToken: buildAccessToken(user.id),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }
}

async function login(input) {
    const email = normalizeEmail(input.email)
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            restaurants: {
                include: {
                    restaurant: true,
                },
            },
        },
    })

    if (!user) {
        throw unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)

    if (!isPasswordValid) {
        throw unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    return {
        accessToken: buildAccessToken(user.id),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            restaurants: mapRestaurants(user.restaurants),
        },
    }
}

module.exports = {
    register,
    login,
}
