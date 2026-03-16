# 🏗️ Sentify Backend Architecture

> Project structure, request lifecycle, module boundaries, and design patterns.
> Last updated: 2026-03-17
>
> **Xem thêm**: [MVP-FLOW.md](./MVP-FLOW.md) — luồng sử dụng từ góc nhìn người dùng.

---

## Mô hình vận hành

Sentify là **managed platform**, không phải self-service tool.

- **User (OWNER/MANAGER)**: Chủ nhà hàng — chỉ xem dashboard, insights, quản lý team. **Không import data.**
- **Operator (SYSTEM_ADMIN)**: Đội vận hành Sentify — thu thập, xác minh, import, publish reviews cho nhà hàng.

> Endpoints `/api/admin/*` dành cho Operator. Endpoints `/api/restaurants/*` dành cho User.

---

## Directory Structure

```
backend-sentify/
├── prisma/
│   ├── schema.prisma          # Database schema (7 models, 5 enums)
│   ├── migrations/            # Prisma migration history
│   └── prisma.config.ts       # Prisma datasource config
├── src/
│   ├── server.js              # Entry point — start, shutdown, process handlers
│   ├── app.js                 # Express app — middleware + route mounting
│   ├── config/
│   │   └── env.js             # Zod-validated env vars
│   ├── controllers/           # Request handling + Zod validation
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── restaurants.controller.js
│   │   └── reviews.controller.js
│   ├── routes/                # Express Router definitions
│   │   ├── auth.js
│   │   └── restaurants.js     # Restaurants + Dashboard + Reviews routes
│   ├── services/              # Business logic layer
│   │   ├── auth.service.js
│   │   ├── dashboard.service.js
│   │   ├── insight.service.js
│   │   ├── restaurant.service.js
│   │   ├── restaurant-access.service.js
│   │   ├── review.service.js
│   │   └── sentiment-analyzer.service.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verify + DB lookup + cookie fallback
│   │   ├── error-handler.js   # Express error handler (last middleware)
│   │   ├── rate-limit.js      # API + auth rate limiters
│   │   ├── request-id.js      # UUID per request (X-Request-Id header)
│   │   ├── request-logger.js  # Structured JSON / pretty dev logs
│   │   └── require-permission.js  # Restaurant permission check
│   ├── lib/                   # Shared utilities
│   │   ├── app-error.js       # AppError class + factory functions
│   │   ├── auth-cookie.js     # Cookie read/write/clear helpers
│   │   ├── controller-error.js # Unified error → response mapping
│   │   ├── math.js            # roundNumber, toPercentage
│   │   ├── prisma.js          # Prisma client singleton
│   │   └── security-event.js  # Structured security event logging
│   ├── modules/               # Feature modules (self-contained)
│   │   └── admin-intake/
│   │       ├── admin-intake.routes.js
│   │       ├── admin-intake.controller.js
│   │       ├── admin-intake.service.js
│   │       ├── admin-intake.validation.js
│   │       └── admin-intake.repository.js
│   └── generated/             # Prisma client output (gitignored)
├── test/                      # Node.js built-in test runner
│   ├── test-helpers.js        # Mock setup, HTTP client, app bootstrap
│   └── *.test.js              # 9 test files
├── docs/                      # Documentation (you are here)
├── .env.example
├── .gitignore
└── package.json
```

---

## Request Lifecycle

```
Client Request
    │
    ▼
┌─────────────────────┐
│   request-id.js     │  Assign UUID → req.requestId, X-Request-Id header
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  request-logger.js  │  Start timer, log on response finish/close
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│      cors()         │  CORS_ORIGINS validation
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│     helmet()        │  Security headers
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  express.json()     │  Parse JSON body (limit: BODY_LIMIT)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│    apiLimiter       │  Rate limit: /api/* (500 req / 15 min)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│     Router          │  Route matching
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │  Protected? │
    └──────┬──────┘
           │ Yes
┌──────────▼──────────┐
│    auth.js          │  Extract token → verify JWT → DB lookup → req.user
└──────────┬──────────┘
           │
    ┌──────┴──────────────┐
    │  Need permission?   │
    └──────┬──────────────┘
           │ Yes (admin routes)
┌──────────▼──────────────┐
│  require-permission.js  │  Lookup RestaurantUser → check permission
└──────────┬──────────────┘
           │
┌──────────▼──────────┐
│    Controller       │  Zod validate → call Service → format response
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│    Service          │  Business logic → call Prisma/Repository
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  error-handler.js   │  Catch unhandled → map to JSON error response
└──────────┬──────────┘
           │
           ▼
     JSON Response
```

---

## Module Pattern

### Flat services (hiện tại: auth, restaurant, dashboard, review, insight)

```
routes/restaurants.js  →  controllers/restaurants.controller.js  →  services/restaurant.service.js  →  prisma
```
- Controller: validate input (Zod) + format response
- Service: business logic + access control
- Access control qua `restaurant-access.service.js` (shared)

### Feature module (hiện tại: admin-intake — **Operator-facing**)

