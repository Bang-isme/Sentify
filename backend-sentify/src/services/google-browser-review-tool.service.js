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
    /^đánh giá$/i,
    /^nhận xét$/i,
    /^口コミ$/i,
    /^レビュー$/i,
]
const EXPAND_REVIEW_BUTTON_SELECTOR = [
    'button.w8nwRe',
    'button[aria-label*="More"]',
    'button[aria-label*="more"]',
    'button[aria-label*="See more"]',
    'button[aria-label*="Xem thêm"]',
    'button[aria-label*="続きを読む"]',
].join(',')

function trimOrNull(value) {
    const trimmed = value?.trim()
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

function parseReviewDateLabel(value, now = new Date()) {
    const label = trimOrNull(value)

    if (!label) {
        return null
    }

    const normalizedInput = label.replace(/^edited\s+/i, '').replace(/^đã chỉnh sửa\s+/i, '')
    const parsedDate = new Date(normalizedInput)

    if (!Number.isNaN(parsedDate.valueOf())) {
        return parsedDate
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
    const labels = [
        /accept all/i,
        /i agree/i,
        /^accept$/i,
        /agree/i,
        /đồng ý/i,
        /chấp nhận/i,
        /すべて受け入れる/i,
        /同意/i,
    ]

    for (const pattern of labels) {
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

async function openReviewsPanel(page) {
    const inlineReviewCount = await page.locator(REVIEW_CARD_SELECTOR).count()
    const clickedTrigger = await clickReviewTrigger(page)

    if (clickedTrigger) {
        await waitForReviewCards(page, Math.max(1, inlineReviewCount), 8000)
    }

    let reviewCount = await page.locator(REVIEW_CARD_SELECTOR).count()

    if (reviewCount === 0 && !clickedTrigger) {
        await clickReviewTrigger(page)
        await waitForReviewCards(page, 1, 8000)
        reviewCount = await page.locator(REVIEW_CARD_SELECTOR).count()
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

    const foundScroller = await markReviewScroller(page)
    return foundScroller ? page.locator(REVIEW_SCROLLER_SELECTOR).first() : null
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

async function collectRawReviews(page) {
    const cards = page.locator(REVIEW_CARD_SELECTOR)

    return cards.evaluateAll(
        (nodes, maxReviews) => {
            const selectedNodes = nodes.slice(0, maxReviews)

            function pickText(root, selectors) {
                for (const selector of selectors) {
                    const node = root.querySelector(selector)
                    const text = node?.textContent?.trim()

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
                    externalId: node.getAttribute('data-review-id') || null,
                    authorName: pickText(node, [
                        '.d4r55',
                        '.TSUbDb',
                        '[data-review-author]',
                        'button[aria-label*="review by"]',
                    ]),
                    ratingLabel:
                        ratingNode?.getAttribute('aria-label') ||
                        node.getAttribute('aria-label') ||
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
        },
        env.REVIEW_BROWSER_MAX_REVIEWS,
    )
}

async function scrollReviewFeed(page, reviewScroller) {
    if (!reviewScroller) {
        await expandVisibleReviewBodies(page)
        return
    }

    await reviewScroller.evaluate((node) => {
        node.scrollTo(0, 0)
    })
    await page.waitForTimeout(1000)
    await waitForReviewCards(page, 1, 3000)
    let stalledIterations = 0

    for (let index = 0; index < env.REVIEW_BROWSER_SCROLL_STEPS; index += 1) {
        await expandVisibleReviewBodies(page)
        const reviewCountBeforeScroll = await page.locator(REVIEW_CARD_SELECTOR).count()

        if (reviewCountBeforeScroll >= env.REVIEW_BROWSER_MAX_REVIEWS) {
            break
        }

        const scrollStateBefore = await reviewScroller.evaluate((node) => ({
            top: node.scrollTop,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
        }))

        await reviewScroller.evaluate((node) => {
            node.scrollBy(0, node.clientHeight * 1.5)
        })
        await page.waitForTimeout(env.REVIEW_BROWSER_SCROLL_DELAY_MS)

        const reviewCountAfterScroll = await page.locator(REVIEW_CARD_SELECTOR).count()
        const scrollStateAfter = await reviewScroller.evaluate((node) => ({
            top: node.scrollTop,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
        }))

        const didMove =
            scrollStateAfter.top > scrollStateBefore.top + 24 ||
            scrollStateAfter.scrollHeight > scrollStateBefore.scrollHeight + 24
        const didGrow = reviewCountAfterScroll > reviewCountBeforeScroll

        if (didMove || didGrow) {
            stalledIterations = 0
        } else {
            stalledIterations += 1
        }

        if (stalledIterations >= 4) {
            break
        }
    }

    await expandVisibleReviewBodies(page)
}

async function scrapeGoogleReviewsWithBrowser({ googleMapUrl, restaurantName, restaurantAddress }) {
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
        await page.waitForLoadState('networkidle', {
            timeout: Math.min(env.REVIEW_BROWSER_TIMEOUT_MS, 10000),
        }).catch(() => {})

        await maybeAcceptConsent(page)
        const reviewScroller = await openReviewsPanel(page)
        await scrollReviewFeed(page, reviewScroller)

        const rawReviews = await collectRawReviews(page)
        const reviews = normalizeBrowserReviews(rawReviews)

        if (reviews.length === 0) {
            throw badGateway(
                'SCRAPE_FAILED',
                'Browser review tool could not extract any reviews from the Google Maps page',
            )
        }

        await session.close()

        return reviews
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

module.exports = {
    scrapeGoogleReviewsWithBrowser,
    __private: {
        buildAutomationUrl,
        extractRatingFromLabel,
        normalizeBrowserReviews,
        parseReviewDateLabel,
    },
}
