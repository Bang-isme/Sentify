const BULLMQ_MINIMUM_REDIS_VERSION = '5.0.0'
const BULLMQ_RECOMMENDED_REDIS_VERSION = '6.2.0'
const REQUIRED_MAX_MEMORY_POLICY = 'noeviction'

function parseRedisInfoBlock(info = '') {
    const parsed = {}

    for (const line of info.split('\n')) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#')) {
            continue
        }

        const separatorIndex = trimmed.indexOf(':')
        if (separatorIndex === -1) {
            continue
        }

        parsed[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1)
    }

    return parsed
}

function compareRedisVersions(left, right) {
    const leftParts = String(left || '')
        .split('.')
        .map((part) => Number.parseInt(part, 10))
    const rightParts = String(right || '')
        .split('.')
        .map((part) => Number.parseInt(part, 10))
    const length = Math.max(leftParts.length, rightParts.length)

    for (let index = 0; index < length; index += 1) {
        const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0
        const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0

        if (leftValue > rightValue) {
            return 1
        }

        if (leftValue < rightValue) {
            return -1
        }
    }

    return 0
}

function buildRedisDeploymentReport(info) {
    const parsed = parseRedisInfoBlock(info)
    const redisVersion = parsed.redis_version || null
    const redisMode = parsed.redis_mode || null
    const maxMemoryPolicy = parsed.maxmemory_policy || null
    const connectedClients = parsed.connected_clients || null
    const tcpPort = parsed.tcp_port || null

    const minimumVersionStatus = !redisVersion
        ? 'UNKNOWN'
        : compareRedisVersions(redisVersion, BULLMQ_MINIMUM_REDIS_VERSION) >= 0
          ? 'PASS'
          : 'FAILED'
    const recommendedVersionStatus = !redisVersion
        ? 'UNKNOWN'
        : compareRedisVersions(redisVersion, BULLMQ_RECOMMENDED_REDIS_VERSION) >= 0
          ? 'PASS'
          : 'WARN'
    const evictionPolicyStatus = !maxMemoryPolicy
        ? 'UNKNOWN'
        : maxMemoryPolicy === REQUIRED_MAX_MEMORY_POLICY
          ? 'PASS'
          : 'FAILED'

    const warnings = []

    if (minimumVersionStatus === 'FAILED') {
        warnings.push(
            `Redis version ${redisVersion} is below BullMQ minimum ${BULLMQ_MINIMUM_REDIS_VERSION}.`,
        )
    }

    if (recommendedVersionStatus === 'WARN') {
        warnings.push(
            `Redis version ${redisVersion} is below BullMQ recommended ${BULLMQ_RECOMMENDED_REDIS_VERSION}.`,
        )
    }

    if (evictionPolicyStatus === 'FAILED') {
        warnings.push(
            `Redis maxmemory-policy is ${maxMemoryPolicy}; BullMQ durability expects ${REQUIRED_MAX_MEMORY_POLICY}.`,
        )
    }

    const status =
        minimumVersionStatus === 'FAILED' || evictionPolicyStatus === 'FAILED'
            ? 'FAILED'
            : recommendedVersionStatus === 'WARN' ||
                minimumVersionStatus === 'UNKNOWN' ||
                evictionPolicyStatus === 'UNKNOWN'
              ? 'WARN'
              : 'PASS'

    return {
        status,
        redisVersion,
        redisMode,
        tcpPort,
        connectedClients,
        minimumVersion: BULLMQ_MINIMUM_REDIS_VERSION,
        recommendedVersion: BULLMQ_RECOMMENDED_REDIS_VERSION,
        requiredMaxMemoryPolicy: REQUIRED_MAX_MEMORY_POLICY,
        maxMemoryPolicy,
        minimumVersionStatus,
        recommendedVersionStatus,
        evictionPolicyStatus,
        safeForBullMq:
            minimumVersionStatus === 'PASS' && evictionPolicyStatus === 'PASS',
        warnings,
    }
}

module.exports = {
    BULLMQ_MINIMUM_REDIS_VERSION,
    BULLMQ_RECOMMENDED_REDIS_VERSION,
    REQUIRED_MAX_MEMORY_POLICY,
    buildRedisDeploymentReport,
    compareRedisVersions,
    parseRedisInfoBlock,
}
