const { conflict } = require('../lib/app-error')
const prisma = require('../lib/prisma')
const { appendAuditEvent } = require('./audit-event.service')

const PLATFORM_CONTROL_ID = 'platform'

function mapPlatformControls(record) {
    return {
        id: record.id,
        crawlQueueWritesEnabled: record.crawlQueueWritesEnabled,
        crawlMaterializationEnabled: record.crawlMaterializationEnabled,
        intakePublishEnabled: record.intakePublishEnabled,
        sourceSubmissionAutoBootstrapEnabled:
            record.sourceSubmissionAutoBootstrapEnabled,
        sourceSubmissionAutoBootstrapMaxPerTick:
            record.sourceSubmissionAutoBootstrapMaxPerTick,
        note: record.note ?? null,
        updatedByUserId: record.updatedByUserId ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    }
}

async function ensurePlatformControls() {
    return prisma.platformControl.upsert({
        where: {
            id: PLATFORM_CONTROL_ID,
        },
        update: {},
        create: {
            id: PLATFORM_CONTROL_ID,
        },
    })
}

async function getPlatformControls() {
    const controls = await ensurePlatformControls()
    return mapPlatformControls(controls)
}

async function updatePlatformControls({ updatedByUserId, changes }) {
    const previousControls = await ensurePlatformControls()
    const updates = {}

    if (Object.prototype.hasOwnProperty.call(changes, 'crawlQueueWritesEnabled')) {
        updates.crawlQueueWritesEnabled = changes.crawlQueueWritesEnabled
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'crawlMaterializationEnabled')) {
        updates.crawlMaterializationEnabled = changes.crawlMaterializationEnabled
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'intakePublishEnabled')) {
        updates.intakePublishEnabled = changes.intakePublishEnabled
    }

    if (
        Object.prototype.hasOwnProperty.call(
            changes,
            'sourceSubmissionAutoBootstrapEnabled',
        )
    ) {
        updates.sourceSubmissionAutoBootstrapEnabled =
            changes.sourceSubmissionAutoBootstrapEnabled
    }

    if (
        Object.prototype.hasOwnProperty.call(
            changes,
            'sourceSubmissionAutoBootstrapMaxPerTick',
        )
    ) {
        updates.sourceSubmissionAutoBootstrapMaxPerTick =
            changes.sourceSubmissionAutoBootstrapMaxPerTick
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'note')) {
        updates.note = changes.note ?? null
    }

    updates.updatedByUserId = updatedByUserId ?? null

    const controls = await prisma.platformControl.upsert({
        where: {
            id: PLATFORM_CONTROL_ID,
        },
        update: updates,
        create: {
            id: PLATFORM_CONTROL_ID,
            ...updates,
        },
    })

    const changedKeys = [
        'crawlQueueWritesEnabled',
        'crawlMaterializationEnabled',
        'intakePublishEnabled',
        'sourceSubmissionAutoBootstrapEnabled',
        'sourceSubmissionAutoBootstrapMaxPerTick',
        'note',
    ].filter((key) => previousControls[key] !== controls[key])

    if (changedKeys.length > 0) {
        await appendAuditEvent({
            action: 'PLATFORM_CONTROLS_UPDATED',
            resourceType: 'platformControl',
            resourceId: controls.id,
            actorUserId: updatedByUserId ?? null,
            summary: 'Platform runtime controls were updated.',
            metadata: {
                changedKeys,
                previous: mapPlatformControls(previousControls),
                current: mapPlatformControls(controls),
            },
        })
    }

    return mapPlatformControls(controls)
}

async function assertPlatformControlEnabled(controlKey, code, message) {
    const controls = await getPlatformControls()

    if (!controls[controlKey]) {
        throw conflict(code, message, {
            controls,
        })
    }

    return controls
}

module.exports = {
    PLATFORM_CONTROL_ID,
    assertPlatformControlEnabled,
    getPlatformControls,
    mapPlatformControls,
    updatePlatformControls,
}
