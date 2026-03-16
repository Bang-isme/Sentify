# 🗄️ Sentify Database Schema

> PostgreSQL + Prisma ORM
> Last updated: 2026-03-16

---

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ RestaurantUser : "has memberships"
    User ||--o{ ReviewIntakeBatch : "creates batches"
    Restaurant ||--o{ RestaurantUser : "has members"
    Restaurant ||--o{ Review : "has reviews"
    Restaurant ||--|| InsightSummary : "has insight"
    Restaurant ||--o{ ComplaintKeyword : "has keywords"
    Restaurant ||--o{ ReviewIntakeBatch : "has batches"
    Restaurant ||--o{ ReviewIntakeItem : "has items"
    ReviewIntakeBatch ||--o{ ReviewIntakeItem : "contains items"
    Review ||--o| ReviewIntakeItem : "linked from item"

    User {
        uuid id PK
        string email UK
        string fullName
        string passwordHash
        int tokenVersion
        int failedLoginCount
        datetime lockedUntil
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }

    Restaurant {
        uuid id PK
        string name
        string slug UK
        string address
        string googleMapUrl
        datetime createdAt
        datetime updatedAt
    }

    RestaurantUser {
        uuid id PK
        uuid userId FK
        uuid restaurantId FK
        enum permission
        datetime createdAt
    }

    Review {
        uuid id PK
        uuid restaurantId FK
        string externalId
        string authorName
        int rating
        string content
        enum sentiment
        string_array keywords
        datetime reviewDate
        datetime createdAt
        datetime updatedAt
    }

    InsightSummary {
        uuid id PK
        uuid restaurantId FK_UK
        float averageRating
        int totalReviews
        float positivePercentage
        float neutralPercentage
        float negativePercentage
        datetime lastCalculatedAt
    }

    ComplaintKeyword {
        uuid id PK
        uuid restaurantId FK
        string keyword
        int count
        float percentage
        datetime lastUpdatedAt
    }

    ReviewIntakeBatch {
        uuid id PK
        uuid restaurantId FK
        uuid createdByUserId FK
        string title
        enum sourceType
        enum status
        datetime publishedAt
        datetime createdAt
        datetime updatedAt
    }

    ReviewIntakeItem {
        uuid id PK
        uuid batchId FK
        uuid restaurantId FK
        string rawAuthorName
        int rawRating
        string rawContent
        datetime rawReviewDate
        string normalizedAuthorName
        int normalizedRating
        string normalizedContent
        datetime normalizedReviewDate
        enum approvalStatus
        string reviewerNote
        uuid canonicalReviewId FK_UK
        datetime createdAt
        datetime updatedAt
    }
```

---

## Models

### User
Tài khoản người dùng. Mỗi user có thể thuộc nhiều restaurant.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique, normalized lowercase |
| `fullName` | String | Display name |
| `passwordHash` | String | bcrypt hash (12 rounds) |
| `tokenVersion` | Int | Incremented on logout/password change → invalidates all tokens |
| `failedLoginCount` | Int | Reset on success, locks account at threshold |
| `lockedUntil` | DateTime? | Account lock expiry |
| `lastLoginAt` | DateTime? | Last successful login |

### Restaurant
Nhà hàng / quán ăn. Hub chính cho reviews và insights.

| Field | Type | Notes |
|---|---|---|
| `slug` | String | Unique, auto-generated from name, stable after creation |
| `googleMapUrl` | String? | Link Google Maps |

### RestaurantUser
Bảng trung gian user ↔ restaurant (many-to-many + permission).

| Field | Type | Notes |
|---|---|---|
| `permission` | Enum | `OWNER` hoặc `MANAGER` |

**Indexes**: `@@unique([userId, restaurantId])`, `@@index([restaurantId])`, `@@index([userId])`

### Review
Review đã được canonical hoá — nguồn duy nhất cho dashboard/insights.

| Field | Type | Notes |
|---|---|---|
| `externalId` | String | Format: `manual-intake:<itemId>` cho manual reviews |
| `rating` | Int | 1-5 |
| `sentiment` | Enum? | `POSITIVE`, `NEUTRAL`, `NEGATIVE` — computed by sentiment analyzer |
| `keywords` | String[] | Extracted complaint keywords (for NEGATIVE reviews) |
| `reviewDate` | DateTime? | Original review date |

**Indexes**:
- `@@unique([restaurantId, externalId])` — prevent duplicates
- `@@index([restaurantId, rating])` — filter by rating
- `@@index([restaurantId, reviewDate])` — date range queries
- `@@index([restaurantId, sentiment])` — sentiment filter

### InsightSummary
Cache tính toán sẵn cho dashboard KPI. 1:1 với Restaurant.

Được recalculate mỗi lần publish batch qua `recalculateRestaurantInsights()`.

### ComplaintKeyword
Top complaint keywords extracted từ negative reviews. Tối đa 10 keywords per restaurant.

**Indexes**: `@@unique([restaurantId, keyword])`, `@@index([restaurantId, count])`

### ReviewIntakeBatch
Batch chứa các review items chờ duyệt trước khi publish.

| Field | Type | Notes |
|---|---|---|
| `sourceType` | Enum | `MANUAL`, `BULK_PASTE`, `CSV` |
| `status` | Enum | `DRAFT` → `IN_REVIEW` → `READY_TO_PUBLISH` → `PUBLISHED` / `ARCHIVED` |

**Status flow**:
```
DRAFT ──> IN_REVIEW ──> READY_TO_PUBLISH ──> PUBLISHED
  │           │              │
  └───────────┴──────────────┘ (can be DELETED if not PUBLISHED)
```

### ReviewIntakeItem
Một review item trong batch. Có raw fields (input gốc) và normalized fields (đã chỉnh sửa).

| Field | Type | Notes |
|---|---|---|
| `approvalStatus` | Enum | `PENDING`, `APPROVED`, `REJECTED` |
| `canonicalReviewId` | UUID? | Link tới Review sau khi publish |

---

## Enums

| Enum | Values | Used by |
|---|---|---|
| `RestaurantPermission` | `OWNER`, `MANAGER` | RestaurantUser |
| `ReviewSentiment` | `POSITIVE`, `NEUTRAL`, `NEGATIVE` | Review |
| `ReviewIntakeBatchSourceType` | `MANUAL`, `BULK_PASTE`, `CSV` | ReviewIntakeBatch |
| `ReviewIntakeBatchStatus` | `DRAFT`, `IN_REVIEW`, `READY_TO_PUBLISH`, `PUBLISHED`, `ARCHIVED` | ReviewIntakeBatch |
| `ReviewIntakeItemApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED` | ReviewIntakeItem |

---

## Index Strategy

| Model | Index | Purpose |
|---|---|---|
| RestaurantUser | `[userId, restaurantId]` UNIQUE | Prevent duplicate memberships |
| RestaurantUser | `[restaurantId]` | Lookup members of a restaurant |
| RestaurantUser | `[userId]` | Lookup restaurants of a user |
| Review | `[restaurantId, externalId]` UNIQUE | Prevent duplicate reviews per restaurant |
| Review | `[restaurantId, rating]` | Dashboard rating filter |
| Review | `[restaurantId, reviewDate]` | Date range queries |
| Review | `[restaurantId, sentiment]` | Sentiment breakdown |
| ComplaintKeyword | `[restaurantId, keyword]` UNIQUE | Prevent duplicate keywords |
| ComplaintKeyword | `[restaurantId, count]` | Sorted complaint list |
| ReviewIntakeBatch | `[restaurantId]` | List batches by restaurant |
| ReviewIntakeBatch | `[restaurantId, status, createdAt]` | Filtered batch list |
| ReviewIntakeBatch | `[restaurantId, updatedAt, createdAt]` | Sorted batch list |
| ReviewIntakeBatch | `[createdByUserId, createdAt]` | User's batches |
| ReviewIntakeItem | `[batchId, approvalStatus]` | Items by status in batch |
| ReviewIntakeItem | `[batchId, createdAt]` | Sorted items in batch |
| ReviewIntakeItem | `[restaurantId, approvalStatus]` | Cross-batch item status |

---

## Migration History

| Migration | Description |
|---|---|
| `20260306175515_init` | Initial schema: User, Restaurant, RestaurantUser, Review, InsightSummary, ComplaintKeyword |
| `20260306190150_auth_hardening` | Add tokenVersion, failedLoginCount, lockedUntil |
| `20260308185026_add_import_runs` | Import run tables (later removed) |
| `20260308185821_add_import_run_progress` | Import progress tracking (later removed) |
| `20260309035500_add_review_keywords_cache` | Add keywords array to Review |
| `20260310053500_add_restaurant_import_state` | Restaurant import state (later removed) |
| `20260312184500_add_review_intake` | ReviewIntakeBatch + ReviewIntakeItem tables |
| `20260312223000_add_intake_indexes` | Performance indexes for intake tables |
| `20260312224500_remove_auto_import` | Remove import run tables + related fields |
| `20260312231500_remove_google_assisted_source_type` | Clean up enum values |
| `20260313080856_add_review_updated_at_and_intake_batch_index` | Review updatedAt + batch index |
