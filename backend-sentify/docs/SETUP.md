# Sentify Backend Setup

Updated: 2026-03-27

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

Keep managed/staging sign-off inputs separate. Use `.env.release-evidence.example` as the template for `.env.release-evidence`:

- `RELEASE_EVIDENCE_MANAGED_REDIS_URL`
- `RELEASE_EVIDENCE_STAGING_API_URL`
- staging proof credentials
- managed DB proof artifact path

The release-evidence proof scripts now auto-load `.env.release-evidence` on top of `.env`, so local runtime config and staging proof secrets no longer need to live in one file.

Important queue and worker settings:

- `REDIS_URL`
- `REVIEW_CRAWL_QUEUE_NAME`
- `REVIEW_CRAWL_WORKER_CONCURRENCY`
- `REVIEW_CRAWL_RUNTIME_MODE`
- `REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS`

To verify the templates stay in sync with the runtime config contract:

```bash
npm run env:check
```

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
- 5 demo users:
  - 3 `USER` accounts with restaurant membership
  - 1 `USER` outsider account without membership
  - 1 `ADMIN` operator account
- 2 published baseline batches
- 1 open Google Maps curation batch
- 1 crawl source, 1 crawl run, and raw review audit rows

Reset the local baseline end to end:

```bash
npm run db:reset:local-baseline
```

Seeded local credentials:

- `USER`: `demo.user.primary@sentify.local` / `DemoPass123!`
- `ADMIN`: `demo.admin@sentify.local` / `DemoPass123!`

## 5. Run The Backend

```bash
npm run dev
```

Health checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/health
```

If you want the fastest path to a real staging backend URL, use the Render blueprint in [RENDER-STAGING.md](/D:/Project%203/backend-sentify/docs/RENDER-STAGING.md).

## 6. Managed Local Real-Queue Stack

For a reproducible local BullMQ path on Windows, use the managed stack script:

```bash
npm run stack:review-crawl:start
npm run stack:review-crawl:status
```

This script will:

- require `REDIS_URL`
- reuse a compatible Redis 5+ server if one is already running
- otherwise start the bundled Memurai binary if available
- start the API on `PORT`
- start `src/review-crawl-worker.js`
- roll back partial startup if worker bootstrap fails
- prune stale local worker heartbeats so immediate restart does not wait for Redis TTL expiry
- write logs and managed PIDs under `.local-runtime/`

Stop the managed stack with:

```bash
npm run stack:review-crawl:stop
```

Recommended local deterministic queue config for manual review-ops testing:

- `REDIS_URL=redis://127.0.0.1:6379`
- `REVIEW_CRAWL_INLINE_QUEUE_MODE=false`
- `REVIEW_CRAWL_RUNTIME_MODE=processor`

## 7. Role-Aware Local Flows

### User-facing flow

Use a seeded `USER` account to:

- create a restaurant
- list owned restaurants
- read restaurant detail, dataset status, reviews, and dashboard

### Admin flow

Use the seeded `ADMIN` account to:

- list restaurants through `/api/admin/restaurants`
- inspect `/api/admin/restaurants/:id`
- create users and manage lifecycle through `/api/admin/users*`
- assign or remove restaurant memberships through `/api/admin/memberships*`
- inspect and update runtime controls through `/api/admin/platform/*`
- curate review batches
- run crawl preview, queue crawl runs, or sync to draft
- publish approved batches

## 8. Browser E2E Entry Point

From the frontend workspace, run:

```bash
cd ..\apps\web
npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts
```

Use the seeded `USER` and `ADMIN` credentials above against the local backend.

This first-wave browser suite proves:

- `USER` lands in the merchant app and moves across `Home`, `Reviews`, `Actions`, and `Settings`
- `ADMIN` lands in the admin hub and uses live `Operations`, `Access`, and `Platform` screens
- both roles can complete login and logout against the seeded local baseline

Current local admin behavior behind those screens:

- `Access > Users` supports create user, role change, password reset, and account lifecycle actions
- `Access > Memberships` supports assign/remove restaurant membership for `USER` accounts
- `Platform > Health & jobs` shows live runtime controls and release-readiness state
- `Platform > Integrations & policies` mirrors runtime controls in policy context
- `Platform > Audit` includes platform-control update events

## 9. Run Review Crawl Workers

If you want a separate queued worker process:

```bash
set REDIS_URL=redis://127.0.0.1:6379
npm run worker:review-crawl
```

Local development may run `processor + scheduler` in one process. A production-style setup should prefer:

- 1 worker with `REVIEW_CRAWL_RUNTIME_MODE=scheduler`
- 1 or more workers with `REVIEW_CRAWL_RUNTIME_MODE=processor`

## 10. Local Queue Smoke

If Windows does not have a Redis service, the smoke script can start a local Redis binary:

```bash
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
node scripts/review-crawl-queue-smoke.js --url "https://maps.app.goo.gl/..." --strategy backfill --materialize
node scripts/review-ops-sync-draft-smoke.js --url "https://maps.app.goo.gl/..." --strategy incremental
```

If neither `REDIS_URL` nor a Redis binary is available, the smoke script falls back to inline queue mode for local benchmarking only.

That local smoke flow will:

- upsert the crawl source
- create a queued crawl run
- process the run until the terminal state is stable
- follow auto-resume backfill chains when they occur
- optionally materialize valid raw reviews into a draft intake batch

The operator smoke additionally proves:

- `review-ops sync-to-draft` queues through the operator service instead of the raw crawl service
- `materializeMode: DRAFT` auto-materializes valid raw reviews into a draft intake batch
- batch readiness can be read immediately after the queued operator run settles

Production queued runs still require Redis.

Global runtime controls can temporarily disable parts of that flow:

- `crawlQueueWritesEnabled = false` blocks new queued crawl runs
- `crawlMaterializationEnabled = false` blocks crawl-to-intake materialization
- `intakePublishEnabled = false` blocks publish into canonical reviews

## 11. Local SMB Load Harnesses

User-facing read load proof on seeded local Postgres plus real HTTP routes:

```bash
npm run load:merchant-reads -- --extra-reviews 4000 --concurrency 8 --rounds 45 --output load-reports/merchant-reads-smb-local.json
```

Review-crawl worker-pressure proof on seeded local Postgres:

```bash
npm run load:review-crawl-workers -- --source-count 24 --concurrency 4 --pages-per-run 12 --reviews-per-page 20 --step-ms 40 --output load-reports/review-crawl-workers-smb-local.json
```

Important behavior:

- the read harness boots the real Express app and hits protected user-facing routes over HTTP
- the worker harness queues real `ReviewCrawlRun` rows and persists synthetic raw-review checkpoints page by page
- if Redis is unavailable, the worker harness falls back to inline queue mode and proves local worker orchestration plus database write pressure, but not Redis transport behavior
- with `REVIEW_CRAWL_REDIS_BINARY` pointed at a local Memurai or Redis binary, the same worker harness exercises the real BullMQ queue transport and worker runtime

## 12. Local Recovery Drill

Logical restaurant-state recovery proof on the shared demo dataset:

```bash
npm run smoke:recovery-drill
```

That drill will:

- seed the shared demo dataset
- snapshot restaurant profile, canonical reviews, intake batches and items, crawl runtime rows, and dashboard aggregates
- simulate destructive restaurant-state loss
- restore from the captured logical snapshot
- write a proof report to `load-reports/backend-recovery-drill-local.json`

This is local logical recovery evidence. It does not replace managed Postgres backup, restore, or rollback drills for staging or production.

## 13. Staging-Compatible Recovery Drill

Shadow-database recovery rehearsal on the shared demo dataset or an existing source database:

```bash
npm run smoke:staging-recovery-drill
```

That drill will:

