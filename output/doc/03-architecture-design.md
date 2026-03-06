# 3. Architecture Design - Sprint 1

Date: 2026-03-02  
Updated: 2026-03-07 (Sprint 1 scope sync)

## 3.1 Design Principles

- **Simple-first**: build the smallest working loop before optimizing
- **Restaurant-scoped**: every business query is filtered by `restaurantId`
- **Synchronous-first**: import + sentiment run in the request for Sprint 1
- **Replaceable AI**: sentiment analyzer sits behind a service interface
- **Separation of concerns**: Express routing, business logic, and DB access should not collapse into one file

## 3.2 Logical Architecture

```mermaid
flowchart LR
    U[Web User] --> FE[Frontend\nReact + Vite]
    FE --> API[Backend API\nNode + Express]
    API --> AUTH[Auth Module]
    API --> REST[Restaurant Module]
    API --> IMPORT[Import Module]
    API --> INSIGHT[Insight Module]
    IMPORT --> SCRAPER[Google Maps Scraper]
    IMPORT --> SENTIMENT[Sentiment Analyzer]
    AUTH --> DB[(PostgreSQL\nPrisma ORM)]
    REST --> DB
    IMPORT --> DB
    INSIGHT --> DB
```

### Not in Sprint 1

- Redis
- BullMQ worker
- report generation service
- embeddings / clustering / vector DB
- organization tenant layer

## 3.3 Service Boundaries

### Frontend

Responsibilities:
- Login and register pages
- Restaurant setup and selection
- Trigger import
- Show review list, filters, and insight cards

### Backend API

Responsibilities:
- Validate request data
- Issue and verify JWT access tokens
- Check restaurant membership
- Run scraping + dedup + sentiment workflow
- Query dashboard and insight data

### Google Maps Scraper

Responsibilities:
- Receive `googleMapUrl`
- Return normalized review JSON
- Hide scraper-specific parsing details from route handlers

Expected review shape:

```json
{
  "externalId": "google-review-id",
  "authorName": "Customer name",
  "rating": 4,
  "content": "Good food",
  "reviewDate": "2026-03-01T10:00:00.000Z"
}
```

### Sentiment Analyzer

Responsibilities:
- Classify one review into `POSITIVE`, `NEUTRAL`, or `NEGATIVE`
- Return extracted keywords for negative reviews
- Stay swappable between keyword-based logic and OpenAI fallback

## 3.4 Prisma 7 Notes

Prisma 7 in this backend uses:

- `prisma.config.ts` for `DATABASE_URL`
- `@prisma/adapter-pg` to connect Prisma Client to PostgreSQL
- `prisma-client-js` generator to keep the current CommonJS runtime simple

That means Sprint 1 no longer keeps `url = env("DATABASE_URL")` inside `schema.prisma`, but it also avoids forcing the whole backend to switch to ESM immediately.

## 3.5 Request Flow

### Import flow

```text
HTTP request
-> auth middleware
-> permission check
-> load restaurant + googleMapUrl
-> scrape reviews
-> for each review: dedup -> analyze -> insert
-> recalculate InsightSummary + ComplaintKeyword
-> return imported/skipped counts
```

### Read flow

```text
HTTP request
-> auth middleware
-> membership check
-> query Prisma
-> shape response JSON
-> return data
```

## 3.6 Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Issue access token |
| POST | `/api/auth/logout` | Client session logout acknowledgement |
| POST | `/api/restaurants` | Create restaurant |
| GET | `/api/restaurants` | List current user's restaurants |
| GET | `/api/restaurants/:id` | Restaurant detail |
| PATCH | `/api/restaurants/:id` | Update restaurant |
| POST | `/api/restaurants/:id/import` | Import Google reviews |
| GET | `/api/restaurants/:id/reviews` | Review list + filters |
| GET | `/api/restaurants/:id/dashboard/kpi` | KPI cards |
| GET | `/api/restaurants/:id/dashboard/sentiment` | Sentiment breakdown |
| GET | `/api/restaurants/:id/dashboard/trend` | Rating trend |
| GET | `/api/restaurants/:id/dashboard/complaints` | Complaint keywords |

## 3.7 Security Baseline

### Authentication

- JWT access token only in Sprint 1
- Access token should be short-lived, for example 15 minutes
- Passwords must be stored as bcrypt hashes
- Logout is client-driven in Sprint 1: client deletes token; no refresh token rotation or token blacklist yet

### Authorization

- Restaurant access is controlled by `RestaurantUser`
- `OWNER` can edit restaurant settings and import
- `MANAGER` can import and view data
- Non-members must receive `403 FORBIDDEN`

### Data Safety

- Dedup reviews with `(restaurantId, externalId)` unique constraint
- Validate input bodies before reaching business logic
- Do not store plaintext passwords
- Keep DB credentials and JWT secret in `.env`

## 3.8 Error Strategy

Standard error shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "requestId": "req_abc123"
  }
}
```

Common codes:

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_FAILED` | 400 | Invalid request data |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT expired |
| `FORBIDDEN` | 403 | User is not a member of the restaurant |
| `NOT_FOUND` | 404 | Resource not found |
| `AUTH_RATE_LIMITED` | 429 | Too many failed login attempts |
| `SCRAPE_FAILED` | 502 | Scraper returned invalid or empty result |

## 3.9 Deployment Notes

| Component | Tech | Port |
|-----------|------|------|
| Frontend | Vite | 5173 |
| API | Express | 3000 |
| Database | PostgreSQL | 5432 |

Environment variables:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/sentify?schema=public
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5173
PORT=3000
```
