const crypto = require('crypto')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const env = require('../config/env')
const { badGateway, serviceUnavailable } = require('../lib/app-error')

const GOOGLE_MAPS_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])
const REVIEW_CARD_SELECTOR = 'div.jftiEf'
const REVIEW_SCROLLER_ATTRIBUTE = 'data-sentify-review-scroller'
const REVIEW_SCROLLER_SELECTOR = `[${REVIEW_SCROLLER_ATTRIBUTE}="true"]`
const LIMITED_VIEW_PATTERN = /limited view of google maps/i
const REVIEW_TRIGGER_PATTERNS = [
    /more reviews/i,
    /see all reviews/i,
    /^reviews$/i,
    /^bài đánh giá$/i,
    /^đánh giá$/i,
    /^nhận xét$/i,
    /^口コミ$/iu,
    /^レビュー$/iu,
]
const REVIEW_COUNT_PATTERNS = [
    /reviews?\b/i,
    /bài\s+(?:đánh giá|viết)(?=\s|$)/i,
    /nhận xét(?=\s|$)/i,
    /件の口コミ/iu,
    /件のレビュー/iu,
    /口コミ/iu,
    /レビュー/iu,
]
const EXPAND_REVIEW_BUTTON_SELECTOR = [
    'button.w8nwRe',
    'button[aria-label*="More"]',
    'button[aria-label*="more"]',
    'button[aria-label*="See more"]',
    'button[aria-label*="Xem thêm"]',
    'button[aria-label*="続きを読む"]',
].join(',')
const CONSENT_BUTTON_PATTERNS = [
    /accept all/i,
    /i agree/i,
    /^accept$/i,
    /agree/i,
    /đồng ý/i,
    /chấp nhận/i,
    /すべて受け入れる/iu,
    /同意/iu,
]
const SORT_TRIGGER_PATTERNS = [
    /sort/i,
    /most relevant/i,
    /newest/i,
    /phù hợp nhất/i,
    /mới nhất/i,
    /sắp xếp/i,
    /関連度順/u,
    /最新/u,
    /並び替え/u,
]
const SORT_NEWEST_PATTERNS = [/newest/i, /mới nhất/i, /最新/u]
const NON_TEXT_RESOURCE_TYPES = new Set(['image', 'media', 'font'])
const NON_TEXT_URL_PATTERNS = [
    /\/vt\//i,
    /\/maps\/vt\?/i,
    /\/streetviewpixels\//i,
    /googleusercontent\.com\/.*=w\d+/i,
    /gstatic\.com\/mapslt\?/i,
]
const NETWORK_REVIEW_RESPONSE_PATTERNS = [/\/maps\/preview\/place\?/i, /\/maps\/rpc\/listugcposts/i]
const REVIEW_SHARE_URL_PATTERN = /\/maps\/reviews\/data=/i
const GOOGLE_CONTRIB_URL_PATTERN = /\/maps\/contrib\//i
const URL_LIKE_PATTERN = /^(?:https?:)?\/\//i
const ABSOLUTE_VI_DATE_PATTERN = /^(\d{1,2})\s*thg\s*(\d{1,2}),?\s*(\d{4})$/iu
const ABSOLUTE_JA_DATE_PATTERN = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/u
const ABSOLUTE_SLASH_DATE_PATTERN = /^(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})$/

let sharedBrowserPromise = null
let sharedBrowserIdleTimer = null
let activeBrowserSessionCount = 0
let cachedStorageStateSnapshot = null
let cachedStorageStatePromise = null

function normalizeVisibleText(value) {
    if (typeof value !== 'string') {
        return null
    }

    const normalizedValue = value.normalize('NFC').replace(/\s+/g, ' ').trim()
    return normalizedValue || null
}

function trimOrNull(value) {
    const trimmed = normalizeVisibleText(value)
    return trimmed ? trimmed : null
}

function isAllowedGoogleMapsHostname(hostname) {
    const normalizedHostname = hostname.toLowerCase()

    return (
        GOOGLE_MAPS_SHORT_HOSTS.has(normalizedHostname) ||
        /^([a-z0-9-]+\.)*google\.[a-z.]+$/i.test(normalizedHostname)
    )
}

function buildAutomationUrl(googleMapUrl) {
    let parsedUrl

    try {
        parsedUrl = new URL(googleMapUrl)
    } catch {
        throw badGateway('SCRAPE_FAILED', 'The saved Google Maps URL is invalid')
    }

    if (!isAllowedGoogleMapsHostname(parsedUrl.hostname)) {
        throw badGateway('SCRAPE_FAILED', 'The saved URL is not a Google Maps URL')
    }

    parsedUrl.searchParams.set('hl', env.REVIEW_BROWSER_LANGUAGE_CODE)

    return parsedUrl.toString()
}

function buildSearchFallbackUrl(restaurantName, restaurantAddress) {
    const query = [trimOrNull(restaurantName), trimOrNull(restaurantAddress)]
        .filter(Boolean)
        .join(' ')

    if (!query) {
        return null
    }

    const fallbackUrl = new URL('https://www.google.com/maps/search/')
    fallbackUrl.searchParams.set('api', '1')
    fallbackUrl.searchParams.set('query', query)
    fallbackUrl.searchParams.set('hl', env.REVIEW_BROWSER_LANGUAGE_CODE)
    return fallbackUrl.toString()
}

function isUnresolvedPlaceUrl(pageUrl) {
    if (!pageUrl || typeof pageUrl !== 'string') {
        return false
    }

    try {
        const parsedUrl = new URL(pageUrl)
        return /\/maps\/place\/@?@/i.test(parsedUrl.pathname) || /\/maps\/place\/\/@/i.test(parsedUrl.pathname)
    } catch {
        return false
    }
}

function isRecoverableReviewPanelFailure(error) {
    return (
        error?.code === 'SCRAPE_FAILED' &&
        /visible review cards|limited view/i.test(error?.message || '')
    )
}

async function pageHasRestaurantIdentity(page, restaurantName) {
    const expectedRestaurantName = trimOrNull(restaurantName)

    if (!expectedRestaurantName) {
        return true
    }

    const normalizedExpectedRestaurantName = expectedRestaurantName.toLocaleLowerCase()
    const pageTitle = normalizeVisibleText(await page.title().catch(() => ''))?.toLocaleLowerCase()

    if (pageTitle?.includes(normalizedExpectedRestaurantName)) {
        return true
    }

    return page
        .locator('body')
        .evaluate(
            (node, normalizedName) =>
                (node.innerText || '')
                    .normalize('NFC')
                    .toLocaleLowerCase()
                    .includes(normalizedName),
            normalizedExpectedRestaurantName,
        )
        .catch(() => false)
}

function normalizeLocale(languageCode) {
    const normalizedCode = languageCode.toLowerCase()

    if (normalizedCode === 'en') {
        return 'en-US'
    }

    if (normalizedCode === 'vi') {
        return 'vi-VN'
    }

    if (normalizedCode === 'ja') {
        return 'ja-JP'
    }

    return normalizedCode
}

