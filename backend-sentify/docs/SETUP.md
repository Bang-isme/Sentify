# Sentify Backend Setup

Updated: 2026-03-25

This document describes how to run the backend and the backend-only crawl tooling in the current codebase.

## 1. Requirements

- Node.js 18+
- npm 9+
- PostgreSQL 15+
- Redis if you want to run queued review-crawl workers as separate processes

## 2. Install

```bash
cd backend-sentify
npm install
```

## 3. Environment

Create `.env` from `.env.example` and fill at least:

- `DATABASE_URL`
- `JWT_SECRET`

Important queue and worker settings:

- `REDIS_URL`
- `REVIEW_CRAWL_QUEUE_NAME`
- `REVIEW_CRAWL_WORKER_CONCURRENCY`
- `REVIEW_CRAWL_RUNTIME_MODE`
- `REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS`

## 4. Database

Generate Prisma client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

Seed the shared demo and regression dataset:

```bash
npm run db:seed
```

The seed currently creates:

- 2 demo restaurants
- 3 demo users with owner, manager, and outsider boundaries
- 2 published baseline batches
- 1 open Google Maps curation batch
- 1 crawl source, 1 crawl run, and raw review audit rows

## 5. Run The Backend

```bash
npm run dev
```

Health checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/health
```

## 6. Run Review Crawl Workers

If you want a separate queued worker process:

```bash
set REDIS_URL=redis://127.0.0.1:6379
npm run worker:review-crawl
```

Local development may run `processor + scheduler` in one process. A production-style setup should prefer:

- 1 worker with `REVIEW_CRAWL_RUNTIME_MODE=scheduler`
- 1 or more workers with `REVIEW_CRAWL_RUNTIME_MODE=processor`

## 7. Local Queue Smoke

If Windows does not have a Redis service, the smoke script can start a local Redis binary:

```bash
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
node scripts/review-crawl-queue-smoke.js --url "https://maps.app.goo.gl/..." --strategy backfill --materialize
```

If neither `REDIS_URL` nor a Redis binary is available, the smoke script now falls back to inline queue mode for local benchmarking only.

That local smoke flow will:

- upsert the crawl source
- create a queued crawl run
- process the run until the terminal state is stable
- follow auto-resume backfill chains when they occur
- optionally materialize valid raw reviews into a draft intake batch

Production queued runs still require Redis.

## 8. Review Ops CLI

The backend-only review ops CLI lets developers or operators drive the system without touching SQL:

```bash
npm run ops:review -- sync-draft --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>" --url="https://maps.app.goo.gl/..."
npm run ops:review -- sources --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>"
npm run ops:review -- run-status --user-id="<user-uuid>" --run-id="<run-uuid>"
npm run ops:review -- batch-readiness --user-id="<user-uuid>" --batch-id="<batch-uuid>"
npm run ops:review -- approve-valid --user-id="<user-uuid>" --batch-id="<batch-uuid>" --reviewer-note="Bulk approved after readiness review"
```

## 9. Tests And Validation

Fast suite:

```bash
npm test
```

Real Postgres smoke:

```bash
npm run test:realdb
```

The real-DB suite now covers both:

- publish -> canonical review -> dashboard refresh
- duplicate publish regression across multiple batches
- seeded merchant-read HTTP routes for restaurants, reviews, KPI, sentiment, trend, complaints, and top issue

The fast suite also now covers:

- refresh token rotation, reuse detection, invalid and expired token handling
- refresh route body-token fallback and cookie clearing on refresh failure
- forgot-password token issuance and enumeration-safe responses
- reset-password invalid token, used token, expired token, refresh-session invalidation, and cookie cleanup

Schema validation:

```bash
npm run db:validate
```

## 10. Important Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the API with nodemon |
| `npm start` | Run the API in production mode |
| `npm run worker:review-crawl` | Run the BullMQ worker and scheduler |
| `npm run smoke:review-crawl-queue -- --url "<google-maps-url>"` | Run the queued crawl smoke harness |
| `npm run validate:review-crawl-scale -- --url "<google-maps-url>"` | Run repeated direct and queued scale validation plus a target-review estimate |
| `npm run ops:review -- <subcommand>` | Run the review ops CLI |
| `npm test` | Fast day-to-day backend suite |
| `npm run test:realdb` | Real Postgres smoke suite for publish and merchant-read routes |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed the shared demo dataset |
| `npm run db:validate` | Validate Prisma schema |
| `npm run db:studio` | Open Prisma Studio |

## 11. Notes

- `npm run db:seed` is idempotent within the Sentify demo dataset scope; it does not reset the whole database.
- `npm run test:realdb` seeds the shared demo dataset and runs the real-DB smoke suite for publish plus merchant-read routes.
- Preview crawl does not require Redis.
- Queued crawl and queue health require Redis in production, but the local smoke harness can fall back to inline queue mode when Redis is unavailable.
- Current live-source benchmarks show that Google preview metadata can be higher than the visible public review surface. Two important examples are `4527 / 4746` on `Quan Pho Hong` and `9744 / 15098` on `Cong Ca Phe`, where the user-confirmed public place card also showed `9744`. Operators should treat `reportedTotal` as a reference number, not a guaranteed extraction count.
