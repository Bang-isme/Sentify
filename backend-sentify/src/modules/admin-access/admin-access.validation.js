const { z } = require('zod')

const accountStateEnum = z.enum(['ACTIVE', 'LOCKED'])
const roleEnum = z.enum(['USER', 'ADMIN'])

const optionalTrimmedString = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))

const uuid = z.string().uuid()

const listUsersQuerySchema = z.object({
    search: optionalTrimmedString,
    role: roleEnum.optional(),
    accountState: accountStateEnum.optional(),
})

const updateUserRoleSchema = z.object({
    role: roleEnum,
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
    createMembershipSchema,
    listMembershipsQuerySchema,
    listUsersQuerySchema,
    updateUserRoleSchema,
}
