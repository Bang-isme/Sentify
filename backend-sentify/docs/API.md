# 📡 Sentify API Reference

> Auto-generated from codebase analysis — 2026-03-16
> Base URL: `http://localhost:3000`

---

## Conventions

### Authentication
- **Bearer token**: `Authorization: Bearer <access_token>`
- **Cookie**: `sentify_access_token=<access_token>` (HttpOnly, auto-set on login)

### Response Envelope
```json
// Success
{ "data": { ... } }

// Paginated
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human message", "requestId": "uuid" } }
```

### Error Codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Zod validation failed (includes `details` array) |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `INVALID_ID` | UUID param format invalid |
| 401 | `AUTH_MISSING_TOKEN` | No token provided |
| 401 | `AUTH_INVALID_TOKEN` | Token malformed or signature invalid |
| 401 | `AUTH_TOKEN_EXPIRED` | Token expired |
| 401 | `AUTH_REVOKED_TOKEN` | Token revoked (tokenVersion mismatch) |
| 403 | `FORBIDDEN` | Insufficient restaurant permission |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `EMAIL_ALREADY_EXISTS` | Registration duplicate email |
| 409 | `UNIQUE_CONSTRAINT_FAILED` | DB unique constraint violation |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds `BODY_LIMIT` |
| 429 | `API_RATE_LIMITED` | Global rate limit exceeded |
| 429 | `AUTH_RATE_LIMITED` | Auth rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled server error |
| 503 | `AUTH_DEPENDENCY_TIMEOUT` | DB timeout during auth check |

---

## Health

### `GET /`
Service status check.
```json
{ "service": "backend-sentify", "status": "ok" }
```

### `GET /health`
Lightweight health check.
```json
{ "status": "ok" }
```

### `GET /api/health`
Health check with database connectivity.
```json
{ "status": "ok", "db": "up" }
// or
{ "status": "unavailable", "db": "down" }  // 503
```

---

## Auth — `/api/auth`

### `POST /api/auth/register`
**Auth**: No | **Rate limit**: 10 req / 15 min

**Body**:
```json
{
  "email": "user@example.com",     // required, valid email
  "password": "12345678",          // required, min 8 chars
  "fullName": "Tran Van A"         // required, 1-100 chars
}
```

**201 Response**:
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "fullName": "Tran Van A" },
    "expiresIn": 900
  }
}
```
Sets `sentify_access_token` cookie.

**Errors**: `EMAIL_ALREADY_EXISTS` (409), `VALIDATION_FAILED` (400)

---

### `POST /api/auth/login`
**Auth**: No | **Rate limit**: 5 req / 1 min (skips successful)

**Body**:
```json
{
  "email": "user@example.com",
  "password": "12345678"
}
```

**200 Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "restaurants": [
        { "id": "uuid", "name": "Phở Hà Nội", "slug": "pho-ha-noi", "permission": "OWNER" }
      ]
    },
    "expiresIn": 900
  }
}
```

**Errors**: `AUTH_INVALID_CREDENTIALS` (401), `AUTH_RATE_LIMITED` (429, account locked)

**Security**: After `LOGIN_LOCK_THRESHOLD` (default: 5) failed attempts → account locked for `LOGIN_LOCK_MINUTES` (default: 15).

---

### `GET /api/auth/session`
**Auth**: Yes

