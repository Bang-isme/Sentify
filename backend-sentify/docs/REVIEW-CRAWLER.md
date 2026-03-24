# Review Crawler

Updated: 2026-03-25

## Purpose

This module adds a backend-side Google Maps review crawler that does not use Playwright or browser automation.

It exists for one reason: give the backend a stable way to extract review data from a Google Maps place URL, normalize the output, and prepare intake-ready JSON that can be validated before it reaches the manual curation flow.

The newest layer on top of this is `review-ops`, a backend-only control plane that turns the low-level crawl primitives into a one-click draft workflow for internal operators.

## What It Does

- accepts a Google Maps place URL
- accepts `google.com/maps/...` URLs and `maps.app.goo.gl/...` short URLs
- resolves the place metadata from the Google Maps preview payload
- extracts the reported total review count for that place
- fetches paginated review rows through the Google Maps review RPC endpoint
- normalizes review data into clean JSON
- generates a second `intake.items` array that already matches the backend manual-intake schema
- canonicalizes URLs to a stable `cid` route when a place hex id is present, so long nested Maps URLs do not need manual cleanup first
- supports a queued crawl model for deeper runs that should not block the HTTP app
- persists crawl sources, crawl runs, and normalized raw reviews in Postgres
- preserves `sourceExternalId` so canonical publish dedupe stays stable across repeated crawls
- keeps a mismatch warning when Google reports more reviews than the public review RPC actually returns

## API Endpoint

`POST /api/admin/review-crawl/google-maps`

Authenticated restaurant editors can use it with:

```json
{
  "restaurantId": "restaurant-uuid",
  "url": "https://www.google.com/maps/place/...",
  "language": "en",
  "region": "us",
  "sort": "newest",
  "pages": 5,
  "pageSize": 20,
  "maxReviews": 100,
  "delayMs": 0
}
```

The response contains:

- `source`: crawl input and fetch metadata
- `place`: normalized place metadata and identifiers
- `reviews`: normalized review rows
- `intake.items`: validated review items shaped for the existing admin-intake flow
- `crawl`: extraction summary, completeness, warnings, and pagination state

For production-style syncs, the queue-backed flow is:

- `POST /api/admin/review-crawl/sources`
- `POST /api/admin/review-crawl/sources/:sourceId/runs`
- `GET /api/admin/review-crawl/runs/:runId`
- `POST /api/admin/review-crawl/runs/:runId/cancel`
- `POST /api/admin/review-crawl/runs/:runId/resume`
- `POST /api/admin/review-crawl/runs/:runId/materialize-intake`

This lets the API create work quickly while a dedicated worker process crawls page-by-page in the background.

## Review Ops API

The recommended operator surface for day-to-day internal use is:

- `POST /api/admin/review-ops/google-maps/sync-to-draft`
- `GET /api/admin/review-ops/sources?restaurantId=...`
- `GET /api/admin/review-ops/sources/:sourceId/runs`
- `GET /api/admin/review-ops/runs/:runId`
- `POST /api/admin/review-ops/sources/:sourceId/disable`
- `POST /api/admin/review-ops/sources/:sourceId/enable`
- `GET /api/admin/review-ops/batches/:batchId/readiness`
- `POST /api/admin/review-ops/batches/:batchId/approve-valid`
- `POST /api/admin/review-ops/batches/:batchId/publish`

What this adds:

- one-click draft sync from Google Maps URL to draft intake batch
- source inventory with latest run and open draft summary
- enriched run status with queue state
- publish-readiness diagnostics before publish
- bulk assistance without bypassing manual publish

## CLI

The same service can be run directly:

```bash
npm run crawl:google-reviews -- --url="https://www.google.com/maps/place/..." --pages=1 --output="./tmp/reviews.json"
```

Supported flags:

- `--url`
- `--language`
- `--region`
- `--sort`
- `--pages`
- `--page-size`
- `--max-reviews`
- `--delay-ms`
- `--search-query`
- `--output`

For a queued end-to-end proof that exercises Redis, BullMQ, the worker, Postgres state, and optional intake materialization:

```bash
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
node scripts/review-crawl-queue-smoke.js --url "https://maps.app.goo.gl/..." --strategy backfill --max-pages 1 --materialize --output "./crawls/queue-smoke.json"
```