function parseIntegerCount(value) {
    const digits = value?.replace(/[^\d]/g, '')

    if (!digits) {
        return null
    }

    const parsedValue = Number.parseInt(digits, 10)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function extractReviewCountFromText(value) {
    const text = normalizeVisibleText(value)

    if (!text) {
        return null
    }

    if (!REVIEW_COUNT_PATTERNS.some((pattern) => pattern.test(text))) {
        return null
    }

    const numberTokens = text.match(/[0-9][0-9.,]{0,15}/g) || []
    const parsedCount = parseIntegerCount(numberTokens.at(-1) || '')
    return parsedCount || null
}

function extractRatingFromLabel(value) {
    const label = trimOrNull(value)

    if (!label) {
        return null
    }

    const match = label.match(/([0-5](?:[.,]\d)?)/)

    if (!match) {
        return null
    }

    const parsedRating = Number(match[1].replace(',', '.'))

    if (!Number.isFinite(parsedRating)) {
        return null
    }

    return Math.max(1, Math.min(5, Math.round(parsedRating)))
}

function shiftDate(now, amount, unit) {
    const nextDate = new Date(now)

    if (unit === 'day') {
        nextDate.setUTCDate(nextDate.getUTCDate() - amount)
        return nextDate
    }

    if (unit === 'week') {
        nextDate.setUTCDate(nextDate.getUTCDate() - amount * 7)
        return nextDate
    }

    if (unit === 'month') {
        nextDate.setUTCMonth(nextDate.getUTCMonth() - amount)
        return nextDate
    }

    nextDate.setUTCFullYear(nextDate.getUTCFullYear() - amount)
    return nextDate
}

function buildUtcDate(year, month, day) {
    const parsedYear = Number(year)
    const parsedMonth = Number(month)
    const parsedDay = Number(day)

    if (
        !Number.isInteger(parsedYear) ||
        !Number.isInteger(parsedMonth) ||
        !Number.isInteger(parsedDay)
    ) {
        return null
    }

    const nextDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay))
    return Number.isNaN(nextDate.valueOf()) ? null : nextDate
}

function parseAbsoluteReviewDate(value) {
    const label = trimOrNull(value)

    if (!label) {
        return null
    }

    const parsedDate = new Date(label)

    if (!Number.isNaN(parsedDate.valueOf())) {
        return parsedDate
    }

    let match = label.match(ABSOLUTE_VI_DATE_PATTERN)

    if (match) {
        return buildUtcDate(match[3], match[2], match[1])
    }

    match = label.match(ABSOLUTE_JA_DATE_PATTERN)

    if (match) {
        return buildUtcDate(match[1], match[2], match[3])
    }

    match = label.match(ABSOLUTE_SLASH_DATE_PATTERN)

    if (match) {
        return buildUtcDate(match[1], match[2], match[3])
    }

    return null
}

function parseReviewDateLabel(value, now = new Date()) {
    const label = trimOrNull(value)

    if (!label) {
        return null
    }

    const normalizedInput = label
        .replace(/^edited\s+/i, '')
        .replace(/^đã chỉnh sửa\s+/i, '')
        .replace(/^編集済み\s*/u, '')
        .replace(/\s*に編集済み$/u, '')
    const parsedAbsoluteDate = parseAbsoluteReviewDate(normalizedInput)

    if (parsedAbsoluteDate) {
        return parsedAbsoluteDate
    }

    const normalizedLabel = normalizedInput.toLowerCase()
    const relativePatterns = [
        { pattern: /^a day ago$/, amount: 1, unit: 'day' },
        { pattern: /^(\d+)\s+days?\s+ago$/, unit: 'day' },
        { pattern: /^a week ago$/, amount: 1, unit: 'week' },
        { pattern: /^(\d+)\s+weeks?\s+ago$/, unit: 'week' },
        { pattern: /^a month ago$/, amount: 1, unit: 'month' },
        { pattern: /^(\d+)\s+months?\s+ago$/, unit: 'month' },
        { pattern: /^a year ago$/, amount: 1, unit: 'year' },
        { pattern: /^(\d+)\s+years?\s+ago$/, unit: 'year' },
        { pattern: /^1\s+ngày\s+trước$/i, amount: 1, unit: 'day' },
        { pattern: /^(\d+)\s+ngày\s+trước$/i, unit: 'day' },
        { pattern: /^1\s+tuần\s+trước$/i, amount: 1, unit: 'week' },
        { pattern: /^(\d+)\s+tuần\s+trước$/i, unit: 'week' },
        { pattern: /^1\s+tháng\s+trước$/i, amount: 1, unit: 'month' },
        { pattern: /^(\d+)\s+tháng\s+trước$/i, unit: 'month' },
        { pattern: /^1\s+năm\s+trước$/i, amount: 1, unit: 'year' },
        { pattern: /^(\d+)\s+năm\s+trước$/i, unit: 'year' },
        { pattern: /^1\s*日\s*前$/u, amount: 1, unit: 'day' },
        { pattern: /^(\d+)\s*日\s*前$/u, unit: 'day' },
        { pattern: /^1\s*週間前$/u, amount: 1, unit: 'week' },
        { pattern: /^(\d+)\s*週間前$/u, unit: 'week' },
        { pattern: /^1\s*か月前$/u, amount: 1, unit: 'month' },
        { pattern: /^(\d+)\s*か月前$/u, unit: 'month' },
        { pattern: /^1\s*ヶ月前$/u, amount: 1, unit: 'month' },
        { pattern: /^(\d+)\s*ヶ月前$/u, unit: 'month' },
        { pattern: /^1\s*年前$/u, amount: 1, unit: 'year' },
        { pattern: /^(\d+)\s*年前$/u, unit: 'year' },
    ]

    for (const { pattern, amount, unit } of relativePatterns) {
        const match = normalizedLabel.match(pattern)

        if (!match) {
            continue
        }

        const resolvedAmount = amount ?? Number(match[1])
        return shiftDate(now, resolvedAmount, unit)
    }

    return null
}

function buildExternalId(rawReview) {
    if (rawReview.externalId) {
        return rawReview.externalId
    }

    const fingerprint = [
        rawReview.authorName,
        rawReview.rating,
        rawReview.content,
        rawReview.reviewDateLabel,
    ]
        .filter(Boolean)
        .join('|')

    return `google_browser_${crypto.createHash('sha1').update(fingerprint).digest('hex')}`
}

function normalizeBrowserReviews(rawReviews) {
    const seenExternalIds = new Set()
    const normalizedReviews = []

    for (const rawReview of rawReviews) {
        const rating = extractRatingFromLabel(rawReview.ratingLabel) ?? rawReview.rating ?? null

        if (!rating || rating < 1 || rating > 5) {
            continue
        }

        const externalId = buildExternalId(rawReview)

        if (seenExternalIds.has(externalId)) {
            continue
        }

        seenExternalIds.add(externalId)
        normalizedReviews.push({
            externalId,
            authorName: trimOrNull(rawReview.authorName),
            rating,
            content: trimOrNull(rawReview.content),
            reviewDate: parseReviewDateLabel(rawReview.reviewDateLabel),
        })
    }

    return normalizedReviews
}

function walkNestedValue(node, visit, path = []) {
    visit(node, path)

    if (Array.isArray(node)) {
        node.forEach((child, index) => walkNestedValue(child, visit, [...path, index]))
        return
    }

    if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
            walkNestedValue(child, visit, [...path, key])
        }
    }
}

function collectNestedStrings(node, predicate) {
    const values = []

    walkNestedValue(node, (child) => {
        if (typeof child !== 'string') {
            return
        }

        if (!predicate || predicate(child)) {
            values.push(child)
        }
    })

    return values
}