- in default `seeded-local` mode, seed the shared demo dataset in the source database first
- in `existing` mode, read an existing source database without seeding it
- capture a logical backup slice for the seeded restaurants and related runtime rows
- create a separately migrated temporary target database unless `--target-db-url` is provided
- verify the target database is empty before restore
- restore the backup slice into the target database
- boot the backend against the restored target and run `/health`, `/api/health`, and authenticated user-facing read smoke
- rehearse rollback by booting the backend against the original source database again
- write a proof report to `load-reports/staging-recovery-drill-local.json`

The restored slice now includes:

- restaurant memberships
- intake batches and items
- crawl sources, runs, and raw reviews
- canonical `Review` data and insight aggregates
- durable `AuditEvent` rows for the selected restaurant slice
- durable `ReviewPublishEvent` lineage rows
- singleton `PlatformControl` state

Latest local baseline proof:

- duration about `8.15s`
- restored slice: `2` restaurants, `3` users, `16` canonical reviews, `3` batches, `19` intake items, `1` crawl source, `1` crawl run, `4` raw reviews
- target and rollback both passed `/health`, `/api/health`, restaurant list, restaurant detail, and dashboard KPI smoke

Useful flags:

- `--target-db-url "<postgres-url>"`
- `--target-database "<database-name>"`
- `--keep-target-database`
- `--restaurant-slug "<slug>"`
- `--source-mode existing`
- `--source-db-url "<postgres-url>"`
- `--smoke-user-id "<user-uuid>"`
- `--output "<file>"`

This is still local evidence. It is stronger than the purely logical recovery drill because it proves a migrated restore target plus app-level rollback smoke, but it is still not a substitute for managed backup or real staging rollback proof.

## 14. Managed Release Evidence Bundle

To assemble one report for managed Redis plus staging-compatible backup, restore, and rollback proof:

```bash
node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --managed-redis-url "redis://127.0.0.1:6379"
```

Helpful wrappers:

```bash
npm run proof:managed-redis
npm run proof:release-evidence
```

What the bundle does:

- runs an ephemeral BullMQ enqueue/process/complete probe against the supplied Redis URL
- runs `staging-recovery-drill.js` in either `seeded-local` or `existing` source mode
- optionally probes a deployed staging API when `--staging-api-url` is provided
- writes:
  - `load-reports/managed-redis-proof.json`
  - `load-reports/staging-recovery-drill-managed.json`
  - `load-reports/managed-release-evidence.json`

Current interpretation:

- `COMPATIBILITY_PROOF_COMPLETE`: all configured bundle checks passed
- `COMPATIBILITY_PROOF_PARTIAL`: core checks passed but at least one proof was skipped or partial
- `COMPATIBILITY_PROOF_FAILED`: at least one required proof failed
- `MANAGED_SIGNOFF_PENDING`: compatibility proof exists, but external managed sign-off is still missing
- `MANAGED_SIGNOFF_COMPLETE`: compatibility proof passed and all external managed sign-off requirements were attached

`admin-platform` now reads `managed-release-evidence.json` and reflects:

- `releaseReadiness.compatibilityProofStatus`
- `releaseReadiness.managedEnvProofStatus`
- `releaseReadiness.managedProofTargets`

Provider-managed Postgres proof support:

- validate an artifact directly:
  - `npm run proof:managed-db -- --artifact docs/examples/managed-db-proof-artifact.example.json`
- attach it to the bundle:
  - `node scripts/release-evidence.js ... --managed-db-proof-artifact docs/examples/managed-db-proof-artifact.example.json`

Managed sign-off preflight:

- quick blocker report:
  - `npm run proof:managed-signoff:preflight`
- direct custom-output form:
  - `node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.json`
- strict mode:
  - `node scripts/managed-signoff-preflight.js --require-ready`

## 15. Review Ops CLI

The backend-only review ops CLI lets developers or operators drive the system without touching SQL:

