const prisma = require('../lib/prisma')

function normalizeEvent(event) {
    return {
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        summary: event.summary,
        restaurantId: event.restaurantId ?? null,
        actorUserId: event.actorUserId ?? null,
        metadataJson: event.metadata ?? {},
    }
}

function resolveAuditClient(options = {}) {
    return options.tx ?? prisma
}

async function appendAuditEvent(event, options = {}) {
    return resolveAuditClient(options).auditEvent.create({
        data: normalizeEvent(event),
    })
}

async function appendAuditEvents(events, options = {}) {
    if (!Array.isArray(events) || events.length === 0) {
        return { count: 0 }
    }

    return resolveAuditClient(options).auditEvent.createMany({
        data: events.map(normalizeEvent),
    })
}

module.exports = {
    appendAuditEvent,
    appendAuditEvents,
}
