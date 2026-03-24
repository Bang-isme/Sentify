# Review Crawler

Updated: 2026-03-24

## Purpose

This module adds a backend-side Google Maps review crawler that does not use Playwright or browser automation.

It exists for one reason: give the backend a stable way to extract review data from a Google Maps place URL, normalize the output, and prepare intake-ready JSON that can be validated before it reaches the manual curation flow.

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
  "delayMs": 500
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

## Architecture Notes

- place metadata and total review count come from the Google Maps `preview/place` payload
- paginated review rows come from the Google Maps `listugcposts` RPC endpoint
- the crawler uses a browser-like HTTP client (`impit`) for review pages because plain `fetch` was returning empty review payloads
- output normalization is isolated in `src/modules/review-crawl/google-maps.parser.js`
- request validation is isolated in `src/modules/review-crawl/google-maps.validation.js`
- Google Maps provider logic lives in `src/modules/review-crawl/google-maps.service.js`
- queue orchestration, run lifecycle, materialization, and scheduling live in `src/modules/review-crawl/review-crawl.service.js`
- BullMQ transport lives in `src/modules/review-crawl/review-crawl.queue.js`
- worker startup lives in `src/review-crawl-worker.js`

## Limits

- this is an unofficial Google Maps integration and can break if Google changes payload structure
- exact completeness depends on Google continuing to expose the expected preview and review RPC formats
- when a crawl is intentionally capped by `pages` or `maxReviews`, the response marks the result as `partial`
- queued runs require Redis via `REDIS_URL`
- local proof runs may also use `REVIEW_CRAWL_REDIS_BINARY` to spawn a temporary Redis process
- `totalReviewCount` is a reported reference number, not a guaranteed extraction SLA

## Why This Matters For Sentify

This module gives the backend a real ingestion bridge:

- crawl raw review evidence
- convert it into valid intake items
- keep admin curation in control before publish

That fits the current manual-first backend direction much better than rebuilding a browser-driven scraper.
