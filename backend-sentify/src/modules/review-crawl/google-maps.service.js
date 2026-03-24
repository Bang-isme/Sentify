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

function buildValidatedIntakeItems(reviews) {
    const warnings = []
    const items = []

    for (const review of reviews) {
        const candidate = buildIntakeCandidateFromReview(review)

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

            items.push(serializeValidatedIntakeItem(parsed.items[0]))
        } catch {
            warnings.push(`Review ${review.reviewId} was skipped because it could not be validated for intake`)
        }
    }

    return {
        items,
        warnings,
    }
}

function buildReviewDedupKey(review) {
    return buildGoogleReviewExternalKey(review)
}

async function fetchText(url, headers = {}) {
    const response = await fetch(url, {
        headers,
    })

    if (!response.ok) {
        if (response.status === 429) {
            throw tooManyRequests(
                'GOOGLE_MAPS_RATE_LIMITED',
                'Google Maps rate-limited the crawl request',
            )
        }

        throw badGateway(
            'GOOGLE_MAPS_FETCH_FAILED',
            `Failed to fetch Google Maps resource: ${response.status} ${response.statusText}`,
        )
    }

    return {
        url: response.url,
        text: await response.text(),
    }
}

async function createBrowserLikeClient(language) {
    return new Impit({
        browser: 'chrome',
        cookieJar: new CookieJar(),
        headers: buildGoogleHeaders(language),
    })
}

async function resolveGoogleMapsSource(input) {
    const headers = buildGoogleHeaders(input.language)
    const initialPage = await fetchText(input.url, headers)
    const canonicalUrl = buildCanonicalMapsUrl(
        input.url,
        initialPage.url,
        input.language,
        input.region,
    )
    let previewPage = initialPage

    if (canonicalUrl && canonicalUrl !== initialPage.url) {
        try {
            previewPage = await fetchText(canonicalUrl, headers)
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
    const previewResponse = await fetchText(previewUrl, headers)
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
    const sourceResponse = await client.fetch(resolved.source.sourcePageUrl)

    if (!sourceResponse.ok) {
        if (sourceResponse.status === 429) {
            throw tooManyRequests(
                'GOOGLE_MAPS_RATE_LIMITED',
                'Google Maps rate-limited the review session bootstrap',
            )
        }

        throw badGateway(
            'GOOGLE_MAPS_FETCH_FAILED',
            `Failed to initialize Google Maps review session: ${sourceResponse.status} ${sourceResponse.statusText}`,
        )
    }

    const sourceHtml = await sourceResponse.text()
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

    const response = await client.fetch(url)

    if (!response.ok) {
        if (response.status === 429) {
            throw tooManyRequests(
                'GOOGLE_MAPS_RATE_LIMITED',
                'Google Maps rate-limited the review page request',
            )
        }

        throw badGateway(
            'GOOGLE_MAPS_REVIEW_FETCH_FAILED',
            `Failed to fetch Google Maps reviews: ${response.status} ${response.statusText}`,
        )
    }

    const page = parseReviewPagePayload(parseGoogleJsonResponse(await response.text()))
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

async function crawlGoogleMapsReviews(input) {
    const session = await initializeGoogleMapsReviewSession(input)

    // Google Maps often returns empty review payloads if the RPC call is sent immediately
    // after the source page session is established.
    await sleep(2000)

    const pageLimit = input.pages === 'max' ? Infinity : input.pages
    const maxReviews = input.maxReviews ?? session.place.totalReviewCount ?? Number.POSITIVE_INFINITY

    const warnings = []
    const reviews = []
    const seenReviewKeys = new Set()
    let nextPageToken = ''
    let fetchedPages = 0
    let exhaustedSource = false

    while (fetchedPages < pageLimit && reviews.length < maxReviews) {
        const page = await fetchGoogleMapsReviewPage({
            client: session.client,
            placeHexId: session.place.identifiers.placeHexId,
            sessionToken: session.sessionToken,
            sort: input.sort,
            nextPageToken,
            searchQuery: input.searchQuery,
            pageSize: input.pageSize,
            language: input.language,
            region: input.region,
        })

        fetchedPages += 1

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
    const completeness =
        reviews.length === 0
            ? 'metadata_only'
            : exhaustedSource
              ? 'complete'
              : 'partial'

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
    fetchGoogleMapsReviewPage,
    initializeGoogleMapsReviewSession,
    resolveGoogleMapsSource,
    sleep,
}
