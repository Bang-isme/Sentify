# 2. User Flow Diagram — Sprint 1

Date: 2026-03-02
Updated: 2026-03-05

Scope: **Sprint 1 MVP only** — Authentication, Restaurant Management, Google Review Import, Dashboard, Insights.

---

## 2.1 Master Flow (Sprint 1)

```mermaid
flowchart TD
    LAND([Landing Page]) --> AUTH[Login / Register]
    AUTH --> SELECT{Có quán nào chưa?}

    SELECT -->|Chưa| CREATE[Tạo quán mới + dán Google Maps URL]
    SELECT -->|Rồi| PICK[Chọn quán]

    CREATE --> DASH
    PICK --> DASH

    DASH[📊 Dashboard]

    DASH --> IMPORT[📥 Import Reviews]
    IMPORT --> FETCH[Hệ thống scrape review từ Google Maps]
    FETCH --> DEDUP[Kiểm tra external_id — bỏ qua trùng]
    DEDUP --> ANALYZE[Phân tích sentiment từng review]
    ANALYZE --> SAVE[Lưu reviews + sentiment vào DB]
    SAVE --> RECALC[Cập nhật InsightSummary + ComplaintKeyword]
    RECALC --> DASH

    DASH --> REVIEWS[📋 Danh sách Reviews]
    REVIEWS --> FILTER_R[Filter theo rating ⭐]
    REVIEWS --> FILTER_T[Filter theo thời gian 📅]

    DASH --> INSIGHT[🔍 Insights]
    INSIGHT --> COMPLAINT[Top keyword tiêu cực + count + %]
    INSIGHT --> SENTIMENT[% Positive / Neutral / Negative]
    INSIGHT --> TREND[Rating trend theo tuần/tháng]

    DASH --> SETTING[⚙️ Thông tin quán]
    SETTING --> EDIT_URL[Sửa Google Maps URL]

    style DASH fill:#0F766E,color:#fff
    style IMPORT fill:#F59E0B,color:#000
    style INSIGHT fill:#3B82F6,color:#fff
```

---

## 2.2 Registration Flow

```mermaid
flowchart TD
    A([Truy cập Landing Page]) --> B{Đã có tài khoản?}

    B -->|Chưa| C[Đăng ký: Email + Password + Họ tên]
    C --> D[Tạo User trong DB]
    D --> E[Tự động login — cấp JWT]
    E --> F{User có quán nào chưa?}
    F -->|Chưa| G([Chuyển sang Tạo quán 2.3])
    F -->|Rồi| H([Chọn quán → Dashboard])

    B -->|Rồi| I([Chuyển sang Login 2.2b])
```

---

## 2.2b Login Flow

```mermaid
flowchart TD
    A([Mở trang Login]) --> B[Nhập Email + Password]
    B --> C{Xác thực}

    C -->|Thành công| D{User có nhiều quán?}
    D -->|Có| E[Hiển thị danh sách quán — chọn 1]
    D -->|Chỉ 1| F([Vào Dashboard])
    E --> F

    C -->|Sai| G[Hiển thị lỗi]
    G --> B
```

---

## 2.3 Restaurant Setup Flow

```mermaid
flowchart TD
    A([Tạo quán mới]) --> B[Nhập tên quán]
    B --> C[Dán Google Maps URL]
    C --> D[Hệ thống lưu restaurant + tạo RestaurantUser với permission OWNER]
    D --> E([Vào Dashboard])
```

---

## 2.4 Review Import Flow

```mermaid
flowchart TD
    A([Nhấn Import Reviews]) --> B{Quán có google_map_url?}

    B -->|Chưa| C[Yêu cầu dán URL trước]
    C --> A

    B -->|Có| D[Hệ thống scrape reviews từ Google Maps]
    D --> E[Với mỗi review từ Google]
    E --> F{external_id đã tồn tại trong DB?}

    F -->|Có| G[Bỏ qua — không import trùng]
    F -->|Chưa| H[Phân tích sentiment: positive / neutral / negative]
    H --> I[Lưu review + sentiment vào DB]

    G --> J{Còn review tiếp?}
    I --> J
    J -->|Có| E
    J -->|Không| K[Cập nhật InsightSummary + ComplaintKeyword]
    K --> L([Hiển thị kết quả: X imported, Y skipped])
```

---

## 2.5 Dashboard View Flow

```mermaid
flowchart TD
    A([Vào Dashboard]) --> B[Xem KPI Cards]
    B --> C[Tổng reviews | Avg Rating | % Positive | % Negative]

    A --> D[Xem Sentiment Breakdown]
    D --> E[Pie chart: Positive / Neutral / Negative]

    A --> F[Xem Trend Chart]
    F --> G{Đổi period?}
    G -->|Có| H[Chọn: Tuần / Tháng]
    H --> F

    A --> I[Xem Top Complaint Keywords]
    I --> J[keyword + count + % so tổng review tiêu cực]

    A --> K([Xem danh sách Reviews])
    A --> L([Import thêm Reviews])
```

---

## 2.6 Review List & Filter Flow

```mermaid
flowchart TD
    A([Vào danh sách Reviews]) --> B[Hiển thị tất cả reviews]

    B --> C{Filter?}
    C -->|Theo rating| D[Chọn: 1⭐ / 2⭐ / 3⭐ / 4⭐ / 5⭐ / Tất cả]
    C -->|Theo thời gian| E[Chọn khoảng ngày]
    D --> F[Hiển thị reviews đã lọc]
    E --> F
```

---

## 2.7 Database Entity Map (Sprint 1)

| Entity | Mục đích | Liên quan feature |
|--------|----------|-------------------|
| `User` | Tài khoản đăng nhập | A. Auth |
| `Restaurant` | Thông tin quán + google_map_url | B. Restaurant |
| `RestaurantUser` | User ↔ Restaurant (OWNER/MANAGER) | B. Restaurant |
| `Review` | Review đã import + sentiment | C. Import, D. Dashboard |
| `InsightSummary` | Cache KPI (avg rating, % pos/neg, total) | F. Sentiment |
| `ComplaintKeyword` | Top keywords tiêu cực | E. Complaint |

---

## 2.8 Không nằm trong Sprint 1

Các flow sau **không triển khai** trong Sprint 1:

- ❌ Email verification
- ❌ Forgot password
- ❌ Plan selection / Payment
- ❌ Invite member
- ❌ CSV upload
- ❌ Report generation / Export PDF
- ❌ Multi-platform (Facebook, Shopee)
- ❌ Notification / Alert
