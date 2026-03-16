# 🔬 Sentify Backend — Gap Analysis & Improvement Plan

> Phân tích sâu các thiếu sót nhỏ mà không nhìn thấy ngay từ bề mặt.
> Mỗi issue có mức ảnh hưởng, file liên quan, và giải pháp đề xuất.
>
> **Last updated**: 2026-03-16

---

## Mục lục

1. [Security Gaps](#1-security-gaps-)
2. [Data Integrity Issues](#2-data-integrity-issues-)
3. [API Design Inconsistencies](#3-api-design-inconsistencies-)
4. [Testing Blind Spots](#4-testing-blind-spots-)
5. [Operational Gaps](#5-operational-gaps-)
6. [Scalability Concerns](#6-scalability-concerns-)
7. [Code Quality Micro-Issues](#7-code-quality-micro-issues-)

---

## 1. Security Gaps 🔒

### SEC-01. CSRF vulnerability khi dùng Cookie auth

**Ảnh hưởng**: 🔴 Critical
**File**: `src/lib/auth-cookie.js`, `src/middleware/auth.js`

**Hiện tại**: Access token được set vào HttpOnly cookie. Browser tự gửi cookie cho mọi request — kể cả request từ site khác (CSRF attack).

**Giải pháp**:
```
Phương án A (Recommend): Double Submit Cookie
- Khi login, set thêm 1 non-HttpOnly CSRF token cookie
- Client đọc CSRF cookie → gửi trong header X-CSRF-Token
- Server so sánh header vs cookie
- Attacker không đọc được cookie từ site khác

Phương án B: SameSite=Strict
- Đổi AUTH_COOKIE_SAME_SITE từ 'lax' sang 'strict'
- Ưu: đơn giản hơn
- Nhược: Cookie không gửi khi navigate từ link ngoài (UX friction)

Phương án C: Drop cookie auth, chỉ dùng Bearer token
- Frontend lưu token trong memory, không localStorage
- Ưu: không cần lo CSRF
- Nhược: token mất khi refresh page (cần refresh token flow từ Sprint 2)
```

**Sprint**: S2 (kết hợp với refresh token implementation)

---

### SEC-02. Không có rate limit cho password change

**Ảnh hưởng**: 🟡 Medium
**File**: `src/routes/auth.js`

**Hiện tại**: `PATCH /api/auth/password` chỉ có `apiLimiter` chung (500 req/15min). Attacker có thể brute-force current password.

**Giải pháp**: Thêm dedicated limiter tương tự `loginLimiter` (5 req/min).

```js
// src/routes/auth.js
const { passwordChangeLimiter } = require('../middleware/rate-limit')
router.patch('/password', authMiddleware, passwordChangeLimiter, authController.changePassword)
```

**Sprint**: S1 (quick fix)

---

### SEC-03. JWT secret rotation strategy

**Ảnh hưởng**: 🟡 Medium

**Hiện tại**: Dùng 1 `JWT_SECRET` duy nhất. Nếu bị leak → phải đổi secret → tất cả user bị logout.

**Giải pháp**:
```
- Hỗ trợ 2 secrets: JWT_SECRET (primary) + JWT_SECRET_PREVIOUS (verify only)
- Khi rotate:
  1. Copy JWT_SECRET → JWT_SECRET_PREVIOUS
  2. Generate JWT_SECRET mới
  3. Deploy — new tokens signed with new secret, old tokens still verifiable
  4. Sau 15 phút (access token TTL), remove JWT_SECRET_PREVIOUS
```

**Sprint**: S5 (production readiness)

---

### SEC-04. Thiếu sanitization cho review content

**Ảnh hưởng**: 🟡 Medium
**File**: `src/modules/admin-intake/admin-intake.validation.js`

**Hiện tại**: Review content chỉ validate max length, không sanitize HTML/script. Nếu frontend render raw content → XSS risk.

**Giải pháp**:
```
Phương án A (Recommend): Sanitize ở backend
- Strip HTML tags trước khi lưu
- Lib: DOMPurify (node-compatible) hoặc simple regex strip

Phương án B: Sanitize ở frontend
- Backend lưu raw, frontend escape khi render
- Rủi ro: mỗi frontend consumer phải nhớ escape
```

**Sprint**: S1 (quick fix)

---

### SEC-05. In-memory rate limiting không hoạt động với multiple instances

**Ảnh hưởng**: 🟡 Medium (khi scale)
**File**: `src/middleware/rate-limit.js`

**Hiện tại**: `express-rate-limit` dùng in-memory store. Khi chạy 2+ instances → rate limit bị split, attacker gửi gấp đôi requests.

**Giải pháp**: Dùng `rate-limit-redis` store khi deploy production.
```js
// Khi có Redis
const RedisStore = require('rate-limit-redis')
const { createClient } = require('redis')
const redisClient = createClient({ url: process.env.REDIS_URL })
// Pass store: new RedisStore({ client: redisClient }) vào createJsonLimiter
```

**Sprint**: S5 (production readiness, chỉ khi deploy multi-instance)

---

### SEC-06. Không log failed password change attempts ở controller level

**Ảnh hưởng**: 🟢 Low
**File**: `src/services/auth.service.js`

**Hiện tại**: `changePassword()` log `auth.password.change.failed` nhưng không đếm attempts. Attacker thử brute-force password change.

**Giải pháp**: Áp dụng cùng `failedLoginCount` pattern, hoặc ít nhất rate limit (xem SEC-02).

---

## 2. Data Integrity Issues 📊

### DAT-01. `listRestaurants()` không có pagination

**Ảnh hưởng**: 🟡 Medium
**File**: `src/services/restaurant.service.js` (line 177)

**Hiện tại**: `findMany` trả tất cả restaurants. Nếu user có 100+ restaurants → response chậm + lớn.

**Giải pháp**: Thêm `page`/`limit` params. Tạm thời thêm hard limit:
```js
take: 50 // safeguard until pagination is added
```

**Sprint**: S3 (user management)

---

### DAT-02. `listReviewBatches()` không có pagination

**Ảnh hưởng**: 🟡 Medium
**File**: `src/modules/admin-intake/admin-intake.repository.js` (line 26)

**Hiện tại**: `findMany` trả tất cả batches. Restaurant có nhiều batches → response lớn.

**Giải pháp**: Thêm `page`/`limit` + optional `status` filter.

**Sprint**: S4 (review nâng cao)

---

### DAT-03. Slug collision edge case

**Ảnh hưởng**: 🟢 Low
**File**: `src/services/restaurant.service.js` (line 58)

**Hiện tại**: `generateUniqueSlug` thử 100 lần rồi throw generic Error. Trong thực tế ít xảy ra, nhưng:
- Error message không rõ ràng cho client
- Loop 100 DB queries trong worst case

**Giải pháp**: 
```js
// Thêm random suffix thay vì sequential
const slug = `${baseSlug}-${randomBytes(3).toString('hex')}` // e.g. pho-ha-noi-a3b2c1
// Chỉ cần 1-2 attempts thay vì 100
```

---

### DAT-04. Không có soft delete

**Ảnh hưởng**: 🟡 Medium (cho future features)

**Hiện tại**: Tất cả delete đều hard delete + cascade. Không thể recovery.

**Giải pháp**: Thêm `deletedAt DateTime?` cho models quan trọng:
```prisma
model Restaurant {
  // ...
  deletedAt DateTime?
  
  @@index([deletedAt]) // filter active records
}

model User {
  // ...
  deletedAt DateTime?
}
```
Thêm Prisma middleware hoặc global filter:
```js
// Middleware approach
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    params.args.where = { ...params.args.where, deletedAt: null }
  }
  return next(params)
})
```

**Sprint**: S3 (trước khi implement delete restaurant/account)

---

### DAT-05. Review `keywords` array không có size constraint

**Ảnh hưởng**: 🟢 Low
**File**: `prisma/schema.prisma` (line 97)

**Hiện tại**: `keywords String[] @default([])` — không limit số lượng keywords. `extractComplaintKeywords` limit 5, nhưng nếu set trực tiếp qua code khác → unbounded.

**Giải pháp**: Validate ở service layer:
```js
keywords: analysis.keywords.slice(0, 10) // hard cap
```

---

### DAT-06. `externalId` format coupling

**Ảnh hưởng**: 🟡 Medium (cho future features)
**File**: `src/modules/admin-intake/admin-intake.service.js` (line 190)

**Hiện tại**: `externalId = "manual-intake:{itemId}"`. Nếu tương lai thêm CSV import, Google import lại, hoặc API integration → cần format mới.

**Giải pháp**: Tách thành helper:
```js
// src/lib/external-id.js
function buildExternalId(source, identifier) {
  return `${source}:${identifier}`
}
function parseExternalId(externalId) {
  const [source, ...rest] = externalId.split(':')
  return { source, identifier: rest.join(':') }
}
```

---

### DAT-07. Không validate `reviewDate` không nằm trong tương lai

**Ảnh hưởng**: 🟢 Low
**File**: `src/modules/admin-intake/admin-intake.validation.js`

**Hiện tại**: Admin có thể add review với `rawReviewDate` năm 2030.

**Giải pháp**: Thêm validation:
```js
rawReviewDate: nullableDate().refine(
  (d) => !d || d <= new Date(),
  { message: 'Review date cannot be in the future' }
)
```

---

## 3. API Design Inconsistencies 🔄

### API-01. Response envelope không nhất quán

**Ảnh hưởng**: 🟡 Medium
**File**: `src/controllers/reviews.controller.js` (line 25)

**Hiện tại**:
```
GET /api/restaurants/:id/reviews  →  { data: [...], pagination: {...} }
GET /api/restaurants/:id          →  { data: {...} }
GET /api/restaurants              →  { data: [...] }
```

`listReviews` trả `{ data, pagination }` trực tiếp thay vì wrap trong `{ data: { items, pagination } }`.

**Giải pháp**: Document convention rõ ràng:
```
Non-paginated: { data: T }
Paginated: { data: T[], pagination: { page, limit, total, totalPages } }
```
Khi thêm pagination cho endpoints khác (S3/S4), follow cùng pattern này.

---

### API-02. Thiếu `createdAt` trong review list response

**Ảnh hưởng**: 🟢 Low
**File**: `src/services/review.service.js` (line 57)

**Hiện tại**: `select` bỏ qua `createdAt`. Frontend không biết review được tạo khi nào (khác với `reviewDate`).

**Giải pháp**: Thêm `createdAt: true` vào select.

---

### API-03. Thiếu aggregate dashboard endpoint

**Ảnh hưởng**: 🟡 Medium

**Hiện tại**: Dashboard cần 5 API calls riêng biệt (KPI, sentiment, trend, complaints, top-issue). Frontend phải manage 5 loading states.

**Giải pháp**: Thêm aggregate endpoint:
```
GET /api/restaurants/:id/dashboard
→ { data: { kpi, sentiment, trend, complaints, topIssue } }
```

Giữ các endpoint riêng lẻ cho lazy loading / partial refresh.

**Sprint**: S4 (review nâng cao)

---

### API-04. Delete responses không nhất quán

**Ảnh hưởng**: 🟢 Low
**File**: `src/modules/admin-intake/admin-intake.service.js`

**Hiện tại**:
- Delete batch → `{ id, restaurantId, status, deleted: true }`
- Delete item → full batch with items

**Giải pháp**: Chuẩn hoá:
```json
// Delete response pattern
{ "data": { "id": "uuid", "deleted": true } }
```

---

### API-05. Không có `sentiment` filter trên review list

**Ảnh hưởng**: 🟡 Medium
**File**: `src/services/review.service.js`

**Hiện tại**: Filter chỉ có `rating`, `from`, `to`. Thiếu `sentiment` mặc dù sentiment data tồn tại.

**Giải pháp**: Thêm `sentiment` query param:
```js
const listReviewsQuerySchema = z.object({
  // ... existing
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
})
```

**Sprint**: S4

---

### API-06. Error responses thiếu timestamp

**Ảnh hưởng**: 🟢 Low
**File**: `src/lib/controller-error.js`

**Hiện tại**: Error response có `requestId` nhưng không có `timestamp`. Khiến debugging khó hơn.

**Giải pháp**:
```js
function sendError(req, res, status, code, message, details) {
  return res.status(status).json({
    error: {
      code, message,
      timestamp: new Date().toISOString(),
      ...(req?.requestId ? { requestId: req.requestId } : {}),
      ...(details ? { details } : {}),
    }
  })
}
```

---

## 4. Testing Blind Spots 🧪

### TST-01. Integration tests mock Prisma → không test actual SQL

**Ảnh hưởng**: 🟡 Medium
**File**: `test/test-helpers.js`

**Hiện tại**: Tất cả tests mock Prisma client hoàn toàn. Không phát hiện được:
- Query syntax errors
- Missing indexes ảnh hưởng performance
- Transaction isolation issues
- Prisma version upgrade regressions

**Giải pháp**: Thêm layer integration tests dùng real database:
```
test/
├── unit/                    # Existing mocked tests
├── integration/             # New: real DB tests
│   ├── setup.js             # Manage test DB lifecycle
│   ├── auth.integration.js
│   └── intake.integration.js
└── test-helpers.js
```

Dùng `docker-compose.test.yml` với PostgreSQL ephemeral container:
```yaml
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_DB: sentify_test
      POSTGRES_PASSWORD: test
    ports: ["5433:5432"]
```

**Sprint**: S5 (production readiness)

---

### TST-02. Không test race conditions

**Ảnh hưởng**: 🟡 Medium

**Hiện tại**: Không test concurrent operations:
- 2 users publish cùng 1 batch cùng lúc
- 2 requests register cùng email cùng lúc
- Concurrent slug generation cho cùng restaurant name

**Giải pháp**: Dùng `Promise.all` trong test để simulate concurrent requests:
```js
const [result1, result2] = await Promise.all([
  request(server, 'POST', '/api/admin/review-batches/batch-1/publish', { token }),
  request(server, 'POST', '/api/admin/review-batches/batch-1/publish', { token }),
])
// Exactly one should succeed, one should fail with INTAKE_BATCH_LOCKED
```

---

### TST-03. Không test cookie auth flow

**Ảnh hưởng**: 🟡 Medium
**File**: `test/auth.integration.test.js`

**Hiện tại**: Tests chỉ dùng Bearer token. Cookie auth path (`readAuthCookie`) chưa được test.

**Giải pháp**: Thêm test cases gửi cookie thay vì header.

---

### TST-04. Không test error-handler edge cases

**Ảnh hưởng**: 🟢 Low

**Chưa test**:
- `entity.too.large` (413)
- `headersSent` guard
- `PrismaClientValidationError`
- Unhandled error logging

---

## 5. Operational Gaps 🔧

### OPS-01. Không có database backup strategy

**Ảnh hưởng**: 🔴 Critical (for production)

**Giải pháp**: Document backup approach:
```
# Automated daily backup (pg_dump)
0 3 * * * pg_dump -U postgres sentify | gzip > /backups/sentify-$(date +%Y%m%d).sql.gz

# Retention: keep 30 days
find /backups -name "sentify-*.sql.gz" -mtime +30 -delete
```

Hoặc dùng managed PostgreSQL service (Supabase, Neon, Railway) có automatic backups.

---

### OPS-02. Không có monitoring/alerting

**Ảnh hưởng**: 🟡 Medium

**Giải pháp**:
```
Phương án A: Structured logging → external collector
- JSON logs hiện tại đã đủ format
- Gửi tới Loki/Elasticsearch → Grafana dashboards
- Alert on: error rate > threshold, response time P99 > 1s

Phương án B: Application-level metrics
- Express middleware đếm requests/errors
- Expose /metrics endpoint (Prometheus format)
- Libraries: prom-client
```

---

### OPS-03. Health check thiếu chiều sâu

**Ảnh hưởng**: 🟡 Medium
**File**: `src/app.js` (line 48)

**Hiện tại**: `SELECT 1` chỉ check DB connection. Không biết:
- Connection pool có bị exhausted không
- Response time bao nhiêu
- Memory usage

**Giải pháp**:
```js
app.get('/api/health', async (req, res) => {
  const start = process.hrtime.bigint()
  try {
    await prisma.$queryRaw`SELECT 1`
    const dbLatencyMs = Number(process.hrtime.bigint() - start) / 1e6
    return res.status(200).json({
      status: 'ok',
      db: 'up',
      dbLatencyMs: Math.round(dbLatencyMs * 10) / 10,
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    })
  } catch (error) {
    return res.status(503).json({ status: 'unavailable', db: 'down' })
  }
})
```

**Sprint**: S5

---

### OPS-04. Không có migration rollback plan

**Ảnh hưởng**: 🟡 Medium

**Hiện tại**: Nếu migration lỗi, phải manual rollback.

**Giải pháp**: Mỗi migration tạo kèm rollback script:
```
prisma/migrations/
├── 20260316_add_refresh_tokens/
│   ├── migration.sql           # Auto-generated
│   └── rollback.sql            # Manual: DROP TABLE "RefreshToken";
```

---

## 6. Scalability Concerns ⚡

### SCL-01. Sentiment analysis blocking publish request

**Ảnh hưởng**: 🟡 Medium
**File**: `src/modules/admin-intake/admin-intake.service.js` (line 183)

**Hiện tại**: `publishReviewBatch()` chạy `analyzeReviewSync()` cho mỗi item + `recalculateRestaurantInsights()` — tất cả synchronous trong 1 request. Batch 200 items → publish request có thể chạy 5-10 giây.

**Giải pháp**:
```
Phase 1 (S1): Accept — tốc độ hiện tại OK cho batch < 200 items
Phase 2 (S5): Background job
  - Publish request → mark batch as PUBLISHING → return immediately
  - Worker job → analyze + create reviews + recalculate insights
  - Thêm status PUBLISHING vào enum
  - Frontend poll hoặc WebSocket cho progress
```

---

### SCL-02. Dashboard sentiment/trend không có cache

**Ảnh hưởng**: 🟡 Medium
**File**: `src/services/dashboard.service.js`

**Hiện tại**: `InsightSummary` là cache cho KPI endpoint. Nhưng sentiment breakdown, trend, và complaint keywords đều query trực tiếp mỗi lần.

**Giải pháp**:
```
Phase 1 (S1): Chuyển sang DB aggregation (đã plan trong Sprint 1)
Phase 2 (S5): Cache layer
  - Mỗi lần recalculateRestaurantInsights(), cache sentiment + trend data
  - Invalidate cache khi publish batch
  - Store: Redis hoặc in-memory Map with TTL
```

---

### SCL-03. Single process — không clustering

**Ảnh hưởng**: 🟢 Low (cho MVP)

**Hiện tại**: `node src/server.js` chạy 1 process.

**Giải pháp** (khi cần):
```
Phương án A: PM2 cluster mode
  pm2 start src/server.js -i max

Phương án B: Docker + orchestrator
  Docker container + Kubernetes/ECS horizontal scaling

Lưu ý: Cần Redis rate limit store (SEC-05) và session management trước khi cluster
```

---

### SCL-04. `fetchIntakeSummary` gọi 2 queries cho mỗi restaurant detail request

**Ảnh hưởng**: 🟢 Low
**File**: `src/services/restaurant.service.js`

**Hiện tại**: `getRestaurantDetail()` gọi `getRestaurantAccess()` + `fetchIntakeSummary()` = ít nhất 3 DB queries.

**Giải pháp**: Gộp thành 1 query hoặc cache dataset status.

---

## 7. Code Quality Micro-Issues 🧹

### CQ-01. `__private` export pattern

**Ảnh hưởng**: 🟢 Low
**File**: `src/modules/admin-intake/admin-intake.service.js` (line 450)

**Hiện tại**: `module.exports.__private = { ... }` export internal functions cho testing. Anti-pattern — tests đang test implementation details.

**Giải pháp**: Test qua public API (service functions) thay vì internal helpers. Nếu helper logic phức tạp, tách thành separate module.

---

### CQ-02. Prisma export pattern bất thường

**Ảnh hưởng**: 🟢 Low
**File**: `src/lib/prisma.js` (line 45-46)

**Hiện tại**:
```js
module.exports = prisma              // default export = prisma client
module.exports.disconnect = disconnect  // named export on same object
```

`server.js` checks `typeof prisma.disconnect === 'function'` OR `typeof prisma.$disconnect`. Confusing.

**Giải pháp**:
```js
module.exports = { prisma, disconnect }
// Hoặc đơn giản:
module.exports = prisma  // và chỉ dùng prisma.$disconnect() trực tiếp
```

---

### CQ-03. Duplicate error handling logic

**Ảnh hưởng**: 🟢 Low
**File**: `src/middleware/error-handler.js`, `src/lib/controller-error.js`

**Hiện tại**: Cả hai đều handle `AppError` và `PrismaClientValidationError`. Logic bị duplicate.

**Giải pháp**: `controller-error.js` (try-catch trong controller) và `error-handler.js` (Express error middleware) phục vụ khác mục đích — giữ nguyên nhưng document rõ:
```
controller-error.js: Handles errors caught in try-catch blocks
error-handler.js: Catches unhandled errors passed via next(err)
```

---

### CQ-04. `isMissingIntakeTableError()` workaround

**Ảnh hưởng**: 🟢 Low
**File**: `src/services/restaurant.service.js` (line 77)

**Hiện tại**: Function check nếu `ReviewIntakeBatch` table chưa tồn tại (migration timing). Workaround cho transition period.

**Giải pháp**: Remove function sau khi confirm tất cả environments đã chạy migration `20260312184500_add_review_intake`.

---

### CQ-05. Hardcoded constants scattered across files

**Ảnh hưởng**: 🟢 Low

**Hiện tại**:
- `ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60` (auth.service.js)
- `AUTH_DB_TIMEOUT_MS = 2000` (middleware/auth.js)
- `PASSWORD_SALT_ROUNDS = 12` (auth.service.js)
- Max 10 complaint keywords (insight.service.js line 50)
- Max 200 items per batch (admin-intake.validation.js line 72)
- Max 5 keywords per review (sentiment-analyzer.service.js line 210, 213)

**Giải pháp**: Gom vào `src/config/constants.js`:
```js
module.exports = {
  AUTH: {
    ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
    PASSWORD_SALT_ROUNDS: 12,
    DB_TIMEOUT_MS: 2000,
  },
  INTAKE: {
    MAX_ITEMS_PER_BATCH: 200,
    MAX_COMPLAINT_KEYWORDS: 10,
    MAX_REVIEW_KEYWORDS: 5,
  },
}
```

---

## Priority Matrix

| ID | Issue | Impact | Effort | Sprint |
|---|---|---|---|---|
| SEC-01 | CSRF with cookie auth | 🔴 | Medium | S2 |
| SEC-02 | No rate limit on password change | 🟡 | Low | S1 |
| SEC-04 | Content sanitization | 🟡 | Low | S1 |
| DAT-01 | Unbounded restaurant list | 🟡 | Low | S3 |
| DAT-02 | Unbounded batch list | 🟡 | Low | S4 |
| DAT-04 | No soft delete | 🟡 | Medium | S3 |
| DAT-07 | Future date review | 🟢 | Low | S1 |
| API-01 | Response envelope inconsistency | 🟡 | Low | S4 |
| API-03 | Aggregate dashboard endpoint | 🟡 | Medium | S4 |
| API-05 | Missing sentiment filter | 🟡 | Low | S4 |
| API-06 | Error timestamp | 🟢 | Low | S1 |
| TST-01 | No real DB integration tests | 🟡 | High | S5 |
| TST-02 | No race condition tests | 🟡 | Medium | S5 |
| OPS-01 | No backup strategy | 🔴 | Low | S5 |
| OPS-03 | Shallow health check | 🟡 | Low | S5 |
| SCL-01 | Sync sentiment in publish | 🟡 | High | S5 |
| SCL-02 | No dashboard cache | 🟡 | Medium | S5 |
| CQ-01 | `__private` export | 🟢 | Low | S4 |
| CQ-04 | Missing table workaround | 🟢 | Low | S1 |
| CQ-05 | Scattered constants | 🟢 | Low | S1 |
