# 🗺️ Sentify Backend — Sprint Roadmap

> Tài liệu này liệt kê đầy đủ các sprint và chức năng cần hoàn thiện ở backend.
> Mỗi sprint có mục tiêu rõ ràng, danh sách task, file cần tạo/sửa, và tiêu chí hoàn thành.
>
> **Last updated**: 2026-03-16 (Sprint 1 ✅, Sprint 2 ✅)

---

## Tổng quan hệ thống hiện tại

### ✅ Đã hoàn thành

| Module | Endpoints | Trạng thái |
|---|---|---|
| Auth | register, login, logout, session, change-password | ✅ Production-ready |
| Restaurant | create, list, get detail, update | ✅ Functional |
| Dashboard | KPI, sentiment, trend, complaints, top-issue | ✅ Production-ready (optimized) |
| Reviews | list (pagination + filters) | ✅ Functional |
| Admin Intake | batch CRUD, item CRUD, bulk add, publish | ✅ Functional |
| Sentiment Analysis | keyword-based, đa ngôn ngữ (VI/EN/JP) | ✅ Functional |
| Insight Recalculation | auto-recalc sau publish | ✅ Functional |

### ❌ Chưa có

| Chức năng | Quan trọng |
|---|---|
| Forgot password / Reset password | 🔴 Bắt buộc |
| Refresh token (token rotation) | 🔴 Bắt buộc |
| User profile management | 🟡 Cần |
| Team management (invite/remove members) | 🟡 Cần |
| Restaurant delete | 🟡 Cần |
| Review search by keyword/sentiment | 🟡 Cần |
| Export reviews (CSV) | 🟢 Nice-to-have |
| Delete account | 🟢 Nice-to-have |
| Notification / Webhook | 🟢 V2 |
| Audit log | 🟢 V2 |

---

## Sprint 1 — Foundation Hardening 🔧

> **Mục tiêu**: Fix các vấn đề nền tảng trước khi build thêm feature.
> **Thời gian ước tính**: 2-3 ngày

### S1-T01. Dashboard query optimization

**Vấn đề**: `getSentimentBreakdown()` và `getTrend()` load toàn bộ reviews vào memory.
**Giải pháp**: Chuyển sang PostgreSQL aggregation.

- **File**: `src/services/dashboard.service.js`
- **Chi tiết**:
  - `getSentimentBreakdown()` → `prisma.review.groupBy({ by: ['sentiment'], _count })`
  - `getTrend()` → raw SQL `date_trunc` + `AVG(rating)` + `COUNT(*)`
- **Verify**: `npm test` — `dashboard.integration.test.js` pass

### S1-T02. UUID param validation middleware

**Vấn đề**: Request với ID không hợp lệ trả 500 thay vì 400.
**Giải pháp**: Middleware validate UUID format trước khi chạm Prisma.

- **File mới**: `src/middleware/validate-uuid.js`
- **File sửa**: `src/routes/restaurants.js`, `src/modules/admin-intake/admin-intake.routes.js`
- **Verify**: Request `GET /api/restaurants/abc` → 400 `INVALID_ID`

### S1-T03. Database indexes

**Giải pháp**: Thêm indexes cho query patterns phổ biến.

- **File**: `prisma/schema.prisma`
- **Indexes**:
  - `Review: @@index([restaurantId])`
  - `Review: @@index([restaurantId, createdAt])`
- **Verify**: `npx prisma validate`, `npx prisma migrate dev`

### S1-T04. fetchIntakeSummary optimization

**Vấn đề**: Load tất cả intake items chỉ để đếm.
**Giải pháp**: Dùng `_count` + `groupBy`.

- **File**: `src/services/restaurant.service.js`
- **Verify**: `npm test`

### S1-T05. publishApprovedItems batching

**Vấn đề**: N lần update riêng lẻ trong transaction.
**Giải pháp**: `Promise.all` cho concurrent updates.

- **File**: `src/modules/admin-intake/admin-intake.repository.js`
- **Verify**: `npm test` — `admin-intake.service.test.js` pass

### S1-T06. Config & gitignore cleanup

