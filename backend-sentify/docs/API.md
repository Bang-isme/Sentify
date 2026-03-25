# Sentify API Reference

Updated: 2026-03-25
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
{ "status": "ok", "db": "up" }
```

or

```json
{ "status": "unavailable", "db": "down" }
```

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

### `GET /api/restaurants/:id`

Returns:

- restaurant summary
- `datasetStatus`
- `insightSummary`

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

These routes only read canonical published data.
They do not expose draft intake state or internal operator notes.

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
      "totalReviews": 25
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
- `GET /users/:id`
- `PATCH /users/:id/role`
- `POST /users/:id/password-reset`
- `GET /memberships`
- `POST /memberships`
- `DELETE /memberships/:id`

Purpose:

- inspect the two-role account directory
- read one user's memberships, security posture, recent intake work, and recent crawl work
- change a user between `USER` and `ADMIN`
- trigger password-reset delivery
- inspect and manage restaurant membership links

## Admin Platform Routes

Mounted under `/api/admin`.

- `GET /platform/health-jobs`
- `GET /platform/integrations-policies`
- `GET /platform/audit?limit=25`

Purpose:

- expose API, database, queue, and worker posture for the admin shell
- show the real role model, route boundary, source coverage, and crawler defaults that FE should design around
- expose a unified audit feed spanning users, memberships, intake, crawl, and publish activity

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
