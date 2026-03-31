const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function withMock(modulePath, exports) {
    require.cache[require.resolve(modulePath)] = {
        id: require.resolve(modulePath),
        filename: require.resolve(modulePath),
        loaded: true,
        exports,
    }
}

test('console email preview logs redacted metadata without body content', async () => {
    const messages = []
    const originalInfo = console.info
    console.info = (value) => messages.push(value)

    clearModule('../src/services/email.service')
    withMock('../src/config/env', {
        EMAIL_PROVIDER: 'console',
    })

    try {
        const emailService = require('../src/services/email.service')
        const result = await emailService.sendPasswordResetEmail({
            to: 'owner@example.com',
            name: 'Owner',
            resetToken: 'super-secret-token',
        })

        assert.equal(result.success, true)
        assert.equal(result.provider, 'console')
        assert.equal(messages.length, 1)

        const payload = JSON.parse(messages[0])
        assert.equal(payload.type, 'email_preview')
        assert.equal(payload.provider, 'console')
        assert.equal(payload.to, 'ow***@example.com')
        assert.equal(payload.subject, 'Sentify - Đặt lại mật khẩu')
        assert.equal(typeof payload.htmlLength, 'number')
        assert.ok(!messages[0].includes('super-secret-token'))
        assert.ok(!messages[0].includes('reset-password?token='))
    } finally {
        console.info = originalInfo
        clearModule('../src/services/email.service')
        clearModule('../src/config/env')
    }
})