function parseGoogleMapsJsonPayload(payloadText) {
    const text = trimOrNull(payloadText)

    if (!text) {
        return null
    }

    try {
        return JSON.parse(text.replace(/^\)\]\}'\s*/, ''))
    } catch {
        return null
    }
}

function findNetworkReviewAuthor(node) {
    let authorName = null

    walkNestedValue(node, (child) => {
        if (authorName || !Array.isArray(child) || child.length < 3) {
            return
        }

        if (
            typeof child[0] !== 'string' ||
            typeof child[1] !== 'string' ||
            !Array.isArray(child[2]) ||
            !child[2].some((value) => typeof value === 'string' && GOOGLE_CONTRIB_URL_PATTERN.test(value))
        ) {
            return
        }

        authorName = child[0]
    })

    return trimOrNull(authorName)
}

function findNetworkReviewRating(node) {
    let rating = null

    walkNestedValue(node, (child) => {
        if (rating || !Array.isArray(child) || child.length !== 1) {
            return
        }

        if (Number.isInteger(child[0]) && child[0] >= 1 && child[0] <= 5) {
            rating = child[0]
        }
    })

    return rating
}

function findNetworkReviewDateLabel(node) {
    const candidates = collectNestedStrings(node, (value) => {
        const normalizedValue = trimOrNull(value)

        if (
            !normalizedValue ||
            normalizedValue.length > 48 ||
            URL_LIKE_PATTERN.test(normalizedValue) ||
            /^\d+$/.test(normalizedValue)
        ) {
            return false
        }

        return Boolean(parseReviewDateLabel(normalizedValue))
    })

    return candidates[0] || null
}

function findNetworkReviewContent(node, authorName, reviewDateLabel) {
    const candidates = collectNestedStrings(node, (value) => {
        const normalizedValue = trimOrNull(value)

        if (
            !normalizedValue ||
            normalizedValue.length < 24 ||
            URL_LIKE_PATTERN.test(normalizedValue) ||
            /^local guide\b/i.test(normalizedValue)
        ) {
            return false
        }

        if (authorName && normalizedValue === authorName) {
            return false
        }

        if (reviewDateLabel && normalizedValue === reviewDateLabel) {
            return false
        }

        return true
    })

    return candidates.sort((left, right) => right.length - left.length)[0] || null
}

function parseNetworkReviewEntry(candidate) {
    if (!Array.isArray(candidate) || typeof candidate[0] !== 'string') {
        return null
    }

    const reviewDataUrls = collectNestedStrings(candidate, (value) => REVIEW_SHARE_URL_PATTERN.test(value))

    if (reviewDataUrls.length === 0) {
        return null
    }

    const authorName = findNetworkReviewAuthor(candidate)
    const reviewDateLabel = findNetworkReviewDateLabel(candidate)
    const content = findNetworkReviewContent(candidate, authorName, reviewDateLabel)
    const rating = findNetworkReviewRating(candidate)

    if (!authorName || !content || !rating) {
        return null
    }

    return {
        externalId: candidate[0],
        authorName,
        rating,
        content,
        reviewDateLabel,
    }
}

function extractRawNetworkReviewsFromParsedPayload(parsedPayload) {
    if (!parsedPayload) {
        return []
    }

    const rawReviews = []
    const seenExternalIds = new Set()

    walkNestedValue(parsedPayload, (child) => {
        if (!Array.isArray(child) || typeof child[0] !== 'string') {
            return
        }

        if (!/^C(?:IHM|i9|hZDSU)/i.test(child[0])) {
            return
        }

        const review = parseNetworkReviewEntry(child)

        if (!review || seenExternalIds.has(review.externalId)) {
            return
        }

        seenExternalIds.add(review.externalId)
        rawReviews.push(review)
    })

    return rawReviews
}

function extractRawNetworkReviewsFromPayloadText(payloadText) {
    return extractRawNetworkReviewsFromParsedPayload(parseGoogleMapsJsonPayload(payloadText))
}

function createNetworkReviewCapture(page) {
    const payloads = []
    let capturePromise = Promise.resolve()

    page.on('response', (response) => {
        capturePromise = capturePromise.then(async () => {
            try {
                const request = response.request()

                if (!['xhr', 'fetch'].includes(request.resourceType())) {
                    return
                }

                const responseUrl = response.url()

                if (!NETWORK_REVIEW_RESPONSE_PATTERNS.some((pattern) => pattern.test(responseUrl))) {
                    return
                }

                const payloadText = await response.text().catch(() => null)

                if (!payloadText) {
                    return
                }

                payloads.push({
                    url: responseUrl,
                    payloadText,
                })
            } catch {
                // fall back to DOM extraction when network capture fails
            }
        })
    })

    return {
        async getRawReviews() {
            await capturePromise.catch(() => {})

            const rawReviews = []
            const seenExternalIds = new Set()

            for (const payload of payloads) {
                const payloadReviews = extractRawNetworkReviewsFromPayloadText(payload.payloadText)

                for (const review of payloadReviews) {
                    if (seenExternalIds.has(review.externalId)) {
                        continue
                    }

                    seenExternalIds.add(review.externalId)
                    rawReviews.push(review)
                }
            }

            return rawReviews
        },
    }
}

function buildReviewCollectionPlan({
    advertisedTotalReviews,
    smartSyncEnabled = false,
    explicitTargetOverride = null,
    strategyOverride = null,
}) {
    const explicitTarget =
        explicitTargetOverride ??
        (env.REVIEW_BROWSER_MAX_REVIEWS > 0 ? env.REVIEW_BROWSER_MAX_REVIEWS : null)
    const hardMaxReviews = env.REVIEW_BROWSER_HARD_MAX_REVIEWS
    const recentSyncTarget = Math.min(env.REVIEW_BROWSER_RECENT_SYNC_TARGET, hardMaxReviews)
    const strategy =
        strategyOverride ?? (smartSyncEnabled && !explicitTarget ? 'INCREMENTAL' : 'FULL')
    const requestedTarget =
        explicitTarget ?? (strategy === 'INCREMENTAL' ? recentSyncTarget : advertisedTotalReviews ?? hardMaxReviews)
    const targetReviewCount = Math.min(requestedTarget, hardMaxReviews)

    return {
        advertisedTotalReviews: advertisedTotalReviews ?? null,
        explicitTarget,
        hardMaxReviews,
        strategy,
        targetReviewCount,
        duplicateStreakLimit: env.REVIEW_BROWSER_DUPLICATE_STREAK_LIMIT,
        minReviewsBeforeEarlyStop: env.REVIEW_BROWSER_MIN_REVIEWS_BEFORE_EARLY_STOP,
    }
}

async function loadPlaywright() {
    try {
        return require('playwright')
    } catch {
        throw serviceUnavailable(
            'PLAYWRIGHT_NOT_INSTALLED',
            'Playwright is not installed on the server',
            {
                hint: 'Run `npm install playwright` in backend-sentify',
            },
        )
    }
}

async function maybeAcceptConsent(page) {
    for (const pattern of CONSENT_BUTTON_PATTERNS) {
        const button = page.getByRole('button', { name: pattern }).first()

        if ((await button.count()) === 0) {
            continue
        }

        try {
            await button.click({
                timeout: 1500,
            })
            await page.waitForTimeout(180)
            return true
        } catch {
            // ignore and continue scanning known consent labels
        }
    }

    return false
}

