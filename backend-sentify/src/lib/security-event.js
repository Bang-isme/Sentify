const env = require('../config/env')

function logSecurityEvent(event, context = {}) {
    if (env.NODE_ENV === 'test') {
        return
    }

    const payload = {
        type: 'security_event',
        timestamp: new Date().toISOString(),
        event,
        ...context,
    }

    console.info(JSON.stringify(payload))
}

module.exports = {
    logSecurityEvent,
}
