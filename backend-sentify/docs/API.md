# Sentify API Reference

Updated: 2026-03-29
Base URL: `http://localhost:3000/api`

This document describes the API surface that exists in the backend today.
It is intentionally aligned to the simplified runtime role model:

- `User.role = USER`
- `User.role = ADMIN`

Important clarification:

- the product still has two actor groups from the proposal:
  - user-facing restaurant users
  - internal admins
- the implementation now keeps that split with only two system roles
- `RestaurantUser` is only a restaurant-scoping relation
- there is no secondary restaurant permission enum anymore

## Conventions

### Auth Transport

Protected endpoints currently accept either:

- `Authorization: Bearer <access_token>`
- auth cookie `sentify_access_token`

Cookie-based auth also uses:

- refresh cookie `sentify_refresh_token`
- CSRF cookie `XSRF-TOKEN`

Important rules:

- cookie-authenticated `POST`, `PATCH`, and `DELETE` requests must send `X-CSRF-Token`
- `GET /api/auth/csrf` can be called before cookie-authenticated writes or refresh flows
- auth responses set cookies; JSON responses do not expose raw tokens

### Response Shapes

Success:

```json
{ "data": { "id": "..." } }
```

Paginated:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "timestamp": "2026-03-25T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

## Role Model

### Runtime roles

- `USER`
  - allowed on `/api/restaurants/*`
  - still needs `RestaurantUser` membership for restaurant-scoped reads and updates
- `ADMIN`
  - allowed on `/api/admin/*`
  - does not need restaurant membership to inspect or operate on a restaurant

### Boundary rules

- `USER` is denied on `/api/admin/*`
- `ADMIN` is denied on `/api/restaurants/*`
- membership only answers "which restaurant can this user see?"
- role only answers "which app surface can this account enter?"

Local demo seed:

- `npm run db:reset:local-baseline` recreates the deterministic local dataset
- seeded `USER` login: `demo.user.primary@sentify.local` / `DemoPass123!`
- seeded `ADMIN` login: `demo.admin@sentify.local` / `DemoPass123!`

Current FE route mapping on top of this API contract:

- merchant app for `USER`
  - `/app`
  - `/app/reviews`
  - `/app/actions`
  - `/app/settings`
- admin app for `ADMIN`
  - live `Operations`: `/admin/operations/*`
  - live `Access`: `/admin/access/*`
  - live `Platform`: `/admin/platform/*`

## Health

### `GET /health`

```json
{ "status": "ok" }
```

### `GET /api/health`

```json
{ "status": "ok", "db": "up", "redis": "up" }
```

or

```json
{ "status": "unavailable", "db": "down", "redis": "down" }
```

Current semantics:

- `db`
  - `up`
  - `down`
  - `skipped` in `NODE_ENV=test`
- `redis`
  - `up`
  - `down`
  - `unconfigured`
  - `skipped` in `NODE_ENV=test` or inline queue mode

The endpoint now checks both:

- Postgres availability through Prisma
- review-crawl Redis queue availability through the queue-health probe

## Auth

### `POST /api/auth/register`

Creates a new `USER`, sets auth, refresh, and CSRF cookies, and returns:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "role": "USER"
    },
    "expiresIn": 900
  }
}
```

### `POST /api/auth/login`

Sets auth, refresh, and CSRF cookies and returns:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "role": "USER",
      "restaurants": [
        {
          "id": "uuid",
          "name": "Cafe One",
          "slug": "cafe-one"
        }
      ]
    },
    "expiresIn": 900
  }
}
```

Important lifecycle errors now returned by auth:

- `401 AUTH_ACCOUNT_LOCKED`
- `403 AUTH_ACCOUNT_DEACTIVATED`

### `GET /api/auth/session`

Returns the current authenticated user and restaurant memberships.
Also re-issues the CSRF cookie for browser clients using cookie auth.

Response shape:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "role": "USER",
      "restaurants": [
        {
          "id": "uuid",
          "name": "Cafe One",
          "slug": "cafe-one"
        }
      ]
    }
  }
}
```

### `GET /api/auth/csrf`

Issues or rotates the `XSRF-TOKEN` cookie and returns `204 No Content`.

### `POST /api/auth/logout`

Clears auth, refresh, and CSRF cookies and revokes the current token version.

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

### `PATCH /api/auth/profile`

Updates the authenticated user's own profile fields.

Currently supported writable fields:

- `fullName`
- `email`

Request body:

```json
{
  "fullName": "Tran Van B",
  "email": "user.updated@example.com"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user.updated@example.com",
      "fullName": "Tran Van B",
      "role": "USER",
      "restaurants": []
    }
  }
}
```

Rules:

- authenticated user only
- cookie-authenticated requests must still send `X-CSRF-Token`
- at least one profile field must be provided
- email remains globally unique
- role, memberships, and account lifecycle are not editable here

### `PATCH /api/auth/password`

Changes password, revokes previous sessions, issues fresh cookies, and returns:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "role": "USER"
    },
    "expiresIn": 900
  }
}
```