async function clickVisibleControlByPatterns(page, patterns, options = {}) {
    return page
        .evaluate(({ patternSources, selector, maxCandidates, maxLabelLength }) => {
            const compiledPatterns = patternSources.map((source) => new RegExp(source, 'iu'))
            const isVisible = (node) => {
                if (!(node instanceof HTMLElement)) {
                    return false
                }

                const style = window.getComputedStyle(node)
                if (style.visibility === 'hidden' || style.display === 'none') {
                    return false
                }

                const rect = node.getBoundingClientRect()
                return rect.width > 0 && rect.height > 0
            }

            const getLabel = (node) => {
                if (!(node instanceof HTMLElement)) {
                    return ''
                }

                return [
                    node.getAttribute('aria-label') || '',
                    node.textContent || '',
                    node.getAttribute('data-value') || '',
                ]
                    .join(' ')
                    .slice(0, maxLabelLength)
                    .replace(/\s+/g, ' ')
                    .trim()
            }

            const controls = [...document.querySelectorAll(selector)].slice(0, maxCandidates)

            for (const control of controls) {
                if (!isVisible(control)) {
                    continue
                }

                const label = getLabel(control)

                if (!label) {
                    continue
                }

                if (compiledPatterns.some((pattern) => pattern.test(label))) {
                    control.click()
                    return label
                }
            }

            return null
        }, {
            patternSources: patterns.map((pattern) => pattern.source),
            selector:
                options.selector ||
                'button,[role="button"],[role="menuitemradio"],[role="menuitem"],[role="option"]',
            maxCandidates: options.maxCandidates || 180,
            maxLabelLength: options.maxLabelLength || 220,
        })
        .catch(() => null)
}

async function maybeSortReviewsByNewest(page, enabled) {
    const timings = {}
    let stepStartedAt = Date.now()
    const markStep = (name) => {
        const now = Date.now()
        timings[name] = now - stepStartedAt
        stepStartedAt = now
    }

    if (!enabled) {
        return {
            applied: false,
            timings,
        }
    }

    const sortTriggerLabel = await clickVisibleControlByPatterns(page, SORT_TRIGGER_PATTERNS, {
        selector: 'button,[role="button"],[role="menuitemradio"],[role="menuitem"]',
        maxCandidates: 100,
        maxLabelLength: 120,
    })

    if (!sortTriggerLabel) {
        return {
            applied: false,
            timings,
        }
    }
    markStep('clickSortTrigger')

    await page.waitForTimeout(160)
    const newestLabel = await clickVisibleControlByPatterns(page, SORT_NEWEST_PATTERNS, {
        selector: 'button,[role="menuitemradio"],[role="menuitem"],[role="option"]',
        maxCandidates: 80,
        maxLabelLength: 120,
    })
    markStep('clickNewestOption')

    if (!newestLabel) {
        return {
            applied: false,
            timings,
        }
    }

    await page.waitForTimeout(600)
    await waitForReviewCards(page, 1, 3000).catch(() => {})
    markStep('waitAfterSort')
    return {
        applied: true,
        timings,
    }
}

async function installStealthScript(context) {
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            configurable: true,
            get: () => undefined,
        })
    })
}

function shouldAbortRequest(request) {
    const resourceType = request.resourceType()

    if (NON_TEXT_RESOURCE_TYPES.has(resourceType)) {
        return true
    }

    const requestUrl = request.url()

    return NON_TEXT_URL_PATTERNS.some((pattern) => pattern.test(requestUrl))
}

async function installRequestFiltering(context) {
    await context.route('**/*', (route) => {
        if (shouldAbortRequest(route.request())) {
            return route.abort().catch(() => {})
        }

        return route.continue().catch(() => {})
    })
}

async function createStorageStateSnapshot(chromium, sessionOptions) {
    const snapshotDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'sentify-review-browser-'))
    const snapshotPath = path.join(snapshotDirectory, 'storage-state.json')
    const profileArgs = ['--disable-blink-features=AutomationControlled']

    if (env.REVIEW_BROWSER_PROFILE_DIRECTORY_VALUE) {
        profileArgs.push(`--profile-directory=${env.REVIEW_BROWSER_PROFILE_DIRECTORY_VALUE}`)
    }

    const bootstrapContext = await chromium.launchPersistentContext(env.REVIEW_BROWSER_USER_DATA_DIR_ROOT, {
        headless: true,
        channel: sessionOptions.channel,
        executablePath: sessionOptions.executablePath,
        locale: sessionOptions.locale,
        userAgent: sessionOptions.userAgent,
        timeout: env.REVIEW_BROWSER_PROFILE_BOOTSTRAP_TIMEOUT_MS,
        args: profileArgs,
    })

    try {
        await installStealthScript(bootstrapContext)
        await bootstrapContext.storageState({
            path: snapshotPath,
        })

        return {
            snapshotPath,
            cleanup: async () => {
                await fs.rm(snapshotDirectory, {
                    recursive: true,
                    force: true,
                })
            },
        }
    } finally {
        await bootstrapContext.close().catch(() => {})
    }
}

function clearSharedBrowserIdleTimer() {
    if (sharedBrowserIdleTimer) {
        clearTimeout(sharedBrowserIdleTimer)
        sharedBrowserIdleTimer = null
    }
}

async function closeSharedBrowser() {
    clearSharedBrowserIdleTimer()

    if (!sharedBrowserPromise) {
        return
    }

    const browserPromise = sharedBrowserPromise
    sharedBrowserPromise = null

    const browser = await browserPromise.catch(() => null)
    await browser?.close().catch(() => {})
}

function scheduleSharedBrowserClose() {
    clearSharedBrowserIdleTimer()

    if (!sharedBrowserPromise || activeBrowserSessionCount > 0) {
        return
    }

    sharedBrowserIdleTimer = setTimeout(() => {
        void closeSharedBrowser()
    }, env.REVIEW_BROWSER_IDLE_CLOSE_MS)
    sharedBrowserIdleTimer.unref?.()
}

async function getSharedBrowser(chromium, sessionOptions) {
    clearSharedBrowserIdleTimer()

    if (!sharedBrowserPromise) {
        sharedBrowserPromise = chromium
            .launch({
                headless: sessionOptions.headless,
                channel: sessionOptions.channel,
                executablePath: sessionOptions.executablePath,
                args: ['--disable-blink-features=AutomationControlled'],
            })
            .catch((error) => {
                sharedBrowserPromise = null
                throw error
            })
    }

    return sharedBrowserPromise
}

async function cleanupCachedStorageStateSnapshot(snapshot) {
    await snapshot?.cleanup?.().catch(() => {})
}

async function getCachedStorageStateSnapshot(chromium, sessionOptions) {
    if (!env.REVIEW_BROWSER_USER_DATA_DIR_ROOT) {
        return null
    }

    const now = Date.now()

    if (cachedStorageStateSnapshot && cachedStorageStateSnapshot.expiresAt > now) {
        return cachedStorageStateSnapshot
    }

    if (cachedStorageStatePromise) {
        return cachedStorageStatePromise
    }

    cachedStorageStatePromise = (async () => {
        const previousSnapshot = cachedStorageStateSnapshot
        let nextSnapshot = null

        try {
            nextSnapshot = await createStorageStateSnapshot(chromium, sessionOptions)
        } catch {
            nextSnapshot = {
                snapshotPath: undefined,
                cleanup: async () => {},
            }
        }

        cachedStorageStateSnapshot = {
            ...nextSnapshot,
            expiresAt: Date.now() + env.REVIEW_BROWSER_STATE_CACHE_MS,
        }
        await cleanupCachedStorageStateSnapshot(previousSnapshot)
        return cachedStorageStateSnapshot
    })()

    try {
        return await cachedStorageStatePromise
    } finally {
        cachedStorageStatePromise = null
    }
}

