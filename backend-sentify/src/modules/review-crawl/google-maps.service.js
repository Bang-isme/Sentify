const crypto = require('node:crypto')

const { Impit } = require('impit')
const { CookieJar } = require('tough-cookie')

const { badGateway, tooManyRequests } = require('../../lib/app-error')
const { createReviewItemsSchema } = require('../admin-intake/admin-intake.validation')
const {
    compactValue,
    extractPlaceHexIdFromUrl,
    extractPreviewFetchPathFromHtml,
    extractSessionTokenFromHtml,
    parseCidFromPlaceHexId,
    parseGoogleJsonResponse,
    parsePreviewPlacePayload,
    parseReviewPagePayload,
} = require('./google-maps.parser')

const SORT_TO_CODE = {
    relevant: 1,
    newest: 2,
    highest_rating: 3,
    lowest_rating: 4,
}

const SESSION_BOOTSTRAP_WARMUP_MS = 2000
const FIRST_PAGE_SESSION_RECOVERY_DELAYS_MS = [500, 1000, 1500, 2000, 3000]
const EMPTY_PAGE_RETRY_DELAYS_MS = [500, 1000]
const CURSOR_SESSION_RECOVERY_DELAYS_MS = [1000, 2000, 4000]
const TEXT_FETCH_RETRY_DELAYS_MS = [500, 1500]
const TEXT_FETCH_TIMEOUT_MS = 15000
const RETRYABLE_TEXT_FETCH_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRYABLE_SESSION_ERROR_CODES = new Set([
    'GOOGLE_MAPS_FETCH_FAILED',
    'GOOGLE_MAPS_RATE_LIMITED',
    'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
    'GOOGLE_MAPS_SESSION_INIT_FAILED',
])

