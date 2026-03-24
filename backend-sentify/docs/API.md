# Sentify API Reference

Updated: 2026-03-24
Base URL: `http://localhost:3000/api`

This file documents the API surface that exists in the current backend codebase.

## Conventions

### Auth

Protected endpoints currently accept either:

- `Authorization: Bearer <access_token>`
- auth cookie `sentify_access_token`

Cookie-based sessions also use:

- refresh cookie `sentify_refresh_token`
- CSRF cookie `XSRF-TOKEN`

Important note:

- auth endpoints set auth and refresh cookies
- cookie-authenticated `POST`, `PATCH`, and `DELETE` requests must send header `X-CSRF-Token` matching the `XSRF-TOKEN` cookie
- `GET /api/auth/csrf` can be used to bootstrap or rotate the CSRF cookie before a cookie-authenticated write, including refresh flows that only have the refresh cookie
- JSON responses do not return raw tokens

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
    "timestamp": "2026-03-19T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

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

Creates a user, sets auth, refresh, and CSRF cookies, and returns:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A"
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
      "restaurants": [
        {
          "id": "uuid",
          "name": "Cafe One",
          "slug": "cafe-one",
          "permission": "OWNER"
        }
      ]
    },
    "expiresIn": 900
  }
}
```

### `GET /api/auth/session`

Returns the current authenticated user and restaurants.
Also re-issues the CSRF cookie for browser clients using cookie auth.

### `GET /api/auth/csrf`

Issues or rotates the `XSRF-TOKEN` cookie and returns `204 No Content`.
This endpoint is safe to call before `POST /api/auth/refresh` when the browser only has the refresh cookie available.

### `POST /api/auth/logout`

Clears auth, refresh, and CSRF cookies and revokes current token version.

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

### `PATCH /api/auth/password`

Changes password, revokes previous sessions, issues fresh auth, refresh, and CSRF cookies, and returns:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A"
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

```json
{
  "data": {
    "message": "If the email is registered, a reset link has been sent."
  }
}
```

### `POST /api/auth/reset-password`

Consumes a reset token and returns:

```json
{
  "data": {
    "message": "Password has been reset successfully"
  }
}
```

## Restaurants

All `/api/restaurants/*` endpoints require auth.

### `POST /api/restaurants`

Create restaurant.

### `GET /api/restaurants`

List restaurants the current user belongs to.

### `GET /api/restaurants/:id`

Returns restaurant detail, `permission`, `datasetStatus`, and `insightSummary`.

### `PATCH /api/restaurants/:id`

Owner-only update for restaurant profile fields.

## Reviews

### `GET /api/restaurants/:id/reviews`

Query params:

- `rating`
- `from`
- `to`
- `page`
- `limit`

Returns canonical review evidence with pagination.

## Dashboard

### `GET /api/restaurants/:id/dashboard/kpi`

Cached KPI summary.

### `GET /api/restaurants/:id/dashboard/sentiment`

Sentiment count and percentage breakdown.

### `GET /api/restaurants/:id/dashboard/trend`

Query param:

- `period=week|month`

### `GET /api/restaurants/:id/dashboard/complaints`

Complaint keywords sorted by frequency.

### `GET /api/restaurants/:id/dashboard/top-issue`

Returns top complaint keyword plus suggested next action.

## Review Crawl

All `/api/admin/review-crawl/*` endpoints require auth plus restaurant-scoped `OWNER` or `MANAGER` access.

### `POST /api/admin/review-crawl/google-maps`

Accepts a Google Maps place URL and returns:

- normalized place metadata
- reported total review count
- normalized review rows
- `intake.items` already shaped for the manual admin-intake flow

Request body:

```json
{
  "restaurantId": "uuid",
  "url": "https://www.google.com/maps/place/...",
  "language": "en",
  "region": "us",
  "sort": "newest",
  "pages": 1,
  "pageSize": 20,
  "maxReviews": 100,
  "delayMs": 500
}
```

Response shape:

```json
{
  "data": {
    "source": {},
    "place": {},
    "reviews": [],
    "intake": {
      "items": [],
      "validItemCount": 0,
      "droppedReviewCount": 0,
      "warnings": []
    },
    "crawl": {
      "status": "ok",
      "completeness": "complete"
    }
  }
}
```

### `POST /api/admin/review-crawl/sources`

Creates or upserts a canonical Google Maps crawl source for one restaurant.

Request body:

```json
{
  "restaurantId": "uuid",
  "url": "https://maps.app.goo.gl/...",
  "language": "en",
  "region": "us",
  "syncEnabled": true,
  "syncIntervalMinutes": 1440
}
```

Response returns:

- `source.id`
- canonical crawl identity (`canonicalCid`, `placeHexId`, `googlePlaceId`)
- source scheduling defaults
- resolved place metadata

### `POST /api/admin/review-crawl/sources/:sourceId/runs`

Enqueues an asynchronous crawl run.

Request body:

```json
{
  "strategy": "INCREMENTAL",
  "priority": "NORMAL",
  "maxPages": 10,
  "pageSize": 20,
  "delayMs": 250
}
```

Returns `202` with a queued run payload.

### `GET /api/admin/review-crawl/runs/:runId`

Returns run progress:

- `status`
- `pagesFetched`
- `extractedCount`
- `validCount`
- `duplicateCount`
- `checkpointCursor`
- `warnings`
- optional linked `intakeBatch`

Status contract:

- `QUEUED`
- `RUNNING`
- `PARTIAL`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### `POST /api/admin/review-crawl/runs/:runId/cancel`

Cancels a queued run immediately or marks a running run for cancellation at the next checkpoint.

### `POST /api/admin/review-crawl/runs/:runId/resume`

Re-queues a `FAILED` or `PARTIAL` run from its persisted checkpoint cursor.

### `POST /api/admin/review-crawl/runs/:runId/materialize-intake`

Creates a draft `ReviewIntakeBatch` with source-tracked intake items from the raw reviews seen in that run.

Important behavior:

- raw reviews are persisted before materialization
- crawler runs do not write directly to canonical `Review`
- intake items now preserve `sourceProvider`, `sourceExternalId`, and `sourceReviewUrl`
- publish still goes through admin-intake review and canonical dedupe

## Admin Intake

All `/api/admin/*` endpoints require:

- authenticated user
- restaurant membership
- `OWNER` or `MANAGER` permission for the related restaurant

There is no global operator-only admin role in the current implementation.

### `POST /api/admin/review-batches`

Create intake batch.

### `GET /api/admin/review-batches`

Requires `restaurantId` query param.

### `GET /api/admin/review-batches/:id`

Batch detail with items.

### `DELETE /api/admin/review-batches/:id`

Delete draft or in-review batch.

### `POST /api/admin/review-batches/:id/items`

Add curated intake items.

### `POST /api/admin/review-batches/:id/items/bulk`

Add items in bulk with duplicate skipping against existing batch items.

### `PATCH /api/admin/review-items/:id`

Update normalized fields, approval status, or reviewer note.
Important validation rules:

- `rawReviewDate` and `normalizedReviewDate` cannot be in the future
- an item cannot move to `APPROVED` unless it has publishable evidence after normalization: at least one of author name, content, or review date must remain
- `normalizedRating`, when provided, must stay in the range `1..5`

### `DELETE /api/admin/review-items/:id`

Delete intake item and recalculate batch state.

### `POST /api/admin/review-batches/:id/publish`

Publishes approved items into canonical `Review` and triggers insight recalculation.

Publish semantics:

- approved intake rows are normalized into a canonical payload before the transaction begins
- manual intake rows receive a stable `manual-intake:v1:*` external id derived from the source review identity
- publish reuses and updates an existing canonical `Review` when the same restaurant and derived external id already exist
- multiple `ReviewIntakeItem` rows may link back to the same canonical `Review` across different batches
