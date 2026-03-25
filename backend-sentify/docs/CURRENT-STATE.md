# Sentify Backend Current State

Updated: 2026-03-25

This document describes the backend exactly as it exists in the current codebase.

## 1. Product Direction

The backend is aligned to a manual-first, merchant-first product:

- admin-curated intake is the only way new evidence enters the system
- publish is the only step that moves data into canonical `Review`
- user-facing dashboard and review APIs read only from canonical published data
- crawl runtime is an admin-side ingestion aid, not a user-triggered product flow

Important role clarification:

- business surface still has two actor groups: user-facing restaurant users and internal admins
- system roles are now simplified to exactly two values:
  - `User.role = USER`
  - `User.role = ADMIN`
- `RestaurantUser` is now a pure membership relation
- there is no secondary permission enum on restaurant membership anymore

In practice, this means:

- `/api/restaurants/*` is the user-facing surface for authenticated `USER` accounts that belong to the restaurant
- `/api/admin/*` is the internal control-plane surface for authenticated `ADMIN` accounts
- admin access no longer inherits from restaurant membership
- admin users are intentionally blocked from the user-facing restaurant routes

Current FE shell contract on top of that split:

- merchant app for `USER`
  - `/app`
  - `/app/reviews`
  - `/app/actions`
  - `/app/settings`
- admin app for `ADMIN`
  - `Operations` is backed now:
    - `/admin/operations/restaurants`
    - `/admin/operations/intake`
    - `/admin/operations/review-ops`
    - `/admin/operations/crawl`
  - `Access` and `Platform` are already part of the FE IA but remain marked `Next` until backend expansion lands:
    - `/admin/access/*`
    - `/admin/platform/*`

## 2. Runtime Stack

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- BullMQ plus Redis for queued crawl jobs
- CommonJS runtime

The backend is a modular monolith. `admin-intake`, `review-crawl`, `review-ops`, and `admin-restaurants` are now clear backend feature modules. Auth and restaurant reads still use the older route-controller-service shape.

## 3. Current Role Model

### System roles

- `USER`
  - uses the user-facing product routes
  - must also belong to the target restaurant through `RestaurantUser`
- `ADMIN`
  - uses only the admin control-plane routes
  - does not need restaurant membership to inspect or operate on a restaurant

### Flow split

#### User-facing flow

Endpoints:

- `POST /api/restaurants`
- `GET /api/restaurants`
- `GET /api/restaurants/:id`
- `PATCH /api/restaurants/:id`
- `GET /api/restaurants/:id/reviews`
- `GET /api/restaurants/:id/dashboard/*`

Behavior:

- create or select a restaurant
- inspect canonical dataset status
- read KPI, sentiment, trend, complaints, top issue, and review evidence

#### Admin flow

Endpoints:

- `GET /api/admin/restaurants`
- `GET /api/admin/restaurants/:id`
- `GET /api/admin/review-batches*`
- `POST /api/admin/review-batches*`
- `PATCH /api/admin/review-items/:id`
- `POST /api/admin/review-crawl/*`
- `POST /api/admin/review-ops/*`

Behavior:

- inspect all restaurants
- review user-facing dataset status plus admin-side next actions
- curate intake batches
- run or inspect Google Maps crawl jobs
- sync crawl evidence into draft batches
- publish approved evidence into canonical reviews

## 4. What The Backend Already Has

### Auth and security

- register, login, session, logout
- password change
- refresh token rotation
- forgot password and reset password
- cookie auth and bearer auth
- CSRF double-submit protection for cookie writes
- rate limits and login lockout
- token revocation through `tokenVersion`
- explicit route separation between `USER` and `ADMIN`

### User-facing reads

- restaurant list and detail
- dataset status
- review evidence list
- dashboard KPI
- sentiment breakdown
- trend
- complaint keywords
- top issue and next action

### Admin control plane

- restaurant list for admin selection
- admin restaurant overview with:
  - current user-facing dataset status
  - source stats
  - latest crawl run
  - open intake batches
  - next recommended admin actions
