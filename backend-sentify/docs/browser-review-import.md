# Browser Review Import

## Goal

Sentify now imports Google Maps reviews through a browser automation adapter instead of Google Places API.

The runtime path is:

1. The web app sends `POST /restaurants/:id/import`.
2. [review-import.service.js](/d:/Project%203/backend-sentify/src/services/review-import.service.js) loads the restaurant and calls the browser adapter.
3. [google-browser-review-tool.service.js](/d:/Project%203/backend-sentify/src/services/google-browser-review-tool.service.js) opens the saved Google Maps URL with Playwright, opens the review surface, scrolls it, normalizes reviews, and returns them.
4. The import service deduplicates by `externalId`, runs sentiment analysis, writes new rows, and rebuilds insights.

## Why This Version Is More Stable

The earlier browser adapter had two concrete problems:

1. It replaced the saved Google Maps place URL with a search query built from `restaurantName` and `restaurantAddress`.
   That could send the browser to the wrong place or a search result page.
2. It waited for a generic `feed` selector that did not match the real Google Maps review layout reliably.

The current adapter fixes both issues:

- It trusts the saved Google Maps URL first and only adds `hl`.
- It reads real review cards from `div.jftiEf`.
- It clicks the review trigger, finds the real scroll container by walking up from the first review card, then scrolls that container instead of waiting for a generic feed.
- It snapshots `storageState` from the configured browser profile first, then launches a normal Playwright context. This avoids coupling the importer to a live browser window and keeps repeated runs consistent.

## Required Runtime Configuration

Environment variables are documented in [.env.example](/d:/Project%203/backend-sentify/.env.example).

The important browser settings are:

- `REVIEW_BROWSER_HEADLESS="true"`
- `REVIEW_BROWSER_LANGUAGE_CODE="en"`
- `REVIEW_BROWSER_EXECUTABLE_PATH`
- `REVIEW_BROWSER_USER_DATA_DIR`

Practical notes:

- `REVIEW_BROWSER_LANGUAGE_CODE="en"` is the most stable option because the current trigger patterns were hardened around English labels first.
- `REVIEW_BROWSER_USER_DATA_DIR` should point to a real Chromium-family profile directory that can open the full Google Maps place page.
- A clean browser context without usable profile state often receives `limited view of Google Maps`, which is not enough for full review extraction.

## Supported Input

Most reliable:

- direct Google Maps place URLs
- `maps.app.goo.gl` share links that redirect to a place page

Less reliable:

- generic search URLs
- region/state pages
- malformed or stale place URLs

The adapter now returns a concrete `SCRAPE_FAILED` error with a hint when it cannot reach visible review cards.

## Code Map

Main files:

- [google-browser-review-tool.service.js](/d:/Project%203/backend-sentify/src/services/google-browser-review-tool.service.js)
- [review-import.service.js](/d:/Project%203/backend-sentify/src/services/review-import.service.js)
- [review-browser-tool.js](/d:/Project%203/backend-sentify/scripts/review-browser-tool.js)
- [google-browser-review-tool.test.js](/d:/Project%203/backend-sentify/test/google-browser-review-tool.test.js)

Important behaviors in the adapter:

- `buildAutomationUrl(...)`
  Keeps the saved Google Maps URL and only normalizes `hl`.
- `createStorageStateSnapshot(...)`
  Reads profile state once and writes a temporary Playwright `storageState` file.
- `openReviewsPanel(...)`
  Clicks `More reviews` or the reviews tab, then verifies that visible review cards exist.
- `markReviewScroller(...)`
  Finds the real scrollable review container by walking up the DOM from the first review card.
- `scrollReviewFeed(...)`
  Resets the scroller to the top, expands visible bodies, and scrolls until the max review target or until the scroller stops moving.

## Concrete Evidence From Live Runs

Date: March 8, 2026

Target place used for verification:

- `The 59 cafe`
- direct URL stored in restaurant id `b6049295-1988-4ac1-845e-af43dadd9ff7`

### 1. CLI browser tool on live data

Command:

```powershell
$env:REVIEW_BROWSER_HEADLESS='true'
npm run reviews:tool -- "https://www.google.com/maps/place/The+59+cafe/@16.0717637,108.214946,17z/data=!4m14!1m7!3m6!1s0x314219bb28181783:0xdc89976718ec6b96!2sThe+59+cafe!8m2!3d16.0717586!4d108.2175209!16s%2Fg%2F11jdrj84zk!3m5!1s0x314219bb28181783:0xdc89976718ec6b96!8m2!3d16.0717586!4d108.2175209!16s%2Fg%2F11jdrj84zk?entry=ttu"
```

Observed result:

- `total: 60`
- first author: `Dongsu Lee`
- last author in the stable 60-review slice: `Duc Hao`

### 2. Repeated scrape stability check

Two consecutive runs of `scrapeGoogleReviewsWithBrowser(...)` on the same place returned:

- run 1: `60`
- run 2: `60`

This matters because an earlier version drifted between `60` and `30` due to not resetting the review scroller before reading the virtualized list.

### 3. End-to-end import through the Sprint 1 service

Command path:

- call [importReviews](/d:/Project%203/backend-sentify/src/services/review-import.service.js) with:
  - `userId: a9d492e4-f366-4667-aba4-49b9a0454746`
  - `restaurantId: b6049295-1988-4ac1-845e-af43dadd9ff7`

Observed result on the first live import:

- `before: 16`
- `imported: 60`
- `skipped: 0`
- `total: 60`
- `after: 76`

Observed result on the repeated import:

- `before: 76`
- `imported: 0`
- `skipped: 60`
- `total: 60`
- `after: 76`

This confirms:

- the browser adapter returns real live data
- dedup still works
- the Sprint 1 insight rebuild path still runs after import

## Known Limits

- This is still browser automation. It is slower and more brittle than a formal API.
- The importer depends on a browser profile state that can open the full Google Maps place page.
- A totally clean profile can still receive a limited Maps view.
- The current implementation is optimized for direct place pages, not arbitrary Google search or region pages.
- `REVIEW_BROWSER_MAX_REVIEWS` caps how many reviews are read in one import run. The default currently targets `60`.

## Recommended Operator Checklist

When the importer stops behaving correctly:

1. Run:

```powershell
npm run reviews:tool -- "<saved place url>"
```

2. If you get `limited view of Google Maps`:
   use or refresh the configured browser profile.
3. If you get zero visible review cards:
   verify the stored URL is a direct place URL or `maps.app.goo.gl` link.
4. If the total review count changes unexpectedly between runs:
   check that the review scroller still resets to top and that the review card selector `div.jftiEf` still exists on the page.
