const env = require('../config/env')

/**
 * Email service abstraction.
 * Development uses a console preview with redacted metadata only.
 * Production can plug in Resend via EMAIL_PROVIDER.
 */

function maskEmailAddress(value) {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    const atIndex = trimmed.indexOf('@')

    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        return '***'
    }

    const local = trimmed.slice(0, atIndex)
    const domain = trimmed.slice(atIndex + 1)
    const visibleLocal = local.slice(0, Math.min(2, local.length))
    return `${visibleLocal}${'*'.repeat(Math.max(1, local.length - visibleLocal.length))}@${domain}`
}

function logConsoleEmailPreview({ to, subject, html }) {
    const payload = {
        type: 'email_preview',
        provider: 'console',
        to: maskEmailAddress(to),
        subject,
        htmlLength: typeof html === 'string' ? html.length : 0,
    }

    console.info(JSON.stringify(payload))
}

async function sendEmail({ to, subject, html }) {
    const provider = env.EMAIL_PROVIDER || 'console'

    if (provider === 'console') {
        logConsoleEmailPreview({ to, subject, html })
        return { success: true, provider: 'console' }
    }

    if (provider === 'resend') {
        const { Resend } = require('resend')
        const resend = new Resend(env.RESEND_API_KEY)

        const result = await resend.emails.send({
            from: env.EMAIL_FROM || 'Sentify <noreply@sentify.app>',
            to,
            subject,
            html,
        })

        return { success: true, provider: 'resend', id: result.id }
    }

    throw new Error(`Unknown email provider: ${provider}`)
}

async function sendPasswordResetEmail({ to, name, resetToken }) {
    const resetUrl = `${env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`

    const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Đặt lại mật khẩu</h2>
            <p>Xin chào ${name || ''},</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Sentify.</p>
            <p>
                <a href="${resetUrl}" 
                   style="display:inline-block; padding:12px 24px; background:#6366f1; color:#fff; text-decoration:none; border-radius:6px;">
                    Đặt lại mật khẩu
                </a>
            </p>
            <p style="color:#6b7280; font-size:14px;">
                Link này sẽ hết hạn sau 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.
            </p>
        </div>
    `

    return sendEmail({
        to,
        subject: 'Sentify - Đặt lại mật khẩu',
        html,
    })
}

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    maskEmailAddress,
}
