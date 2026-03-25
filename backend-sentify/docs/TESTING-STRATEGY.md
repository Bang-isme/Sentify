# Sentify Backend Testing Strategy

Updated: 2026-03-25

This document tracks the current backend testing posture for the live codebase.

Source-of-truth docs:

- `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`
- `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`

## 1. Goals

The backend test strategy now has six practical layers:

1. fast unit and mocked integration tests for daily development
2. real Postgres smoke for auth, publish, and canonical data updates
3. queued crawl runtime proof for background ingestion
4. seeded HTTP smoke for user-facing routes
5. local SMB load proof for user-facing latency and throughput
6. local recovery, queue, and shadow-database drills for operational confidence

Important role-testing principle:

- the product remains merchant-first and admin-curated
- the runtime role model is now simplified to:
  - `USER`
  - `ADMIN`
- tests should prove both the role boundary and the restaurant-scope boundary

## 2. Current Test Layers

```text
Browser E2E                Implemented for critical paths
Local SMB load proof       Implemented
Seeded read-path smoke     Implemented
Real Postgres smoke        Implemented
Queued crawl smoke         Implemented
Mocked integration         Current baseline
Unit tests                 Current baseline
```

### Current baseline

- unit tests for services, parsers, validation, and domain helpers
- mocked integration tests for controller and request/response behavior
- auth integration for cookie plus CSRF handshake
- auth integration for body-token refresh, refresh-failure cookie clearing, and forgot/reset controller contracts
- service-level auth lifecycle coverage for refresh rotation, reuse handling, forgot-password, and reset-password
- publish-path coverage for canonical review reuse
- queue/runtime coverage for BullMQ-safe job ids and worker lifecycle
- role-boundary integration coverage for `USER` versus `ADMIN`
- admin restaurant overview coverage for the new admin discovery flow
- admin access integration coverage for users and memberships
- admin platform integration coverage for health, policies, and audit

### Real-data coverage already in place

- `npm run db:seed`
- `npm run test:realdb`
- `npm run load:merchant-reads -- --extra-reviews 4000 --concurrency 8 --rounds 45 --output load-reports/merchant-reads-smb-local.json`
- `npm run load:review-crawl-workers -- --source-count 24 --concurrency 4 --pages-per-run 12 --reviews-per-page 20 --step-ms 40 --output load-reports/review-crawl-workers-smb-local.json`
- `npm run smoke:review-ops-sync-draft -- --url "..."` for operator-triggered queue proof
- `npm run smoke:review-crawl-queue -- --url "..."` for queue-backed crawl proof
- `npm run smoke:recovery-drill`
- `npm run smoke:staging-recovery-drill`
- `npm run db:reset:local-baseline`
- `test/merchant-read.realdb.test.js` for end-to-end user-facing HTTP proof on seeded Postgres

Browser E2E entry point:

```powershell
cd "D:\Project 3\apps\web"
npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts
```

Current browser-critical-path proof:

- `USER`: login, merchant app landing, `Home`, `Reviews`, `Actions`, `Settings`, settings update, admin-route deny, logout
- `ADMIN`: login, admin hub landing, live `Operations`, `Access`, and `Platform` screens, merchant-route deny, logout

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

- `auth.realdb.test.js`: register -> session cookie -> refresh rotation -> logout proof
- `duplicate-publish.realdb.test.js`: same source review across multiple batches must reuse canonical review rows and keep insight totals stable
- `publish.realdb.test.js`: publish -> canonical review -> dashboard refresh
- `merchant-read.realdb.test.js`: user-facing route -> auth -> service -> Prisma proof, plus `USER` versus `ADMIN` boundaries and admin restaurant overview smoke

Current auth-lifecycle service suite:

- `refresh-token.service.test.js`
- `password-reset.service.test.js`

Current role and route boundary suite:

- `data-isolation.integration.test.js`
- `admin-restaurants.integration.test.js`
- `auth.integration.test.js`

## 4. Shared Seed Dataset

