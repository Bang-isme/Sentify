function get(value, path) {
    let current = value

    for (const key of path) {
        if (current === null || current === undefined) {
            return undefined
        }

        current = current[key]
    }

    return current
}

function asString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asInteger(value) {
    return Number.isInteger(value) ? value : null
}

function normalizeText(value) {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim()

    return normalized === '' ? null : normalized
}

function compactValue(value) {
    if (value === null || value === undefined || value === '') {
        return undefined
    }

    if (Array.isArray(value)) {
        const next = value
            .map((entry) => compactValue(entry))
            .filter((entry) => entry !== undefined)

        return next.length === 0 ? undefined : next
    }

    if (typeof value === 'object') {
        const next = Object.fromEntries(
            Object.entries(value)
                .map(([key, entry]) => [key, compactValue(entry)])
                .filter(([, entry]) => entry !== undefined),
        )

        return Object.keys(next).length === 0 ? undefined : next
    }

    return value
}

function normalizeGoogleUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return null
    }

    if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('//') && !value.startsWith('/')) {
        return null
    }

    if (value.startsWith('//')) {
        return `https:${value}`
    }

    return value
}

function extractFirstUrl(value) {
    if (typeof value === 'string') {
        return normalizeGoogleUrl(value)
    }

    if (!Array.isArray(value)) {
        return null
    }

    for (const entry of value) {
        const resolved = extractFirstUrl(entry)

        if (resolved) {
            return resolved
        }
    }

    return null
}

function stripXssiPrefix(text) {
    if (typeof text !== 'string') {
        throw new Error('Expected response text to be a string')
    }

    return text.replace(/^\)\]\}'\n/, '')
}

function parseGoogleJsonResponse(text) {
    return JSON.parse(stripXssiPrefix(text))
}

function decodeHtmlAttribute(value) {
    return value.replace(/&amp;/g, '&')
}

function extractPreviewFetchPathFromHtml(html) {
    const match = html.match(/href="([^"]*\/maps\/preview\/place\?[^"]+)" as="fetch"/i)

    if (!match || !match[1]) {
        throw new Error('Could not find Google Maps preview preload URL in HTML response')
    }

    return decodeHtmlAttribute(match[1])
}

function extractSessionTokenFromHtml(html) {
    const match = html.match(/var kEI='([^']+)'/)
    return match?.[1] || null
}

function extractPlaceHexIdFromUrl(url) {
    if (typeof url !== 'string') {
        return null
    }

    const matches = [...url.matchAll(/!1s([a-zA-Z0-9_:.-]+)!/g)]
    return matches.length > 0 ? matches[matches.length - 1][1] : null
}

function parseCidFromPlaceHexId(placeHexId) {
    if (!placeHexId || !placeHexId.includes(':')) {
        return null
    }

    const [, cidHex] = placeHexId.split(':')

    try {
        return BigInt(cidHex).toString(10)
    } catch {
        return null
    }
}

function parseGoogleTimestampToIso(value) {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null
    }

    let milliseconds = numericValue

    if (numericValue >= 1e15) {
        milliseconds = Math.floor(numericValue / 1000)
    } else if (numericValue < 1e12 && numericValue >= 1e9) {
        milliseconds = numericValue * 1000
    }

    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeImageEntry(entry) {
    const image = {
        id: asString(entry?.[0]),
        url: asString(get(entry, [1, 6, 0])),
        size: compactValue({
            width: asInteger(get(entry, [1, 6, 2, 0])),
            height: asInteger(get(entry, [1, 6, 2, 1])),
        }),
        location: compactValue({
            latitude: asNumber(get(entry, [1, 8, 0, 2])),
            longitude: asNumber(get(entry, [1, 8, 0, 1])),
            friendlyName: normalizeText(get(entry, [1, 21, 3, 7, 0])),
        }),
        caption: normalizeText(get(entry, [1, 21, 3, 5, 0])),
    }

    return compactValue(image)
}