- **File sửa**: `.env.example` (thêm `DB_POOL_MAX`, `TRUST_PROXY`, `NODE_ENV`, `AUTH_COOKIE_DOMAIN`)
- **File sửa**: `.gitignore` (thêm `src/generated/`)

### S1-T07. Rate limit cho password change *(từ gap analysis SEC-02)*

- **File sửa**: `src/middleware/rate-limit.js`, `src/routes/auth.js`
- **Chi tiết**: Thêm `passwordChangeLimiter` (5 req/min) cho `PATCH /api/auth/password`

### S1-T08. Sanitize review content *(từ gap analysis SEC-04)*

- **File sửa**: `src/modules/admin-intake/admin-intake.service.js`
- **Chi tiết**: Strip HTML tags khỏi content trước khi lưu. Tránh XSS nếu frontend render raw.

### S1-T09. Validate reviewDate không nằm trong tương lai *(DAT-07)*

- **File sửa**: `src/modules/admin-intake/admin-intake.validation.js`

### S1-T10. Thêm timestamp vào error responses *(API-06)*

- **File sửa**: `src/lib/controller-error.js`

### S1-T11. Gom hardcoded constants vào 1 file *(CQ-05)*

- **File mới**: `src/config/constants.js`
- **File sửa**: `src/services/auth.service.js`, `src/middleware/auth.js`, `src/services/insight.service.js`, `src/services/sentiment-analyzer.service.js`, `src/modules/admin-intake/admin-intake.validation.js`

### S1-T12. Remove `isMissingIntakeTableError` workaround *(CQ-04)*

- **File sửa**: `src/services/restaurant.service.js`
- **Chi tiết**: Workaround cho migration timing — không còn cần thiết.

### S1 — Tiêu chí hoàn thành

- [x] `npm test` — tất cả test files pass (34/34)
- [x] `npx prisma validate` — no errors
- [x] Dashboard endpoints không load full dataset vào memory
- [x] Invalid UUID request trả 400, không trả 500
- [x] Password change endpoint có rate limit riêng
- [x] Review content được sanitize trước khi lưu
- [x] Error response có timestamp

> ✅ **Sprint 1 hoàn thành**: 2026-03-16

---

## Sprint 2 — Auth Hoàn Thiện 🔐

> **Mục tiêu**: Auth flow đầy đủ cho production — refresh token, forgot password, email verification.
> **Thời gian ước tính**: 3-4 ngày

### S2-T01. Refresh token (Token rotation)

**Hiện tại**: Chỉ có access token (15 phút), hết hạn → phải login lại.
**Giải pháp**: Thêm refresh token flow.

- **Schema change**:
  ```prisma
  model RefreshToken {
    id          String   @id @default(uuid())
    userId      String
    token       String   @unique
    familyId    String
    expiresAt   DateTime
    revokedAt   DateTime?
    createdAt   DateTime @default(now())
    
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    @@index([userId])
    @@index([familyId])
    @@index([expiresAt])
  }
  ```
- **Endpoints mới**:
  - `POST /api/auth/refresh` — nhận refresh token, trả access + refresh token mới
- **File mới**:
  - `src/services/refresh-token.service.js`
- **File sửa**:
  - `prisma/schema.prisma`
  - `src/services/auth.service.js` (login trả thêm refresh token)
  - `src/controllers/auth.controller.js`
  - `src/routes/auth.js`
  - `src/lib/auth-cookie.js` (thêm refresh token cookie)
- **Security**: Token rotation — mỗi lần refresh tạo token mới, revoke token cũ. Nếu phát hiện reuse → revoke toàn bộ family.

### S2-T02. Forgot password / Reset password

**Hiện tại**: Không có cách khôi phục mật khẩu.
**Giải pháp**: OTP hoặc reset link qua email.

- **Schema change**:
  ```prisma
  model PasswordResetToken {
    id        String   @id @default(uuid())
    userId    String
    token     String   @unique
    expiresAt DateTime
    usedAt    DateTime?
    createdAt DateTime @default(now())
    
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    @@index([userId])
    @@index([token])
  }
  ```
- **Endpoints mới**:
  - `POST /api/auth/forgot-password` — gửi email reset link
  - `POST /api/auth/reset-password` — verify token + đặt mật khẩu mới
