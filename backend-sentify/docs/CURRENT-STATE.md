# Sentify Backend Current State

Updated: 2026-03-25

This document describes the backend and database as they exist in the current codebase.

## 1. Current Product Direction

The backend is firmly aligned to:

- a manual-first workflow
- admin-curated intake
- merchant reads backed only by canonical published data

In practice:

- crawl and manual entry create intake evidence
- publish is the only step that moves data into canonical `Review`
- merchant dashboard and review APIs read from curated, stable data

## 2. Runtime Stack

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- BullMQ plus Redis for queued crawl jobs
- CommonJS runtime

The backend is a modular monolith. `admin-intake`, `review-crawl`, and `review-ops` now have clearer feature boundaries than the older route-controller-service areas.

## 3. What The Backend Already Has

### Auth and security

- register, login, session, logout
- password change
- refresh token rotation
- forgot password and reset password
- cookie auth and bearer auth
- CSRF double-submit protection for cookie writes
- rate limits and login lockout
- token revocation through `tokenVersion`

### Merchant-facing reads

- restaurant detail
- dataset status
- review evidence list
- dashboard KPI
- sentiment breakdown
- trend
- complaint keywords
- top issue and next action

### Admin intake

- create batch
- list batch
- add items
- bulk add items
- update item
- delete item
- publish batch
- canonical review reuse when external review identity matches

### Review crawl runtime

- Google Maps source upsert
- queued crawl runs
- worker process with checkpoint, cancel, and resume
- raw review persistence
- draft materialization into intake batches
- fresh-session cursor recovery for suspicious empty pages
- backfill auto-resume from persisted checkpoint cursors
- structured `crawlCoverage` diagnostics plus mismatch warnings when preview metadata totals exceed extracted public reviews

### Review ops control plane

- one-click `sync-to-draft` orchestration from Google Maps URL
- source list with latest run `crawlCoverage` and open draft batch summary
- run history by source
- enriched run detail with queue state and operator policy
- source enable and disable controls
- batch readiness summary before publish
- bulk approve of only currently publishable pending items
- thin publish proxy that still uses the existing admin-intake publish path

## 4. Current Database Shape

The schema currently contains 13 models:

1. `User`
2. `RefreshToken`
3. `PasswordResetToken`
4. `Restaurant`
5. `RestaurantUser`
6. `Review`
7. `InsightSummary`
8. `ComplaintKeyword`
9. `ReviewIntakeBatch`
10. `ReviewIntakeItem`
11. `ReviewCrawlSource`
12. `ReviewCrawlRun`
13. `ReviewCrawlRawReview`

Data layers are clearly separated:

- `Review` is the canonical merchant-facing dataset
- `ReviewIntakeBatch` and `ReviewIntakeItem` are curation and publish staging
- `ReviewCrawlSource`, `ReviewCrawlRun`, and `ReviewCrawlRawReview` are crawl runtime and audit state
- `InsightSummary` and `ComplaintKeyword` are dashboard read models

Important crawl invariants:

- only one active crawl run per source (`QUEUED` or `RUNNING`)
- only one open crawl-backed intake batch per crawl source

## 5. Quality And Evidence Already In Place

Current verification evidence includes:

- `npm test`
- `npm run db:validate`
- `npm run db:seed`
- `npm run test:realdb`
- queued crawl smoke
- review crawl scale-validation harness

Important proof points already exist:

- BullMQ-safe queued crawl runtime
- worker heartbeat and scheduler lock behavior
- shared seed dataset for demo and regression work
- service-level auth lifecycle proof for refresh rotation, refresh-token reuse detection, forgot-password issuance, and reset-password invalidation
- controller-level auth route proof for body-token refresh, cookie clearing on failed refresh, and reset-password cookie cleanup
- real Postgres publish smoke
- real Postgres HTTP smoke for merchant read routes
- local SMB load proof for merchant read routes over seeded HTTP + Prisma paths
- local worker-pressure proof for crawl checkpoint persistence and concurrency
- real Postgres duplicate-publish regression across batches
- operator orchestration tests for `review-ops`
- repeated live Google Maps crawl benchmarks that converge to stable public review ceilings

Current crawl evidence on the live `Quan Pho Hong` source:

- direct full crawl, `delayMs=0`: `4527 / 4746` in about `33-36s`
- queued backfill smoke, default backfill delay `0`: `4527 / 4746` in about `50.3s`
- completed runs keep a mismatch warning and expose `crawlCoverage.operatorPolicy = REPORTED_TOTAL_IS_ADVISORY` when `reportedTotal > extractedCount`

Current crawl evidence on the larger live `Cong Ca Phe` source:

- preview metadata reported `15098`
- direct and queued runs both converged at `9744`
- the user-confirmed Google Maps place card also showed `9744`
- this strongly suggests the crawler matched the visible public review surface

Current crawl evidence on the even larger live `Pizza 4P's Hoang Van Thu` source:

- preview metadata reported `17646`
- direct full crawl converged at `14599`
- queued backfill with `maxPages=1000` also converged at `14599`
- this shows the same mismatch pattern can persist at larger scale while direct and queued modes still agree on the crawlable public review ceiling

Current local SMB load evidence:

- merchant reads on seeded local Postgres plus real HTTP routes:
  - `4010` canonical reviews on the target restaurant
  - `360` successful requests, `0` errors
  - overall throughput about `186.32 requests/s`
  - overall latency about `42.87ms avg`, `63.63ms p95`, `188.21ms p99`
- review crawl workers on seeded local Postgres with synthetic checkpoint writes:
  - `24` queued runs at concurrency `4`
  - `5760` raw reviews persisted across `288` synthetic pages
  - about `4.99 runs/s`, `59.9 pages/s`, `1198.06 raw reviews/s`
  - observed max running concurrency `4`
  - local environment had no Redis, so this proof used inline queue fallback and an in-process worker pool

## 6. Seed And Demo Data

The shared seed dataset currently creates:

- 2 restaurants
- 3 users with realistic access boundaries
- published baseline data
- an open Google Maps crawl draft batch
- a crawl source, a crawl run, and raw review audit rows
- at least one invalid raw review example to exercise readiness diagnostics

## 7. What Is Still Missing

The backend is still not fully release-ready. Main remaining gaps:

- Redis-backed SMB load proof for queued crawl workers and operator-triggered queue paths
- staging evidence, backup, restore, and rollback drills
- continued refactor of older auth and restaurant modules toward the same feature-module shape

## 8. Short Conclusion

The backend is well past the demo-only stage.

It already has:

- a sound manual-first data model
- a controlled publish boundary
- queue-based crawl infrastructure outside the request path
- a backend-only operator layer that reduces internal crawl-to-draft work
- seed and real-database proof for core publish behavior
- local SMB load proof for merchant reads and worker checkpoint pressure
- real benchmark evidence that the crawler can handle larger sources operationally

The remaining work is mostly about Redis-backed queue proof, staging evidence, and release discipline, not missing core business flow.
