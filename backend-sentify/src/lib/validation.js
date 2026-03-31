const { z } = require('zod')

function requiredUuid(fieldName = 'id') {
    return z.string().uuid(`${fieldName} must be a valid UUID`)
}

module.exports = {
    requiredUuid,
}
