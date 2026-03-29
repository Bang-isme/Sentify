const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const SSL_MODES_WITH_VERIFY_FULL_RUNTIME_SEMANTICS = new Set([
    'prefer',
    'require',
    'verify-ca',
])

function isExternalDatabaseHost(hostname) {
    return Boolean(hostname) && !LOOPBACK_HOSTS.has(hostname)
}

function normalizeDatabaseOptions(optionsOrConnectionLimit) {
    if (
        typeof optionsOrConnectionLimit === 'number' ||
        optionsOrConnectionLimit === undefined ||
        optionsOrConnectionLimit === null
    ) {
        return {
            connectionLimit: optionsOrConnectionLimit,
        }
    }

    return optionsOrConnectionLimit
}

function setSearchParamIfMissing(url, key, value) {
    if (
        value === undefined ||
        value === null ||
        value === '' ||
        url.searchParams.has(key)
    ) {
        return
    }

    url.searchParams.set(key, String(value))
}

function normalizeDatabaseUrl(databaseUrl, optionsOrConnectionLimit) {
    if (!databaseUrl) {
        return databaseUrl
    }

    try {
        const url = new URL(databaseUrl)
        const options = normalizeDatabaseOptions(optionsOrConnectionLimit)

        setSearchParamIfMissing(url, 'connection_limit', options.connectionLimit)
        setSearchParamIfMissing(url, 'connect_timeout', options.connectTimeoutSeconds)
        setSearchParamIfMissing(url, 'statement_timeout', options.statementTimeoutMs)
        setSearchParamIfMissing(
            url,
            'idle_in_transaction_session_timeout',
            options.idleInTransactionTimeoutMs,
        )

        const sslMode = url.searchParams.get('sslmode')

        // pg-connection-string warns that require/prefer/verify-ca are aliases for verify-full.
        // Make the stronger runtime behavior explicit for external managed databases.
        if (
            isExternalDatabaseHost(url.hostname) &&
            sslMode &&
            SSL_MODES_WITH_VERIFY_FULL_RUNTIME_SEMANTICS.has(sslMode)
        ) {
            url.searchParams.set('sslmode', 'verify-full')
        }

        return url.toString()
    } catch (_error) {
        return databaseUrl
    }
}

module.exports = {
    LOOPBACK_HOSTS,
    normalizeDatabaseUrl,
}
