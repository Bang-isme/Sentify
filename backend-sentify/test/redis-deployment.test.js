const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildRedisDeploymentReport,
    compareRedisVersions,
} = require('../src/lib/redis-deployment')

test('compareRedisVersions compares semantic redis versions numerically', () => {
    assert.equal(compareRedisVersions('8.4.0', '6.2.0') > 0, true)
    assert.equal(compareRedisVersions('6.2.0', '6.2.0'), 0)
    assert.equal(compareRedisVersions('5.0.0', '6.2.0') < 0, true)
})

test('buildRedisDeploymentReport fails unsafe eviction policies', () => {
    const report = buildRedisDeploymentReport(
        ['redis_version:8.4.0', 'redis_mode:standalone', 'maxmemory_policy:volatile-lru'].join(
            '\n',
        ),
    )

    assert.equal(report.status, 'FAILED')
    assert.equal(report.evictionPolicyStatus, 'FAILED')
    assert.equal(report.safeForBullMq, false)
    assert.equal(
        report.warnings.includes(
            'Redis maxmemory-policy is volatile-lru; BullMQ durability expects noeviction.',
        ),
        true,
    )
})

test('buildRedisDeploymentReport passes noeviction with supported versions', () => {
    const report = buildRedisDeploymentReport(
        ['redis_version:8.4.0', 'redis_mode:standalone', 'maxmemory_policy:noeviction'].join(
            '\n',
        ),
    )

    assert.equal(report.status, 'PASS')
    assert.equal(report.minimumVersionStatus, 'PASS')
    assert.equal(report.evictionPolicyStatus, 'PASS')
    assert.equal(report.safeForBullMq, true)
})
