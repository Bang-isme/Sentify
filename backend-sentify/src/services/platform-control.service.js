const { conflict } = require('../lib/app-error')
const prisma = require('../lib/prisma')

const PLATFORM_CONTROL_ID = 'platform'

function mapPlatformControls(record) {
    return {
        id: record.id,
        crawlQueueWritesEnabled: record.crawlQueueWritesEnabled,
        crawlMaterializationEnabled: record.crawlMaterializationEnabled,
        intakePublishEnabled: record.intakePublishEnabled,
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