async function createBrowserSession(chromium, options = {}) {
    const sessionOptions = {
        headless: env.REVIEW_BROWSER_HEADLESS_VALUE,
        channel: env.REVIEW_BROWSER_CHANNEL,
        executablePath: env.REVIEW_BROWSER_EXECUTABLE_PATH,
        locale: normalizeLocale(env.REVIEW_BROWSER_LANGUAGE_CODE),
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }

    const storageStateSnapshot = options.useStorageState
        ? await getCachedStorageStateSnapshot(chromium, sessionOptions)
        : null
    const browser = await getSharedBrowser(chromium, sessionOptions)
    const context = await browser.newContext({
        locale: sessionOptions.locale,
        userAgent: sessionOptions.userAgent,
        storageState: storageStateSnapshot?.snapshotPath,
    })
    await installRequestFiltering(context)
    await installStealthScript(context)
    const page = await context.newPage()
    activeBrowserSessionCount += 1

    return {
        page,
        close: async () => {
            await context.close().catch(() => {})
            activeBrowserSessionCount = Math.max(activeBrowserSessionCount - 1, 0)
            scheduleSharedBrowserClose()
        },
    }
}

async function waitForReviewCards(page, minimumCards = 1, timeoutMs = 6000) {
    try {
        await page.waitForFunction(
            ({ cardSelector, minimumCount }) =>
                document.querySelectorAll(cardSelector).length >= minimumCount,
            {
                cardSelector: REVIEW_CARD_SELECTOR,
                minimumCount: minimumCards,
            },
            {
                timeout: timeoutMs,
            },
        )
        return true
    } catch {
        return false
    }
}

async function getReviewCardCount(page) {
    return page.locator(REVIEW_CARD_SELECTOR).count()
}

async function getReviewFeedSnapshot(page) {
    return page.evaluate(
        ({ cardSelector, scrollerSelector }) => {
            const scroller = document.querySelector(scrollerSelector)

            return {
                reviewCount: document.querySelectorAll(cardSelector).length,
                scrollTop: scroller?.scrollTop || 0,
                clientHeight: scroller?.clientHeight || 0,
                scrollHeight: scroller?.scrollHeight || 0,
            }
        },
        {
            cardSelector: REVIEW_CARD_SELECTOR,
            scrollerSelector: REVIEW_SCROLLER_SELECTOR,
        },
    )
}

async function waitForReviewFeedGrowth(page, previousReviewCount, previousScrollHeight, timeoutMs) {
    try {
        await page.waitForFunction(
            ({ cardSelector, scrollerSelector, previousReviewCount, previousScrollHeight }) => {
                const reviewCount = document.querySelectorAll(cardSelector).length

                if (reviewCount > previousReviewCount) {
                    return true
                }

                const scroller = document.querySelector(scrollerSelector)

                if (!scroller) {
                    return false
                }

                return scroller.scrollHeight > previousScrollHeight + 16
            },
            {
                cardSelector: REVIEW_CARD_SELECTOR,
                scrollerSelector: REVIEW_SCROLLER_SELECTOR,
                previousReviewCount,
                previousScrollHeight,
            },
            {
                timeout: timeoutMs,
            },
        )
        return true
    } catch {
        return false
    }
}

async function clickReviewTrigger(page) {
    const fastTriggerLabel = await clickVisibleControlByPatterns(page, REVIEW_TRIGGER_PATTERNS, {
        selector: 'button,[role="tab"],[role="button"],a,[role="link"]',
        maxCandidates: 120,
        maxLabelLength: 120,
    })

    if (fastTriggerLabel) {
        await page.waitForTimeout(400)
        return true
    }

    const roles = ['button', 'tab', 'link']

    for (const role of roles) {
        for (const pattern of REVIEW_TRIGGER_PATTERNS) {
            const candidate = page.getByRole(role, { name: pattern }).first()

            if ((await candidate.count()) === 0) {
                continue
            }

            try {
                await candidate.click({
                    timeout: 2500,
                })
                await page.waitForTimeout(900)
                return true
            } catch {
                // keep trying the next candidate
            }
        }
    }

    return false
}

async function markReviewScroller(page) {
    return page.evaluate(
        ({ cardSelector, markerAttribute }) => {
            document
                .querySelectorAll(`[${markerAttribute}]`)
                .forEach((node) => node.removeAttribute(markerAttribute))

            const firstCard = document.querySelector(cardSelector)

            if (!firstCard) {
                return false
            }

            let current = firstCard.parentElement

            while (current) {
                const style = window.getComputedStyle(current)
                const overflowY = style.overflowY
                const isScrollable =
                    (overflowY === 'auto' || overflowY === 'scroll') &&
                    current.scrollHeight > current.clientHeight + 48

                if (isScrollable) {
                    current.setAttribute(markerAttribute, 'true')
                    return true
                }

                current = current.parentElement
            }

            return false
        },
        {
            cardSelector: REVIEW_CARD_SELECTOR,
            markerAttribute: REVIEW_SCROLLER_ATTRIBUTE,
        },
    )
}

async function extractAdvertisedReviewCountCandidates(page) {
    const selector = 'button, [role="button"], [role="tab"], [aria-label], .F7nice, .jANrlb'
    const texts = await page
        .locator(selector)
        .evaluateAll((nodes) =>
            nodes
                .slice(0, 240)
                .flatMap((node) => [node.textContent, node.getAttribute?.('aria-label')])
                .filter((value) => typeof value === 'string')
                .map((value) => value.normalize('NFC').replace(/\s+/g, ' ').trim())
                .filter((value) => value.length <= 80)
                .filter(Boolean),
        )
        .catch(() => [])

    const counts = texts.map(extractReviewCountFromText).filter((value) => Number.isInteger(value))

    if (counts.length > 0) {
        return [...new Set(counts)].sort((left, right) => left - right)
    }

    const bodyLines = await page
        .locator('body')
        .evaluate((node) =>
            (node.innerText || '')
                .split('\n')
                .map((line) => line.normalize('NFC').replace(/\s+/g, ' ').trim())
                .filter(Boolean),
        )
        .catch(() => [])

    const fallbackCounts = bodyLines
        .map(extractReviewCountFromText)
        .filter((value) => Number.isInteger(value))

    if (fallbackCounts.length === 0) {
        return []
    }

    return [...new Set(fallbackCounts)].sort((left, right) => left - right)
}

function pickAdvertisedReviewCount(countCandidates, collectedReviewCount) {
    if (!Array.isArray(countCandidates) || countCandidates.length === 0) {
        return null
    }

    const eligibleCounts = countCandidates.filter((count) => count >= collectedReviewCount)

    if (eligibleCounts.length > 0) {
        return eligibleCounts[0]
    }

    return countCandidates.at(-1) || null
}