```bash
npm run ops:review -- sync-draft --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>" --url="https://maps.app.goo.gl/..."
npm run ops:review -- sources --user-id="<user-uuid>" --restaurant-id="<restaurant-uuid>"
npm run ops:review -- run-status --user-id="<user-uuid>" --run-id="<run-uuid>"
npm run ops:review -- batch-readiness --user-id="<user-uuid>" --batch-id="<batch-uuid>"
npm run ops:review -- approve-valid --user-id="<user-uuid>" --batch-id="<batch-uuid>" --reviewer-note="Bulk approved after readiness review"
```

Use an `ADMIN` user id for these commands.

## 16. Tests And Validation

Fast suite:

```bash
npm test
```

Real Postgres smoke:

```bash
npm run test:realdb
```

The real-DB suite covers both:

- publish -> canonical review -> dashboard refresh
- duplicate publish regression across multiple batches
- seeded user-facing HTTP routes for restaurants, reviews, KPI, sentiment, trend, complaints, and top issue
- role-boundary proof for `USER` vs `ADMIN`

Schema validation:

```bash
npm run db:validate
```

## 16. Important Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the API with nodemon |
| `npm start` | Run the API in production mode |
| `npm run worker:review-crawl` | Run the BullMQ worker and scheduler |
| `npm run stack:review-crawl:start` | Start a managed local Redis + API + worker stack |
| `npm run stack:review-crawl:status` | Inspect the managed local review-crawl stack |
| `npm run stack:review-crawl:stop` | Stop the managed local review-crawl stack |
| `npm run smoke:review-crawl-queue -- --url "<google-maps-url>"` | Run the queued crawl smoke harness |
| `npm run smoke:review-ops-sync-draft -- --url "<google-maps-url>"` | Run the operator-triggered sync-to-draft smoke harness |
| `npm run smoke:recovery-drill` | Run the local logical backup and restore drill on the shared demo dataset |
| `npm run smoke:staging-recovery-drill` | Run the local shadow-database restore, health-smoke, and rollback rehearsal |
| `npm run validate:review-crawl-scale -- --url "<google-maps-url>"` | Run repeated direct and queued scale validation plus a target-review estimate |
| `npm run load:merchant-reads -- ...` | Run the local SMB read-path harness over real HTTP routes |
| `npm run load:review-crawl-workers -- ...` | Run the local SMB worker-pressure harness and write a JSON report |
| `npm run ops:review -- <subcommand>` | Run the review ops CLI |
| `npm test` | Fast day-to-day backend suite |
| `npm run test:realdb` | Real Postgres smoke suite for publish and user-facing read routes |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply migrations |
| `npm run db:reset:local-baseline` | Reset local Postgres, reseed the demo dataset, and validate the schema |
| `npm run db:seed` | Seed the shared demo dataset |
| `npm run db:validate` | Validate Prisma schema |
| `npm run db:studio` | Open Prisma Studio |

## 17. Notes

- `npm run db:seed` is idempotent within the Sentify demo dataset scope; it does not reset the whole database.
- `npm run db:reset:local-baseline` is the reproducible local-only reset command for development and browser testing.
- `npm run test:realdb` seeds the shared demo dataset and runs the real-DB smoke suite for publish plus user-facing read routes.
- `npm run load:merchant-reads` writes a local SMB latency and throughput report for seeded user-facing routes.
- `npm run load:review-crawl-workers` writes a local worker-pressure report; without Redis it falls back to inline mode and should not be used to claim Redis transport proof.
- `npm run smoke:review-ops-sync-draft` writes a local operator-path proof report and should be run with Redis or Memurai if you want real BullMQ transport evidence.
- `npm run smoke:recovery-drill` writes a local logical recovery report and proves snapshot plus restore of seeded restaurant state, but it is not a substitute for managed Postgres backup or rollback evidence.
- `npm run smoke:staging-recovery-drill` writes a local shadow-database recovery report and proves target migration, restore isolation, app health, read smoke, and source rollback rehearsal, but it is still not managed-environment proof.
- Preview crawl does not require Redis.
- Queued crawl and queue health require Redis in production, but the local smoke harness can fall back to inline queue mode when Redis is unavailable.