### `POST /api/auth/refresh`

Rotates refresh token and renews auth, refresh, and CSRF cookies.

```json
{
  "data": {
    "expiresIn": 900
  }
}
```

### `POST /api/auth/forgot-password`

Always returns a generic success message.

### `POST /api/auth/reset-password`

Consumes a reset token and returns:

```json
{
  "data": {
    "message": "Password has been reset successfully"
  }
}
```

## Flow Map

### User-facing flow

This is the stable product surface read by restaurant users.

Typical sequence:

1. register or login
2. read session
3. create or select a restaurant
4. read restaurant detail and dataset status
5. read dashboard and review evidence
6. update restaurant profile fields if needed

Required identity:

- `User.role = USER`
- restaurant membership for restaurant-scoped routes

### Admin flow

This is the internal control plane for curated intake and crawl orchestration.

Typical sequence:

1. login as `ADMIN`
2. list restaurants through the admin overview surface
3. inspect one restaurant's user-facing dataset status plus admin-side next actions
4. curate intake batches or run crawl flows
5. publish approved evidence into canonical reviews

Required identity:

- `User.role = ADMIN`
- no restaurant membership required

## User-Facing Routes

All `/api/restaurants/*` routes require:

- authentication
- `User.role = USER`

### `POST /api/restaurants`

Creates a restaurant and immediately adds a `RestaurantUser` membership row for the calling `USER`.

### `GET /api/restaurants`

Lists restaurants that the current `USER` belongs to.

Returned fields:

- `id`
- `name`
- `slug`
- `googleMapUrl`
- `totalReviews`
- `entitlement`
  - `planTier`
  - `effectivePolicy.sourceSubmissionLane`
  - `effectivePolicy.sourceSyncIntervalMinutes`
  - `effectivePolicy.actionCardsLimit`
  - `effectivePolicy.prioritySync`
  - `effectivePolicy.processingClass`

### `GET /api/restaurants/:id`

Returns:

- restaurant summary
- `datasetStatus`
- `insightSummary`
- `entitlement`
- `sourceSubmission`

Important note:

- there is no `permission` field anymore
- if the caller is not a member of that restaurant, the API returns `404`

### `PATCH /api/restaurants/:id`

Updates restaurant profile fields:

- `name`
- `address`
- `googleMapUrl`

Current contract:

- any `USER` who belongs to the restaurant may update it
- there is no owner-only sub-role gate anymore
- responses now also include:
  - `entitlement`
  - `sourceSubmission`

### `GET /api/restaurants/:id/reviews`

Lists canonical review evidence for the restaurant.

Query params:

- `rating`
- `from`
- `to`
- `page`
- `limit`

### Dashboard routes

- `GET /api/restaurants/:id/dashboard/kpi`
- `GET /api/restaurants/:id/dashboard/sentiment`
- `GET /api/restaurants/:id/dashboard/trend`
- `GET /api/restaurants/:id/dashboard/complaints`
- `GET /api/restaurants/:id/dashboard/top-issue`
- `GET /api/restaurants/:id/dashboard/actions`

These routes only read canonical published data.
They do not expose draft intake state or internal operator notes.

### `GET /api/restaurants/:id/dashboard/actions`

Returns the merchant-facing prioritization payload built from canonical published reviews only.

Top-level shape:

```json
{
  "data": {
    "summary": {
      "state": "ACTIONABLE_NOW",
      "focusCode": "FIX_RESPONSE_TIME",
      "headline": "Focus on slow service first.",
      "detail": "3 published negative reviews mention slow service...",
      "generatedAt": "2026-03-27T00:00:00.000Z"
    },
    "snapshot": {
      "hasSourceUrl": true,
      "totalReviews": 25,
      "averageRating": 4.2,
      "negativePercentage": 20
    },
    "entitlement": {
      "planTier": "PREMIUM",
      "effectivePolicy": {
        "planTier": "PREMIUM",
        "sourceSubmissionLane": "PRIORITY",
        "sourceSyncIntervalMinutes": 360,
        "actionCardsLimit": 3,
        "prioritySync": true,
        "processingClass": "PRIORITY_QUEUE"
      }
    },
    "capabilities": {
      "sourceSubmissionLane": "PRIORITY",
      "sourceSyncIntervalMinutes": 360,
      "actionCardsLimit": 3,
      "prioritySync": true,
      "processingClass": "PRIORITY_QUEUE"
    },
    "executionLayer": {
      "currentFocusCode": "FIX_RESPONSE_TIME",
      "currentFocus": "Use published complaints to tighten speed of service first.",
      "nextCapabilityCode": "ASSIGN_AND_TRACK",
      "nextCapability": "Turn the top issue into ownership, follow-up, and repeat measurement in later publishes."
    },
    "topIssue": {
      "keyword": "slow service",
      "affectedReviewCount": 3,
      "affectedReviewPercentage": 60,
      "priority": "HIGH",
      "recommendationCode": "FIX_RESPONSE_TIME",
      "recommendation": "Check staffing and order handoff during peak hours...",
      "evidenceSummary": "Recent evidence mentioning slow service...",
      "evidenceReview": {
        "id": "uuid",
        "authorName": "Guest",
        "rating": 2,
        "sentiment": "NEGATIVE",
        "content": "Slow service again...",
        "reviewDate": "2026-03-27T00:00:00.000Z"
      }
    },
    "actionCards": []
  }
}
```

Current `summary.state` values:

- `AWAITING_SOURCE`
- `AWAITING_FIRST_PUBLISH`
- `ACTIONABLE_NOW`
- `MONITORING`

Important contract note:

- this endpoint is read-only
- it uses only canonical published complaint keywords and published negative review evidence
- it exists so FE does not have to infer merchant priorities from `complaints` and `top-issue` heuristics alone
- it now also carries the backend-owned merchant entitlement/capability contract so FE does not infer free-vs-premium behavior from internal queue state

## Admin Routes

All `/api/admin/*` routes require:

- authentication
- `User.role = ADMIN`

Important note:

- admin access does not depend on `RestaurantUser`
- the restaurant id in admin routes only scopes which restaurant the operator is acting on

## Admin Restaurant Overview

### `GET /api/admin/restaurants`

Lists all restaurants for internal admin discovery.

Returned fields include:

- restaurant identity and profile
- `totalReviews`
- `memberCount`
- `pendingBatchCount`
- `activeSourceCount`
- `insightSummary`
- `entitlement`

### `GET /api/admin/restaurants/:id`

Returns one combined overview that explains the full admin flow for a restaurant.

Top-level shape:

```json
{
  "data": {
    "restaurant": {
      "id": "uuid",
      "name": "Cafe One",
      "slug": "cafe-one",
      "memberCount": 2,
      "totalReviews": 25,
      "entitlement": {
        "planTier": "FREE"
      }
    },
    "userFlow": {
      "datasetStatus": {
        "sourcePolicy": "ADMIN_CURATED",
        "pendingBatchCount": 1
      },
      "insightSummary": {
        "totalReviews": 25,
        "averageRating": 4.2
      }
    },
    "adminFlow": {
      "sourceStats": {
        "totalCount": 1,
        "activeCount": 1,
        "disabledCount": 0
      },
      "latestRun": {
        "id": "uuid",
        "status": "PARTIAL"
      },
      "openBatches": [],
      "nextActions": []
    }
  }
}
```

Why this endpoint exists:

- admin should not need to borrow user-facing routes to understand a restaurant
- the endpoint makes the user-visible state and admin next steps visible in one payload

### `PATCH /api/admin/restaurants/:id/entitlement`

Updates the merchant-facing plan contract for one restaurant.

Request:

```json
{
  "planTier": "PREMIUM"
}
```

Response:

```json
{
  "data": {
    "restaurantId": "uuid",
    "entitlement": {
      "planTier": "PREMIUM",
      "effectivePolicy": {
        "planTier": "PREMIUM",
        "sourceSubmissionLane": "PRIORITY",
        "sourceSyncIntervalMinutes": 360,
        "actionCardsLimit": 3,
        "prioritySync": true,
        "processingClass": "PRIORITY_QUEUE"
      }
    }
  }
}
```

Important contract note:

- `RestaurantEntitlement.planTier` is the only persisted merchant-facing entitlement truth
- pending source submissions that still use `ENTITLEMENT_DEFAULT` lane source will be re-aligned to the new plan default
- submissions already marked `ADMIN_OVERRIDE` keep their operator-selected lane

## Admin Intake Routes

Mounted under `/api/admin`.

- `POST /review-batches`
- `GET /review-batches`
- `GET /review-batches/:id`
- `DELETE /review-batches/:id`
- `POST /review-batches/:id/items`
- `POST /review-batches/:id/items/bulk`
- `PATCH /review-items/:id`
- `DELETE /review-items/:id`
- `POST /review-batches/:id/publish`

