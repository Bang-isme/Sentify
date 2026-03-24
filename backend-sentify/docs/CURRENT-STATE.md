# Sentify Backend Current State

Updated: 2026-03-24

Tài liệu này mô tả backend và database theo codebase hiện tại, không dựa trên tài liệu lịch sử đã bị bỏ.

## 1. Hướng sản phẩm hiện tại

Backend hiện đi theo hướng:

- manual-first
- admin-curated
- merchant đọc từ canonical dataset đã ổn định

Điều này có nghĩa:

- crawl hoặc nhập tay chỉ là intake
- publish mới là bước đưa dữ liệu vào `Review` canonical
- dashboard merchant chỉ đọc từ dữ liệu đã được kiểm soát

## 2. Stack và runtime

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- CommonJS
- BullMQ + Redis cho review crawl queue

Kiến trúc hiện là modular monolith. `admin-intake` và `review-crawl` đã có ranh giới module rõ hơn phần còn lại.

## 3. Backend hiện có gì

### Auth và security

- register, login, session, logout
- change password
- refresh token rotation
- forgot password, reset password
- cookie auth
- CSRF double-submit
- rate limit
- login lockout
- token revocation qua `tokenVersion`

### Merchant-facing reads

- restaurant detail
- dataset status
- review evidence list
- KPI
- sentiment breakdown
- rating trend
- complaint keywords
- top issue

### Admin intake

- create batch
- list batch
- add items
- bulk add
- update item
- delete item
- publish batch
- canonical review reuse khi external identity trùng nhau

### Review crawl runtime

- Google Maps source upsert
- queued crawl runs
- worker process
- checkpoint/resume/cancel
- raw review persistence
- materialize raw reviews sang draft intake batch

## 4. Database hiện tại

Schema hiện có 13 models:

1. `User`
2. `RefreshToken`
3. `PasswordResetToken`
4. `Restaurant`
5. `RestaurantUser`
6. `Review`
7. `InsightSummary`
8. `ComplaintKeyword`
9. `ReviewIntakeBatch`
10. `ReviewIntakeItem`
11. `ReviewCrawlSource`
12. `ReviewCrawlRun`
13. `ReviewCrawlRawReview`

Phân lớp dữ liệu hiện tại:

- `Review`: canonical dataset
- `ReviewIntakeBatch` và `ReviewIntakeItem`: intake và curation
- `ReviewCrawlSource`, `ReviewCrawlRun`, `ReviewCrawlRawReview`: crawl runtime và audit trail
- `InsightSummary`, `ComplaintKeyword`: read models cho dashboard

## 5. Chất lượng và evidence hiện có

Hiện tại đã có:

- `npm test` pass cho suite mặc định
- `npm run db:validate` pass
- `npm run db:seed` pass
- `npm run test:realdb` pass
- queued crawl smoke pass với local Redis binary

Evidence đáng tin cậy hơn trước:

- queue/runtime tests cho BullMQ-safe job ids và worker lifecycle
- local queued smoke proof cho `source -> run -> worker -> materialize-intake`
- shared seed dataset cho demo, smoke, và regression
- real Postgres publish smoke cho flow `create batch -> approve -> publish -> dashboard refresh`

## 6. Dataset demo hiện có

Seed dataset hiện tạo:

- 2 restaurants
- 3 users với 3 vai trò thực dụng: owner, manager, outsider
- 2 published baseline batches
- 1 open Google Maps curation batch
- 1 crawl source + 1 crawl run + raw review audit trail
- 1 invalid raw review example để kiểm tra validation gap

Điều này giúp FE hoặc QA sau này có dữ liệu thật để bám mà không phải sửa tay database mỗi lần.

## 7. Những gì còn thiếu

Backend vẫn chưa nên gọi là release-ready hoàn chỉnh. Những khoảng trống còn lại là:

- auth lifecycle depth cho refresh và password reset
- read-path smoke rộng hơn trên seeded data cho `reviews`, `sentiment`, `trend`, `complaints`, `top issue`
- duplicate publish smoke trên real DB qua nhiều batch
- load test SMB cho queue worker và merchant-read queries
- staging evidence, backup, restore, rollback
- refactor tiếp auth, restaurants, reviews, dashboard về module boundaries nhất quán hơn

## 8. Kết luận ngắn

Backend hiện đã vượt xa mức “demo cho có”.

Nó đã có:

- data model hợp lý cho manual-first
- auth/security đủ nghiêm túc
- publish path có kiểm soát
- queue-based crawl foundation đã chạy thật
- seed + real DB smoke để làm nền cho các vòng sửa tiếp theo

Phần còn lại bây giờ không còn là “có backend chưa”, mà là “làm cho backend đủ bằng chứng để ship tự tin hơn”.
