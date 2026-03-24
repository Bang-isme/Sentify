# Sentify Backend Current State

Updated: 2026-03-25

This document describes the backend and database as they exist in the current codebase. It is intentionally grounded in live code, not in retired design documents.

## 1. Current Product Direction

The backend is now firmly aligned to a:

- manual-first workflow
- admin-curated intake model
- merchant read surface backed only by canonical published data

In practical terms:

- crawl and manual entry only create intake evidence
- publish is the only step that moves data into canonical `Review`
- merchant dashboard and review APIs read from curated, stable data

## 2. Runtime Stack

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- BullMQ + Redis for queued crawl jobs
- CommonJS runtime

The backend is a modular monolith. `admin-intake`, `review-crawl`, and now `review-ops` have clearer feature boundaries than the legacy route/controller/service areas.

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
- backfill auto-resume from persisted checkpoint cursor
- warning preservation when Google reports more reviews than the crawler can actually extract

### Review ops control plane

- one-click `sync-to-draft` orchestration from Google Maps URL
- source list with latest run and open draft batch summary
- run history by source
- enriched run detail with queue state
- source enable and disable controls
- batch readiness summary before publish
- bulk approve of only currently publishable pending items
- thin publish proxy that still uses the existing admin-intake publish path

This operator layer is backend-only. It exists to reduce the number of manual steps a developer or internal operator must execute behind the scenes.

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

Two database invariants were added for safer crawl operations:

- only one active crawl run per source (`QUEUED` or `RUNNING`)
- only one open crawl-backed intake batch per crawl source

## 5. Quality And Evidence Already In Place

Current verification evidence includes:

- `npm test`
- `npm run db:validate`
- `npm run db:seed`
- `npm run test:realdb`
- queued crawl smoke with local Redis

Important proof points already exist:

- BullMQ-safe queued crawl runtime
- worker heartbeat and scheduler lock behavior
- shared seed dataset for demo and regression work
- real Postgres publish smoke
- operator orchestration tests for `review-ops`
- repeated live Google Maps crawl benchmarks that converge to the same public review ceiling

Current crawl evidence on the live `Quán Phở Hồng` source:

- direct full crawl, `delayMs=0`: `4527 / 4746` reviews in roughly `33-36s`
- queued backfill smoke, default backfill delay `0`: `4527 / 4746` reviews in roughly `50.3s`
- completed runs now keep a warning when `reportedTotal > extractedCount`

## 6. Seed And Demo Data

The shared seed dataset currently creates:

- 2 restaurants
- 3 users with realistic access boundaries
- published baseline data
- an open Google Maps crawl draft batch
- a crawl source, a crawl run, and raw review audit rows
- at least one invalid raw review example to exercise readiness diagnostics

This gives FE, QA, and backend work a common baseline without hand-editing the database each time.

## 7. What Is Still Missing

The backend is not fully release-ready yet. The main remaining gaps are:

- deeper auth lifecycle proof for refresh and password reset
- broader seeded read-path smoke for `reviews`, `sentiment`, `trend`, `complaints`, and `top issue`
- real-DB duplicate publish regression across multiple batches
- SMB load testing for queue workers and merchant reads
- staging evidence, backup, restore, and rollback drills
- continued refactor of the older auth and restaurant modules toward the same feature-module shape
- a clear product policy for places where Google-reported totals stay above the public crawl ceiling

## 8. Short Conclusion

The backend is well past the "demo only" stage.

It already has:

- a sound manual-first data model
- a controlled publish boundary
- queue-based crawl infrastructure that runs outside the request path
- a backend-only operator layer that reduces internal crawl-to-draft work
- seed and real-database proof for core publish behavior

The remaining work is mostly about stronger evidence, scale proof, and release discipline, not missing core business flow.
