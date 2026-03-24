# Sentify Backend Architecture

Updated: 2026-03-24

This document describes the backend as it exists in the current codebase.
It intentionally avoids future-only roles and flows that are not implemented yet.

## Runtime Shape

Sentify backend is a modular monolith built with:

- Node.js + Express 5
- PostgreSQL + Prisma 7
- CommonJS runtime

Entry points:

- `src/server.js`: process lifecycle, startup, graceful shutdown
- `src/app.js`: Express middleware and route mounting

Mounted route groups:

- `/api/auth`
- `/api/restaurants`
- `/api/admin`
- `/health`
- `/api/health`

## Current Module Layout

The codebase is currently in a mixed state:

- `admin-intake` already follows a feature-module pattern under `src/modules/admin-intake/`
- `review-crawl` now also follows a feature-module pattern under `src/modules/review-crawl/`
- that module now separates controller, service, repository, validation, and domain rules so batch-state logic and publish rules are not buried in HTTP handlers
- auth, restaurants, reviews, dashboard, and insights still use the older `routes/ + controllers/ + services/` layout

This means the backend is already modular, but the refactor toward a fully feature-oriented structure is not finished yet.

## Directory Map

```text
backend-sentify/
  prisma/
    schema.prisma
    migrations/
    prisma.config.ts
  src/
    app.js
    server.js
    config/
      constants.js
      env.js
    controllers/
      auth.controller.js
      dashboard.controller.js
      restaurants.controller.js
      reviews.controller.js
    lib/
      app-error.js
      auth-cookie.js
      controller-error.js
      math.js
      prisma.js
      security-event.js
    middleware/
      auth.js
      csrf.js
      error-handler.js
      rate-limit.js
      request-id.js
      request-logger.js
      require-permission.js
      validate-uuid.js
    modules/
      admin-intake/
        admin-intake.controller.js
        admin-intake.domain.js
        admin-intake.repository.js
        admin-intake.routes.js
        admin-intake.service.js
        admin-intake.validation.js
      review-crawl/
        google-maps.parser.js
        google-maps.routes.js
        google-maps.service.js
        google-maps.validation.js
        review-crawl.controller.js
        review-crawl.domain.js
        review-crawl.queue.js
        review-crawl.repository.js
        review-crawl.runtime.js
        review-crawl.service.js
    routes/
      auth.js
      restaurants.js
    services/
      auth.service.js
      dashboard.service.js
      email.service.js
      insight.service.js
      password-reset.service.js
      refresh-token.service.js
      restaurant-access.service.js
      restaurant.service.js
      review.service.js
      sentiment-analyzer.service.js
  test/
```

## Request Flow

Typical request lifecycle:

1. `request-id` assigns `req.requestId`
2. `request-logger` measures and logs the request
3. `cors`, `helmet`, body parsers
4. global `/api` rate limit
5. `csrfProtection`
6. route matching
7. optional `auth` middleware
8. optional `require-permission`
9. controller validation with Zod
10. service execution
11. Prisma / repository access
12. JSON response or mapped error

## Auth and Session Model

Current auth implementation supports both:

- Bearer token via `Authorization: Bearer ...`
- cookie-based session via `sentify_access_token`

Additional auth features already implemented:

- refresh token rotation
- password reset tokens
- login lockout after repeated failures
- token revocation through `tokenVersion`
- fallback verification with `JWT_SECRET_PREVIOUS`

Important implementation notes:

- `csrf.js` enforces double-submit protection for cookie-authenticated write requests
- the CSRF contract now covers both access-cookie and refresh-cookie write paths
- auth controllers issue `XSRF-TOKEN` on register, login, session refresh, password change, refresh, and explicit `GET /api/auth/csrf`
- auth controllers clear `XSRF-TOKEN` on logout, refresh failure, and password reset
- Bearer-token requests bypass CSRF validation because the browser cannot inject the bearer token from another origin

This means the cookie-based auth path is now fully wired end-to-end for browser writes.

## Authorization Model

There is no global `SYSTEM_ADMIN` role in the current schema.

Current authorization is restaurant-scoped:

- `RestaurantUser.permission` can be `OWNER` or `MANAGER`
- access checks are resolved through membership in `RestaurantUser`

Admin-intake routes are not global operator routes yet. They are protected by:

- authenticated user
- restaurant membership
- `OWNER` or `MANAGER` permission for the target restaurant

## Data Ownership Boundaries

Current ownership split:

- `restaurants`, `reviews`, `dashboard`, `insights`: merchant-facing read/update surface
- `admin-intake`: curation workflow before publishing to canonical reviews
- `review-crawl`: ingestion bridge that turns external Google Maps place URLs into validated intake-ready JSON
- `Review`: canonical dataset used by merchant-facing reads
- `ReviewIntakeBatch` and `ReviewIntakeItem`: staging and review workflow

## Review Crawl Flow

Current Google Maps crawl architecture now has two lanes:

1. preview lane:
   - `POST /api/admin/review-crawl/google-maps`
   - synchronous, small, used for diagnostics and sampling
2. job lane:
   - source upsert
   - queued crawl run
   - worker-side page-by-page persistence
   - optional materialization into draft intake batch

Queued crawl flow:

1. API resolves canonical source identity from the input URL
2. API creates or upserts one `ReviewCrawlSource`
3. API creates one `ReviewCrawlRun` with status `QUEUED`
4. BullMQ enqueues the run into the `review-crawl` queue
5. worker process claims the run lease and initializes a Google Maps review session
6. worker fetches review pages sequentially and persists normalized raw reviews page-by-page
7. worker checkpoints `nextPageToken`, counts, warnings, and known-review streak after each page
8. worker finishes the run as `COMPLETED`, `PARTIAL`, `FAILED`, or `CANCELLED`
9. admin may materialize the run into a draft intake batch

Why this matters:

- the HTTP app is no longer responsible for long-running deep crawls
- crawl progress survives process restarts through persisted run state
- incremental syncs stop early when the worker hits already-known reviews
- canonical `Review` still stays behind the admin-intake publish boundary

## Publish Flow

Current publish flow in `admin-intake.service.js`:

1. load batch and verify it is editable
2. filter approved intake items
3. validate that each approved item is publishable and build canonical `Review` payload from normalized-or-raw values
4. derive a stable manual external id from source review identity
5. create new canonical reviews or update existing canonical reviews with the same `(restaurantId, externalId)` inside one transaction
6. link intake items to `canonicalReviewId`, allowing multiple intake rows from different batches to reference one canonical review
7. mark batch as `PUBLISHED`
8. recalculate `InsightSummary` and `ComplaintKeyword`

This is synchronous in the request path today.

## Dashboard Read Model

Current dashboard behavior:

- KPI reads from cached `InsightSummary`
- complaint keywords read from cached `ComplaintKeyword`
- trend is aggregated from `Review`
- sentiment breakdown is grouped from `Review`
- review evidence reads from canonical `Review`

## Testing Posture

The project has a solid mocked test layer:

- controller tests
- service tests
- route-level integration tests with mocked Prisma
- auth integration coverage for cookie plus CSRF handshake
- repository coverage for cross-batch canonical review reuse on publish

The current suite is good for business logic verification, but it is not yet a full real-database integration setup.
