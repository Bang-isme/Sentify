# Sentify Backend Testing Strategy

Updated: 2026-03-24

Tài liệu này bám theo trạng thái backend hiện tại và bộ docs đang còn hiệu lực:

- `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`
- `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`

## 1. Mục tiêu

Backend hiện không còn ở mức demo mock-only. Chiến lược test bây giờ có 3 tầng rõ ràng:

1. suite nhanh để dev hằng ngày
2. smoke trên Postgres thật để khóa publish contract
3. proof vận hành queue/worker cho review crawl

## 2. Tầng Test Hiện Có

```text
Browser E2E                Planned later
Seeded read-path smoke     Next expansion
Real Postgres smoke        Implemented
Queued crawl smoke         Implemented
Mocked integration         Current baseline
Unit tests                 Current baseline
```

### Current baseline

- Unit tests cho service, domain helpers, parser, validation
- Mocked integration tests cho controller và request/response behavior
- Auth integration cho cookie + CSRF handshake
- Publish-path coverage cho canonical review reuse
- Queue/runtime coverage cho BullMQ-safe job id và worker lifecycle

### Real-data coverage đã có

- `npm run db:seed`
- `npm run test:realdb`
- `npm run smoke:review-crawl-queue -- --url "..."`

## 3. File Pattern

```text
test/
  *.service.test.js
  *.controller.test.js
  *.integration.test.js
  *.realdb.test.js
  test-helpers.js

prisma/
  seed.js
  seed-data.js
```

Ý nghĩa:

- `*.service.test.js`: logic nghiệp vụ
- `*.controller.test.js`: validation và error mapping
- `*.integration.test.js`: mocked request-to-response behavior
- `*.realdb.test.js`: smoke hoặc integration trên Postgres thật

## 4. Dataset Dùng Chung

Seed baseline hiện có:

- 2 restaurants
- owner, manager, outsider
- 2 published baseline batches
- 1 open Google Maps curation batch
- 1 queued-crawl audit trail với raw reviews
- 1 invalid raw review example

Dataset này phải đủ để:

- demo dashboard
- demo review evidence
- demo admin curation
- chạy publish smoke
- support FE fix sau này

## 5. Commands

Suite mặc định:

```powershell
cd "D:\Project 3\backend-sentify"
npm test
```

Seed local database:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:seed
```

Smoke trên Postgres thật:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm run db:seed
npm run test:realdb
```

Queued crawl smoke:

```powershell
cd "D:\Project 3\backend-sentify"
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
npm run smoke:review-crawl-queue -- --url "https://maps.app.goo.gl/..."
```

## 6. Minimum Evidence

| Area | Minimum evidence hiện mong đợi |
|---|---|
| Auth | register, login, logout, session, invalid token, expired token, permission denial |
| CSRF | issue cookie, missing token -> `403`, correct token -> success |
| Restaurant access | owner, manager, non-member behavior |
| Admin intake | create, add, update, delete, publish, duplicate reuse |
| Dashboard | KPI, sentiment, trend, complaints, top issue |
| Review crawl | source upsert, queued run, worker processing, materialize-intake |
| Ops | `/health`, `/api/health`, migrations, seed, worker startup |

## 7. Gaps Còn Lại

Những gì vẫn chưa đủ:

- read-path smoke rộng hơn trên seeded data cho toàn bộ merchant APIs
- real DB smoke cho duplicate publish xuyên batch
- auth lifecycle depth cho refresh và password reset
- load test SMB cho queue worker và dashboard reads
- staging proof, backup, restore, rollback

## 8. Merge Gate

- `npm test` pass
- `npm run db:validate` pass
- high-risk backend change có test hoặc smoke proof đi kèm
- nếu đụng publish path hoặc crawl runtime thì phải có evidence thật, không chỉ mock
- docs public contract phải sync khi behavior đổi