- **File mới**:
  - `src/services/password-reset.service.js`
  - `src/services/email.service.js` (email abstraction — giai đoạn đầu dùng console.log, sau gắn Resend/SendGrid)
- **File sửa**:
  - `prisma/schema.prisma`
  - `src/controllers/auth.controller.js`
  - `src/routes/auth.js`
  - `src/config/env.js` (thêm `RESET_TOKEN_EXPIRES_MINUTES`, `APP_URL`, `SMTP_*`)

### S2-T03. Email service abstraction

**Mục tiêu**: Tạo email service layer để gửi email transactional.

- **File mới**: `src/services/email.service.js`
- **Strategy**: Interface-based — development dùng console log, production gắn Resend hoặc SendGrid
- **Config**: `EMAIL_PROVIDER` env var (`console` | `resend` | `sendgrid`)
- **Templates**: Reset password, welcome email (dùng template string, không cần template engine)

### S2-T04. CSRF protection cho cookie auth *(từ gap analysis SEC-01)*

**Hiện tại**: Cookie auth vulnerable to CSRF.
**Giải pháp**: Implement Double Submit Cookie pattern:
- Login set thêm non-HttpOnly CSRF token
- Client gửi CSRF token trong `X-CSRF-Token` header
- Server reject nếu header khác cookie

- **File mới**: `src/middleware/csrf.js`
- **File sửa**: `src/lib/auth-cookie.js`, `src/app.js`

### S2-T05. JWT secret rotation support *(SEC-03)*

- **File sửa**: `src/config/env.js` (thêm `JWT_SECRET_PREVIOUS`)
- **File sửa**: `src/middleware/auth.js` (try primary → fallback to previous)

### S2 — Tiêu chí hoàn thành

- [x] User có thể refresh token mà không cần re-login
- [x] Token rotation hoạt động — reuse detection revoke cả family
- [x] Forgot password gửi được email (ít nhất console log trong dev)
- [x] Reset password flow hoạt động end-to-end
- [x] CSRF protection hoạt động cho cookie-based auth
- [x] JWT secret rotation có thể thực hiện zero-downtime
- [x] Tất cả test pass (34/34)

> ✅ **Sprint 2 hoàn thành**: 2026-03-16

---

## Sprint 3 — User & Team Management 👥

> **Mục tiêu**: Quản lý profile, mời thành viên vào restaurant, phân quyền.
> **Thời gian ước tính**: 3-4 ngày

### S3-T01. User profile management

**Hiện tại**: Không có endpoint cập nhật profile.

- **Endpoints mới**:
  - `GET /api/users/me` — lấy profile chi tiết
  - `PATCH /api/users/me` — cập nhật fullName (và avatar nếu có)
  - `DELETE /api/users/me` — soft delete / deactivate account
- **File mới**:
  - `src/modules/users/users.controller.js`
  - `src/modules/users/users.service.js`
  - `src/modules/users/users.validation.js`
  - `src/modules/users/users.routes.js`
- **File sửa**:
  - `src/app.js` (mount user routes)
  - `prisma/schema.prisma` (thêm `isActive` boolean nếu support soft delete)

### S3-T02. Team invitation system

**Hiện tại**: `RestaurantUser` tồn tại nhưng không có flow invite.

- **Schema change**:
  ```prisma
  model Invitation {
    id             String               @id @default(uuid())
    restaurantId   String
    invitedEmail   String
    permission     RestaurantPermission @default(MANAGER)
    invitedByUserId String
    token          String               @unique
    status         InvitationStatus     @default(PENDING)
    expiresAt      DateTime
    acceptedAt     DateTime?
    createdAt      DateTime             @default(now())

    restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
    invitedBy  User       @relation(fields: [invitedByUserId], references: [id], onDelete: Cascade)
    
    @@unique([restaurantId, invitedEmail])
    @@index([token])
    @@index([invitedEmail])
  }

  enum InvitationStatus {
    PENDING
    ACCEPTED
    EXPIRED
    CANCELLED
  }
  ```