**200 Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "Tran Van A",
      "restaurants": [...]
    }
  }
}
```

---

### `POST /api/auth/logout`
**Auth**: Yes

Increments `tokenVersion` to revoke all existing tokens.

**200 Response**:
```json
{ "data": { "message": "Logged out successfully" } }
```
Clears `sentify_access_token` cookie.

---

### `PATCH /api/auth/password`
**Auth**: Yes

**Body**:
```json
{
  "currentPassword": "old-password",       // required
  "newPassword": "new-password-min-8"      // required, min 8, must differ from current
}
```

**200 Response**: Returns new access token + user data.

**Errors**: `AUTH_INVALID_CREDENTIALS` (401), `AUTH_PASSWORD_REUSE` (400)

---

## Restaurants — `/api/restaurants`

All endpoints require auth.

### `POST /api/restaurants`
**Body**:
```json
{
  "name": "Phở Hà Nội",                           // required, 1-120 chars
  "address": "123 Nguyễn Trãi, Q5, HCM",          // optional, max 255
  "googleMapUrl": "https://maps.google.com/..."    // optional, valid URL
}
```

**201 Response**: Created restaurant with `permission: "OWNER"`.

---

### `GET /api/restaurants`
List all restaurants the user is a member of.

**200 Response**:
```json
{
  "data": [
    {
      "id": "uuid", "name": "Phở Hà Nội", "slug": "pho-ha-noi",
      "googleMapUrl": null, "permission": "OWNER", "totalReviews": 42
    }
  ]
}
```

---

### `GET /api/restaurants/:id`
Restaurant detail with insight summary and dataset status.

**200 Response**:
```json
{
  "data": {
    "id": "uuid", "name": "...", "slug": "...", "address": "...", "googleMapUrl": "...",
    "permission": "OWNER",
    "datasetStatus": {
      "sourcePolicy": "ADMIN_CURATED",
      "lastPublishedAt": "2026-03-15T...",
      "lastPublishedSourceType": "MANUAL",
      "pendingBatchCount": 1, "readyBatchCount": 0,
      "pendingItemCount": 3, "approvedItemCount": 5, "rejectedItemCount": 1
    },
    "insightSummary": {
      "totalReviews": 42, "averageRating": 4.2,
      "positivePercentage": 65.0, "neutralPercentage": 20.0, "negativePercentage": 15.0
    }
  }
}
```

---

### `PATCH /api/restaurants/:id`
**Permission**: OWNER only.

**Body**: At least one field required.
```json
{
  "name": "New Name",              // optional
  "address": "New Address",        // optional, null to clear
  "googleMapUrl": null             // optional, null to clear
}
```

---

## Reviews — `/api/restaurants/:id/reviews`

### `GET /api/restaurants/:id/reviews`
Paginated review list with filters.

**Query params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `rating` | int (1-5) | — | Filter by rating |
| `from` | YYYY-MM-DD | — | Start date |
| `to` | YYYY-MM-DD | — | End date |
| `page` | int ≥ 1 | 1 | Page number |
| `limit` | int 1-100 | 20 | Page size |

**200 Response**:
```json
{
  "data": [
    {
      "id": "uuid", "externalId": "manual-intake:uuid",
      "authorName": "Nguyễn A", "rating": 5,
      "content": "Phở rất ngon!", "sentiment": "POSITIVE",
      "reviewDate": "2026-03-10T..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

## Dashboard — `/api/restaurants/:id/dashboard`

### `GET .../dashboard/kpi`
Cached insight summary (same as restaurant detail's `insightSummary`).

### `GET .../dashboard/sentiment`
Sentiment breakdown by count + percentage.
```json
{
  "data": [
    { "label": "POSITIVE", "count": 28, "percentage": 65.0 },
    { "label": "NEUTRAL", "count": 9, "percentage": 20.0 },
    { "label": "NEGATIVE", "count": 7, "percentage": 15.0 }
  ]
}
```

### `GET .../dashboard/trend?period=week`
Rating trend over time. Query: `period` = `week` (default) | `month`.
```json
{
  "data": [
    { "label": "2026-W10", "averageRating": 4.1, "reviewCount": 8 },
    { "label": "2026-W11", "averageRating": 4.5, "reviewCount": 12 }
  ]
}
```

### `GET .../dashboard/complaints`
Complaint keywords sorted by frequency.
```json
{ "data": [{ "keyword": "chậm", "count": 5, "percentage": 71.4 }] }
```

### `GET .../dashboard/top-issue`
Top complaint keyword with actionable suggestion.
```json
{
  "data": {
    "keyword": "chậm", "count": 5, "percentage": 71.4,
    "action": "Prioritize improving chậm — review 5 related complaints.",
    "lastUpdatedAt": "2026-03-15T..."
  }
}
```

---

## Admin Intake — `/api/admin`

All endpoints require auth + OWNER/MANAGER permission.

### `POST /api/admin/review-batches`
**Body**:
```json
{
  "restaurantId": "uuid",                    // required
  "sourceType": "MANUAL",                    // MANUAL | BULK_PASTE | CSV
  "title": "Tháng 3 reviews"                // optional
}
```

### `GET /api/admin/review-batches?restaurantId=uuid`
List batches with item counts.

### `GET /api/admin/review-batches/:id`
Batch detail with all items.

### `DELETE /api/admin/review-batches/:id`
Delete batch (DRAFT/IN_REVIEW only). **Error**: `INTAKE_BATCH_NOT_DELETABLE` (409)

### `POST /api/admin/review-batches/:id/items`
Add review items to batch.
```json
{
  "items": [{
    "rawAuthorName": "Nguyễn A",
    "rawRating": 5,                          // required, 1-5
    "rawContent": "Phở ngon lắm!",
    "rawReviewDate": "2026-03-10"
  }]
}
```

### `POST /api/admin/review-batches/:id/items/bulk`
Same schema, deduplicates against existing items.

### `PATCH /api/admin/review-items/:id`
Update item fields / approval status.
```json
{
  "normalizedRating": 4,
  "approvalStatus": "APPROVED",              // PENDING | APPROVED | REJECTED
  "reviewerNote": "Rating adjusted"
}
```

### `DELETE /api/admin/review-items/:id`
Remove item from batch.

### `POST /api/admin/review-batches/:id/publish`
Publish approved items → create canonical Reviews → recalculate insights.
**Error**: `INTAKE_BATCH_NOT_READY` (400, no approved items), `INTAKE_BATCH_LOCKED` (409, already published)
