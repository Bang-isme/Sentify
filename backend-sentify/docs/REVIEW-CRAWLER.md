# Review Crawler

Updated: 2026-03-25

## Purpose

This module gives Sentify a backend-side Google Maps review crawler without Playwright or browser automation.

Its job is simple:

- accept a Google Maps place URL
- resolve the place identity
- crawl public review rows
- normalize them into clean JSON
- prepare intake-ready payloads that can be validated before publish

The backend-only `review-ops` layer sits on top of this and turns the low-level crawl primitives into a one-click draft workflow for internal operators.

## What It Does

- accepts `google.com/maps/...` URLs and `maps.app.goo.gl/...` short URLs
- resolves metadata from the Google Maps preview payload
- extracts the preview-reported review total
- fetches paginated public review rows through `listugcposts`
- normalizes review rows into clean JSON
- generates `intake.items` that already match the manual intake schema
- persists crawl sources, crawl runs, and raw normalized reviews in Postgres
- supports queued deep crawls so large backfills stay outside the request path
- preserves source identity fields so publish dedupe stays stable across repeated crawls
- keeps mismatch warnings when Google reports more reviews than the crawler can actually extract

## API Surface

Preview lane:

- `POST /api/admin/review-crawl/google-maps`

Queue-backed lane:

- `POST /api/admin/review-crawl/sources`
- `POST /api/admin/review-crawl/sources/:sourceId/runs`
- `GET /api/admin/review-crawl/runs/:runId`
- `POST /api/admin/review-crawl/runs/:runId/cancel`
- `POST /api/admin/review-crawl/runs/:runId/resume`
- `POST /api/admin/review-crawl/runs/:runId/materialize-intake`

Operator lane:

- `POST /api/admin/review-ops/google-maps/sync-to-draft`
- `GET /api/admin/review-ops/sources?restaurantId=...`
- `GET /api/admin/review-ops/sources/:sourceId/runs`
- `GET /api/admin/review-ops/runs/:runId`
- `GET /api/admin/review-ops/batches/:batchId/readiness`
- `POST /api/admin/review-ops/batches/:batchId/approve-valid`
- `POST /api/admin/review-ops/batches/:batchId/publish`

## CLI

Direct crawl:

```bash
npm run crawl:google-reviews -- --url="https://www.google.com/maps/place/..." --pages=max --delay-ms=0 --output="./crawls/reviews.json"
```

Queued smoke:

```bash
npm run smoke:review-crawl-queue -- --url "https://maps.app.goo.gl/..." --strategy backfill --output "./crawls/queue-smoke.json"
```

If local Windows has no Redis service and no Redis binary, the smoke script can fall back to inline queue mode for local benchmarking only.

Scale validation:

```bash
npm run validate:review-crawl-scale -- --url="https://maps.app.goo.gl/..." --target-reviews=20000 --output="./crawls/scale-validation.json"
```

## Runtime Notes

- output normalization lives in `src/modules/review-crawl/google-maps.parser.js`
- request validation lives in `src/modules/review-crawl/google-maps.validation.js`
- provider logic lives in `src/modules/review-crawl/google-maps.service.js`
- queue orchestration and run lifecycle live in `src/modules/review-crawl/review-crawl.service.js`
- BullMQ transport lives in `src/modules/review-crawl/review-crawl.queue.js`
- worker startup lives in `src/review-crawl-worker.js`
- deep crawl now uses same-session empty-page retry, fresh-session cursor recovery, and backfill auto-resume from persisted checkpoint cursors

## Benchmark Snapshot

### Source 1: Quan Pho Hong

Live URL:

- `https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8`

Observed on 2026-03-25:

- direct full crawl, `delayMs=0`: `4527` unique reviews, `227` pages, about `33-36s`
- queued backfill smoke, default backfill delay `0`: `4527` unique reviews, `227` pages, about `50.3s`
- preview metadata reported total: `4746`

Artifacts:

- [benchmark-direct-delay0.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0.json)
- [benchmark-direct-delay0-run2.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0-run2.json)
- [benchmark-direct-delay0-vi-vn.json](D:/Project%203/backend-sentify/crawls/benchmark-direct-delay0-vi-vn.json)
- [benchmark-queue-default-backfill-inline-final.json](D:/Project%203/backend-sentify/crawls/benchmark-queue-default-backfill-inline-final.json)

### Source 2: Cong Ca Phe

Live URL:

- `https://maps.app.goo.gl/kaFYtSNsriybyw6w7`

Observed on 2026-03-25:

- direct full crawl, `delayMs=0`: `9744` unique reviews, `488` pages
- queued backfill with `maxPages=1000`: `9744` unique reviews, `488` pages
- preview metadata reported total: `15098`
- the visible Google Maps place card shown by the user also displayed `9744` reviews

Artifacts:

- [link-test-kaFYtSNsriybyw6w7-direct.json](D:/Project%203/backend-sentify/crawls/link-test-kaFYtSNsriybyw6w7-direct.json)
- [link-test-kaFYtSNsriybyw6w7-queued-max1000.json](D:/Project%203/backend-sentify/crawls/link-test-kaFYtSNsriybyw6w7-queued-max1000.json)
- [scale-validation-kaFYtSNsriybyw6w7.json](D:/Project%203/backend-sentify/crawls/scale-validation-kaFYtSNsriybyw6w7.json)

## What These Benchmarks Mean

Two strong patterns now appear:

- repeated runs converge to the same extracted-review ceiling for a given place
- that ceiling can be lower than the preview metadata total

The `Cong Ca Phe` case is especially important:

- preview metadata said `15098`
- both direct and queued runs converged at `9744`
- the public Google Maps place card also showed `9744`

That strongly suggests the crawler is matching the public review surface, while preview metadata may include a larger opaque total that is not fully reachable through the public review pagination chain.

## Limits

- this is still an unofficial Google Maps integration
- Google can change payload shape or pagination behavior at any time
- `totalReviewCount` should be treated as a reference number, not a guaranteed extraction SLA
- `COMPLETED` means the currently exposed public review page chain was exhausted
- `COMPLETED` does not guarantee `extractedCount === preview metadata total`
- some places appear to expose two counters:
  - a larger preview metadata total
  - a smaller public review surface count
- current crawler behavior appears to align with the public review surface when the two diverge

## Why This Matters For Sentify

This module gives Sentify a practical ingestion bridge:

- crawl raw review evidence
- validate it before it becomes intake
- keep publish behind manual curation

That matches the current manual-first backend direction much better than browser-driven scraping.