- **Endpoints mới**:
  - `POST /api/restaurants/:id/invitations` — OWNER mời member (gửi email)
  - `GET /api/restaurants/:id/invitations` — list pending invitations
  - `DELETE /api/restaurants/:id/invitations/:inviteId` — cancel invitation
  - `POST /api/invitations/:token/accept` — accept invitation (public, no auth)
  - `GET /api/restaurants/:id/members` — list team members
  - `PATCH /api/restaurants/:id/members/:memberId` — thay đổi permission
  - `DELETE /api/restaurants/:id/members/:memberId` — remove member

- **File mới**:
  - `src/modules/team/team.controller.js`
  - `src/modules/team/team.service.js`
  - `src/modules/team/team.validation.js`
  - `src/modules/team/team.routes.js`
- **Business rules**:
  - Chỉ OWNER mời được member
  - Chỉ OWNER đổi được permission
  - OWNER không thể remove chính mình (phải transfer trước)
  - Invitation expire sau 7 ngày

### S3-T03. Transfer restaurant ownership

- **Endpoint mới**:
  - `POST /api/restaurants/:id/transfer` — OWNER chuyển quyền cho member khác
- **Business rules**:
  - Chỉ OWNER gọi được
  - Target phải là member hiện tại của restaurant
  - OWNER cũ chuyển thành MANAGER

### S3-T04. Delete restaurant

**Hiện tại**: Không có endpoint xóa restaurant.

- **Endpoint mới**: `DELETE /api/restaurants/:id`
- **Business rules**: Chỉ OWNER, cascade delete reviews + insights + intake batches
- **File sửa**: `src/controllers/restaurants.controller.js`, `src/routes/restaurants.js`

### S3-T05. Soft delete pattern *(từ gap analysis DAT-04)*

- **File sửa**: `prisma/schema.prisma` (thêm `deletedAt DateTime?` cho User, Restaurant)
- **File mới**: `src/middleware/soft-delete.js` (Prisma middleware filter active records)
- **Áp dụng**: Tất cả delete operations trong Sprint 3 dùng soft delete thay vì hard delete

### S3-T06. Pagination cho `listRestaurants()` *(DAT-01)*

- **File sửa**: `src/services/restaurant.service.js`, `src/controllers/restaurants.controller.js`
- **Query params**: `page`, `limit` (default 20, max 50)

### S3 — Tiêu chí hoàn thành

- [ ] User cập nhật được profile
- [ ] OWNER mời được thành viên vào restaurant
- [ ] Invitation flow hoạt động (gửi → accept → thành member)
- [ ] OWNER quản lý được team (đổi quyền, remove)
- [ ] Ownership transfer hoạt động
- [ ] Delete restaurant / account dùng soft delete
- [ ] Restaurant list có pagination

---

## Sprint 4 — Review Management Nâng Cao 📊

> **Mục tiêu**: Search, filter nâng cao, export, và cải thiện review insights.
> **Thời gian ước tính**: 3-4 ngày

### S4-T01. Review search & advanced filters

**Hiện tại**: Chỉ filter `rating`, `from`, `to`. Không search được content.

- **Endpoint sửa**: `GET /api/restaurants/:id/reviews`
- **Query params mới**:
  - `sentiment` — filter theo `POSITIVE`, `NEUTRAL`, `NEGATIVE`
  - `search` — full-text search content + authorName
  - `sort` — `reviewDate`, `rating`, `createdAt` (asc/desc)
- **File sửa**:
  - `src/controllers/reviews.controller.js` (mở rộng validation schema)
  - `src/services/review.service.js` (thêm search + sort logic)
- **Cân nhắc**: PostgreSQL `ILIKE` cho search đơn giản. Nếu cần full-text search performance → dùng `pg_trgm` extension + GIN index.

### S4-T02. Export reviews (CSV)

- **Endpoint mới**: `GET /api/restaurants/:id/reviews/export?format=csv`
- **File mới**:
  - `src/services/export.service.js`
- **File sửa**:
  - `src/controllers/reviews.controller.js`
  - `src/routes/restaurants.js`
- **Headers**: `Content-Type: text/csv`, `Content-Disposition: attachment`
- **Columns**: authorName, rating, content, sentiment, keywords, reviewDate

### S4-T03. Batch archive & management

**Hiện tại**: Batch chỉ delete được khi DRAFT/IN_REVIEW. Không archive được.