- intake create, edit, delete, publish
- canonical review reuse when external review identity matches
- review crawl source upsert and queued runs
- crawl-to-draft orchestration via `review-ops`

### Review crawl runtime

- Google Maps source upsert
- queued crawl runs
- worker process with checkpoint, cancel, and resume
- raw review persistence
- draft materialization into intake batches
- fresh-session cursor recovery for suspicious empty pages
- backfill auto-resume from persisted checkpoint cursors
- structured `crawlCoverage` diagnostics and mismatch warnings when preview totals exceed extracted public reviews

## 5. Current Database Shape

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

Important role and ownership invariants:

- `User.role` is the only system-role switch
- `RestaurantUser` only answers “does this user belong to this restaurant?”
- `Review` is the canonical user-facing dataset
- `ReviewIntakeBatch` and `ReviewIntakeItem` are admin-side staging
- `ReviewCrawlSource`, `ReviewCrawlRun`, and `ReviewCrawlRawReview` are admin-side crawl runtime and audit state

## 6. Seed And Demo Data

The shared seed dataset currently creates:

- 2 restaurants
- 5 users:
  - 3 `USER` accounts with realistic restaurant memberships
  - 1 `USER` outsider account with no membership
  - 1 `ADMIN` operator account
- published baseline data
- an open Google Maps crawl draft batch
- a crawl source, a crawl run, and raw review audit rows
- at least one invalid raw review example for readiness diagnostics

This dataset supports:

- user-facing dashboard demo
- review evidence demo
- admin curation demo
- publish smoke
- role-boundary smoke

Local deterministic reset and browser entrypoints:

- `npm run db:reset:local-baseline`
- seeded `USER` login: `demo.user.primary@sentify.local` / `DemoPass123!`
- seeded `ADMIN` login: `demo.admin@sentify.local` / `DemoPass123!`
- browser E2E entrypoint: `cd "D:\Project 3\apps\web" ; npx playwright test`

## 7. Quality And Evidence Already In Place

Current verification evidence includes:

- `npm test`
- `npm run db:validate`
- `npm run db:seed`
- `npm run test:realdb`
- `cd "D:\Project 3\apps\web" ; npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts`
- queued crawl smoke
- review crawl scale-validation harness
- local SMB user-read load proof
- local worker-pressure proof
- local operator-path proof
- local logical recovery drill
- local shadow-database restore and rollback rehearsal

Important proof points already exist:

- auth token tables now match the live Prisma schema on fresh and existing local databases
- route guards now enforce the simplified `USER` vs `ADMIN` split
- admin users can inspect restaurants through dedicated admin endpoints instead of borrowing user-facing routes
- real Postgres HTTP smoke covers user-facing read routes
- real Postgres smoke covers publish and duplicate publish behavior
- browser E2E now proves:
  - strict `USER` vs `ADMIN` shell separation
  - direct-route fail-close behavior
  - merchant critical path across `Home`, `Reviews`, `Actions`, and `Settings`
  - admin critical path across live `Operations` screens plus structural `Access` and `Platform` navigation
- Redis-backed local smoke covers worker and operator queue flow
- shadow-database recovery proof covers restore plus app-level rollback smoke

## 8. What Is Still Missing

The backend is still not fully release-ready. Main remaining gaps:

- managed Redis or staging proof beyond local Memurai-backed queue evidence
- real deployed staging evidence and managed-environment backup, restore, and rollback drills beyond the current local shadow-database rehearsal
- continued refactor of older auth and restaurant modules toward the same feature-module shape

## 9. Short Conclusion

The backend is already beyond the demo-only stage.

The important contract is now simpler than before:

- user-facing app flow belongs to `USER`
- admin control-plane flow belongs to `ADMIN`
- restaurant membership answers scope, not privilege level

That keeps the codebase closer to the real product goal:

- users read stable restaurant intelligence
- admins operate intake, crawl, and publish mechanics
