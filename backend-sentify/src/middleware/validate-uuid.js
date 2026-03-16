const { badRequest } = require('../lib/app-error')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUuidParam(paramName = 'id') {
    return (req, res, next) => {
        const value = req.params[paramName]

        if (!value || !UUID_RE.test(value)) {
            throw badRequest(
                'INVALID_ID',
                `Parameter "${paramName}" must be a valid UUID`,
            )
        }

        next()
    }
}

module.exports = { validateUuidParam }