async function openReviewsPanel(page) {
    const timings = {}
    let stepStartedAt = Date.now()
    const markStep = (name) => {
        const now = Date.now()
        timings[name] = now - stepStartedAt
        stepStartedAt = now
    }
    const inlineReviewCount = await getReviewCardCount(page)
    markStep('countInlineCards')
    const clickedTrigger = await clickReviewTrigger(page)
    markStep('clickReviewTrigger')

    if (clickedTrigger) {
        await waitForReviewCards(page, Math.max(1, inlineReviewCount), 8000)
        markStep('waitAfterTrigger')
    }

    let reviewCount = await getReviewCardCount(page)
    markStep('countCardsAfterTrigger')

    if (reviewCount === 0 && !clickedTrigger) {
        await clickReviewTrigger(page)
        await waitForReviewCards(page, 1, 8000)
        reviewCount = await getReviewCardCount(page)
        markStep('fallbackTrigger')
    }

    if (reviewCount === 0) {
        const pageText = (await page.locator('body').innerText().catch(() => '')) || ''

        if (LIMITED_VIEW_PATTERN.test(pageText)) {
            throw badGateway(
                'SCRAPE_FAILED',
                'Google Maps is serving a limited view, so the browser tool cannot reach full reviews',
                {
                    hint: env.REVIEW_BROWSER_USER_DATA_DIR
                        ? 'The configured browser profile still received a limited Maps view. Refresh the profile or use a direct place URL.'
                        : 'Set REVIEW_BROWSER_USER_DATA_DIR (or REVIEW_BROWSER_PROFILE_DIRECTORY) to a browser profile that can open the full Google Maps place page.',
                },
            )
        }

        throw badGateway(
            'SCRAPE_FAILED',
            'Could not find visible review cards on the Google Maps page',
            {
                hint: 'Use a direct Google Maps place URL or a maps.app.goo.gl share link instead of a generic search or region URL.',
            },
        )
    }

    const advertisedReviewCountCandidates = await extractAdvertisedReviewCountCandidates(page)
    markStep('extractAdvertisedCount')
    const foundScroller = await markReviewScroller(page)
    markStep('markReviewScroller')

    return {
        advertisedReviewCountCandidates,
        reviewScroller: foundScroller ? page.locator(REVIEW_SCROLLER_SELECTOR).first() : null,
        timings,
    }
}

async function expandVisibleReviewBodies(page) {
    const clickedButtons = await page
        .evaluate((selector) => {
            const viewportHeight =
                window.innerHeight || document.documentElement.clientHeight || 0
            const buttons = [...document.querySelectorAll(selector)].slice(0, 36)
            let clicked = 0

            for (const button of buttons) {
                if (!(button instanceof HTMLElement) || button.hasAttribute('disabled')) {
                    continue
                }

                const rect = button.getBoundingClientRect()
                const isVisible =
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.bottom >= -24 &&
                    rect.top <= viewportHeight + 24

                if (!isVisible) {
                    continue
                }

                button.click()
                clicked += 1
            }

            return clicked
        }, EXPAND_REVIEW_BUTTON_SELECTOR)
        .catch(() => 0)

    if (clickedButtons > 0) {
        await page.waitForTimeout(Math.min(120 + clickedButtons * 12, 260))
    }
}

async function collectRawReviews(page, maxReviews) {
    const cards = page.locator(REVIEW_CARD_SELECTOR)

    return cards.evaluateAll((nodes, reviewLimit) => {
        const selectedNodes = nodes.slice(0, reviewLimit)

        function normalizeText(value) {
            if (typeof value !== 'string') {
                return null
            }

            const normalizedValue = value.normalize('NFC').replace(/\s+/g, ' ').trim()
            return normalizedValue || null
        }

        function pickText(root, selectors) {
            for (const selector of selectors) {
                const node = root.querySelector(selector)
                const text = normalizeText(node?.textContent ?? null)

                if (text) {
                    return text
                }
            }

            return null
        }

        return selectedNodes.map((node) => {
            const ratingNode = node.querySelector(
                '.kvMYJc, [role="img"][aria-label*="star"], [role="img"][aria-label*="Star"]',
            )

            return {
                externalId: normalizeText(node.getAttribute('data-review-id')) || null,
                authorName: pickText(node, [
                    '.d4r55',
                    '.TSUbDb',
                    '[data-review-author]',
                    'button[aria-label*="review by"]',
                ]),
                ratingLabel:
                    normalizeText(ratingNode?.getAttribute('aria-label')) ||
                    normalizeText(node.getAttribute('aria-label')) ||
                    null,
                content: pickText(node, [
                    '.wiI7pd',
                    '.MyEned',
                    '[data-review-text]',
                    '.fontBodyMedium span',
                ]),
                reviewDateLabel: pickText(node, ['.rsqaWe', '.xRkPPb', 'span[class*="rsqaWe"]']),
            }
        })
    }, maxReviews)
}

async function collectVisibleReviewExternalIds(page, maxReviews) {
    return page
        .locator(REVIEW_CARD_SELECTOR)
        .evaluateAll((nodes, reviewLimit) => {
            return nodes
                .slice(0, reviewLimit)
                .map((node) => node.getAttribute('data-review-id'))
                .filter((value) => typeof value === 'string' && value.trim().length > 0)
                .map((value) => value.trim())
        }, maxReviews)
        .catch(() => [])
}

function computeScrollPassBudget(collectionPlan) {
    const targetReviewCount = collectionPlan?.domTargetReviewCount ?? collectionPlan?.targetReviewCount

    if (!Number.isInteger(targetReviewCount) || targetReviewCount <= 0) {
        return Math.max(env.REVIEW_BROWSER_SCROLL_STEPS, 60)
    }

    if (collectionPlan?.strategy === 'INCREMENTAL') {
        return Math.max(
            env.REVIEW_BROWSER_SCROLL_STEPS,
            Math.ceil(targetReviewCount / 6) + env.REVIEW_BROWSER_STALL_LIMIT * 2,
        )
    }

    return Math.max(env.REVIEW_BROWSER_SCROLL_STEPS, 60, Math.ceil(targetReviewCount / 4) * 2)
}