- **Endpoint mới**: `POST /api/admin/review-batches/:id/archive`
- **Business rule**: PUBLISHED batch có thể archive, ARCHIVED batch ẩn khỏi list mặc định
- **File sửa**: `src/modules/admin-intake/admin-intake.service.js`

### S4-T04. Dashboard date range filter

**Hiện tại**: Dashboard endpoints trả data cho tất cả thời gian.

- **Query params mới** cho tất cả dashboard endpoints:
  - `from` — YYYY-MM-DD
  - `to` — YYYY-MM-DD
- **File sửa**: `src/services/dashboard.service.js`, `src/controllers/dashboard.controller.js`

### S4-T05. Single review detail

**Hiện tại**: Chỉ có list, không xem chi tiết 1 review.

- **Endpoint mới**: `GET /api/restaurants/:id/reviews/:reviewId`
- **File sửa**: `src/services/review.service.js`, `src/controllers/reviews.controller.js`, `src/routes/restaurants.js`

### S4-T06. Aggregate dashboard endpoint *(API-03)*

- **Endpoint mới**: `GET /api/restaurants/:id/dashboard`
- **Response**: `{ kpi, sentiment, trend, complaints, topIssue }` — gộp 5 endpoints
- **Lý do**: Giảm frontend từ 5 API calls xuống 1

### S4-T07. Pagination cho `listReviewBatches()` *(DAT-02)*

- **File sửa**: `src/modules/admin-intake/admin-intake.repository.js`
- **Query params**: `page`, `limit`, `status` filter

### S4-T08. Standardize delete response envelope *(API-04)*

- **Chi tiết**: Tất cả delete endpoints trả `{ data: { id, deleted: true } }`

### S4 — Tiêu chí hoàn thành

- [ ] Search reviews bằng keyword hoạt động
- [ ] Filter theo sentiment hoạt động
- [ ] Export CSV download thành công
- [ ] Dashboard endpoints hỗ trợ date range filter
- [ ] Aggregate dashboard endpoint hoạt động
- [ ] Batch list có pagination + status filter
- [ ] View chi tiết 1 review

---

## Sprint 5 — Production Readiness 🚀

> **Mục tiêu**: Đảm bảo backend sẵn sàng cho production deployment.
> **Thời gian ước tính**: 2-3 ngày

### S5-T01. Request compression

- **Thêm**: `compression` middleware cho responses
- **File sửa**: `src/app.js`, `package.json`
- **Lý do**: Giảm bandwidth, đặc biệt cho dashboard JSON responses lớn

### S5-T02. Request timeout

- **Thêm**: Timeout middleware cho các request chạy quá lâu
- **File mới**: `src/middleware/request-timeout.js`
- **Default**: 30s cho API, 60s cho export endpoints
- **File sửa**: `src/app.js`

### S5-T03. Database health monitoring

- **Endpoint sửa**: `GET /api/health`
- **Thêm chi tiết**:
  - DB connection pool status
  - DB response time
  - Uptime
  - Memory usage
- **File sửa**: `src/app.js`

### S5-T04. CORS hardening

- **File sửa**: `src/app.js`, `src/config/env.js`
- **Thêm**: `CORS_METHODS`, `CORS_MAX_AGE` env vars
- **Preflight caching**: `Access-Control-Max-Age: 86400`

### S5-T05. API versioning strategy

- **Quyết định**: URL-based versioning (`/api/v1/...`)
- **File sửa**: `src/app.js`
- **Strategy**: Mount current routes dưới `/api/v1/`, giữ `/api/` redirect tới `/api/v1/` cho backward compat
- **Lý do**: Khi cần breaking change, mount `/api/v2/` song song

### S5-T06. Cron job: cleanup expired tokens

- **File mới**: `src/jobs/cleanup-tokens.job.js`
- **Logic**: Xóa expired refresh tokens và password reset tokens
- **Schedule**: Chạy hàng ngày (dùng `node-cron` hoặc external scheduler)

### S5-T07. Security headers audit

- **Review**: Helmet config hiện tại
- **Thêm**: `Permissions-Policy`, `Referrer-Policy`, CSP nếu serve HTML
- **File sửa**: `src/app.js`

### S5-T08. Real database integration tests *(TST-01)*

