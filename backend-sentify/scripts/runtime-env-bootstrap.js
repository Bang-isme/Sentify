const { randomBytes } = require('node:crypto')

// Keep the default node --test suite hermetic. Unit and integration tests
// should not inherit workstation-local runtime or staging credentials.
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.LOG_FORMAT = process.env.LOG_FORMAT || 'json'
process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5432/sentify?schema=public'
process.env.JWT_SECRET =
    process.env.JWT_SECRET || randomBytes(32).toString('hex')
process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'sentify-api'
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'sentify-web'
process.env.REDIS_URL = process.env.REDIS_URL || ''
process.env.REVIEW_CRAWL_INLINE_QUEUE_MODE =
    process.env.REVIEW_CRAWL_INLINE_QUEUE_MODE || 'true'