async function scrollReviewFeed(page, reviewScroller, collectionPlan) {
    const timings = {}
    let stepStartedAt = Date.now()
    const markStep = (name) => {
        const now = Date.now()
        timings[name] = (timings[name] || 0) + (now - stepStartedAt)
        stepStartedAt = now
    }
    const domTargetReviewCount = Math.max(
        collectionPlan.domTargetReviewCount ?? collectionPlan.targetReviewCount,
        0,
    )

    if (!reviewScroller) {
        await expandVisibleReviewBodies(page)
        return {
            collectedCardCount: await getReviewCardCount(page),
            reachedEndOfFeed: true,
            earlyStopped: false,
            duplicateStreak: 0,
            scrollPasses: 0,
            stalledIterations: 0,
            timings,
        }
    }

    await reviewScroller.evaluate((node) => {
        node.scrollTo(0, 0)
    })
    await page.waitForTimeout(500)
    await waitForReviewCards(page, 1, 3000)
    markStep('primeScroller')

    const maxScrollPasses = computeScrollPassBudget(collectionPlan)
    let stalledIterations = 0
    let reachedEndOfFeed = false
    let earlyStopped = false
    let duplicateStreak = 0
    let scrollPasses = 0
    const observedReviewIds = new Set()
    const canUseEarlyStop =
        collectionPlan.strategy === 'INCREMENTAL' &&
        collectionPlan.sortedByNewest &&
        collectionPlan.knownExternalIds instanceof Set &&
        collectionPlan.knownExternalIds.size > 0

    if (canUseEarlyStop) {
        const initialVisibleReviewIds = await collectVisibleReviewExternalIds(
            page,
            Math.min(await getReviewCardCount(page), domTargetReviewCount),
        )

        for (const reviewId of initialVisibleReviewIds) {
            if (observedReviewIds.has(reviewId)) {
                continue
            }

            observedReviewIds.add(reviewId)

            if (collectionPlan.knownExternalIds.has(reviewId)) {
                duplicateStreak += 1
            } else {
                duplicateStreak = 0
            }
        }

        if (
            observedReviewIds.size >= collectionPlan.minReviewsBeforeEarlyStop &&
            duplicateStreak >= collectionPlan.duplicateStreakLimit
        ) {
            await expandVisibleReviewBodies(page)

            return {
                collectedCardCount: await getReviewCardCount(page),
                reachedEndOfFeed: false,
                earlyStopped: true,
                duplicateStreak,
                scrollPasses,
                stalledIterations,
            }
        }
    }

    for (let index = 0; index < maxScrollPasses; index += 1) {
        scrollPasses += 1
        const reviewCountBeforeScroll = await getReviewCardCount(page)
        markStep('countBeforeScroll')

        if (reviewCountBeforeScroll >= domTargetReviewCount) {
            break
        }

        const isNearTarget =
            domTargetReviewCount > 0 &&
            reviewCountBeforeScroll >= Math.floor(domTargetReviewCount * 0.8)

        const expansionInterval = collectionPlan.strategy === 'INCREMENTAL' ? 10 : 6

        if (scrollPasses === 1 || scrollPasses % expansionInterval === 0 || isNearTarget) {
            await expandVisibleReviewBodies(page)
            markStep('expandVisibleBodies')
        }

        const scrollStateBefore = await getReviewFeedSnapshot(page)
        markStep('snapshotBeforeScroll')
        const scrollDelta = isNearTarget
            ? Math.max(scrollStateBefore.clientHeight * 0.9, 360)
            : Math.max(scrollStateBefore.clientHeight * 2.25, 960)

        await reviewScroller.evaluate((node, delta) => {
            node.scrollBy(0, delta)
        }, scrollDelta)
        const growthWaitTimeout =
            collectionPlan.strategy === 'INCREMENTAL'
                ? Math.max(650, Math.floor(env.REVIEW_BROWSER_SCROLL_DELAY_MS * 1.5))
                : env.REVIEW_BROWSER_SCROLL_DELAY_MS
        await waitForReviewFeedGrowth(
            page,
            scrollStateBefore.reviewCount,
            scrollStateBefore.scrollHeight,
            growthWaitTimeout,
        )
        markStep('waitForFeedGrowth')

        const scrollStateAfter = await getReviewFeedSnapshot(page)
        const reviewCountAfterScroll = scrollStateAfter.reviewCount
        markStep('snapshotAfterScroll')

        if (canUseEarlyStop) {
            const visibleReviewIds = await collectVisibleReviewExternalIds(
                page,
                Math.min(reviewCountAfterScroll, domTargetReviewCount),
            )
            markStep('collectVisibleIds')

            for (const reviewId of visibleReviewIds) {
                if (observedReviewIds.has(reviewId)) {
                    continue
                }

                observedReviewIds.add(reviewId)

                if (collectionPlan.knownExternalIds.has(reviewId)) {
                    duplicateStreak += 1
                } else {
                    duplicateStreak = 0
                }
            }

            if (
                observedReviewIds.size >= collectionPlan.minReviewsBeforeEarlyStop &&
                duplicateStreak >= collectionPlan.duplicateStreakLimit
            ) {
                earlyStopped = true
                break
            }
        }

        const atBottom =
            scrollStateAfter.scrollTop + scrollStateAfter.clientHeight >=
            scrollStateAfter.scrollHeight - 24
        const didMove =
            scrollStateAfter.scrollTop > scrollStateBefore.scrollTop + 24 ||
            scrollStateAfter.scrollHeight > scrollStateBefore.scrollHeight + 24
        const didGrow = reviewCountAfterScroll > reviewCountBeforeScroll

        if (didMove || didGrow) {
            stalledIterations = 0
        } else {
            stalledIterations += 1
        }

        if (stalledIterations >= env.REVIEW_BROWSER_STALL_LIMIT && atBottom) {
            await reviewScroller.evaluate((node) => {
                node.scrollBy(0, -Math.max(node.clientHeight * 0.4, 220))
            })
            await page.waitForTimeout(Math.max(env.REVIEW_BROWSER_SCROLL_DELAY_MS / 2, 250))
            await reviewScroller.evaluate((node) => {
                node.scrollBy(0, Math.max(node.clientHeight * 0.7, 320))
            })
            await page.waitForTimeout(env.REVIEW_BROWSER_SCROLL_DELAY_MS)

            const recoveredCount = await getReviewCardCount(page)
            markStep('attemptRecover')

            if (recoveredCount > reviewCountAfterScroll) {
                stalledIterations = 0
                continue
            }

            reachedEndOfFeed = true
            break
        }
    }

    await expandVisibleReviewBodies(page)
    markStep('finalExpand')

    return {
        collectedCardCount: await getReviewCardCount(page),
        reachedEndOfFeed,
        earlyStopped,
        duplicateStreak,
        scrollPasses,
        stalledIterations,
        timings,
    }
}

