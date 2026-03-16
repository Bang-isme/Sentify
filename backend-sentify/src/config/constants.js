module.exports = {
    AUTH: {
        ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
        PASSWORD_SALT_ROUNDS: 12,
        DB_TIMEOUT_MS: 2000,
    },
    INTAKE: {
        MAX_ITEMS_PER_BATCH: 200,
        MAX_REVIEW_KEYWORDS: 5,
    },
    INSIGHTS: {
        MAX_COMPLAINT_KEYWORDS: 10,
    },
}
