# Sentify Backend Architecture

Updated: 2026-04-01

This document describes the backend as it exists in the current codebase.

It keeps one important distinction explicit:

- the product still has two actor groups from the proposal:
  - user-facing restaurant users
  - internal admins
- the runtime implementation now models that split with only two system roles:
  - `USER`
  - `ADMIN`

## Runtime Shape

Sentify backend is a modular monolith built with:

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- BullMQ plus Redis for queued crawl work
- CommonJS runtime

Entry points:

- `src/server.js`: process lifecycle and graceful shutdown
- `src/app.js`: middleware and route mounting

Health boundary:

- `/health` is a minimal liveness route
- `/api/health` is a lightweight readiness route:
  - Postgres `SELECT 1`
  - bounded Redis `PING`
- heavy queue and worker diagnostics stay on admin platform surfaces such as:
  - `/api/admin/platform/health-jobs`

Mounted route groups:

- `/api/auth`
- `/api/restaurants`
- `/api/admin`
- `/health`
- `/api/health`

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
      prisma.js
      security-event.js
      user-roles.js
    middleware/
      auth.js
      csrf.js
      error-handler.js
      rate-limit.js
      request-id.js
      request-logger.js
      require-internal-role.js
      require-user-role.js
      validate-uuid.js
    modules/
      admin-restaurants/
        admin-restaurants.controller.js
        admin-restaurants.routes.js
        admin-restaurants.service.js
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
      review-ops/
        review-ops.controller.js
        review-ops.routes.js
        review-ops.service.js
        review-ops.validation.js
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
      user-access.service.js
  test/
```

## Module Layout

The backend is currently split into two styles:

- feature modules under `src/modules/*` for admin-facing orchestration areas
- older route-controller-service slices for auth and user-facing restaurant reads

Current feature modules:

- `admin-restaurants`
- `admin-intake`
- `review-crawl`
- `review-ops`

This means the codebase is already modular, but the full refactor to one uniform module style is still unfinished.

## Request Flow

Typical request lifecycle:

1. `request-id` assigns `req.requestId`
2. `request-logger` records timing and outcome
3. `cors`, `helmet`, and body parsers run
4. global `/api` rate limit applies
5. `csrfProtection` checks cookie-authenticated writes
6. route match happens
7. `auth` optionally loads the authenticated user
8. one of the role guards may run:
   - `require-user-role`
   - `require-internal-role`
9. controller validates input
10. service executes business logic
11. Prisma persists or reads data
12. response or mapped error is returned

## Auth and Session Model

The auth model supports both:

- bearer token auth
- cookie-based browser auth

Security features already implemented:

- refresh token rotation
- password reset tokens
- login lockout after repeated failures
- token revocation through `tokenVersion`
- optional fallback verification with `JWT_SECRET_PREVIOUS`
- CSRF double-submit protection for cookie-authenticated writes

Operational notes:

- auth controllers issue `XSRF-TOKEN` on register, login, refresh, password change, session bootstrap, and explicit CSRF bootstrap
- logout and refresh failure clear auth cookies and CSRF state
- bearer-token requests bypass CSRF because the browser cannot inject the bearer token cross-site

## Authorization Model

### System roles

Source of truth:

- Prisma enum in `prisma/schema.prisma`
- runtime constants in `src/lib/user-roles.js`

Current runtime roles:

- `USER`
- `ADMIN`

### Scope model

Restaurant scoping is handled by `RestaurantUser`.

Important rule:

- `RestaurantUser` is membership only
- it does not carry sub-roles such as owner, manager, or member anymore

### Route split

User-facing routes:

- mounted at `/api/restaurants`
- require `auth`
- require `User.role = USER`
- require restaurant membership for restaurant-scoped reads and updates

Admin routes:

- mounted at `/api/admin`
- require `auth`
- require `User.role = ADMIN`
- do not require restaurant membership

### Why the split matters

This preserves the proposal's actor boundary while simplifying implementation:

- restaurant users read only the stable canonical dataset
- internal admins manage intake, crawl, readiness, and publish
- admin users do not borrow user-facing routes to understand a restaurant
- user-facing accounts cannot see admin-only mechanics

## Endpoint Ownership by Flow

### User-facing flow

Owned by:

- `routes/restaurants.js`
- `controllers/restaurants.controller.js`
- `controllers/dashboard.controller.js`
- `controllers/reviews.controller.js`
- `services/restaurant.service.js`
- `services/dashboard.service.js`
- `services/review.service.js`

What it does:

- create a restaurant
- list the user's restaurants
- read restaurant detail and dataset status
- read dashboard aggregates
- read canonical review evidence
- update restaurant profile fields

### Admin flow

Owned by:

- `modules/admin-restaurants/*`
- `modules/admin-intake/*`
- `modules/review-crawl/*`
- `modules/review-ops/*`

What it does:

- inspect restaurant-level admin overview
- curate intake batches
- preview or queue Google Maps crawl runs
- sync crawl data into draft batches
- approve valid items
- publish approved evidence into canonical reviews

## Data Ownership Boundaries

User-facing reads:

- `Review`
- `InsightSummary`
- `ComplaintKeyword`
- dataset status derived from intake and publish state

Admin-side workflow state:

- `ReviewIntakeBatch`
- `ReviewIntakeItem`
- `ReviewCrawlSource`
- `ReviewCrawlRun`
- `ReviewCrawlRawReview`

Important invariant:

- user-facing routes never read draft intake items directly as product evidence
- publish is the boundary that moves approved evidence into canonical `Review`

## Review Crawl Flow

The Google Maps crawl runtime has three layers:

1. preview lane
   - synchronous sample fetch for diagnostics
2. queued runtime lane
   - source upsert
   - queue-backed run lifecycle
   - persisted raw review checkpoints
3. operator lane
   - one-click sync to draft
   - readiness checks
   - admin publish follow-through

Queued crawl flow:

1. admin upserts a crawl source
2. admin creates a crawl run
3. BullMQ enqueues the run
4. worker processes pages and persists raw reviews plus checkpoint state
5. run finishes as `COMPLETED`, `PARTIAL`, `FAILED`, or `CANCELLED`
6. admin may materialize the run into a draft intake batch

## Review Ops Flow

`review-ops` composes the crawl and intake layers into a tighter admin workflow:

1. sync Google Maps URL to draft
2. inspect sources and runs
3. inspect draft readiness
4. bulk approve valid pending items
5. publish the batch

This module exists so the admin flow can be understood from backend endpoints without the frontend having to stitch together low-level crawl calls itself.

## Admin Restaurant Overview

`admin-restaurants` is the missing "flow map" module for internal users.

Its two endpoints:

- `GET /api/admin/restaurants`
- `GET /api/admin/restaurants/:id`

exist for one reason:

- admin needs one clear discovery and overview surface that explains both:
  - what the user-facing restaurant currently looks like
  - what the admin should do next

That is why the detail payload contains both:

- `userFlow`
- `adminFlow`

## Current Architectural Summary

The current backend architecture is intentionally simple:

- one modular monolith
- one user-facing route family
- one admin route family
- one canonical dataset boundary

That simplicity is now enforced by the role model too:

- `USER` owns the user-facing restaurant app surface
- `ADMIN` owns the internal control plane
- `RestaurantUser` only scopes which restaurant a `USER` can access