- **File mới**: `test/integration/setup.js`, `docker-compose.test.yml`
- **Chi tiết**: Tests chạy trên PostgreSQL thật (Docker) thay vì mock Prisma

### S5-T09. Race condition tests *(TST-02)*

- **Chi tiết**: Test concurrent publish, concurrent register, concurrent slug generation

### S5-T10. Redis rate limit store *(SEC-05)*

- **File sửa**: `src/middleware/rate-limit.js`
- **Chi tiết**: Chuyển từ in-memory sang Redis store khi deploy multi-instance
- **Conditional**: Chỉ cần khi chạy 2+ instances

### S5-T11. Database backup strategy *(OPS-01)*

- **File mới**: `docs/BACKUP-STRATEGY.md`
- **Chi tiết**: Document pg_dump schedule, retention policy, restore procedure

### S5-T12. Background publish job *(SCL-01)*

- **Thêm enum**: `PUBLISHING` vào `ReviewIntakeBatchStatus`
- **File mới**: `src/jobs/publish-batch.job.js`
- **Chi tiết**: Publish → mark PUBLISHING → return → background worker → PUBLISHED
- **Conditional**: Chỉ cần khi batch > 50 items thường xuyên

### S5 — Tiêu chí hoàn thành

- [ ] Response compression hoạt động (check Content-Encoding header)
- [ ] Request timeout ngắt các request chạy quá lâu
- [ ] Health endpoint trả DB latency, memory, uptime
- [ ] API versioning setup xong
- [ ] Expired tokens được dọn dẹp tự động
- [ ] Security headers đầy đủ
- [ ] Integration tests chạy trên real DB
- [ ] Backup strategy được document

---

## Sprint 6 — Advanced Features (V2) 🌟

> **Mục tiêu**: Features nâng cao cho phiên bản tiếp theo.
> **Thời gian ước tính**: Tuỳ scope

### S6-T01. Notification system

- **Schema**:
  ```prisma
  model Notification {
    id        String   @id @default(uuid())
    userId    String
    type      String
    title     String
    body      String?
    data      Json?
    readAt    DateTime?
    createdAt DateTime @default(now())
    
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    @@index([userId, readAt])
    @@index([userId, createdAt])
  }
  ```
- **Endpoints**:
  - `GET /api/notifications` — list notifications (pagination)
  - `PATCH /api/notifications/:id/read` — mark as read
  - `POST /api/notifications/read-all` — mark all as read
- **Trigger points**: Batch published, member invited, ownership transferred

### S6-T02. Audit log

- **Schema**:
  ```prisma
  model AuditLog {
    id           String   @id @default(uuid())
    userId       String?
    restaurantId String?
    action       String
    resource     String
    resourceId   String?
    metadata     Json?
    ip           String?
    userAgent    String?
    createdAt    DateTime @default(now())
    
    @@index([restaurantId, createdAt])
    @@index([userId, createdAt])
    @@index([action, createdAt])
  }
  ```
- **Endpoints**:
  - `GET /api/restaurants/:id/audit-log` — OWNER only
- **Tracked actions**: member.invited, member.removed, batch.published, restaurant.updated, settings.changed

### S6-T03. Webhook system

- **Schema**: `WebhookEndpoint` (url, events, secret, active)
- **Endpoints**: CRUD cho webhook endpoints
- **Events**: `batch.published`, `insight.updated`, `member.joined`
- **Delivery**: Queue-based (Bull/BullMQ) với retry

### S6-T04. Multi-language sentiment analysis

**Hiện tại**: Keyword-based (VI/EN/JP). Hạn chế accuracy.
**Nâng cấp**: Tích hợp LLM API cho sentiment analysis.

- **Strategy**: Hybrid — dùng keyword-based cho real-time, LLM cho batch analysis
- **Config**: `SENTIMENT_PROVIDER` env var (`keyword` | `openai` | `gemini`)
- **File sửa**: `src/services/sentiment-analyzer.service.js`

---

## Tổng kết Sprint Map