The shared seed currently provides:

- 2 restaurants
- 5 users:
  - 3 `USER` accounts with restaurant membership
  - 1 `USER` outsider without restaurant membership
  - 1 `ADMIN` operator
- 2 published baseline batches
- 1 open Google Maps crawl draft batch
- 1 queued-crawl audit trail with raw reviews
- 1 invalid raw review example

This dataset must support:

- user-facing dashboard demo
- review evidence demo
- admin curation demo
- publish smoke
- role-boundary smoke
- user-flow versus admin-flow verification

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

Operator-triggered queue smoke:

```powershell
cd "D:\Project 3\backend-sentify"
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\memurai.exe
node scripts/review-ops-sync-draft-smoke.js --url "https://maps.app.goo.gl/..."
```

Local SMB load proof:

```powershell
cd "D:\Project 3\backend-sentify"
npm run load:merchant-reads -- --extra-reviews 4000 --concurrency 8 --rounds 45 --output load-reports/merchant-reads-smb-local.json
npm run load:review-crawl-workers -- --source-count 24 --concurrency 4 --pages-per-run 12 --reviews-per-page 20 --step-ms 40 --output load-reports/review-crawl-workers-smb-local.json
```

Recovery drills:

```powershell
cd "D:\Project 3\backend-sentify"
npm run smoke:recovery-drill
npm run smoke:staging-recovery-drill
```

## 6. Minimum Evidence

| Area | Minimum expected evidence |
|---|---|
| Auth | register, login, logout, session, invalid token, expired token, refresh rotation and reuse detection, forgot/reset password lifecycle |
| CSRF | issue cookie, missing token -> `403`, correct token -> success |
| User flow role boundary | `USER` can use `/api/restaurants/*`; `ADMIN` gets `403` there |
| Restaurant scope boundary | member can read own restaurant; outsider gets `404` |
| Admin flow role boundary | `USER` gets `403` on `/api/admin/*`; `ADMIN` is allowed |
| User-facing routes | seeded `GET /api/restaurants`, `/:id`, `/:id/reviews`, KPI, sentiment, trend, complaints, top issue |
| Admin overview flow | `GET /api/admin/restaurants` and `GET /api/admin/restaurants/:id` expose restaurant discovery plus combined `userFlow` and `adminFlow` overview |
| Admin access | `GET /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/role`, `POST /api/admin/users/:id/password-reset`, `GET/POST/DELETE /api/admin/memberships*` |
| Admin platform | `GET /api/admin/platform/health-jobs`, `GET /api/admin/platform/integrations-policies`, `GET /api/admin/platform/audit` |
| Admin intake | create, add, update, delete, publish, duplicate reuse |
| Review crawl | source upsert, queued run, worker processing, materialize-intake |
| Review ops | sync-to-draft, source list, run detail, readiness, approve-valid, publish |
| Performance | local SMB read-load report and worker-pressure report for high-risk backend changes |
| Ops | `/health`, `/api/health`, migrations, seed, worker startup, local logical recovery drill, shadow-database restore plus rollback rehearsal |

## 7. Remaining Gaps

The main testing gaps still left are:

- managed Redis or staging-backed queue proof beyond local Memurai compatibility
- real staging proof and managed-environment backup, restore, and rollback beyond local logical and shadow-database drills
- browser coverage is still limited to first-wave critical paths and does not yet exercise deep intake publish or queue-backed crawl execution inside the browser

## 8. Merge Gate

- `npm test` passes
- `npm run db:validate` passes
- any high-risk backend change ships with test or smoke evidence
- changes to publish or crawl runtime need real evidence, not only mocks
- role-boundary changes must prove:
  - `USER` allow on `/api/restaurants/*`
  - `USER` deny on `/api/admin/*`
  - `ADMIN` allow on `/api/admin/*`
  - `ADMIN` deny on `/api/restaurants/*`
- user-facing or worker performance changes should refresh the local load report or equivalent evidence
- source-of-truth docs stay synced when behavior changes