function buildGoogleHeaders(language) {
    return {
        Accept: '*/*',
        'Accept-Language': `${language},en;q=0.9`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncate(value, maxLength) {
    if (typeof value !== 'string') {
        return value
    }

    return value.length > maxLength ? value.slice(0, maxLength) : value
}

function buildSourcePageUrl(placeHexId, language, region) {
    const url = new URL(`https://maps.google.com/maps/place/${placeHexId}`)
    url.searchParams.set('hl', language)
    url.searchParams.set('gl', region.toUpperCase())
    return url.toString()
}

function buildCanonicalMapsUrl(inputUrl, resolvedUrl, language, region) {
    const placeHexId = extractPlaceHexIdFromUrl(resolvedUrl) || extractPlaceHexIdFromUrl(inputUrl)

    if (!placeHexId) {
        return null
    }

    const cid = parseCidFromPlaceHexId(placeHexId)

    if (cid) {
        const url = new URL('https://www.google.com/maps')
        url.searchParams.set('cid', cid)
        url.searchParams.set('hl', language)
        url.searchParams.set('gl', region.toUpperCase())
        return url.toString()
    }

    return buildSourcePageUrl(placeHexId, language, region)
}

function buildPreviewUrl(previewFetchPath) {
    return new URL(previewFetchPath, 'https://www.google.com').toString()
}

function buildReviewsRpcUrl({
    placeHexId,
    sessionToken,
    sort,
    nextPageToken,
    searchQuery,
    pageSize,
    language,
    region,
}) {
    const url = new URL('https://www.google.com/maps/rpc/listugcposts')
    const sortCode = SORT_TO_CODE[sort]
    const prefix = searchQuery ? '!1m7' : '!1m6'
    const searchSection = searchQuery ? `!3s${searchQuery}` : ''
    const nextTokenSection = nextPageToken || ''
    const pb = `${prefix}!1s${placeHexId}${searchSection}!6m4!4m1!1e1!4m1!1e3!2m2!1i${pageSize}!2s${nextTokenSection}!5m2!1s${sessionToken}!7e81!8m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!11m4!1e3!2e1!6m1!1i2!13m1!1e${sortCode}`

    url.searchParams.set('authuser', '0')
    url.searchParams.set('hl', language)
    url.searchParams.set('gl', region.toUpperCase())
    url.searchParams.set('pb', pb)
    return url.toString()
}

function buildGoogleReviewExternalKey(review) {
    if (review?.reviewId) {
        return `google-maps:review:${review.reviewId}`
    }

    const fingerprint = crypto
        .createHash('sha256')
        .update(
            JSON.stringify({
                contributorId: review?.author?.contributorId || null,
                publishedAt: review?.publishedAt || null,
                rating: review?.rating || null,
                text: review?.text || null,
                reviewUrl: review?.reviewUrl || null,
            }),
        )
        .digest('hex')
        .slice(0, 40)

    return `google-maps:fingerprint:${fingerprint}`
}

function buildIntakeCandidateFromReview(review) {
    return {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: buildGoogleReviewExternalKey(review),
        sourceReviewUrl: review.reviewUrl ?? null,
        rawAuthorName: truncate(review.author?.name, 120) || undefined,
        rawRating: review.rating,
        rawContent: truncate(review.text, 4000) ?? null,
        rawReviewDate: review.publishedAt ?? null,
    }
}

function serializeValidatedIntakeItem(item) {
    return compactValue({
        sourceProvider: item.sourceProvider ?? undefined,
        sourceExternalId: item.sourceExternalId ?? undefined,
        sourceReviewUrl: item.sourceReviewUrl ?? null,
        rawAuthorName: item.rawAuthorName ?? undefined,
        rawRating: item.rawRating,
        rawContent: item.rawContent ?? null,
        rawReviewDate: item.rawReviewDate ? item.rawReviewDate.toISOString() : null,
    })
}

function mapIntakeValidationCode(issue) {
    const path = Array.isArray(issue.path) ? issue.path.join('.') : ''

    if (path === 'items.0.rawRating') {
        return 'INTAKE_INVALID_RATING'
    }

    if (path === 'items.0.rawReviewDate') {
        return 'INTAKE_INVALID_REVIEW_DATE'
    }

    if (path === 'items.0.sourceReviewUrl') {
        return 'INTAKE_INVALID_SOURCE_REVIEW_URL'
    }

    if (path === 'items.0.rawContent') {
        return 'INTAKE_INVALID_CONTENT'
    }

    if (path === 'items.0.rawAuthorName') {
        return 'INTAKE_INVALID_AUTHOR_NAME'
    }

    return 'INTAKE_VALIDATION_FAILED'
}

function formatIntakeValidationIssues(error, review) {
    const issues = Array.isArray(error?.issues) ? error.issues : []

    if (issues.length === 0) {
        return [
            {
                code: 'INTAKE_VALIDATION_FAILED',
                field: null,
                reviewId: review.reviewId ?? null,
                message: 'Review could not be validated for intake',
            },
        ]
    }

    return issues.map((issue) => ({
        code: mapIntakeValidationCode(issue),
        field: Array.isArray(issue.path) ? issue.path.join('.') : null,
        reviewId: review.reviewId ?? null,
        message: issue.message,
    }))
}

function buildValidatedIntakeItems(reviews) {
    const warnings = []
    const items = []
    const issues = []

    for (const review of reviews) {
        const validation = validateReviewForIntake(review)

        warnings.push(...validation.warnings)

        if (validation.item) {
            items.push(validation.item)
        }

        if (validation.issues.length > 0) {
            issues.push(...validation.issues)
        }
    }

    return {
        items,
        issues,
        warnings,
    }
}

function buildReviewDedupKey(review) {
    return buildGoogleReviewExternalKey(review)
}

function validateReviewForIntake(review) {
    const candidate = buildIntakeCandidateFromReview(review)
    const warnings = []

    if (typeof review.text === 'string' && review.text.length > 4000) {
        warnings.push(`Review ${review.reviewId} content was truncated to 4000 characters`)
    }

    if (typeof review.author?.name === 'string' && review.author.name.length > 120) {
        warnings.push(`Review ${review.reviewId} author name was truncated to 120 characters`)
    }

    try {
        const parsed = createReviewItemsSchema.parse({
            items: [candidate],
        })

        return {
            item: serializeValidatedIntakeItem(parsed.items[0]),
            issues: [],
            warnings,
        }
    } catch (error) {
        return {
            item: null,
            issues: formatIntakeValidationIssues(error, review),
            warnings: [
                ...warnings,
                `Review ${review.reviewId} was skipped because it could not be validated for intake`,
            ],
        }
    }
}

async function createBrowserLikeClient(language) {
    return new Impit({
        browser: 'chrome',
        cookieJar: new CookieJar(),
        headers: buildGoogleHeaders(language),
    })
}

function isRetryableTextFetchError(error) {
    return error?.details?.retryable === true
}

function buildFetchFailureMessage(error) {
    const causeMessage =
        error?.cause?.message ||
        error?.message ||
        'Unknown upstream fetch failure'

    return truncate(causeMessage, 240)
}

async function performResponseFetch(url, headers = {}, options = {}) {
    const timeoutMs = options.timeoutMs ?? TEXT_FETCH_TIMEOUT_MS
    const controller = new AbortController()
    let timeoutId = null

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort()
            const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`)
            timeoutError.name = 'AbortError'
            reject(timeoutError)
        }, timeoutMs)
    })

    try {
        const requestPromise = options.client
            ? options.client.fetch(url, {
                  headers,
                  signal: controller.signal,
              })
            : fetch(url, {
                  headers,
                  signal: controller.signal,
              })
        return await Promise.race([requestPromise, timeoutPromise])
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

async function performTextFetch(url, headers = {}, options = {}) {
    const failureCode = options.failureCode ?? 'GOOGLE_MAPS_FETCH_FAILED'
    const failureMessagePrefix =
        options.failureMessagePrefix ?? 'Failed to fetch Google Maps resource'
    const rateLimitCode = options.rateLimitCode ?? 'GOOGLE_MAPS_RATE_LIMITED'
    const rateLimitMessage =
        options.rateLimitMessage ?? 'Google Maps rate-limited the crawl request'

    try {
        const response = await performResponseFetch(url, headers, options)

        if (!response.ok) {
            const details = compactValue({
                url,
                status: response.status,
                statusText: response.statusText || null,
                retryable: RETRYABLE_TEXT_FETCH_STATUS_CODES.has(response.status),
            })

            if (response.status === 429) {
                throw tooManyRequests(rateLimitCode, rateLimitMessage, details)
            }

            throw badGateway(
                failureCode,
                `${failureMessagePrefix}: ${response.status} ${response.statusText}`,
                details,
            )
        }

        return {
            url: response.url || url,
            text: await response.text(),
        }
    } catch (error) {
        if (error?.code === rateLimitCode || error?.code === failureCode) {
            throw error
        }

        const details = compactValue({
            url,
            retryable: true,
            reason: buildFetchFailureMessage(error),
        })

        throw badGateway(
            failureCode,
            `${failureMessagePrefix}: ${buildFetchFailureMessage(error)}`,
            details,
        )
    }
}

async function fetchText(url, headers = {}, options = {}) {
    const retryDelaysMs = Array.isArray(options.retryDelaysMs)
        ? options.retryDelaysMs
        : TEXT_FETCH_RETRY_DELAYS_MS

    let lastError

    for (let attemptIndex = 0; attemptIndex <= retryDelaysMs.length; attemptIndex += 1) {
        try {
            return await performTextFetch(url, headers, options)
        } catch (error) {
            lastError = error

            if (!isRetryableTextFetchError(error) || attemptIndex >= retryDelaysMs.length) {
                throw error
            }

            await sleep(retryDelaysMs[attemptIndex])
        }
    }

    throw lastError
}

async function resolveGoogleMapsSource(input) {
    const headers = buildGoogleHeaders(input.language)
    const client = await createBrowserLikeClient(input.language)
    const initialPage = await fetchText(input.url, headers, {
        client,
    })
    const canonicalUrl = buildCanonicalMapsUrl(
        input.url,
        initialPage.url,
        input.language,
        input.region,
    )
    let previewPage = initialPage

    if (canonicalUrl && canonicalUrl !== initialPage.url) {
        try {
            previewPage = await fetchText(canonicalUrl, headers, {
                client,
            })
        } catch {
            previewPage = initialPage
        }
    }

    let previewFetchPath

    try {
        previewFetchPath = extractPreviewFetchPathFromHtml(previewPage.text)
    } catch (error) {
        if (previewPage !== initialPage) {
            previewFetchPath = extractPreviewFetchPathFromHtml(initialPage.text)
            previewPage = initialPage
        } else {
            throw error
        }
    }

    const previewUrl = buildPreviewUrl(previewFetchPath)
    const previewResponse = await fetchText(previewUrl, headers, {
        client,
    })
    const previewPayload = parseGoogleJsonResponse(previewResponse.text)
    const preview = parsePreviewPlacePayload(previewPayload, {
        inputUrl: input.url,
        resolvedUrl: previewPage.url,
    })

    const placeHexId = preview.place.identifiers.placeHexId
    const sourcePageUrl = buildSourcePageUrl(placeHexId, input.language, input.region)

    return {
        place: preview.place,
        resolvedPlaceUrl: preview.resolvedPlaceUrl,
        reviewContextToken: preview.reviewContextToken,
        source: compactValue({
            provider: 'google_maps',
            inputUrl: input.url,
            resolvedUrl: previewPage.url,
            originalResolvedUrl: initialPage.url !== previewPage.url ? initialPage.url : undefined,
            canonicalUrl: canonicalUrl && canonicalUrl !== input.url ? canonicalUrl : undefined,
            previewUrl,
            sourcePageUrl,
            language: input.language,
            region: input.region,
        }),
    }
}

async function initializeGoogleMapsReviewSession(input) {
    const resolved = input.place && input.source ? input : await resolveGoogleMapsSource(input)
    const client = await createBrowserLikeClient(resolved.source.language)
    const sourceResponse = await fetchText(
        resolved.source.sourcePageUrl,
        buildGoogleHeaders(resolved.source.language),
        {
            client,
            failureCode: 'GOOGLE_MAPS_SESSION_INIT_FAILED',
            failureMessagePrefix:
                'Failed to initialize Google Maps review session',
            rateLimitMessage:
                'Google Maps rate-limited the review session bootstrap',
        },
    )
    const sourceHtml = sourceResponse.text
    const sessionToken = extractSessionTokenFromHtml(sourceHtml)

    if (!sessionToken) {
        throw badGateway(
            'GOOGLE_MAPS_SESSION_INIT_FAILED',
            'Could not initialize a Google Maps review session token',
        )
    }

    return {
        ...resolved,
        client,
        sessionToken,
    }
}

async function fetchGoogleMapsReviewPage({
    client,
    placeHexId,
    sessionToken,
    sort,
    nextPageToken,
    searchQuery,
    pageSize,
    language,
    region,
    timeoutMs,
}) {
    const url = buildReviewsRpcUrl({
        placeHexId,
        sessionToken,
        sort,
        nextPageToken,
        searchQuery,
        pageSize,
        language,
        region,
    })

    const response = await fetchText(url, buildGoogleHeaders(language), {
        client,
        timeoutMs,
        failureCode: 'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
        failureMessagePrefix: 'Failed to fetch Google Maps reviews',
        rateLimitMessage: 'Google Maps rate-limited the review page request',
    })

    const page = parseReviewPagePayload(parseGoogleJsonResponse(response.text))
    return {
        ...page,
        reviews: page.reviews.map((review) =>
            compactValue({
                ...review,
                externalReviewKey: buildGoogleReviewExternalKey(review),
            }),
        ),
    }
}

function isRetryableSessionError(error) {
    return RETRYABLE_SESSION_ERROR_CODES.has(error?.code)
}

function shouldRetrySuspiciousEmptyPage({ page, reportedTotal, searchQuery, extractedCount }) {
    if (searchQuery) {
        return false
    }

    if ((reportedTotal || 0) <= 0) {
        return false
    }

    if (page.reviews.length > 0 || page.nextPageToken) {
        return false
    }

    return extractedCount < reportedTotal
}

function determineCrawlCompleteness({
    extractedCount,
    exhaustedSource,
    prematureExhaustionDetected,
}) {
    if (extractedCount === 0) {
        return 'metadata_only'
    }

    if (prematureExhaustionDetected) {
        return 'partial'
    }

    return exhaustedSource ? 'complete' : 'partial'
}

async function fetchGoogleMapsReviewPageWithRecovery(params, options = {}) {
    const retryDelaysMs = Array.isArray(options.retryDelaysMs)
        ? options.retryDelaysMs
        : EMPTY_PAGE_RETRY_DELAYS_MS

    let lastPage = null
    let suspiciousEmpty = false

    for (let attemptIndex = 0; attemptIndex <= retryDelaysMs.length; attemptIndex += 1) {
        const page = await fetchGoogleMapsReviewPage(params)
        lastPage = page
        suspiciousEmpty = shouldRetrySuspiciousEmptyPage({
            page,
            reportedTotal: options.reportedTotal,
            searchQuery: options.searchQuery,
            extractedCount: options.extractedCount || 0,
        })

        if (!suspiciousEmpty) {
            return {
                page,
                attempts: attemptIndex + 1,
                suspiciousEmpty: false,
            }
        }

        if (attemptIndex < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attemptIndex])
        }
    }

    return {
        page: lastPage,
        attempts: retryDelaysMs.length + 1,
        suspiciousEmpty,
    }
}

async function recoverCursorWithFreshSessions({
    session,
    input,
    nextPageToken,
    extractedCount,
    reportedTotal,
    retryDelaysMs = CURSOR_SESSION_RECOVERY_DELAYS_MS,
}) {
    if (!nextPageToken) {
        return {
            session,
            pageResult: null,
            attempts: 0,
            recovered: false,
        }
    }

    let lastSession = session
    let lastPageResult = null

    for (let attemptIndex = 0; attemptIndex <= retryDelaysMs.length; attemptIndex += 1) {
        const recoveredSession = await initializeGoogleMapsReviewSession({
            ...input,
            place: session.place,
            source: session.source,
            reviewContextToken: session.reviewContextToken,
        })

        await sleep(SESSION_BOOTSTRAP_WARMUP_MS)

        const pageResult = await fetchGoogleMapsReviewPageWithRecovery(
            {
                client: recoveredSession.client,
                placeHexId: recoveredSession.place.identifiers.placeHexId,
                sessionToken: recoveredSession.sessionToken,
                sort: input.sort,
                nextPageToken,
                searchQuery: input.searchQuery,
                pageSize: input.pageSize,
                language: input.language,
                region: input.region,
            },
            {
                reportedTotal,
                searchQuery: input.searchQuery,
                extractedCount,
            },
        )

        lastSession = recoveredSession
        lastPageResult = pageResult

        if (!pageResult.suspiciousEmpty) {
            return {
                session: recoveredSession,
                pageResult,
                attempts: attemptIndex + 1,
                recovered: true,
            }
        }

        if (attemptIndex < retryDelaysMs.length) {
            await sleep(retryDelaysMs[attemptIndex])
        }
    }

    return {
        session: lastSession,
        pageResult: lastPageResult,
        attempts: retryDelaysMs.length + 1,
        recovered: false,
    }
}

async function crawlGoogleMapsReviews(input) {
    const pageLimit = input.pages === 'max' ? Infinity : input.pages
    const warnings = []
    const reviews = []
    const seenReviewKeys = new Set()
    let nextPageToken = ''
    let fetchedPages = 0
    let exhaustedSource = false
    let prematureExhaustionDetected = false
    let session = null
    let firstPageResult = null
    let lastRecoverableSessionError = null

    for (
        let sessionAttemptIndex = 0;
        sessionAttemptIndex <= FIRST_PAGE_SESSION_RECOVERY_DELAYS_MS.length;
        sessionAttemptIndex += 1
    ) {
        try {
            session = await initializeGoogleMapsReviewSession(input)

            // Google Maps often returns placeholder review payloads if the first RPC call is
            // sent immediately after the source page session is established.
            await sleep(SESSION_BOOTSTRAP_WARMUP_MS)

            firstPageResult = await fetchGoogleMapsReviewPageWithRecovery(
                {
                    client: session.client,
                    placeHexId: session.place.identifiers.placeHexId,
                    sessionToken: session.sessionToken,
                    sort: input.sort,
                    nextPageToken: '',
                    searchQuery: input.searchQuery,
                    pageSize: input.pageSize,
                    language: input.language,
                    region: input.region,
                },
                {
                    reportedTotal: session.place.totalReviewCount ?? 0,
                    searchQuery: input.searchQuery,
                    extractedCount: 0,
                },
            )

            if (!firstPageResult.suspiciousEmpty) {
                if (sessionAttemptIndex > 0) {
                    warnings.push(
                        `Recovered the initial Google Maps review session after ${sessionAttemptIndex + 1} attempts`,
                    )
                }

                if (firstPageResult.attempts > 1) {
                    warnings.push(
                        `Retried the first review page ${firstPageResult.attempts - 1} time(s) before reviews were returned`,
                    )
                }

                break
            }

            warnings.push(
                `Google Maps returned an empty first review page on session attempt ${sessionAttemptIndex + 1}`,
            )
        } catch (error) {
            if (!isRetryableSessionError(error)) {
                throw error
            }

            lastRecoverableSessionError = error
            warnings.push(
                `Google Maps review session attempt ${sessionAttemptIndex + 1} failed with ${error.code}`,
            )
        }

        session = null
        firstPageResult = null

        if (sessionAttemptIndex < FIRST_PAGE_SESSION_RECOVERY_DELAYS_MS.length) {
            await sleep(FIRST_PAGE_SESSION_RECOVERY_DELAYS_MS[sessionAttemptIndex])
        }
    }

    if (!session || !firstPageResult) {
        if (lastRecoverableSessionError) {
            throw lastRecoverableSessionError
        }

        throw badGateway(
            'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
            'Google Maps returned place metadata, but the initial review page could not be recovered',
        )
    }

    const maxReviews = input.maxReviews ?? session.place.totalReviewCount ?? Number.POSITIVE_INFINITY

    while (fetchedPages < pageLimit && reviews.length < maxReviews) {
        const pageNumber = fetchedPages + 1
        let pageResult =
            pageNumber === 1 && firstPageResult
                ? firstPageResult
                : await fetchGoogleMapsReviewPageWithRecovery(
                      {
                          client: session.client,
                          placeHexId: session.place.identifiers.placeHexId,
                          sessionToken: session.sessionToken,
                          sort: input.sort,
                          nextPageToken,
                          searchQuery: input.searchQuery,
                          pageSize: input.pageSize,
                          language: input.language,
                          region: input.region,
                      },
                      {
                          reportedTotal: session.place.totalReviewCount ?? 0,
                          searchQuery: input.searchQuery,
                          extractedCount: reviews.length,
                       },
                   )

        if (pageNumber > 1 && pageResult.suspiciousEmpty) {
            const recoveredCursor = await recoverCursorWithFreshSessions({
                session,
                input,
                nextPageToken,
                extractedCount: reviews.length,
                reportedTotal: session.place.totalReviewCount ?? 0,
            })

            if (recoveredCursor.recovered) {
                session = recoveredCursor.session
                pageResult = recoveredCursor.pageResult
                warnings.push(
                    `Recovered review cursor for page ${pageNumber} after ${recoveredCursor.attempts} fresh session attempt(s)`,
                )
            }
        }

        const page = pageResult.page

        fetchedPages += 1

        if (pageNumber > 1 && pageResult.attempts > 1) {
            warnings.push(
                `Retried review page ${pageNumber} ${pageResult.attempts - 1} time(s) before accepting the response`,
            )
        }

        for (const review of page.reviews) {
            const dedupKey = buildReviewDedupKey(review)

            if (seenReviewKeys.has(dedupKey)) {
                continue
            }

            seenReviewKeys.add(dedupKey)
            reviews.push(review)

            if (reviews.length >= maxReviews) {
                break
            }
        }

        if (!page.nextPageToken || page.nextPageToken === nextPageToken) {
            exhaustedSource = true

            if (pageResult.suspiciousEmpty) {
                prematureExhaustionDetected = true
            }

            break
        }

        nextPageToken = page.nextPageToken

        if (fetchedPages < pageLimit && reviews.length < maxReviews && input.delayMs > 0) {
            await sleep(input.delayMs)
        }
    }

    if (!input.searchQuery && (session.place.totalReviewCount || 0) > 0 && reviews.length === 0) {
        throw badGateway(
            'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
            'Google Maps returned place metadata, but no review rows could be extracted',
        )
    }

    const intake = buildValidatedIntakeItems(reviews)
    const pageLimitReached = fetchedPages >= pageLimit && !exhaustedSource
    const reviewLimitReached = reviews.length >= maxReviews && !exhaustedSource
    const resumeCursor =
        prematureExhaustionDetected && nextPageToken ? nextPageToken : undefined
    const completeness = determineCrawlCompleteness({
        extractedCount: reviews.length,
        exhaustedSource,
        prematureExhaustionDetected,
    })

    if (pageLimitReached) {
        warnings.push('Review crawl stopped because the requested page limit was reached')
    }

    if (reviewLimitReached) {
        warnings.push('Review crawl stopped because the requested review limit was reached')
    }

    if (
        exhaustedSource &&
        typeof session.place.totalReviewCount === 'number' &&
        input.searchQuery === undefined &&
        reviews.length < session.place.totalReviewCount
    ) {
        warnings.push(
            `Google Maps reported ${session.place.totalReviewCount} reviews, but only ${reviews.length} unique reviews were extracted`,
        )
    }

    if (prematureExhaustionDetected) {
        warnings.push(
            'Google Maps stopped returning review pages before the reported total could be reached, so this crawl was marked as partial',
        )
    }

    warnings.push(...intake.warnings)

    return {
        schemaVersion: '1.0.0',
        source: compactValue({
            ...session.source,
            fetchedAt: new Date().toISOString(),
            sort: input.sort,
            searchQuery: input.searchQuery,
            requestedPages: input.pages,
            pageSize: input.pageSize,
            requestedMaxReviews: input.maxReviews,
        }),
        place: compactValue({
            ...session.place,
            googleMapsUrl: session.resolvedPlaceUrl,
        }),
        reviews,
        intake: {
            items: intake.items,
            validItemCount: intake.items.length,
            droppedReviewCount: reviews.length - intake.items.length,
            warnings: intake.warnings,
        },
        crawl: {
            status: 'ok',
            completeness,
            fetchedPages,
            totalReviewsExtracted: reviews.length,
            exhaustedSource,
            prematureExhaustionDetected,
            resumeCursor,
            nextPageToken: exhaustedSource ? undefined : nextPageToken || undefined,
            pageLimitReached,
            reviewLimitReached,
            warnings,
        },
    }
}

module.exports = {
    buildGoogleReviewExternalKey,
    buildIntakeCandidateFromReview,
    buildValidatedIntakeItems,
    crawlGoogleMapsReviews,
    determineCrawlCompleteness,
    fetchText,
    fetchGoogleMapsReviewPage,
    fetchGoogleMapsReviewPageWithRecovery,
    initializeGoogleMapsReviewSession,
    recoverCursorWithFreshSessions,
    resolveGoogleMapsSource,
    shouldRetrySuspiciousEmptyPage,
    sleep,
    validateReviewForIntake,
}
