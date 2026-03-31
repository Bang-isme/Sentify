const { z } = require('zod')
const { requiredUuid } = require('../../lib/validation')

const accountStateEnum = z.enum(['ACTIVE', 'LOCKED', 'DEACTIVATED'])
const accountActionEnum = z.enum(['LOCK', 'UNLOCK', 'DEACTIVATE', 'REACTIVATE'])
const roleEnum = z.enum(['USER', 'ADMIN'])

const optionalTrimmedString = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))

const uuid = requiredUuid()

const listUsersQuerySchema = z.object({
    search: optionalTrimmedString,
    role: roleEnum.optional(),
    accountState: accountStateEnum.optional(),
})

const updateUserRoleSchema = z.object({
    role: roleEnum,
})

const createUserSchema = z.object({
    email: z.string().trim().email(),
    fullName: z.string().trim().min(1).max(120),
    role: roleEnum.default('USER'),
    password: z.string().min(8).max(128),
    restaurantId: uuid.optional(),
})

const updateUserAccountStateSchema = z.object({
    action: accountActionEnum,
})

const listMembershipsQuerySchema = z.object({
    userId: uuid.optional(),
    restaurantId: uuid.optional(),
})

const createMembershipSchema = z.object({
    userId: uuid,
    restaurantId: uuid,
})

module.exports = {
    createUserSchema,
    createMembershipSchema,
    listMembershipsQuerySchema,
    listUsersQuerySchema,
    updateUserAccountStateSchema,
    updateUserRoleSchema,
}
