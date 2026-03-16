# 🎯 Sentify MVP — Business Model & User Flow

> Tài liệu mô tả rõ mô hình vận hành, luồng sử dụng, và phân quyền của Sentify.
> **Mục đích**: Đảm bảo team FE, BE, QA hiểu đúng "ai làm gì" trước khi code.
>
> **Last updated**: 2026-03-17

---

## Mô hình vận hành

Sentify là **managed platform** — không phải self-service tool.

**Chủ nhà hàng không tự import review.** Đội vận hành Sentify (dev/ops) thu thập, xác minh, và import data. Chủ nhà hàng chỉ xem kết quả phân tích.

```
┌───────────────────────────────────────────────────────────┐
│                      Sentify Platform                      │
│                                                            │
│   🧑‍💼 Chủ nhà hàng (User)     🛠️ Đội vận hành (Operator)  │
│   ─────────────────────      ──────────────────────────    │
│   • Đăng ký / đăng nhập     • Thu thập reviews (Google,   │
│   • Xem dashboard             scrape, manual research)     │
│   • Xem insights + trends   • Nhập data vào hệ thống      │
│   • Quản lý profile           (batch import)               │
│   • Quản lý team           • QC: xác minh, duyệt, reject  │
│                              • Publish → sinh insights     │
│   👉 Chỉ XEM, không         • Đảm bảo data chính xác      │
│      import data               và minh bạch               │
│                                                            │
│   UI: Client App             UI: Admin/Operator Panel      │
└───────────────────────────────────────────────────────────┘
```

---

## Actors & Quyền hạn

| Role | Ai? | Quyền |
|---|---|---|
| **User (OWNER)** | Chủ nhà hàng đăng ký Sentify | Xem dashboard, xem reviews, quản lý team, quản lý profile |
| **User (MANAGER)** | Thành viên được OWNER mời | Xem dashboard, xem reviews (không quản lý team) |
| **Operator (SYSTEM_ADMIN)** | Dev / đội vận hành Sentify | Import reviews, QC data, publish, quản lý restaurants cho nhiều clients |

> ⚠️ **Quan trọng**: Operator KHÔNG phải là OWNER của nhà hàng. Operator quản lý data cho nhà hàng thay mặt chủ nhà hàng.

---

## User Journeys

### Journey 1: Chủ nhà hàng — Onboarding

```
Đăng ký → Tạo nhà hàng → (Chờ operator import data) → Xem dashboard
```

| Bước | Ai làm | Chi tiết |
|---|---|---|
| 1. Đăng ký tài khoản | **User** | Email + password + fullName |
| 2. Tạo nhà hàng | **User** | Nhập tên, địa chỉ, Google Maps URL |
| 3. Thu thập reviews | **Operator** | Crawl từ Google Maps, TripAdvisor, v.v. |
| 4. Import + QC | **Operator** | Batch import → duyệt từng item → publish |
| 5. Xem dashboard | **User** | KPI, sentiment %, trend, top complaints |

### Journey 2: Chủ nhà hàng — Sử dụng hàng ngày

```
Login → Chọn nhà hàng → Xem dashboard → Xem chi tiết reviews
```

| Hành động | Endpoint | Mô tả |
|---|---|---|
| Đăng nhập | `POST /api/auth/login` | Access + refresh token |
| Xem restaurants | `GET /api/restaurants` | List nhà hàng mình có quyền |
| Dashboard KPI | `GET .../dashboard/kpi` | tổng reviews, rating trung bình |
| Sentiment | `GET .../dashboard/sentiment` | Tỷ lệ tích cực / trung tính / tiêu cực |
| Trend | `GET .../dashboard/trend` | Rating + volume theo tuần/tháng |
| Complaints | `GET .../dashboard/complaints` | Từ khoá phàn nàn nổi bật |
| Reviews | `GET .../reviews` | Danh sách reviews (phân trang, filter) |

### Journey 3: Operator — Import & QC data

```
Tạo batch → Nhập items → Duyệt từng item → Publish → Insights tự tính
```

| Bước | Endpoint | Chi tiết |
|---|---|---|
| 1. Tạo batch cho nhà hàng X | `POST /api/admin/review-batches` | Chọn restaurant, đặt tên batch, ghi nguồn |
| 2. Nhập items | `POST .../items/bulk` | Paste hoặc CSV: tên, rating, nội dung, ngày |
| 3. Duyệt từng item | `PATCH /api/admin/review-items/:id` | APPROVED / REJECTED + ghi chú |
| 4. Publish | `POST .../publish` | Auto: phân tích sentiment → tạo canonical reviews → tính insights |