function normalizeReviewEntry(entry) {
    const review = Array.isArray(entry?.[0]) ? entry[0] : entry

    if (!Array.isArray(review)) {
        return null
    }

    const responseData = Array.isArray(review[3]) ? review[3] : null
    const responseText = normalizeText(get(responseData, [14, 0, 0]))
    const images = Array.isArray(get(review, [2, 2]))
        ? get(review, [2, 2]).map(normalizeImageEntry).filter(Boolean)
        : []

    return compactValue({
        reviewId: asString(review[0]),
        reviewUrl: extractFirstUrl(get(entry, [2])),
        publishedAt: parseGoogleTimestampToIso(get(review, [1, 2])),
        updatedAt: parseGoogleTimestampToIso(get(review, [1, 3])),
        relativePublishedAt: normalizeText(get(review, [1, 6])),
        author: compactValue({
            name: normalizeText(get(review, [1, 4, 5, 0])),
            avatarUrl: asString(get(review, [1, 4, 5, 1])),
            profileUrl: asString(get(review, [1, 4, 5, 2, 0])),
            contributorId: asString(get(review, [1, 4, 5, 3])),
            reviewCountLabel: normalizeText(get(review, [1, 4, 5, 10, 0])),
            reviewCount: asInteger(get(review, [1, 4, 5, 5])),
        }),
        rating: asInteger(get(review, [2, 0, 0])),
        text: normalizeText(get(review, [2, 15, 0, 0])),
        language: asString(get(review, [2, 14, 0])),
        source: asString(get(review, [1, 13, 0])),
        images,
        ownerResponse: responseText
            ? compactValue({
                  text: responseText,
                  publishedAt: parseGoogleTimestampToIso(get(responseData, [1])),
                  updatedAt: parseGoogleTimestampToIso(get(responseData, [2])),
              })
            : undefined,
    })
}

function parseReviewPagePayload(payload) {
    const rawReviews = Array.isArray(payload?.[2]) ? payload[2] : []

    return {
        nextPageToken: asString(payload?.[1]),
        reviews: rawReviews.map(normalizeReviewEntry).filter(Boolean),
    }
}

function parsePreviewPlacePayload(payload, context = {}) {
    const placeNode = payload?.[6]

    if (!Array.isArray(placeNode)) {
        throw new Error('Google Maps preview payload does not contain the place node')
    }

    const addressLines = Array.isArray(placeNode[2])
        ? placeNode[2].map((value) => normalizeText(value)).filter(Boolean)
        : []
    const placeHexId =
        asString(placeNode[10]) ||
        extractPlaceHexIdFromUrl(context.resolvedUrl) ||
        extractPlaceHexIdFromUrl(context.inputUrl)

    const place = compactValue({
        name: normalizeText(placeNode[11]),
        formattedAddress:
            normalizeText(placeNode[18]) ||
            (addressLines.length > 0 ? addressLines.join(', ') : null),
        addressLines,
        categories: Array.isArray(placeNode[13])
            ? placeNode[13].map((value) => normalizeText(value)).filter(Boolean)
            : undefined,
        description:
            normalizeText(get(placeNode, [32, 1, 1])) ||
            normalizeText(get(placeNode, [32, 0, 1])),
        rating: asNumber(get(placeNode, [4, 7])),
        totalReviewCount: asInteger(get(placeNode, [37, 1])),
        coordinates: compactValue({
            latitude: asNumber(get(placeNode, [9, 2])),
            longitude: asNumber(get(placeNode, [9, 3])),
        }),
        identifiers: compactValue({
            placeHexId,
            googlePlaceId: asString(placeNode[78]),
            cid: parseCidFromPlaceHexId(placeHexId),
        }),
    })

    if (!place?.name || !place?.identifiers?.placeHexId) {
        throw new Error('Google Maps preview payload is missing required place metadata')
    }

    return {
        place,
        resolvedPlaceUrl: asString(placeNode[42]) || context.resolvedUrl || context.inputUrl || null,
        reviewContextToken: asString(get(placeNode, [37, 3])),
    }
}

module.exports = {
    compactValue,
    extractPlaceHexIdFromUrl,
    extractPreviewFetchPathFromHtml,
    extractSessionTokenFromHtml,
    parseGoogleJsonResponse,
    parseCidFromPlaceHexId,
    parseGoogleTimestampToIso,
    parsePreviewPlacePayload,
    parseReviewPagePayload,
}
