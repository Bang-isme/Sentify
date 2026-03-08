# Browser Review Import

## Goal

Sentify now imports Google Maps reviews through a browser automation adapter plus a DB-backed import run queue.

The runtime path is:

1. The web app sends `POST /restaurants/:id/import`.
2. [import.controller.js](/d:/Project%203/backend-sentify/src/controllers/import.controller.js) creates or reuses an import run.
3. [review-import-run.service.js](/d:/Project%203/backend-sentify/src/services/review-import-run.service.js) persists `QUEUED/RUNNING/COMPLETED/FAILED` state in `ImportRun`.
4. The worker calls [review-import.service.js](/d:/Project%203/backend-sentify/src/services/review-import.service.js).
5. [google-browser-review-tool.service.js](/d:/Project%203/backend-sentify/src/services/google-browser-review-tool.service.js) opens the saved Google Maps URL with Playwright, scrolls the review feed, normalizes reviews, and returns both reviews and scrape metadata.
6. The import service deduplicates by `externalId`, analyzes sentiment in batches, writes new rows, and rebuilds insights.
7. The web app polls `GET /restaurants/:id/import/latest` until the run reaches a terminal state.

## What This Pass Solved

### 1. Long-running import no longer blocks the HTTP request

Old behavior:

- one request opened Google Maps
- one request scraped reviews
- one request analyzed everything
- one request rebuilt dashboard data

That was not production-safe for a multi-minute browser crawl.

Current behavior:

- `POST /restaurants/:id/import` returns quickly with a queued or already-running import run
- background execution continues in-process
- the latest run is queryable from the API

### 2. Import status is persisted

The new Prisma model is [ImportRun](/d:/Project%203/backend-sentify/prisma/schema.prisma).

It stores:

- `status`
- `phase`
- `progressPercent`
- `imported / skipped / total`
- scrape metadata
- timestamps
- failure details when the run fails

This means an import is no longer just "fire and hope". It is now observable.

### 3. Only one import per restaurant can run at a time

If another import is requested while one is already `QUEUED` or `RUNNING`, the backend returns the existing run instead of starting a duplicate crawl.

### 4. Stale runs are cleaned up on restart

At server boot, [server.js](/d:/Project%203/backend-sentify/src/server.js) calls `recoverStaleImportRuns()`.

Any run left in `QUEUED` or `RUNNING` from an interrupted process is marked `FAILED` with a restart-specific error code instead of staying stuck forever.

## Data Quality Rules

### No fake reviews

The current importer only persists live reviews returned from the browser adapter.
There is no fallback fixture source in the runtime path.

### Unicode-first handling

Review text, author names, and date labels are normalized with Unicode NFC and whitespace cleanup before persistence.
The backend no longer degrades multilingual review text into broken ASCII-only forms.

### Multilingual parsing

The importer now parses relative review dates in:

- English
- Vietnamese
- Japanese

The sentiment analyzer also keeps multilingual text intact and can match complaint phrases in:

- English
- Vietnamese
- Japanese

### Honest metadata

`advertisedTotalReviews` is best-effort only.

If the page exposes a low-confidence count string that appears to merge rating and review count into the same DOM surface, the importer returns `advertisedTotalReviews: null`.

The rule is deliberate:

- correct count
- or `null`
- but never a fabricated number

## Performance Changes

### Browser crawl

- `REVIEW_BROWSER_MAX_REVIEWS=0` means auto-target mode
- auto-target mode crawls until feed exhaustion or `REVIEW_BROWSER_HARD_MAX_REVIEWS`
- scroll behavior is no longer fixed to the old `12-step` pass
- the adapter uses larger jumps early and smaller jumps near the tail of the feed
- one recovery nudge is attempted before declaring the feed exhausted

### Import pipeline

- sentiment analysis now runs in batches instead of per-review serial awaits
- complaint keyword rebuild analyzes negative reviews in parallel promise groups
- run progress updates at coarse phases:
  - `QUEUED`
  - `SCRAPING`
  - `ANALYZING`
  - `PERSISTING`
  - `REBUILDING`
  - `COMPLETED`

## Runtime Configuration

Main browser settings are documented in [.env.example](/d:/Project%203/backend-sentify/.env.example).

Current production-like local defaults:

- `REVIEW_BROWSER_HEADLESS="true"`
- `REVIEW_BROWSER_LANGUAGE_CODE="en"`
- `REVIEW_BROWSER_TIMEOUT_MS=45000`
- `REVIEW_BROWSER_SCROLL_STEPS=24`
- `REVIEW_BROWSER_SCROLL_DELAY_MS=450`
- `REVIEW_BROWSER_MAX_REVIEWS=0`
- `REVIEW_BROWSER_HARD_MAX_REVIEWS=320`
- `REVIEW_BROWSER_STALL_LIMIT=6`

