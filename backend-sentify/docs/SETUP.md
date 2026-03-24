# Sentify Backend Setup

Updated: 2026-03-24

Tài liệu này mô tả cách chạy backend hiện tại theo đúng state của codebase.

## 1. Yêu cầu

- Node.js 18+
- npm 9+
- PostgreSQL 15+
- Redis nếu muốn chạy queued review-crawl bằng worker riêng

## 2. Cài đặt

```bash
cd backend-sentify
npm install
```

## 3. Environment

Tạo file `.env` từ `.env.example` rồi điền tối thiểu:

- `DATABASE_URL`
- `JWT_SECRET`

Các biến review-crawl queue quan trọng:

- `REDIS_URL`
- `REVIEW_CRAWL_QUEUE_NAME`
- `REVIEW_CRAWL_WORKER_CONCURRENCY`

## 4. Database

Chạy migrate và generate client:

```bash
npm run db:generate
npm run db:migrate
```

Seed dataset dùng chung cho demo, smoke, và regression:

```bash
npm run db:seed
```

Seed hiện tạo:

- 2 demo restaurants
- 3 demo users: owner, manager, outsider
- 2 published baseline batches
- 1 open Google Maps curation batch
- 1 review crawl source, 1 crawl run, và raw review audit trail

## 5. Chạy Backend

```bash
npm run dev
```

Health checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/health
```

## 6. Chạy Review Crawl Queue

Nếu muốn chạy queued crawl bằng worker riêng:

```bash
set REDIS_URL=redis://127.0.0.1:6379
npm run worker:review-crawl
```

Nếu local Windows chưa có Redis service, smoke script có thể tự bật một binary local:

```bash
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
node scripts/review-crawl-queue-smoke.js --url "https://maps.app.goo.gl/..." --strategy backfill --max-pages 1 --materialize
```

Flow smoke này sẽ:

- khởi động Redis local tạm thời nếu `REDIS_URL` chưa có
- khởi động worker runtime
- upsert crawl source
- enqueue run
- chờ run kết thúc
- materialize raw reviews sang draft intake batch nếu có `--materialize`

## 7. Chạy Tests

Suite mặc định:

```bash
npm test
```

Suite này ưu tiên speed, chủ yếu dùng mocks, và `publish.realdb.test.js` sẽ bị skip theo mặc định.

Smoke trên Postgres thật:

```bash
npm run test:realdb
```

Schema validation:

```bash
npm run db:validate
```

## 8. Scripts Quan Trọng

| Script | Mục đích |
|---|---|
| `npm run dev` | chạy API với nodemon |
| `npm start` | chạy API production mode |
| `npm run worker:review-crawl` | chạy BullMQ worker và scheduler |
| `npm run smoke:review-crawl-queue -- --url "<google-maps-url>"` | proof lane cho queue worker |
| `npm test` | suite nhanh dùng cho vòng phát triển thường ngày |
| `npm run test:realdb` | smoke path trên Postgres thật cho publish và dashboard refresh |
| `npm run db:generate` | generate Prisma client |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | seed dataset dùng chung |
| `npm run db:validate` | validate Prisma schema |
| `npm run db:studio` | mở Prisma Studio |

## 9. Ghi Chú

- `npm run db:seed` là idempotent trong phạm vi dataset demo của Sentify, không reset toàn bộ database.
- `npm run test:realdb` tạo restaurant tạm cho smoke publish rồi tự dọn sau khi test kết thúc.
- Preview crawl không cần Redis, nhưng queued crawl thì cần Redis hoặc local binary qua smoke harness.