```
Sprint 1 ─── Foundation Hardening ──── 2-3 ngày ─── 🔴 Critical
   │
Sprint 2 ─── Auth Hoàn Thiện ───────── 3-4 ngày ─── 🔴 Critical
   │
Sprint 3 ─── User & Team ─────────── 3-4 ngày ─── 🟡 Important
   │
Sprint 4 ─── Review Nâng Cao ──────── 3-4 ngày ─── 🟡 Important
   │
Sprint 5 ─── Production Ready ─────── 2-3 ngày ─── 🟡 Important
   │
Sprint 6 ─── Advanced (V2) ─────────── TBD ──────── 🟢 Future
```

**Tổng cộng Sprint 1-5**: ~15-18 ngày dev

---

## Endpoint Inventory (Current + Planned)

### Hiện tại: 21 endpoints

| Group | Method | Path | Auth |
|---|---|---|---|
| Auth | POST | `/api/auth/register` | No |
| Auth | POST | `/api/auth/login` | No |
| Auth | GET | `/api/auth/session` | Yes |
| Auth | POST | `/api/auth/logout` | Yes |
| Auth | PATCH | `/api/auth/password` | Yes |
| Restaurant | POST | `/api/restaurants` | Yes |
| Restaurant | GET | `/api/restaurants` | Yes |
| Restaurant | GET | `/api/restaurants/:id` | Yes |
| Restaurant | PATCH | `/api/restaurants/:id` | Yes |
| Reviews | GET | `/api/restaurants/:id/reviews` | Yes |
| Dashboard | GET | `/api/restaurants/:id/dashboard/kpi` | Yes |
| Dashboard | GET | `/api/restaurants/:id/dashboard/sentiment` | Yes |
| Dashboard | GET | `/api/restaurants/:id/dashboard/trend` | Yes |
| Dashboard | GET | `/api/restaurants/:id/dashboard/complaints` | Yes |
| Dashboard | GET | `/api/restaurants/:id/dashboard/top-issue` | Yes |
| Admin | POST | `/api/admin/review-batches` | Yes+Perm |
| Admin | GET | `/api/admin/review-batches` | Yes+Perm |
| Admin | GET | `/api/admin/review-batches/:id` | Yes+Perm |
| Admin | DELETE | `/api/admin/review-batches/:id` | Yes+Perm |
| Admin | POST | `/api/admin/review-batches/:id/items` | Yes+Perm |
| Admin | POST | `/api/admin/review-batches/:id/items/bulk` | Yes+Perm |
| Admin | PATCH | `/api/admin/review-items/:id` | Yes+Perm |
| Admin | DELETE | `/api/admin/review-items/:id` | Yes+Perm |
| Admin | POST | `/api/admin/review-batches/:id/publish` | Yes+Perm |

### Planned: +20 endpoints (Sprint 2-6)

| Sprint | Method | Path | Description |
|---|---|---|---|
| S2 | POST | `/api/auth/refresh` | Refresh token |
| S2 | POST | `/api/auth/forgot-password` | Request reset |
| S2 | POST | `/api/auth/reset-password` | Reset password |
| S3 | GET | `/api/users/me` | Get profile |
| S3 | PATCH | `/api/users/me` | Update profile |
| S3 | DELETE | `/api/users/me` | Deactivate account |
| S3 | POST | `/api/restaurants/:id/invitations` | Invite member |
| S3 | GET | `/api/restaurants/:id/invitations` | List invitations |
| S3 | DELETE | `/api/restaurants/:id/invitations/:inviteId` | Cancel invite |
| S3 | POST | `/api/invitations/:token/accept` | Accept invite |
| S3 | GET | `/api/restaurants/:id/members` | List members |
| S3 | PATCH | `/api/restaurants/:id/members/:memberId` | Change permission |
| S3 | DELETE | `/api/restaurants/:id/members/:memberId` | Remove member |
| S3 | POST | `/api/restaurants/:id/transfer` | Transfer ownership |
| S3 | DELETE | `/api/restaurants/:id` | Delete restaurant |
| S4 | GET | `/api/restaurants/:id/reviews/export` | Export CSV |
| S4 | GET | `/api/restaurants/:id/reviews/:reviewId` | Review detail |
| S4 | POST | `/api/admin/review-batches/:id/archive` | Archive batch |
| S6 | GET | `/api/notifications` | List notifications |
| S6 | PATCH | `/api/notifications/:id/read` | Mark read |