Purpose:

- create draft batches
- ingest manual or crawl-derived items
- approve or reject evidence
- publish approved evidence into canonical `Review`

## Review Crawl Routes

Mounted under `/api/admin`.

- `POST /review-crawl/google-maps`
- `POST /review-crawl/sources`
- `POST /review-crawl/sources/:sourceId/runs`
- `GET /review-crawl/runs/:runId`
- `POST /review-crawl/runs/:runId/cancel`
- `POST /review-crawl/runs/:runId/resume`
- `POST /review-crawl/runs/:runId/materialize-intake`

Purpose:

- preview crawl samples
- register or update crawl sources
- queue crawl runs
- inspect queue-backed run state
- materialize valid raw reviews into draft intake

## Review Ops Routes

Mounted under `/api/admin`.

- `POST /review-ops/google-maps/sync-to-draft`
- `GET /review-ops/sources`
- `GET /review-ops/sources/:sourceId/runs`
- `GET /review-ops/runs/:runId`
- `POST /review-ops/sources/:sourceId/disable`
- `POST /review-ops/sources/:sourceId/enable`
- `GET /review-ops/batches/:batchId/readiness`
- `POST /review-ops/batches/:batchId/approve-valid`
- `POST /review-ops/batches/:batchId/publish`

Purpose:

- collapse crawl-to-draft into one operator flow
- inspect readiness before publish
- bulk-approve valid pending items
- publish through the same admin-curated boundary

## Admin Access Routes

Mounted under `/api/admin`.

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id/role`
- `PATCH /users/:id/account-state`
- `POST /users/:id/password-reset`
- `GET /memberships`
- `POST /memberships`
- `DELETE /memberships/:id`

Purpose:

- inspect the two-role account directory
- read one user's memberships, security posture, recent intake work, and recent crawl work
- create a new `USER` or `ADMIN`
- change a user between `USER` and `ADMIN`
- lock, unlock, deactivate, or reactivate an account
- trigger password-reset delivery
- inspect and manage restaurant membership links

Lifecycle invariants:

- admins cannot lock or deactivate themselves
- the last available `ADMIN` account cannot be locked, deactivated, or downgraded
- `ADMIN` accounts cannot hold restaurant memberships
- deactivated `USER` accounts cannot receive restaurant membership assignment

## Admin Platform Routes

Mounted under `/api/admin`.

- `GET /platform/health-jobs`
- `GET /platform/integrations-policies`
- `GET /platform/controls`
- `GET /platform/audit?limit=25`
- `PATCH /platform/controls`

Purpose:

- expose API, database, queue, and worker posture for the admin shell
- show the real role model, route boundary, source coverage, and crawler defaults that FE should design around
- expose a dedicated read model for runtime controls without requiring FE to parse health or policy payloads
- expose a unified audit feed spanning users, memberships, intake, crawl, publish, and platform-control activity
- allow safe runtime controls for crawl queue writes, crawl materialization, and intake publish

Health and policy additions:

- `controls` returns the live singleton runtime-control record
- `recovery.releaseReadiness` reports:
  - local proof coverage
  - managed-environment proof status
  - remaining managed-environment gap

## Optional Endpoint Backlog

These endpoints are not part of the live backend contract today.
They are tracked here so FE and future BE work do not have to rediscover them.

| Endpoint | Priority | Rationale |
|---|---|---|
| `DELETE /api/restaurants/:id` | Low | Let a `USER` remove one of their restaurants if the product later needs soft-delete or self-service cleanup. |
| `GET /api/restaurants/:id/reviews/:reviewId` | Low | Expose a canonical single-review detail endpoint if FE later needs deep links or focused evidence views. |
| `DELETE /api/admin/restaurants/:id` | Low | Let `ADMIN` archive or delete a restaurant explicitly instead of only reading and operating on it. |
| `GET /api/admin/restaurants/:id/reviews` | Low | Let `ADMIN` inspect canonical published reviews directly from the admin surface instead of inferring them from restaurant detail plus user-facing reads. |
| `POST /api/admin/review-batches/:id/archive` | Low | Expose an explicit archive action for review batches because the schema already supports archived batch state. |

Backlog rules:

- do not treat these endpoints as implemented
- add them only when a concrete FE or operator workflow needs them
- prefer soft-delete or archive semantics over destructive hard-delete for restaurant or batch lifecycles

## Final Contract Summary

The backend now exposes two clean route families:

- `/api/restaurants/*`
  - for `USER`
  - restaurant membership required
  - reads and light profile updates only
- `/api/admin/*`
  - for `ADMIN`
  - no restaurant membership required
  - admin discovery, intake, crawl, and publish control plane