> **Sau khi publish**: Chủ nhà hàng sẽ thấy data mới trên dashboard tự động.

### Journey 4: Khôi phục mật khẩu

```
Quên mật khẩu → Nhập email → Nhận email reset → Đặt mật khẩu mới
```

---

## Data Flow

```
 Operator thu thập        Operator QC           Auto-process          User xem
 ──────────────────     ───────────────     ─────────────────     ────────────
 Google Maps            Duyệt items         Sentiment Analysis    Dashboard
 TripAdvisor     ──►    Reject spam    ──►   Keyword extraction ──► KPI
 Manual research        Verify data          Insight calculation    Trend
                        Source tracking      InsightSummary upsert  Complaints
```

---

## Endpoint Map (24 endpoints)

### 🔓 Public

| Method | Path | Dùng bởi |
|---|---|---|
| POST | `/api/auth/register` | User |
| POST | `/api/auth/login` | User / Operator |
| POST | `/api/auth/refresh` | User / Operator |
| POST | `/api/auth/forgot-password` | User |
| POST | `/api/auth/reset-password` | User |

### 🔒 User endpoints (authenticated)

| Method | Path | Chức năng |
|---|---|---|
| GET | `/api/auth/session` | Session hiện tại |
| POST | `/api/auth/logout` | Đăng xuất |
| PATCH | `/api/auth/password` | Đổi mật khẩu |
| POST | `/api/restaurants` | Tạo nhà hàng |
| GET | `/api/restaurants` | List nhà hàng |
| GET | `/api/restaurants/:id` | Chi tiết nhà hàng |
| PATCH | `/api/restaurants/:id` | Cập nhật nhà hàng |
| GET | `/api/restaurants/:id/reviews` | List reviews (phân trang) |
| GET | `/api/restaurants/:id/dashboard/kpi` | KPI tổng quan |
| GET | `/api/restaurants/:id/dashboard/sentiment` | Phân bổ cảm xúc |
| GET | `/api/restaurants/:id/dashboard/trend` | Xu hướng |
| GET | `/api/restaurants/:id/dashboard/complaints` | Từ khoá phàn nàn |
| GET | `/api/restaurants/:id/dashboard/top-issue` | Vấn đề nổi bật |

### 🔒 Operator endpoints (authenticated + permission)

| Method | Path | Chức năng |
|---|---|---|
| POST | `/api/admin/review-batches` | Tạo batch import |
| GET | `/api/admin/review-batches` | List batches |
| GET | `/api/admin/review-batches/:id` | Chi tiết batch |
| DELETE | `/api/admin/review-batches/:id` | Xoá batch |
| POST | `/api/admin/review-batches/:id/items` | Thêm item |
| POST | `/api/admin/review-batches/:id/items/bulk` | Import hàng loạt |
| PATCH | `/api/admin/review-items/:id` | Duyệt/sửa item |
| DELETE | `/api/admin/review-items/:id` | Xoá item |
| POST | `/api/admin/review-batches/:id/publish` | Publish → sinh reviews + insights |

---

## Feature Matrix

| Feature | Dùng bởi | Status | Sprint |
|---|---|---|---|
| Đăng ký / Đăng nhập / Đổi MK | User | ✅ Done | S1 |
| Refresh Token + CSRF | User | ✅ Done | S2 |
| Forgot / Reset Password | User | ✅ Done | S2 |
| CRUD Restaurant | User | ✅ Done | S1 |
| Dashboard (KPI, sentiment, trend) | User | ✅ Done | S1 |
| Review list (paginated) | User | ✅ Done | S1 |
| Batch import + QC + publish | Operator | ✅ Done | S1 |
| Sentiment analysis (VI/EN/JP) | System | ✅ Done | S1 |
| User profile management | User | ⏳ Planned | S3 |
| Team management (invite/remove) | User (OWNER) | ⏳ Planned | S3 |
| Review search + filters | User | ⏳ Planned | S4 |
| Export CSV | User | ⏳ Planned | S4 |
| Operator dashboard (multi-restaurant) | Operator | ⏳ Planned | S4+ |
| Data source tracking + audit | Operator | ⏳ Planned | S4+ |
| Aggregate dashboard endpoint | User | ⏳ Planned | S4 |
