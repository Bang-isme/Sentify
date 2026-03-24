# Sentify Backend Testing Strategy

Updated: 2026-03-25

This document tracks the current backend testing posture for the live codebase.

Source-of-truth docs:

- `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`
- `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`

## 1. Goals

The backend is no longer mock-only. The test strategy now has four practical layers:

1. fast day-to-day tests for development
2. real Postgres smoke for publish and canonical data updates
3. queued crawl runtime proof for background ingestion
4. seeded HTTP smoke for merchant-read routes

## 2. Current Test Layers

```text
Browser E2E                Planned later
Seeded read-path smoke     Implemented
Real Postgres smoke        Implemented
Queued crawl smoke         Implemented
Mocked integration         Current baseline
Unit tests                 Current baseline
```

### Current baseline

- unit tests for services, parsers, validation, and domain helpers
- mocked integration tests for controller and request/response behavior
- auth integration for cookie + CSRF handshake
- auth integration for body-token refresh, refresh-failure cookie clearing, and forgot/reset controller contracts
- service-level auth lifecycle coverage for refresh rotation/reuse and forgot/reset password flows
- publish-path coverage for canonical review reuse
- queue/runtime coverage for BullMQ-safe job ids and worker lifecycle

### Real-data coverage already in place

- `npm run db:seed`
- `npm run test:realdb`
- `npm run smoke:review-crawl-queue -- --url "..."`
- `test/merchant-read.realdb.test.js` for full HTTP merchant-read proof on seeded Postgres

## 3. File Pattern

```text
test/
  *.service.test.js
  *.controller.test.js
  *.integration.test.js
  *.realdb.test.js
  test-helpers.js

prisma/
  seed.js
  seed-data.js
```

Meaning:

- `*.service.test.js`: business logic
- `*.controller.test.js`: validation and error mapping
- `*.integration.test.js`: mocked HTTP behavior
- `*.realdb.test.js`: smoke or integration proof on real Postgres

Current real-DB suite:

- `duplicate-publish.realdb.test.js`: same source review across multiple batches must reuse canonical review rows and keep insight totals stable
- `publish.realdb.test.js`: publish -> canonical review -> dashboard refresh
- `merchant-read.realdb.test.js`: route -> auth -> service -> Prisma proof for merchant reads

Current auth-lifecycle service suite:

- `refresh-token.service.test.js`: rotation, family-wide revoke on reuse, invalid and expired token handling, revoke-all behavior
- `password-reset.service.test.js`: enumeration-safe forgot-password behavior, reset token issuance, invalid/used/expired reset handling, credential invalidation and refresh-session revocation

## 4. Shared Seed Dataset

The shared seed currently provides:

- 2 restaurants
- owner, manager, and outsider memberships
- 2 published baseline batches
- 1 open Google Maps crawl draft batch
- 1 queued-crawl audit trail with raw reviews
- 1 invalid raw review example

This dataset must support:

- dashboard demo
- review evidence demo
- admin curation demo
- publish smoke
- merchant-read HTTP smoke
- later frontend integration fixes

## 5. Commands

Fast suite:

```powershell
cd "D:\Project 3\backend-sentify"
npm test
```

Seed local database:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:seed
```

Real Postgres smoke:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm run db:seed
npm run test:realdb
```

Queued crawl smoke:

```powershell
cd "D:\Project 3\backend-sentify"
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
npm run smoke:review-crawl-queue -- --url "https://maps.app.goo.gl/..."
```

## 6. Minimum Evidence

| Area | Minimum expected evidence |
|---|---|
| Auth | register, login, logout, session, invalid token, expired token, permission denial, refresh rotation and reuse detection, forgot/reset password lifecycle |
| CSRF | issue cookie, missing token -> `403`, correct token -> success |
| Restaurant access | owner, manager, outsider behavior |
| Merchant read routes | seeded `GET /api/restaurants`, `/:id`, `/:id/reviews`, KPI, sentiment, trend, complaints, top issue |
| Admin intake | create, add, update, delete, publish, duplicate reuse |
| Review crawl | source upsert, queued run, worker processing, materialize-intake |
| Ops | `/health`, `/api/health`, migrations, seed, worker startup |

## 7. Remaining Gaps

The main testing gaps still left are:

- SMB load testing for queue workers and dashboard reads
- staging proof, backup, restore, and rollback

## 8. Merge Gate

- `npm test` passes
- `npm run db:validate` passes
- any high-risk backend change ships with test or smoke evidence
- changes to publish or crawl runtime need real evidence, not only mocks
- public contract docs stay synced when behavior changes
