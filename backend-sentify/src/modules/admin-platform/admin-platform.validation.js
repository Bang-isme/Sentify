const { z } = require('zod')

const listAuditQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(25),
})

module.exports = {
    listAuditQuerySchema,
}
