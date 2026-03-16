# 🗺️ Sentify Backend — Sprint Roadmap

> Tài liệu này liệt kê đầy đủ các sprint và chức năng cần hoàn thiện ở backend.
> Mỗi sprint có mục tiêu rõ ràng, danh sách task, file cần tạo/sửa, và tiêu chí hoàn thành.
>
> **Last updated**: 2026-03-17 (Sprint 1 ✅, Sprint 2 ✅)
>
> **Mô hình vận hành**: Xem [MVP-FLOW.md](./MVP-FLOW.md) — Sentify là **managed platform**:
> - 🧑‍💼 **User** (chủ nhà hàng): chỉ xem dashboard/insights, quản lý profile/team
> - 🛠️ **Operator** (đội vận hành): thu thập, QC, import, publish data

---

## Tổng quan hệ thống hiện tại

### ✅ Đã hoàn thành

| Module | Endpoints | Trạng thái |
|---|---|---|
| Auth | register, login, logout, session, change-password, refresh, forgot/reset | ✅ Production-ready |
| Restaurant | create, list, get detail, update | ✅ Functional |
| Dashboard | KPI, sentiment, trend, complaints, top-issue | ✅ Production-ready (optimized) |
| Reviews | list (pagination + filters) | ✅ Functional |
| Admin Intake | batch CRUD, item CRUD, bulk add, publish | ✅ Functional |
| Sentiment Analysis | keyword-based, đa ngôn ngữ (VI/EN/JP) | ✅ Functional |
| Insight Recalculation | auto-recalc sau publish | ✅ Functional |
| Security | CSRF, refresh token rotation, JWT rotation | ✅ Production-ready |

### ❌ Chưa có

| Chức năng | Dùng bởi | Quan trọng |
|---|---|---|
| User profile management | User | 🔴 Bắt buộc |
| Team management (invite/remove) | User | 🔴 Bắt buộc |
| Aggregate dashboard endpoint | User | 🔴 Bắt buộc |
| Review search + detail | User | 🔴 Bắt buộc |
| Dashboard date range filter | User | 🟡 Cần |
| Delete restaurant / account | User | 🟡 Cần |
| Operator role (SYSTEM_ADMIN) | Operator | 🟡 Cần |
| Data source tracking | Operator | 🟡 Cần |
| Audit trail | Operator | 🟡 Cần |
| Export reviews (CSV) | User | 🟡 Cần |
| Notification system | User | 🟢 Nice-to-have |

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

- **File**: `prisma/schema.prisma`
- **Indexes**: `Review: @@index([restaurantId])`, `Review: @@index([restaurantId, createdAt])`
- **Verify**: `npx prisma validate`, `npx prisma migrate dev`

### S1-T04. fetchIntakeSummary optimization

- **File**: `src/services/restaurant.service.js`
- Dùng `_count` + `groupBy` thay vì load tất cả items

### S1-T05. publishApprovedItems batching

- **File**: `src/modules/admin-intake/admin-intake.repository.js`
- `Promise.all` cho concurrent updates

### S1-T06 → S1-T12. Config cleanup, rate limit, sanitize, validate, constants

*(Chi tiết xem CHANGELOG Sprint 1)*

### S1 — Tiêu chí hoàn thành

- [x] `npm test` — 34/34 pass
- [x] `npx prisma validate` — no errors
- [x] Dashboard không load full dataset vào memory
- [x] Invalid UUID → 400
- [x] Password change có rate limit
- [x] Review content sanitized
- [x] Error response có timestamp

> ✅ **Sprint 1 hoàn thành**: 2026-03-16

---

## Sprint 2 — Auth Hoàn Thiện 🔐

> **Mục tiêu**: Auth flow đầy đủ cho production — refresh token, forgot password, CSRF, JWT rotation.
> **Thời gian ước tính**: 3-4 ngày

### S2-T01. Refresh token (Token rotation)