async function scrapeGoogleReviewsWithBrowserDetailed({
    googleMapUrl,
    restaurantName,
    restaurantAddress,
    knownExternalIds,
    explicitTargetOverride,
    strategyOverride,
    preferNewest,
}) {
    const { chromium } = await loadPlaywright()
    const browserUrl = buildAutomationUrl(googleMapUrl, restaurantName, restaurantAddress)
    const searchFallbackUrl = buildSearchFallbackUrl(restaurantName, restaurantAddress)
    const phaseTimingsMs = {}
    let phaseStartedAt = Date.now()

    const markPhase = (phaseName) => {
        const now = Date.now()
        phaseTimingsMs[phaseName] = now - phaseStartedAt
        phaseStartedAt = now
    }

    async function runScrapeAttempt({ useStorageState }) {
        let session
        let usedSearchFallback = false

        phaseStartedAt = Date.now()
        Object.keys(phaseTimingsMs).forEach((key) => delete phaseTimingsMs[key])

        try {
            session = await createBrowserSession(chromium, {
                useStorageState,
            })
            const { page } = session
            const networkReviewCapture = createNetworkReviewCapture(page)
            markPhase('bootstrap')

            await page.goto(browserUrl, {
                waitUntil: 'domcontentloaded',
                timeout: env.REVIEW_BROWSER_TIMEOUT_MS,
            })
            await page
                .waitForLoadState('networkidle', {
                    timeout: Math.min(env.REVIEW_BROWSER_TIMEOUT_MS, 2500),
                })
                .catch(() => {})
    
            if (
                searchFallbackUrl &&
                (isUnresolvedPlaceUrl(page.url()) ||
                    !(await pageHasRestaurantIdentity(page, restaurantName)))
            ) {
                await page.goto(searchFallbackUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: env.REVIEW_BROWSER_TIMEOUT_MS,
                })
                await page
                    .waitForLoadState('networkidle', {
                        timeout: Math.min(env.REVIEW_BROWSER_TIMEOUT_MS, 2500),
                    })
                    .catch(() => {})
                usedSearchFallback = true
            }

            markPhase('navigate')

            await maybeAcceptConsent(page)
            let openReviewsPanelResult

            try {
                openReviewsPanelResult = await openReviewsPanel(page)
            } catch (error) {
                if (!usedSearchFallback && searchFallbackUrl && isRecoverableReviewPanelFailure(error)) {
                    await page.goto(searchFallbackUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: env.REVIEW_BROWSER_TIMEOUT_MS,
                    })
                    await page
                        .waitForLoadState('networkidle', {
                            timeout: Math.min(env.REVIEW_BROWSER_TIMEOUT_MS, 2500),
                        })
                        .catch(() => {})
                    usedSearchFallback = true
                    await maybeAcceptConsent(page)
                    openReviewsPanelResult = await openReviewsPanel(page)
                } else {
                    throw error
                }
            }

            const {
                reviewScroller,
                advertisedReviewCountCandidates,
                timings: openReviewsPanelTimings,
            } = openReviewsPanelResult
            markPhase('openReviewsPanel')
            const collectionPlan = buildReviewCollectionPlan({
                advertisedTotalReviews: advertisedReviewCountCandidates?.at(-1) ?? null,
                smartSyncEnabled: knownExternalIds instanceof Set && knownExternalIds.size > 0,
                explicitTargetOverride,
                strategyOverride,
            })
            collectionPlan.knownExternalIds = knownExternalIds
            const sortResult = await maybeSortReviewsByNewest(
                page,
                preferNewest || collectionPlan.strategy === 'INCREMENTAL',
            )
            collectionPlan.sortedByNewest = sortResult.applied
            markPhase('sort')
            await page.waitForTimeout(collectionPlan.strategy === 'INCREMENTAL' ? 900 : 220)

            const rawNetworkReviews = await networkReviewCapture.getRawReviews()
            const networkSeedReviews = normalizeBrowserReviews(rawNetworkReviews)
            collectionPlan.networkSeedReviewCount = networkSeedReviews.length
            collectionPlan.domTargetReviewCount =
                collectionPlan.strategy === 'INCREMENTAL'
                    ? Math.max(collectionPlan.targetReviewCount - networkSeedReviews.length, 0)
                    : collectionPlan.targetReviewCount
            markPhase('networkSeed')

            const scrollMetadata =
                collectionPlan.domTargetReviewCount > 0
                    ? await scrollReviewFeed(page, reviewScroller, collectionPlan)
                    : {
                          collectedCardCount: 0,
                          reachedEndOfFeed: false,
                          earlyStopped: false,
                          duplicateStreak: 0,
                          scrollPasses: 0,
                          stalledIterations: 0,
                      }
            markPhase('scroll')

            const domRawReviews =
                collectionPlan.domTargetReviewCount > 0
                    ? await collectRawReviews(page, collectionPlan.domTargetReviewCount)
                    : []
            const rawReviews = [...rawNetworkReviews, ...domRawReviews]
            const reviews = normalizeBrowserReviews(rawReviews)
            markPhase('collectAndNormalize')
            const advertisedTotalReviewsCandidate = pickAdvertisedReviewCount(
                advertisedReviewCountCandidates,
                reviews.length,
            )
            const advertisedTotalReviews =
                scrollMetadata.reachedEndOfFeed &&
                advertisedTotalReviewsCandidate !== null &&
                advertisedTotalReviewsCandidate > Math.ceil(reviews.length * 1.5)
                    ? null
                    : advertisedTotalReviewsCandidate

            if (reviews.length === 0) {
                throw badGateway(
                    'SCRAPE_FAILED',
                    'Browser review tool could not extract any reviews from the Google Maps page',
                )
            }

            await session.close()

            return {
                reviews,
                metadata: {
                    source: 'google-maps-browser',
                    advertisedTotalReviews,
                    explicitTarget: collectionPlan.explicitTarget,
                    hardMaxReviews: collectionPlan.hardMaxReviews,
                    strategy: collectionPlan.strategy,
                    sortedByNewest: collectionPlan.sortedByNewest,
                    targetReviewCount: collectionPlan.targetReviewCount,
                    domTargetReviewCount: collectionPlan.domTargetReviewCount,
                    networkSeedReviewCount: networkSeedReviews.length,
                    usedProfileStorageState: useStorageState,
                    usedSearchFallback,
                    rawReviewCount: rawReviews.length,
                    normalizedReviewCount: reviews.length,
                    reachedRequestedTarget: reviews.length >= collectionPlan.targetReviewCount,
                    reachedEndOfFeed:
                        scrollMetadata.reachedEndOfFeed ||
                        (advertisedTotalReviews !== null &&
                            reviews.length >= advertisedTotalReviews),
                    earlyStopped: scrollMetadata.earlyStopped,
                    duplicateStreak: scrollMetadata.duplicateStreak,
                    scrollPasses: scrollMetadata.scrollPasses,
                    stalledIterations: scrollMetadata.stalledIterations,
                    phaseTimingsMs,
                    internalTimingsMs: {
                        openReviewsPanel: openReviewsPanelTimings,
                        sort: sortResult.timings,
                        scroll: scrollMetadata.timings,
                    },
                },
            }
        } catch (error) {
            if (session) {
                await session.close().catch(() => {})
            }

            throw error
        }
    }

    try {
        return await runScrapeAttempt({
            useStorageState: false,
        })
    } catch (error) {
        if (
            env.REVIEW_BROWSER_USER_DATA_DIR_ROOT &&
            isRecoverableReviewPanelFailure(error)
        ) {
            try {
                return await runScrapeAttempt({
                    useStorageState: true,
                })
            } catch (profileError) {
                error = profileError
            }
        }

        if (error?.statusCode) {
            throw error
        }

        const message = error?.message || 'Unknown browser import failure'

        if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
            throw serviceUnavailable(
                'PLAYWRIGHT_BROWSER_NOT_INSTALLED',
                'Playwright Chromium browser is not installed on the server',
                {
                    hint: 'Run `npx playwright install chromium` in backend-sentify',
                },
            )
        }

        throw badGateway('SCRAPE_FAILED', 'Browser review import failed', {
            upstream: 'playwright-browser',
            cause: (error?.message || message),
        })
    }
}

async function scrapeGoogleReviewsWithBrowser(params) {
    const { reviews } = await scrapeGoogleReviewsWithBrowserDetailed(params)
    return reviews
}

module.exports = {
    scrapeGoogleReviewsWithBrowser,
    scrapeGoogleReviewsWithBrowserDetailed,
    __private: {
        buildAutomationUrl,
        buildSearchFallbackUrl,
        buildReviewCollectionPlan,
        computeScrollPassBudget,
        extractRatingFromLabel,
        extractReviewCountFromText,
        extractRawNetworkReviewsFromPayloadText,
        isUnresolvedPlaceUrl,
        pageHasRestaurantIdentity,
        pickAdvertisedReviewCount,
        normalizeBrowserReviews,
        normalizeVisibleText,
        parseReviewDateLabel,
        shouldAbortRequest,
        maybeSortReviewsByNewest,
    },
}
