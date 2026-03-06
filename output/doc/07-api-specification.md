# 7. API Specification - Sprint 1

Date: 2026-03-03  
Updated: 2026-03-07 (Sprint 1 scope sync)
Base URL: `http://localhost:3000/api`  
Backend: Node.js + Express  
Content-Type: `application/json`

## 7.1 Common Conventions

### Auth header

```http
Authorization: Bearer <access_token>
```

### Error response

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "requestId": "req_abc123"
  }
}
```

### Pagination

```http
?page=1&limit=20
```

## 7.2 Health Endpoint

### GET `/health`

**Response (200):**

```json
{ "status": "ok" }
```

## 7.3 Auth Endpoints

### POST `/auth/register`

**Request:**

```json
{
  "email": "owner@sentify.dev",
  "password": "SecurePass123!",
  "fullName": "Nguyen Van A"
}
```

**Response (201):**

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "owner@sentify.dev",
      "fullName": "Nguyen Van A"
    },
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```

### POST `/auth/login`

**Request:**

```json
{
  "email": "owner@sentify.dev",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "owner@sentify.dev",
      "fullName": "Nguyen Van A",
      "restaurants": [
        {
          "id": "uuid",
          "name": "Quan Pho Binh",
          "slug": "quan-pho-binh",
          "permission": "OWNER"
        }
      ]
    }
  }
}
```

### POST `/auth/logout`

Sprint 1 logout is simple: the client clears its access token.
The server can still expose an acknowledgement endpoint.

**Auth:** JWT required

**Response (200):**

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

## 7.4 Restaurant Endpoints

### POST `/restaurants`

**Auth:** JWT required

**Request:**

```json
{
  "name": "Quan Pho Binh",
  "address": "123 Nguyen Hue, Q1",
  "googleMapUrl": "https://maps.google.com/..."
}
```

**Response (201):**

```json
{
  "data": {
    "id": "uuid",
    "name": "Quan Pho Binh",
    "slug": "quan-pho-binh",
    "address": "123 Nguyen Hue, Q1",
    "googleMapUrl": "https://maps.google.com/...",
    "permission": "OWNER",
    "createdAt": "2026-03-07T08:00:00.000Z"
  }
}
```

### GET `/restaurants`

**Auth:** JWT required

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Quan Pho Binh",
      "slug": "quan-pho-binh",
      "googleMapUrl": "https://maps.google.com/...",
      "permission": "OWNER",
      "totalReviews": 156
    }
  ]
}
```

### GET `/restaurants/:id`

**Auth:** JWT required

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "name": "Quan Pho Binh",
    "slug": "quan-pho-binh",
    "address": "123 Nguyen Hue, Q1",
    "googleMapUrl": "https://maps.google.com/...",
    "insightSummary": {
      "totalReviews": 156,
      "averageRating": 4.2,
      "positivePercentage": 62,
      "neutralPercentage": 20,
      "negativePercentage": 18
    }
  }
}
```

### PATCH `/restaurants/:id`

**Auth:** JWT required  
**Permission:** `OWNER`

**Request:**

```json
{
  "name": "Quan Pho Binh - CN2",
  "googleMapUrl": "https://maps.google.com/new-url..."
}
```

## 7.5 Review Import Endpoint

### POST `/restaurants/:id/import`

**Auth:** JWT required  
**Permission:** `OWNER` or `MANAGER`

**Request:**
No body required. The backend uses the saved `googleMapUrl`.

**Response (200):**

```json
{
  "data": {
    "imported": 42,
    "skipped": 8,
    "total": 50,
    "message": "Successfully imported 42 new reviews, 8 duplicates skipped."
  }
}
```

## 7.6 Review List Endpoint

### GET `/restaurants/:id/reviews`

**Auth:** JWT required

Query params:

```http
?rating=1&from=2026-03-01&to=2026-03-31&page=1&limit=20
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "externalId": "google_abc",
      "authorName": "Tran B",
      "rating": 2,
      "content": "Phuc vu cham",
      "sentiment": "NEGATIVE",
      "reviewDate": "2026-03-05T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

## 7.7 Dashboard Endpoints

### GET `/restaurants/:id/dashboard/kpi`

**Response (200):**

```json
{
  "data": {
    "totalReviews": 156,
    "averageRating": 4.2,
    "positivePercentage": 62,
    "neutralPercentage": 20,
    "negativePercentage": 18
  }
}
```

### GET `/restaurants/:id/dashboard/sentiment`

**Response (200):**

```json
{
  "data": [
    { "label": "POSITIVE", "count": 97, "percentage": 62 },
    { "label": "NEUTRAL", "count": 31, "percentage": 20 },
    { "label": "NEGATIVE", "count": 28, "percentage": 18 }
  ]
}
```

### GET `/restaurants/:id/dashboard/trend?period=week`

**Response (200):**

```json
{
  "data": [
    { "label": "2026-W09", "averageRating": 4.1, "reviewCount": 12 },
    { "label": "2026-W10", "averageRating": 4.4, "reviewCount": 18 }
  ]
}
```

### GET `/restaurants/:id/dashboard/complaints`

**Response (200):**

```json
{
  "data": [
    { "keyword": "cham", "count": 14, "percentage": 50 },
    { "keyword": "thai do", "count": 9, "percentage": 32.1 }
  ]
}
```

## 7.8 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_FAILED` | 400 | Invalid request payload |
| `MISSING_GOOGLE_MAP_URL` | 400 | Restaurant has no Google Maps URL |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong login data |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT expired |
| `FORBIDDEN` | 403 | User lacks restaurant access |
| `NOT_FOUND` | 404 | Restaurant or review not found |
| `AUTH_RATE_LIMITED` | 429 | Too many failed logins |
| `SCRAPE_FAILED` | 502 | Scraper failed |