- Schema: `RefreshToken` model (familyId, hash, revoked, expires)
- Endpoint: `POST /api/auth/refresh`
- Reuse detection: revoke toàn bộ family nếu phát hiện token đã revoke

### S2-T02. Forgot / Reset password

- Schema: `PasswordResetToken` model (hash, single-use, expires)
- Endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- Anti-enumeration: luôn trả success bất kể email có tồn tại không

### S2-T03. Email service abstraction

- `src/services/email.service.js` — console (dev) / Resend (prod)

### S2-T04. CSRF protection

- Double Submit Cookie pattern
- Middleware: `src/middleware/csrf.js`

### S2-T05. JWT secret rotation

- `JWT_SECRET_PREVIOUS` fallback trong auth middleware

### S2 — Tiêu chí hoàn thành

- [x] Refresh token rotation + reuse detection
- [x] Forgot/reset password flow end-to-end
- [x] CSRF cho cookie-based auth
- [x] JWT secret rotation zero-downtime
- [x] 34/34 tests pass

> ✅ **Sprint 2 hoàn thành**: 2026-03-16

---

## Sprint 3 — User Experience Hoàn Thiện 👤

> **Mục tiêu**: Hoàn thiện mọi tính năng mà chủ nhà hàng (User) cần — profile, team, dashboard nâng cao. Sau sprint này, **FE User App có đủ endpoints để dựng UI end-to-end**.
> **Thời gian ước tính**: 3-4 ngày
> **Phục vụ**: 🧑‍💼 User

### S3-T01. User profile management

**Hiện tại**: Không có endpoint cập nhật profile.
**FE cần**: Trang Settings với form sửa tên, deactivate account.

- **Endpoints mới**:
  - `GET /api/users/me` — profile chi tiết (email, fullName, createdAt, restaurants count)
  - `PATCH /api/users/me` — cập nhật fullName
  - `DELETE /api/users/me` — soft delete (deactivate account)
- **File mới**:
  - `src/modules/users/users.controller.js`
  - `src/modules/users/users.service.js`
  - `src/modules/users/users.validation.js`
  - `src/modules/users/users.routes.js`
- **Schema**: Thêm `deletedAt DateTime?` cho `User`
- **FE UI**: Settings page → Profile tab → form + danger zone (deactivate)

### S3-T02. Team management (invite / remove members)

**Hiện tại**: `RestaurantUser` tồn tại nhưng không có flow invite.
**FE cần**: Tab "Team" trong restaurant settings.