Semantics:

- `REVIEW_BROWSER_MAX_REVIEWS > 0`
  means explicit target
- `REVIEW_BROWSER_MAX_REVIEWS = 0`
  means crawl until exhaustion, bounded by the hard ceiling

## API Surface

### Queue import

`POST /api/restaurants/:id/import`

Returns:

- queued run summary if a new run was created
- existing run summary if one is already active

### Read latest run

`GET /api/restaurants/:id/import/latest`

Returns the most recent import run for that restaurant, including:

- `status`
- `phase`
- `progressPercent`
- final scrape/import counts

## Concrete Live Evidence

Verification date: March 9, 2026

Target place:

- `The 59 cafe`
- restaurant id `b6049295-1988-4ac1-845e-af43dadd9ff7`

### 1. Direct browser scrape with real data

Observed result from [scrapeGoogleReviewsWithBrowserDetailed](/d:/Project%203/backend-sentify/src/services/google-browser-review-tool.service.js):

- `normalizedReviewCount: 269`
- `reachedEndOfFeed: true`
- `advertisedTotalReviews: null`

Interpretation:

- the importer is no longer capped at `60`
- it collected `269` live reviews from this place
- the advertised total was intentionally nulled because the DOM count source was not trustworthy enough

### 2. Synchronous import service on real data

Observed result from [review-import.service.js](/d:/Project%203/backend-sentify/src/services/review-import.service.js):

- `before: 60`
- `imported: 209`
- `skipped: 60`
- `total: 269`
- `after: 269`

This confirms:

- live review data enters the DB
- dedup still works
- insight rebuild still completes

### 3. Queue and polling path on real data

Observed result from [review-import-run.service.js](/d:/Project%203/backend-sentify/src/services/review-import-run.service.js):

- initial API-equivalent run state:
  - `status: QUEUED`
  - `phase: QUEUED`
  - `progressPercent: 0`
- running state:
  - `status: RUNNING`
  - `phase: SCRAPING`
  - `progressPercent: 15`
- terminal state:
  - `status: COMPLETED`
  - `phase: COMPLETED`
  - `progressPercent: 100`
  - `imported: 0`
  - `skipped: 266`
  - `total: 266`

That proves the new queue/status API is not theoretical; it runs against the real place and transitions across persisted states.

## Tests Added

Regression coverage now includes:

- URL validation and `hl` injection
- English, Vietnamese, and Japanese date parsing
- multilingual review-count parsing
- auto-target vs hard ceiling logic
- Unicode-safe review normalization
- multilingual sentiment handling
- queue dedup behavior
- import-service metadata honesty

Relevant files:

- [google-browser-review-tool.test.js](/d:/Project%203/backend-sentify/test/google-browser-review-tool.test.js)
- [review-import.service.test.js](/d:/Project%203/backend-sentify/test/review-import.service.test.js)
- [review-import-run.service.test.js](/d:/Project%203/backend-sentify/test/review-import-run.service.test.js)
- [sentiment-analyzer.test.js](/d:/Project%203/backend-sentify/test/sentiment-analyzer.test.js)

## Known Limits

- This is still browser automation, not a first-party data API.
- Progress is coarse-grained phase tracking, not per-review streaming telemetry.
- The importer can still stop short of every review on very large places because `REVIEW_BROWSER_HARD_MAX_REVIEWS` is a safety ceiling.
- `advertisedTotalReviews` is still best-effort only.
- Queue execution is in-process for Sprint 1. It is more reliable than long synchronous requests, but it is not yet a distributed worker system.

## Operational Guidance

When diagnosing import behavior:

1. Run:

```powershell
npm run reviews:tool -- "<saved place url>"
```

2. Check:

- `normalizedReviewCount`
- `reachedEndOfFeed`
- `advertisedTotalReviews`

3. Then inspect:

- `GET /api/restaurants/:id/import/latest`

4. If the run is stuck in `RUNNING` after a crash/restart, restart the server once so stale run recovery can mark it `FAILED`.

## Honest Status

This importer is now materially stronger than the earlier pass:

- deeper crawl
- better multilingual fidelity
- better service throughput
- persisted queue/status/progress
- no fake runtime data path

But it is still a bounded browser worker, not a perfect mirror of all Google review history.
