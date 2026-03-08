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
const ABSOLUTE_VI_DATE_PATTERN = /^(\d{1,2})\s*thg\s*(\d{1,2}),?\s*(\d{4})$/iu
const ABSOLUTE_JA_DATE_PATTERN = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/u
const ABSOLUTE_SLASH_DATE_PATTERN = /^(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})$/

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

function buildReviewCollectionPlan({ advertisedTotalReviews }) {
    const explicitTarget =
        env.REVIEW_BROWSER_MAX_REVIEWS > 0 ? env.REVIEW_BROWSER_MAX_REVIEWS : null
    const hardMaxReviews = env.REVIEW_BROWSER_HARD_MAX_REVIEWS
    const targetReviewCount = Math.min(
        explicitTarget ?? advertisedTotalReviews ?? hardMaxReviews,
        hardMaxReviews,
    )

    return {
        advertisedTotalReviews: advertisedTotalReviews ?? null,
        explicitTarget,
        hardMaxReviews,
        targetReviewCount,
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
            await page.waitForTimeout(500)
            return true
        } catch {
            // ignore and continue scanning known consent labels
        }
    }

    return false
}

async function installStealthScript(context) {
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            configurable: true,
            get: () => undefined,
        })
    })
}

async function createStorageStateSnapshot(chromium, sessionOptions) {
    const snapshotDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'sentify-review-browser-'))
    const snapshotPath = path.join(snapshotDirectory, 'storage-state.json')
    const bootstrapContext = await chromium.launchPersistentContext(env.REVIEW_BROWSER_USER_DATA_DIR, {
        headless: true,
        channel: sessionOptions.channel,
        executablePath: sessionOptions.executablePath,
        locale: sessionOptions.locale,
        userAgent: sessionOptions.userAgent,
        args: ['--disable-blink-features=AutomationControlled'],
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

async function createBrowserSession(chromium) {
    const sessionOptions = {
        headless: env.REVIEW_BROWSER_HEADLESS_VALUE,
        channel: env.REVIEW_BROWSER_CHANNEL,
        executablePath: env.REVIEW_BROWSER_EXECUTABLE_PATH,
        locale: normalizeLocale(env.REVIEW_BROWSER_LANGUAGE_CODE),
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }

    let storageStateSnapshot = null

    if (env.REVIEW_BROWSER_USER_DATA_DIR) {
        storageStateSnapshot = await createStorageStateSnapshot(chromium, sessionOptions)
    }

    const browser = await chromium.launch({
        headless: sessionOptions.headless,
        channel: sessionOptions.channel,
        executablePath: sessionOptions.executablePath,
        args: ['--disable-blink-features=AutomationControlled'],
    })
    const context = await browser.newContext({
        locale: sessionOptions.locale,
        userAgent: sessionOptions.userAgent,
        storageState: storageStateSnapshot?.snapshotPath,
    })
    await installStealthScript(context)
    const page = await context.newPage()

    return {
        page,
        close: async () => {
            await context.close().catch(() => {})
            await browser.close().catch(() => {})
            await storageStateSnapshot?.cleanup?.().catch(() => {})
        },
    }
}

async function waitForReviewCards(page, minimumCards = 1, timeoutMs = 6000) {
    try {
        await page.waitForFunction(
            ({ cardSelector, minimumCount }) =>
                document.querySelectorAll(cardSelector).length >= minimumCount,
            {
                timeout: timeoutMs,
            },
            {
                cardSelector: REVIEW_CARD_SELECTOR,
                minimumCount: minimumCards,
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

async function clickReviewTrigger(page) {
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
                await page.waitForTimeout(1200)
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
    const inlineReviewCount = await getReviewCardCount(page)
    const clickedTrigger = await clickReviewTrigger(page)

    if (clickedTrigger) {
        await waitForReviewCards(page, Math.max(1, inlineReviewCount), 8000)
    }

    let reviewCount = await getReviewCardCount(page)

    if (reviewCount === 0 && !clickedTrigger) {
        await clickReviewTrigger(page)
        await waitForReviewCards(page, 1, 8000)
        reviewCount = await getReviewCardCount(page)
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
                        : 'Set REVIEW_BROWSER_USER_DATA_DIR to a browser profile that can open the full Google Maps place page.',
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
    const foundScroller = await markReviewScroller(page)

    return {
        advertisedReviewCountCandidates,
        reviewScroller: foundScroller ? page.locator(REVIEW_SCROLLER_SELECTOR).first() : null,
    }
}

async function expandVisibleReviewBodies(page) {
    const buttons = page.locator(EXPAND_REVIEW_BUTTON_SELECTOR)
    const count = Math.min(await buttons.count(), 24)

    for (let index = 0; index < count; index += 1) {
        try {
            await buttons.nth(index).click({
                timeout: 750,
            })
        } catch {
            // ignore stale or already-clicked controls
        }
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

function computeScrollPassBudget(targetReviewCount) {
    if (!Number.isInteger(targetReviewCount) || targetReviewCount <= 0) {
        return Math.max(env.REVIEW_BROWSER_SCROLL_STEPS, 60)
    }

    return Math.max(env.REVIEW_BROWSER_SCROLL_STEPS, 60, Math.ceil(targetReviewCount / 4) * 2)
}

async function scrollReviewFeed(page, reviewScroller, collectionPlan) {
    if (!reviewScroller) {
        await expandVisibleReviewBodies(page)
        return {
            collectedCardCount: await getReviewCardCount(page),
            reachedEndOfFeed: true,
            scrollPasses: 0,
            stalledIterations: 0,
        }
    }

    await reviewScroller.evaluate((node) => {
        node.scrollTo(0, 0)
    })
    await page.waitForTimeout(1000)
    await waitForReviewCards(page, 1, 3000)

    const maxScrollPasses = computeScrollPassBudget(collectionPlan.targetReviewCount)
    let stalledIterations = 0
    let reachedEndOfFeed = false
    let scrollPasses = 0

    for (let index = 0; index < maxScrollPasses; index += 1) {
        scrollPasses += 1
        await expandVisibleReviewBodies(page)
        const reviewCountBeforeScroll = await getReviewCardCount(page)

        if (reviewCountBeforeScroll >= collectionPlan.targetReviewCount) {
            break
        }

        const scrollStateBefore = await reviewScroller.evaluate((node) => ({
            top: node.scrollTop,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
        }))
        const isNearTarget =
            collectionPlan.targetReviewCount > 0 &&
            reviewCountBeforeScroll >= Math.floor(collectionPlan.targetReviewCount * 0.7)
        const scrollDelta = isNearTarget
            ? Math.max(scrollStateBefore.clientHeight * 0.9, 360)
            : Math.max(scrollStateBefore.clientHeight * 2.25, 960)

        await reviewScroller.evaluate((node, delta) => {
            node.scrollBy(0, delta)
        }, scrollDelta)
        await page.waitForTimeout(env.REVIEW_BROWSER_SCROLL_DELAY_MS)

        const reviewCountAfterScroll = await getReviewCardCount(page)
        const scrollStateAfter = await reviewScroller.evaluate((node) => ({
            top: node.scrollTop,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
        }))

        const atBottom =
            scrollStateAfter.top + scrollStateAfter.clientHeight >= scrollStateAfter.scrollHeight - 24
        const didMove =
            scrollStateAfter.top > scrollStateBefore.top + 24 ||
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

            if (recoveredCount > reviewCountAfterScroll) {
                stalledIterations = 0
                continue
            }

            reachedEndOfFeed = true
            break
        }
    }

    await expandVisibleReviewBodies(page)

    return {
        collectedCardCount: await getReviewCardCount(page),
        reachedEndOfFeed,
        scrollPasses,
        stalledIterations,
    }
}

async function scrapeGoogleReviewsWithBrowserDetailed({
    googleMapUrl,
    restaurantName,
    restaurantAddress,
}) {
    const { chromium } = await loadPlaywright()
    const browserUrl = buildAutomationUrl(googleMapUrl, restaurantName, restaurantAddress)

    let session

    try {
        session = await createBrowserSession(chromium)
        const { page } = session

        await page.goto(browserUrl, {
            waitUntil: 'domcontentloaded',
            timeout: env.REVIEW_BROWSER_TIMEOUT_MS,
        })
        await page
            .waitForLoadState('networkidle', {
                timeout: Math.min(env.REVIEW_BROWSER_TIMEOUT_MS, 10000),
            })
            .catch(() => {})

        await maybeAcceptConsent(page)
        const { reviewScroller, advertisedReviewCountCandidates } = await openReviewsPanel(page)
        const collectionPlan = buildReviewCollectionPlan({
            advertisedTotalReviews: advertisedReviewCountCandidates?.at(-1) ?? null,
        })
        const scrollMetadata = await scrollReviewFeed(page, reviewScroller, collectionPlan)
        const rawReviews = await collectRawReviews(page, collectionPlan.targetReviewCount)
        const reviews = normalizeBrowserReviews(rawReviews)
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
                targetReviewCount: collectionPlan.targetReviewCount,
                rawReviewCount: rawReviews.length,
                normalizedReviewCount: reviews.length,
                reachedRequestedTarget: reviews.length >= collectionPlan.targetReviewCount,
                reachedEndOfFeed:
                    scrollMetadata.reachedEndOfFeed ||
                    (advertisedTotalReviews !== null && reviews.length >= advertisedTotalReviews),
                scrollPasses: scrollMetadata.scrollPasses,
                stalledIterations: scrollMetadata.stalledIterations,
            },
        }
    } catch (error) {
        if (session) {
            await session.close().catch(() => {})
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
            cause: message,
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
        buildReviewCollectionPlan,
        extractRatingFromLabel,
        extractReviewCountFromText,
        pickAdvertisedReviewCount,
        normalizeBrowserReviews,
        normalizeVisibleText,
        parseReviewDateLabel,
    },
}