- **Schema change**:
  ```prisma
  model Invitation {
    id              String               @id @default(uuid())
    restaurantId    String
    invitedEmail    String
    permission      RestaurantPermission @default(MANAGER)
    invitedByUserId String
    token           String               @unique
    status          InvitationStatus     @default(PENDING)
    expiresAt       DateTime
    acceptedAt      DateTime?
    createdAt       DateTime             @default(now())

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
- **Endpoints mới (User-facing)**:
  - `POST /api/restaurants/:id/invitations` — OWNER mời member (gửi email)
  - `GET /api/restaurants/:id/invitations` — list pending invitations
  - `DELETE /api/restaurants/:id/invitations/:inviteId` — cancel invitation
  - `POST /api/invitations/:token/accept` — accept invitation (public, no auth)
  - `GET /api/restaurants/:id/members` — list team members
  - `PATCH /api/restaurants/:id/members/:memberId` — đổi permission (OWNER only)
  - `DELETE /api/restaurants/:id/members/:memberId` — remove member (OWNER only)
- **File mới**:
  - `src/modules/team/team.controller.js`
  - `src/modules/team/team.service.js`
  - `src/modules/team/team.validation.js`
  - `src/modules/team/team.routes.js`
- **Business rules**:
  - Chỉ OWNER mời / đổi quyền / remove
  - OWNER không thể remove chính mình
  - Invitation expire sau 7 ngày
- **FE UI**: Restaurant → Settings → Team tab → member list + invite form

### S3-T03. Transfer restaurant ownership

- **Endpoint**: `POST /api/restaurants/:id/transfer`
- **Rules**: OWNER only, target phải là member, OWNER cũ → MANAGER
- **FE UI**: Team tab → dropdown trên member → "Transfer ownership"

### S3-T04. Delete restaurant (soft delete)

- **Endpoint**: `DELETE /api/restaurants/:id`
- **Rules**: OWNER only, set `deletedAt`
- **Schema**: Thêm `deletedAt DateTime?` cho `Restaurant`
- **FE UI**: Restaurant Settings → Danger zone → Delete

### S3-T05. Aggregate dashboard endpoint

**FE cần**: 1 call thay vì 5.

- **Endpoint**: `GET /api/restaurants/:id/dashboard`
- **Response**: `{ kpi, sentiment, trend, complaints, topIssue }`
- **FE UI**: Dashboard load 1 lần → render 5 sections

### S3-T06. Review detail + search + filters

**FE cần**: Search bar, filter chips, xem chi tiết 1 review.

- **Sửa**: `GET /api/restaurants/:id/reviews` → thêm `sentiment`, `search`, `sort`
- **Mới**: `GET /api/restaurants/:id/reviews/:reviewId`
- **FE UI**: Reviews page → search + filter + sortable table + click → detail modal

### S3-T07. Dashboard date range filter

- Tất cả dashboard endpoints → `from`, `to` (YYYY-MM-DD)
- **FE UI**: Date range picker trên dashboard

### S3-T08. Pagination restaurants + standardize delete

- `GET /api/restaurants` → `page`, `limit`
- Delete endpoints trả `{ data: { id, deleted: true } }`

### S3 — Tiêu chí hoàn thành

- [ ] User xem + sửa được profile
- [ ] OWNER mời member qua email → accept → thành member
- [ ] Team: đổi quyền, remove, transfer ownership
- [ ] Delete restaurant (soft delete)
- [ ] Aggregate dashboard (`/dashboard`) hoạt động
- [ ] Reviews: search + filter + detail
- [ ] Dashboard: date range filter
- [ ] Restaurant list có pagination
- [ ] **FE User App có đủ endpoints cho mọi trang**

---

## Sprint 4 — Operator Tools & Data Quality 🛠️

> **Mục tiêu**: Nâng cấp công cụ cho đội vận hành — operator role, data source tracking, audit, batch management, export. Sau sprint này, **FE Operator Panel có đủ endpoints để dựng UI vận hành**.
> **Thời gian ước tính**: 3-4 ngày
> **Phục vụ**: 🛠️ Operator + 🧑‍💼 User (export, data transparency)

### S4-T01. Operator role (SYSTEM_ADMIN)

**Hiện tại**: Admin routes check OWNER/MANAGER — nhưng Operator không phải member của nhà hàng.

- **Schema**:
  ```prisma
  // Thêm vào User model
  role  UserRole  @default(USER)

  enum UserRole {
    USER           // Chủ nhà hàng
    SYSTEM_ADMIN   // Đội vận hành Sentify
  }
  ```
- **File mới**: `src/middleware/require-system-admin.js`
- **File sửa**: Admin routes dùng `requireSystemAdmin` thay vì check restaurant permission
- **FE UI**: Operator login → detect `SYSTEM_ADMIN` → render Operator Panel

### S4-T02. Data source tracking

**Operator cần**: Ghi rõ nguồn gốc data trên mỗi batch.

- **Schema** (thêm vào `ReviewIntakeBatch`):
  ```prisma
  sourceUrl     String?    // Google Maps listing URL
  sourceNotes   String?    // "crawl Google Maps ngày 15/03"
  ```
- **Sửa**: `POST /api/admin/review-batches` thêm `sourceUrl`, `sourceNotes`
- **FE UI**: Batch create form → Source URL + Notes fields

### S4-T03. Batch archive + pagination + filter

- **Mới**: `POST /api/admin/review-batches/:id/archive`
- **Sửa**: `GET /api/admin/review-batches` → `page`, `limit`, `status`, `restaurantId`
- ARCHIVED ẩn khỏi list mặc định
- **FE UI**: Batch list → filter + pagination + archive button

### S4-T04. Operator multi-restaurant overview

**Operator cần**: Xem tất cả restaurants + thống kê nhanh.

- **Mới** (Operator-only): `GET /api/admin/restaurants`
- **Response**: `{ id, name, slug, totalReviews, lastBatchAt, pendingBatchCount }`
- **FE UI**: Operator Panel → sidebar restaurant list

### S4-T05. Audit trail

**Mọi action của Operator phải được log** — đảm bảo minh bạch.

- **Schema**:
  ```prisma
  model AuditLog {
    id           String   @id @default(uuid())
    userId       String?
    restaurantId String?
    action       String   // batch.created, batch.published, item.approved, item.rejected
    resource     String   // ReviewIntakeBatch, ReviewIntakeItem
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
- **Mới**: `GET /api/admin/audit-logs` (pagination, filter by restaurant/action/date)
- **Auto-log**: batch create, item approve/reject, batch publish, batch archive
- **FE UI**: Operator Panel → Audit Log tab → filterable table

### S4-T06. Data transparency cho User

**User cần biết**: data từ đâu, bao nhiêu reviews, cập nhật khi nào.

- **Mới**: `GET /api/restaurants/:id/data-summary`
- **Response**:
  ```json
  {
    "totalReviews": 523,
    "totalBatches": 12,
    "lastUpdatedAt": "2026-03-15T...",
    "sources": [
      { "type": "MANUAL", "count": 23 },
      { "type": "BULK_PASTE", "count": 400 },
      { "type": "CSV", "count": 100 }
    ]
  }
  ```
- **FE UI**: Dashboard footer → "523 reviews từ 12 đợt • Cập nhật: 15/03/2026"

### S4-T07. Export reviews (CSV)

- **Mới**: `GET /api/restaurants/:id/reviews/export?format=csv`
- **Headers**: `Content-Type: text/csv`, `Content-Disposition: attachment`
- **Columns**: authorName, rating, content, sentiment, keywords, reviewDate
- **FE UI**: Reviews page → "Export CSV" button

### S4 — Tiêu chí hoàn thành

- [ ] SYSTEM_ADMIN role — access admin endpoints không cần restaurant membership
- [ ] Source tracking trên batches
- [ ] Batch list: pagination + status filter + archive
- [ ] Operator xem tất cả restaurants + thống kê
- [ ] Audit trail auto-log mọi action
- [ ] User xem data transparency trên dashboard
- [ ] Export CSV hoạt động
- [ ] **FE Operator Panel có đủ endpoints cho mọi trang**

---

## Sprint 5 — Production Readiness 🚀

> **Mục tiêu**: Backend sẵn sàng deploy production — performance, notifications, security, seed data.
> **Thời gian ước tính**: 2-3 ngày
> **Phục vụ**: 🏗️ Infrastructure + 🧑‍💼 User (notifications)

### S5-T01. Notification system (User-facing)

**User cần biết** khi có data mới được Operator publish.

- **Schema**:
  ```prisma
  model Notification {
    id        String   @id @default(uuid())
    userId    String
    type      String   // batch.published, member.invited, member.joined
    title     String
    body      String?
    data      Json?    // { restaurantId, batchId, ... }
    readAt    DateTime?
    createdAt DateTime @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, readAt])
    @@index([userId, createdAt])
  }
  ```
- **Endpoints**:
  - `GET /api/notifications` — list + unread count (pagination)
  - `PATCH /api/notifications/:id/read` — mark read
  - `POST /api/notifications/read-all` — mark all read
- **Trigger**: Operator publish batch → notify OWNER + MANAGERs
- **FE UI**: Navbar → bell icon → dropdown → unread badge

### S5-T02. Request compression + timeout

- `compression` middleware → giảm bandwidth
- `request-timeout.js` → 30s default, 60s export
- **File sửa**: `src/app.js`, `package.json`

### S5-T03. Enhanced health endpoint

- `GET /api/health` → `{ status, db: { latencyMs }, uptime, memory }`
- **FE UI**: Operator Panel → System Status

### S5-T04. CORS hardening + security headers

- `CORS_METHODS`, `CORS_MAX_AGE` env vars
- Helmet audit: `Permissions-Policy`, `Referrer-Policy`

### S5-T05. API versioning

- Mount dưới `/api/v1/`, `/api/` redirect → `/api/v1/`

### S5-T06. Cron: cleanup expired tokens

- `src/jobs/cleanup-tokens.job.js` — xóa expired refresh + reset tokens hàng ngày

### S5-T07. Soft delete middleware

- `src/middleware/soft-delete.js` — auto-filter `deletedAt IS NULL`
- Áp dụng cho User + Restaurant

### S5-T08. Seed script

- `prisma/seed.js` — tạo 1 SYSTEM_ADMIN, 2 demo restaurants, sample data
- FE dev có data sẵn khi phát triển

### S5 — Tiêu chí hoàn thành

- [ ] Notifications: User nhận thông báo khi batch published
- [ ] Compression + timeout hoạt động
- [ ] Health endpoint trả DB latency, memory, uptime
- [ ] API versioning `/api/v1/`
- [ ] Token cleanup tự động
- [ ] Security headers đầy đủ
- [ ] Soft delete middleware
- [ ] Seed script chạy được

---

## Sprint 6 — Advanced Features (V2) 🌟

> **Mục tiêu**: Features nâng cao. Triển khai tuỳ nhu cầu.

### S6-T01. LLM-powered sentiment analysis
- Gemini/OpenAI tích hợp, aspect-based: "đồ ăn ngon nhưng phục vụ chậm"
- Config: `SENTIMENT_PROVIDER=keyword|gemini`

### S6-T02. Review dispute (User-facing)
- User báo review không chính xác → Operator xem xét
- Schema: `ReviewDispute`

### S6-T03. Scheduled reports
- PDF/email weekly report cho OWNER (background job)

### S6-T04. Webhook system
- OWNER cấu hình webhook + events (`batch.published`, `insight.updated`)

### S6-T05. Redis rate limit store
- In-memory → Redis khi multi-instance

---

## Tổng kết Sprint Map

```
Sprint 1 ─── Foundation Hardening ──── 2-3 ngày ── ✅ Done
   │
Sprint 2 ─── Auth Hoàn Thiện ───────── 3-4 ngày ── ✅ Done
   │
Sprint 3 ─── User Experience ────────── 3-4 ngày ── 🟡 Next     → FE User App sẵn sàng
   │
Sprint 4 ─── Operator Tools ─────────── 3-4 ngày ── 🟡 After S3 → FE Operator Panel sẵn sàng
   │
Sprint 5 ─── Production Ready ──────── 2-3 ngày ── 🟡 After S4 → Deploy production
   │
Sprint 6 ─── Advanced (V2) ─────────── TBD ─────── 🟢 Future
```

**Tổng cộng Sprint 1-5**: ~15-18 ngày dev

### Sau Sprint 5, FE có đủ endpoints cho:

| FE App | Trang | Sẵn sàng từ |
|---|---|---|
| **User App** | Login / Register / Forgot PW | S2 ✅ |
| | Restaurant picker | S1 + S3 |
| | Dashboard (KPI, charts, complaints) | S1 + S3 (aggregate + date range) |
| | Reviews (search, filter, detail, export) | S1 + S3 + S4 |
| | Settings (profile, change PW) | S2 + S3 |
| | Team management | S3 |
| | Notifications | S5 |
| **Operator Panel** | Login (detect SYSTEM_ADMIN) | S4 |
| | All restaurants overview | S4 |
| | Batch management (create, QC, publish) | S1 + S4 |
| | Audit trail | S4 |
| | System health | S5 |

---

## Endpoint Inventory

### ✅ Done: 24 endpoints (Sprint 1-2)

| Group | Method | Path | Dùng bởi |
|---|---|---|---|
| Auth | POST | `/api/auth/register` | User |
| Auth | POST | `/api/auth/login` | User / Operator |
| Auth | GET | `/api/auth/session` | User / Operator |
| Auth | POST | `/api/auth/logout` | User / Operator |
| Auth | PATCH | `/api/auth/password` | User |
| Auth | POST | `/api/auth/refresh` | User / Operator |
| Auth | POST | `/api/auth/forgot-password` | User |
| Auth | POST | `/api/auth/reset-password` | User |
| Restaurant | POST | `/api/restaurants` | User |
| Restaurant | GET | `/api/restaurants` | User |
| Restaurant | GET | `/api/restaurants/:id` | User |
| Restaurant | PATCH | `/api/restaurants/:id` | User |
| Reviews | GET | `/api/restaurants/:id/reviews` | User |
| Dashboard | GET | `.../dashboard/kpi` | User |
| Dashboard | GET | `.../dashboard/sentiment` | User |
| Dashboard | GET | `.../dashboard/trend` | User |
| Dashboard | GET | `.../dashboard/complaints` | User |
| Dashboard | GET | `.../dashboard/top-issue` | User |
| Operator | POST | `/api/admin/review-batches` | Operator |
| Operator | GET | `/api/admin/review-batches` | Operator |
| Operator | GET | `/api/admin/review-batches/:id` | Operator |
| Operator | DELETE | `/api/admin/review-batches/:id` | Operator |
| Operator | POST | `.../items` or `.../items/bulk` | Operator |
| Operator | PATCH/DELETE | `/api/admin/review-items/:id` | Operator |
| Operator | POST | `.../publish` | Operator |

### ⏳ Planned: +22 endpoints (Sprint 3-5)

| Sprint | Method | Path | Dùng bởi | Chức năng |
|---|---|---|---|---|
| S3 | GET | `/api/users/me` | User | Profile |
| S3 | PATCH | `/api/users/me` | User | Update profile |
| S3 | DELETE | `/api/users/me` | User | Deactivate |
| S3 | POST | `.../invitations` | OWNER | Invite member |
| S3 | GET | `.../invitations` | OWNER | List invitations |
| S3 | DELETE | `.../invitations/:inviteId` | OWNER | Cancel invite |
| S3 | POST | `/api/invitations/:token/accept` | Public | Accept invite |
| S3 | GET | `.../members` | User | List team |
| S3 | PATCH | `.../members/:memberId` | OWNER | Change perm |
| S3 | DELETE | `.../members/:memberId` | OWNER | Remove member |
| S3 | POST | `.../transfer` | OWNER | Transfer ownership |
| S3 | DELETE | `/api/restaurants/:id` | OWNER | Delete restaurant |
| S3 | GET | `.../dashboard` | User | Aggregate dashboard |
| S3 | GET | `.../reviews/:reviewId` | User | Review detail |
| S4 | GET | `/api/admin/restaurants` | Operator | All restaurants |
| S4 | POST | `.../archive` | Operator | Archive batch |
| S4 | GET | `/api/admin/audit-logs` | Operator | Audit trail |
| S4 | GET | `.../data-summary` | User | Data transparency |
| S4 | GET | `.../reviews/export` | User | Export CSV |
| S5 | GET | `/api/notifications` | User | List notifications |
| S5 | PATCH | `/api/notifications/:id/read` | User | Mark read |
| S5 | POST | `/api/notifications/read-all` | User | Mark all read |