This script is intended for local validation. It will:

- start a local Redis process when `REDIS_URL` is not already set
- start the worker runtime in-process
- upsert the crawl source
- enqueue a queued run
- poll until the run reaches a terminal state
- optionally create a `GOOGLE_MAPS_CRAWL` draft intake batch from valid raw reviews

If no Redis server or local Redis binary is available, the smoke script now falls back to an inline queue mode for local benchmarking. That fallback is only for local proof and developer diagnostics. Production queued runs still require Redis.

For internal operator actions without touching SQL directly:

```bash
npm run ops:review -- sync-draft --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>" --url="https://maps.app.goo.gl/..."
npm run ops:review -- sources --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>"
npm run ops:review -- run-status --user-id="<user-uuid>" --run-id="<run-uuid>"
npm run ops:review -- batch-readiness --user-id="<user-uuid>" --batch-id="<batch-uuid>"
npm run ops:review -- approve-valid --user-id="<user-uuid>" --batch-id="<batch-uuid>" --reviewer-note="Bulk approved after readiness review"
```

The CLI prints JSON only and still routes through service-layer permission checks.

## Architecture Notes

- place metadata and total review count come from the Google Maps `preview/place` payload
- paginated review rows come from the Google Maps `listugcposts` RPC endpoint
- the crawler uses a browser-like HTTP client (`impit`) for review pages because plain `fetch` was returning empty review payloads
- output normalization is isolated in `src/modules/review-crawl/google-maps.parser.js`
- request validation is isolated in `src/modules/review-crawl/google-maps.validation.js`
- Google Maps provider logic lives in `src/modules/review-crawl/google-maps.service.js`
- queue orchestration, run lifecycle, materialization, and scheduling live in `src/modules/review-crawl/review-crawl.service.js`
- operator orchestration, readiness, and bulk-assist logic live in `src/modules/review-ops/`
- BullMQ transport lives in `src/modules/review-crawl/review-crawl.queue.js`
- worker startup lives in `src/review-crawl-worker.js`
- deep crawl now uses fresh-session cursor recovery, same-session empty-page retries, and backfill auto-resume from persisted checkpoint cursors

## Benchmark Snapshot

Observed on 2026-03-25 with the live Google Maps short URL `https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8` for `Quán Phở Hồng`:

- direct full crawl, `delayMs=0`: `4527` unique reviews, `227` pages, ~`33-36s`
- queued backfill smoke, default backfill delay `0`: `4527` unique reviews, `227` pages, ~`50.3s`
- Google Maps reported total for this place: `4746`

Committed benchmark artifacts:

- [benchmark-direct-delay0.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0.json)
- [benchmark-direct-delay0-run2.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0-run2.json)
- [benchmark-direct-delay0-vi-vn.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0-vi-vn.json)
- [benchmark-queue-default-backfill-inline-final.json](D:/Project%203/backend-sentify/crawls/benchmark-queue-default-backfill-inline-final.json)

The important conclusion is not “Google reported `4746`, so the crawler is broken at `4527`”. The stronger evidence is that multiple runs, locales, and runtime modes converge to the same `4527` ceiling. For this source, the backend now appears to exhaust the public review pagination chain consistently, while still preserving a warning that the reported total is larger than the crawlable total.

## Limits

- this is an unofficial Google Maps integration and can break if Google changes payload structure
- exact completeness depends on Google continuing to expose the expected preview and review RPC formats
- when a crawl is intentionally capped by `pages` or `maxReviews`, the response marks the result as `partial`
- queued runs require Redis via `REDIS_URL` in production
- local proof runs may also use `REVIEW_CRAWL_REDIS_BINARY` to spawn a temporary Redis process
- `totalReviewCount` is a reported reference number, not a guaranteed extraction SLA
- `COMPLETED` means the currently exposed public review page chain was exhausted; it does not guarantee `extractedCount === reportedTotal`

## Why This Matters For Sentify

This module gives the backend a real ingestion bridge:

- crawl raw review evidence
- convert it into valid intake items
- keep admin curation in control before publish

That fits the current manual-first backend direction much better than rebuilding a browser-driven scraper.