```
modules/admin-intake/
├── admin-intake.routes.js       # Express Router
├── admin-intake.controller.js   # Validate + delegate
├── admin-intake.service.js      # Business logic
├── admin-intake.validation.js   # Zod schemas (separated)
└── admin-intake.repository.js   # Data access layer
```
- Repository pattern: tách Prisma queries khỏi business logic
- Self-contained: tất cả trong 1 folder
- **Đây là module dùng bởi Operator** (đội vận hành), không phải User (chủ nhà hàng)
- **Recommended pattern cho Sprint 3+**: Mọi feature mới nên follow pattern này

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                     LOGIN FLOW                           │
│                                                          │
│  1. Client POST /api/auth/login { email, password }     │
│  2. Validate Zod schema                                  │
│  3. Lookup user (include restaurants)                    │
│  4. Check account lock (lockedUntil)                    │
│  5. bcrypt.compare(password, passwordHash)              │
│  6. On success:                                          │
│     - Reset failedLoginCount                             │
│     - Build JWT (userId, tokenVersion, 15min)           │
│     - Create refresh token (7 days, token rotation)     │
│     - Set HttpOnly access cookie + refresh cookie       │
│     - Set CSRF cookie (non-HttpOnly, for frontend)      │
│     - Return { user, restaurants, expiresIn }           │
│  7. On failure:                                          │
│     - Increment failedLoginCount                         │
│     - Lock account if threshold reached                 │
│     - Log security event                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  AUTH MIDDLEWARE                          │
│                                                          │
│  1. Extract token (Bearer header → Cookie fallback)     │
│  2. jwt.verify(token, JWT_SECRET)                        │
│     → on fail: try JWT_SECRET_PREVIOUS (rotation)       │
│  3. DB lookup: user.findUnique({ id, tokenVersion })    │
│     (with 2s timeout safeguard)                          │
│  4. Compare payload.tokenVersion === user.tokenVersion  │
│  5. Set req.user = { userId, tokenVersion, jti }        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  REFRESH TOKEN FLOW                       │
│                                                          │
│  1. POST /api/auth/refresh (cookie or body)             │
│  2. Hash token → lookup in DB                            │
│  3. If already revoked → REUSE DETECTED                 │
│     → Revoke entire token family (stolen token defense) │
│  4. If valid → revoke old token + create new pair       │
│  5. Set new access + refresh cookies                     │
└─────────────────────────────────────────────────────────┘
```

**Token Revocation**: `logout()` và `changePassword()` increment `tokenVersion` + revoke tất cả refresh tokens.

---

## Error Handling Pipeline

```
Error Source          Handler                    Response
─────────────        ───────────                ────────
Zod validation    →  controller-error.js     →  400 VALIDATION_FAILED + details
AppError          →  controller-error.js     →  4xx/5xx with code + message
Prisma P2002      →  controller-error.js     →  409 UNIQUE_CONSTRAINT_FAILED
Prisma validation →  controller-error.js     →  400 INVALID_REQUEST
JSON parse        →  error-handler.js        →  400 INVALID_JSON
Payload too large →  error-handler.js        →  413 PAYLOAD_TOO_LARGE
Unhandled         →  error-handler.js        →  500 INTERNAL_SERVER_ERROR (logged)
```

---

## Data Flow: Review Intake → Insights

```
1. CREATE BATCH
   POST /api/admin/review-batches → ReviewIntakeBatch (status: DRAFT)

2. ADD ITEMS
   POST .../items → ReviewIntakeItem (approvalStatus: PENDING)
   Status auto-transitions: DRAFT → IN_REVIEW → READY_TO_PUBLISH

3. REVIEW ITEMS
   PATCH /api/admin/review-items/:id → approvalStatus: APPROVED/REJECTED
   Normalized fields override raw fields

4. PUBLISH
   POST .../publish →
   ├── Filter approved items
   ├── Build canonical Review per item (run sentiment analysis)
   ├── Upsert Reviews (skip duplicates by externalId)
   ├── Link intake items (canonicalReviewId)
   ├── Set batch status = PUBLISHED
   └── recalculateRestaurantInsights()
       ├── Aggregate: totalReviews, averageRating
       ├── Group: sentiment percentages
       ├── Extract: top 10 complaint keywords
       └── Upsert InsightSummary + ComplaintKeyword (in transaction)

5. DASHBOARD READS
   GET .../dashboard/* → reads InsightSummary cache (cheap)
   GET .../reviews → reads canonical Review table (paginated)
```

---

## Logging Strategy

| Event type | Logger | Format |
|---|---|---|
| HTTP requests | `request-logger.js` | JSON (prod) / Pretty colored (dev) |
| Security events | `security-event.js` | JSON `{ type: "security_event", event: "auth.login.success", ... }` |
| Runtime events | `server.js` | JSON `{ type: "runtime_event", event: "server.started", ... }` |
| Errors | `error-handler.js` | JSON `{ type: "error_log", event: "middleware.unhandled_error", ... }` |

All logs include `requestId` for tracing. Dev mode supports `LOG_FORMAT=pretty` with ANSI colors.
