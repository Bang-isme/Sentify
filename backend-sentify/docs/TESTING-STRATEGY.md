# Sentify Backend Testing Strategy

Updated: 2026-03-29

This document tracks the current backend testing posture for the live codebase.

Source-of-truth docs:

- `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`
- `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`

## 1. Goals

The backend test strategy now has six practical layers:

1. fast unit and mocked integration tests for daily development
2. real Postgres smoke for auth, publish, and canonical data updates
3. queued crawl runtime proof for background ingestion
4. seeded HTTP smoke for user-facing routes
5. local SMB load proof for user-facing latency and throughput
6. local recovery, queue, and shadow-database drills for operational confidence

Important role-testing principle:

- the product remains merchant-first and admin-curated
- the runtime role model is now simplified to:
  - `USER`
  - `ADMIN`
- tests should prove both the role boundary and the restaurant-scope boundary

## 2. Current Test Layers

```text
Browser E2E                Implemented for critical paths
Local SMB load proof       Implemented
Seeded read-path smoke     Implemented
Real Postgres smoke        Implemented
Queued crawl smoke         Implemented
Mocked integration         Current baseline
Unit tests                 Current baseline
```

### Current baseline

- unit tests for services, parsers, validation, and domain helpers
- mocked integration tests for controller and request/response behavior
- auth integration for cookie plus CSRF handshake
- auth integration for body-token refresh, refresh-failure cookie clearing, and forgot/reset controller contracts
- service-level auth lifecycle coverage for refresh rotation, reuse handling, forgot-password, and reset-password
- publish-path coverage for canonical review reuse
- admin-intake service and repository coverage for durable audit events plus review/publish lineage fields
- admin-access integration coverage for durable membership assignment/removal audit behavior
- review-crawl and review-ops service coverage for durable crawl-source mutation audit behavior
- queue/runtime coverage for BullMQ-safe job ids and worker lifecycle
- role-boundary integration coverage for `USER` versus `ADMIN`
- admin restaurant overview coverage for the new admin discovery flow and restaurant-specific source-submission work item wiring
- restaurant service coverage for merchant `sourceSubmission` state and timeline/history derivation
- dashboard service coverage for merchant action summary, top issue enrichment, and evidence-backed action-card derivation
- restaurant entitlement coverage for backend-owned free/premium capability policy on restaurant reads, merchant actions, crawl-source defaults, and admin entitlement updates
- restaurant integration coverage for Google Maps-only merchant URL validation plus create/update response contract
- restaurant integration coverage for durable `RestaurantSourceSubmission` create, update, and clear behavior plus best-effort persistence when Google Maps resolution is temporarily unavailable
- restaurant integration coverage for `GET /api/restaurants/:id/source-submission/history` and durable audit snapshot reconstruction across source replace/clear flows
- restaurant source-preview integration coverage for canonical place resolution, same-restaurant duplicate detection, and cross-restaurant shared-identity hints
- admin source-submission queue integration coverage for deduped canonical-place grouping, actionable work-item summaries, explicit resolve actions, explicit create-source actions, explicit scheduling-lane triage actions, and lease-based `claim-next` behavior for deduped groups
- review-crawl service coverage for source creation directly from persisted canonical identity without re-calling Google
- review-crawl service coverage for scheduler bootstrap of canonical-ready source submissions into crawl-source linking plus initial queued runs while respecting internal `PRIORITY` lane ordering, explicit auto-bootstrap per-tick backpressure, and full-disable behavior
- admin access integration coverage for users, memberships, and account lifecycle
- admin platform integration coverage for health, policies, audit, runtime controls, and merchant source auto-bootstrap policy exposure
- backend test teardown now closes review-crawl queue resources so targeted integration runs do not leak BullMQ/Redis handles or hanging `node --test` processes
- latest targeted backend regression on `2026-03-27` passed:
  - `45/45` for `test/dashboard.service.test.js test/restaurant.service.test.js test/restaurants.integration.test.js test/admin-restaurants.integration.test.js test/review-crawl.service.test.js`
  - after the stable restaurant-entitlement slice landed
  - before the fresh-baseline real-DB reruns
- release-evidence harness coverage now includes:
  - `managed-redis-proof.js` for BullMQ compatibility against a supplied Redis URL
  - `staging-api-proof.js` for authenticated merchant/admin smoke against a supplied staging API base URL
  - `staging-performance-proof.js` for authenticated merchant read-path latency against the deployed staging API
  - `staging-review-ops-proof.js` for deployed admin queue, run, and materialization flow against an existing seeded source
  - `performance-proof.js` for bundled merchant-read load, Redis worker-pressure load, and optional scale-estimate evidence
  - `staging-recovery-drill.js --source-mode existing` for staging-safe restore rehearsal without reseeding the source DB
  - `release-evidence.js` for a combined managed release-evidence report

### Real-data coverage already in place

- `npm run db:seed`
- `npm run test:realdb`
- full `npm run test:realdb` now resets and reseeds the local baseline before each `.realdb.test.js` file so shared Postgres state does not leak across files
- `npm run load:merchant-reads -- --extra-reviews 4000 --concurrency 8 --rounds 45 --output load-reports/merchant-reads-smb-local.json`
- `npm run load:review-crawl-workers -- --source-count 24 --concurrency 4 --pages-per-run 12 --reviews-per-page 20 --step-ms 40 --output load-reports/review-crawl-workers-smb-local.json`
- `npm run smoke:review-ops-sync-draft -- --url "..."` for operator-triggered queue proof
- `npm run smoke:review-crawl-queue -- --url "..."` for queue-backed crawl proof
- `npm run smoke:recovery-drill`
- `npm run smoke:staging-recovery-drill`
- `npm run db:reset:local-baseline`
- `test/merchant-read.realdb.test.js` for end-to-end user-facing HTTP proof on seeded Postgres
- do not run baseline-resetting real-DB commands in parallel against the same local database; `db:reset:local-baseline`, direct `merchant-read.realdb.test.js`, and `npm run test:realdb` are intentionally exclusive
- a real regression was observed on `2026-03-27` when `merchant-read.realdb.test.js` and `npm run test:realdb` overlapped:
  - failures looked like missing tables or older columns
  - root cause was concurrent ownership of the same local Postgres baseline, not a schema defect
- latest merchant source-submission verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && npm run db:generate`
  - `cd D:\Project 3\backend-sentify && npm run db:validate`
  - `cd D:\Project 3\backend-sentify && node --test test/restaurant.service.test.js test/restaurants.integration.test.js`
  - `cd D:\Project 3\backend-sentify && node --test test/admin-restaurants.integration.test.js test/review-crawl.service.test.js`
  - `cd D:\Project 3\backend-sentify && $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js`
  - `cd D:\Project 3\backend-sentify && npm run db:reset:local-baseline`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb`
  - result:
    - restaurant contract + history suite: `21/21 passed`
    - admin queue + scheduler snapshot suite: `20/20 passed`
    - targeted real-DB merchant ingress + queue + history suite: `8/8 passed`
    - fresh-baseline real-DB suite: passed
    - real-DB runner isolation: per-file migrated+seeded baseline reset
- latest merchant source-submission timeline verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && node --test test/admin-restaurants.integration.test.js test/restaurant.service.test.js test/restaurants.integration.test.js`
  - `cd D:\Project 3\backend-sentify && npm run db:reset:local-baseline`
  - `cd D:\Project 3\backend-sentify && $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb`
  - result:
    - combined admin/merchant timeline contract suite: `26/26 passed`
    - `merchant-read.realdb.test.js`: `7/7 passed`
    - `npm run test:realdb`: passed
  - seed resilience: `prisma/seed-data.js` now retries on local Postgres deadlock so the isolated per-file baseline reset does not make `test:realdb` flaky
- latest merchant source-submission history verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && node --test test/restaurant.service.test.js test/restaurants.integration.test.js` -> `21/21 passed`
  - `cd D:\Project 3\backend-sentify && node --test test/admin-restaurants.integration.test.js test/review-crawl.service.test.js` -> `20/20 passed`
  - `cd D:\Project 3\backend-sentify && $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js` -> `8/8 passed`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
  - proof focus:
    - durable `sourceSubmissionSnapshot` enrichment on merchant/admin/scheduler audit writes
    - `GET /api/restaurants/:id/source-submission/history`
    - cross-attempt history surviving URL replacement and clear operations
- latest merchant actions verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && node --test test/dashboard.service.test.js test/dashboard.integration.test.js`
  - `cd D:\Project 3\backend-sentify && npm run db:reset:local-baseline`
  - `cd D:\Project 3\backend-sentify && $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb`
  - result:
    - merchant actions unit + mocked integration suite: `4/4 passed`
    - targeted real-DB merchant dashboard suite: `8/8 passed`
    - fresh-baseline real-DB suite: passed
  - proof focus:
    - `GET /api/restaurants/:id/dashboard/actions`
    - backend-owned merchant action summary state
    - evidence-backed top-issue enrichment and action-card payloads derived from canonical published reviews
- latest merchant entitlement verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && node --test test/dashboard.service.test.js test/restaurant.service.test.js test/restaurants.integration.test.js test/admin-restaurants.integration.test.js test/review-crawl.service.test.js` -> `45/45 passed`
  - `cd D:\Project 3\backend-sentify && npm run db:reset:local-baseline` -> passed
  - `cd D:\Project 3\backend-sentify && $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js` -> `9/9 passed`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
  - proof focus:
    - `RestaurantEntitlement.planTier` as the only persisted merchant-facing plan truth
    - restaurant list/detail responses now include entitlement plus effective capability policy
    - `GET /api/restaurants/:id/dashboard/actions` now returns entitlement-derived capabilities
    - default crawl-source sync cadence now derives from entitlement
    - `PATCH /api/admin/restaurants/:id/entitlement` updates plan tier and re-aligns entitlement-default pending source-submission lanes
- latest merchant source-preview verification on `2026-03-27`:
  - same combined targeted suite as above
  - verified recommendation/dedupe preview paths plus unresolved-save fallback, persisted submission delete-on-clear behavior, explicit persisted submission states (`PENDING_IDENTITY_RESOLUTION`, `READY_FOR_SOURCE_LINK`, `LINKED_TO_SOURCE`), admin queue grouping by canonical place identity, operator re-resolution, and crawl-source linking from persisted canonical identity
  - full `test:realdb`: passed
- latest scheduler bootstrap verification on `2026-03-27`:
  - `cd D:\Project 3\backend-sentify && node --test test/review-crawl.service.test.js`
  - `cd D:\Project 3\backend-sentify && node --test test/admin-platform.integration.test.js`
  - `cd D:\Project 3\backend-sentify && node --test test/review-crawl.worker-runtime.test.js`
  - `cd D:\Project 3\backend-sentify && npm run test:realdb`
  - verified:
    - canonical-ready merchant submissions are processed before due-source scans when scheduler capacity is limited
    - platform controls can fully disable merchant source auto-bootstrap without blocking already-linked due-source scans
    - platform controls can cap merchant source auto-bootstrap throughput per scheduler tick before remaining scheduler capacity is handed back to due-source scans
    - admin platform policies expose the merchant-ingress auto-bootstrap enable/disable and backpressure knobs directly
    - runtime `PRIORITY` lane maps to `HIGH` crawl-run priority during automatic bootstrap
    - fresh-baseline real-DB suite stayed green after the scheduler slice
- latest release-evidence verification on `2026-03-28`:
  - `cd D:\Project 3\backend-sentify && node --test test/env.test.js test/managed-signoff-preflight.test.js test/release-evidence.test.js test/admin-platform.integration.test.js` -> `11/11 passed`
  - `cd D:\Project 3\backend-sentify && node --test test/release-evidence.test.js test/admin-platform.integration.test.js` -> `7/7 passed`
  - `cd D:\Project 3\backend-sentify && node scripts/staging-api-proof.js --base-url http://127.0.0.1:3000 --user-email demo.user.primary@sentify.local --user-password DemoPass123! --admin-email demo.admin@sentify.local --admin-password DemoPass123! --output load-reports/staging-api-proof-local.json` -> `STAGING_PROOF_COMPLETE`
  - `cd D:\Project 3\backend-sentify && node scripts/performance-proof.js --output load-reports/performance-proof-local.json --scale-url https://maps.app.goo.gl/yWeP9xmjowpkYVbU7` -> `PERFORMANCE_PROOF_COMPLETE`
  - `cd D:\Project 3\backend-sentify && node scripts/staging-recovery-drill.js --source-mode existing --restaurant-slug demo-quan-pho-hong --output load-reports/staging-recovery-drill-managed.json` -> `restoredMatchesSource=true`
  - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --managed-redis-url redis://127.0.0.1:6379 --staging-api-url http://127.0.0.1:3000 --staging-user-email demo.user.primary@sentify.local --staging-user-password DemoPass123! --staging-admin-email demo.admin@sentify.local --staging-admin-password DemoPass123! --include-performance-proof --performance-scale-url https://maps.app.goo.gl/yWeP9xmjowpkYVbU7` -> `COMPATIBILITY_PROOF_COMPLETE` with `managedEnvProofStatus=MANAGED_SIGNOFF_PENDING`
  - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --managed-redis-url redis://127.0.0.1:6379 --staging-api-url http://127.0.0.1:3000 --staging-user-email demo.user.primary@sentify.local --staging-user-password DemoPass123! --staging-admin-email demo.admin@sentify.local --staging-admin-password DemoPass123! --include-performance-proof --performance-scale-url https://maps.app.goo.gl/yWeP9xmjowpkYVbU7 --require-managed-signoff` -> expected non-zero exit because targets are still local and no managed DB artifact was attached
  - `cd D:\Project 3\backend-sentify && node scripts/managed-db-proof-validate.js --artifact docs/examples/managed-db-proof-artifact.example.json --output load-reports/managed-db-proof-validation-example.json` -> `MANAGED_DB_PROOF_COMPLETE`
  - `cd D:\Project 3\backend-sentify && node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.json` -> `MANAGED_SIGNOFF_PENDING` with blocker list on the current local env
  - `cd D:\Project 3\backend-sentify && node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json` after filling a real external managed Redis URL -> `MANAGED_SIGNOFF_PENDING` with remaining blockers now reduced to staging API URL, staging merchant/admin credentials, and the managed DB proof artifact
  - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --managed-redis-url redis://127.0.0.1:6379 --staging-api-url http://127.0.0.1:3000 --staging-user-email demo.user.primary@sentify.local --staging-user-password DemoPass123! --staging-admin-email demo.admin@sentify.local --staging-admin-password DemoPass123! --managed-db-proof-artifact docs/examples/managed-db-proof-artifact.example.json --include-performance-proof --performance-scale-url https://maps.app.goo.gl/yWeP9xmjowpkYVbU7 --require-managed-signoff` -> expected non-zero exit with `managedDbProof=PASSED` because the remaining blockers were still local Redis and local staging API targets
  - `cd D:\Project 3\backend-sentify && node --test test/admin-platform.integration.test.js` -> `4/4 passed`, including stale-proof regression coverage for local artifacts, heavy bundle artifacts, and preflight artifacts
  - proof focus:
    - authenticated merchant and admin read smoke beyond plain health endpoints
    - isolated Redis worker-pressure proof without queue collision or inline-path double processing
    - existing-source restore/rollback proof on a larger dirty local slice
    - single release artifact joining Redis, recovery, staging API, and performance evidence
  - current caveat:
    - this green bundle still used local Memurai `7.2.5` and local API base URL `http://127.0.0.1:3000`
    - repeat the same commands with real managed Redis and deployed staging URLs for external release sign-off
    - optional skipped checks now stay non-degrading, so `managedDbProof=SKIPPED` no longer downgrades the local compatibility artifact by itself
    - Render plus Neon staging is now real and verified; the only strict managed-signoff blocker left is the provider-managed DB proof artifact
- latest external staging verification on `2026-03-28`:
  - staging backend:
    - Render URL: `https://sentify-2fu0.onrender.com`
    - `/health`: `200`
    - `/api/health`: `{"status":"ok","db":"up"}`
  - staging database:
    - Neon direct connection was used for deploy-safe migration and seed
    - `npm run db:migrate:deploy`: passed against staging
    - `node prisma/seed.js`: passed against staging
  - staging proof accounts:
    - merchant: `demo.user.primary@sentify.local`
    - admin: `demo.admin@sentify.local`
    - password used for proof: `DemoPass123!`
  - deployed staging auth smoke:
    - `cd D:\Project 3\backend-sentify && node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com --output load-reports/staging-api-proof-managed.json` -> `STAGING_PROOF_COMPLETE`
    - proof focus:
      - root health endpoint
      - API health endpoint
      - merchant authenticated read smoke
      - admin authenticated control-plane smoke
  - strict managed-signoff preflight after wiring Render plus Neon:
    - `cd D:\Project 3\backend-sentify && node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json` -> `MANAGED_SIGNOFF_READY`
  - live managed DB restore drill status:
    - staging review count before damage: `16`
    - deleted review for restore proof:
      - `id = 81c35358-64de-485e-9e8a-febbf07c7631`
      - `externalId = source-review:v1:google_maps:demo-phohong-published-001`
    - checkpoint used for provider restore target:
      - `2026-03-28T16:27:40.000Z`
    - review count after delete: `15`
  - managed DB proof completion:
    - Neon restored the staging branch to `2026-03-28T16:27:00.000Z`
    - restored review count returned to `16`
    - deleted review `81c35358-64de-485e-9e8a-febbf07c7631` was present again
    - `cd D:\Project 3\backend-sentify && node scripts/managed-db-proof-validate.js --artifact load-reports/managed-db-proof-staging.json --output load-reports/managed-db-proof-validation-staging.json` -> `MANAGED_DB_PROOF_COMPLETE`
  - strict managed sign-off completion:
    - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --require-managed-signoff --output load-reports/managed-release-evidence.latest.json` -> `COMPATIBILITY_PROOF_COMPLETE`
    - `managedEnvProofStatus = MANAGED_SIGNOFF_COMPLETE`
  - staging timeout hardening for free-tier hosts:
    - `release-evidence.js` now accepts `--staging-timeout-ms`
    - env fallback added:
      - `RELEASE_EVIDENCE_STAGING_TIMEOUT_MS`
    - current staging proof env uses `60000` to tolerate Render free cold starts
  - env/runtime caveat:
    - `.env.example` and `.env.release-evidence.example` are now intentionally split
    - `JWT_SECRET_PREVIOUS=` may be left blank safely after the env parser fix proved by `test/env.test.js`
- latest post-redeploy staging rerun on `2026-03-29`:
  - first rerun after the Render redeploy:
    - `curl.exe -sS https://sentify-2fu0.onrender.com/health` -> `{"status":"ok"}`
    - `curl.exe -sS https://sentify-2fu0.onrender.com/api/health` -> `{"status":"unavailable","db":"down"}`
    - `cd D:\Project 3\backend-sentify && node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com --output load-reports/staging-api-proof-managed.json` -> `STAGING_PROOF_FAILED`
    - root cause from Render logs:
      - `TRUST_PROXY=true` triggered `ERR_ERL_PERMISSIVE_TRUST_PROXY`
  - rerun after fixing Render env to `TRUST_PROXY=1`:
    - `curl.exe -sS https://sentify-2fu0.onrender.com/health` -> `{"status":"ok"}`
    - `curl.exe -sS https://sentify-2fu0.onrender.com/api/health` -> `{"status":"ok","db":"up"}`
    - `cd D:\Project 3\backend-sentify && node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com --output load-reports/staging-api-proof-managed.json` -> `STAGING_PROOF_COMPLETE`
  - `cd D:\Project 3\backend-sentify && node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json` -> `MANAGED_SIGNOFF_READY`
  - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --require-managed-signoff --output load-reports/managed-release-evidence.latest.json` -> `COMPATIBILITY_PROOF_COMPLETE` with `managedEnvProofStatus=MANAGED_SIGNOFF_COMPLETE`
  - interpretation:
    - managed sign-off inputs and historical artifacts remained present throughout
    - live staging runtime is green again after the `TRUST_PROXY=1` fix
  - freshness rule:
    - release readiness should only be trusted while artifacts are fresh
    - default freshness windows are `24h` for required local proof and `72h` for managed proof artifacts
    - override via `ADMIN_PLATFORM_LOCAL_PROOF_MAX_AGE_HOURS` and `ADMIN_PLATFORM_MANAGED_PROOF_MAX_AGE_HOURS` when needed
  - external staging read-performance verification on `2026-03-29`:
  - command:
    - `cd D:\Project 3\backend-sentify && node scripts/staging-performance-proof.js --output load-reports/staging-performance-proof-managed.json`
  - artifact:
    - `load-reports/staging-performance-proof-managed.json`
  - result:
    - `overallStatus = STAGING_PERFORMANCE_PROOF_COMPLETE`
    - `40` authenticated merchant read requests
    - `0%` error rate
    - `p95 = 899.53ms`
    - `3.37 req/s`
  - measured scope:
    - `restaurants.list`
    - `restaurant.detail`
    - `reviews.page`
    - `reviews.rating`
    - `dashboard.kpi`
    - `dashboard.sentiment`
    - `dashboard.trend`
    - `dashboard.complaints`
    - `dashboard.topIssue`
    - `dashboard.actions`
  - caveat:
    - this is an HTTP read-path proof only
    - it intentionally does not replace the local Redis worker-pressure proof because Render free staging is not a reliable worker-throughput benchmark
- external staging operator queue verification on `2026-03-29`:
  - command:
    - `cd D:\Project 3\backend-sentify && node scripts/staging-review-ops-proof.js --output load-reports/staging-review-ops-proof-managed.json`
  - result against the currently deployed Render baseline:
    - failed after the seeded source's active run remained `QUEUED` for more than `305000ms`
  - supporting control-plane evidence:
    - `GET /api/admin/platform/health-jobs` returned:
      - queue `HEALTHY`
      - workers `DEGRADED`
      - `scheduler = null`
      - `processors = []`
  - repo-level root cause and fix:
    - `src/server.js` was not booting `startReviewCrawlWorkerRuntime()` for the Render web service
    - the codebase now starts review-crawl runtime from `src/server.js` whenever Redis is configured and inline mode is off
  - next proof step:
    - redeploy Render staging
    - rerun `proof:staging-review-ops`
- latest full backend-suite verification on `2026-03-29`:
  - `cd D:\Project 3\backend-sentify && npm test` -> passed (`184` tests: `171` pass, `13` skipped, `0` fail)
  - `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
  - proof focus:
    - full mocked/unit/integration suite is green alongside real-DB smoke
    - managed-signoff preflight coverage no longer leaks workstation-local `.env.release-evidence`
    - env loader override hooks now exist for test isolation:
      - `SENTIFY_RUNTIME_ENV_FILE`
      - `SENTIFY_RELEASE_EVIDENCE_ENV_FILE`
    - env config now also rejects permissive `TRUST_PROXY=true` values in tests and runtime config parsing
- freshest backend and browser rerun on `2026-03-28`:
  - `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
  - `cd D:\Project 3\backend-sentify && node --test test/admin-platform.integration.test.js` -> `4/4 passed`
  - `cd D:\Project 3\backend-sentify && node --test test/managed-db-proof-validate.test.js test/admin-platform.integration.test.js` -> `4/4 passed`
  - `cd D:\Project 3\backend-sentify && node --test test/managed-signoff-preflight.test.js test/managed-db-proof-validate.test.js test/admin-platform.integration.test.js` -> `6/6 passed`
  - `cd D:\Project 3\apps\web && npx playwright install chromium` -> browser runtime installed successfully on this workstation
  - `cd D:\Project 3\apps\web && npm run build` -> passed
  - `cd D:\Project 3\apps\web && npm run test:run -- test/App.test.tsx test/api.test.ts` -> `10/10 passed`
  - `cd D:\Project 3\apps\web && npx playwright test e2e --workers=1` -> `12/12 passed`
  - `cd D:\Project 3\apps\web && npx playwright test e2e/admin-platform-controls.spec.ts --workers=1` -> `1/1 passed`
  - `cd D:\Project 3\apps\web && npx playwright test e2e/admin-critical-path.spec.ts e2e/admin-platform-controls.spec.ts --workers=1` -> `2/2 passed`
  - proof focus:
    - browser suite owned a real isolated stack:
      - FE preview `127.0.0.1:4173`
      - API `127.0.0.1:3100`
      - queue `review-crawl-playwright`
    - admin and user flows both passed on the same fresh baseline
  - operational note:
    - a red `release-evidence` run with `ECONNREFUSED 127.0.0.1:3000` was observed before the local API stack was started
    - rerunning the same command after the target API became healthy returned `COMPATIBILITY_PROOF_COMPLETE`, so that earlier red result should be treated as target-unavailable evidence, not an application-contract regression
    - after the release-readiness semantics changed, the admin-platform integration suite plus targeted admin browser proofs were rerun to confirm the new compatibility/sign-off fields did not break backend or FE flows
    - use `managed-signoff-preflight.js` first when you want a fast blocker report before committing several minutes to the full bundle

Browser E2E entry point:

```powershell
cd "D:\Project 3\apps\web"
npx playwright test e2e --workers=1
```

That command now owns an isolated real stack by default:

- resets the local baseline unless `PLAYWRIGHT_SKIP_DB_RESET=1`
- starts the browser-facing Vite server on `http://127.0.0.1:4173`
- starts an isolated backend API on `http://127.0.0.1:3100`
- starts an isolated review-crawl worker namespace with queue `review-crawl-playwright`
- tears down the isolated API and worker after the suite unless `PLAYWRIGHT_PRESERVE_BACKEND_STACK=1`

Most reliable local rerun path for the two most concurrency-sensitive browser proofs on this Windows workstation:

```powershell
cd "D:\Project 3\apps\web"
node .\scripts\playwright-preview.js --host 127.0.0.1 --port 4173 --strictPort
```

Then, in a second terminal:

```powershell
cd "D:\Project 3\apps\web"
npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line
```

That preview-reuse path matters because the dual-session proofs are sensitive to frontend preview port churn on repeated local reruns.

Current browser-critical-path proof:

- `USER`: login, merchant app landing, `Home`, `Reviews`, `Actions`, `Settings`, settings update, admin-route deny, logout
- `ADMIN`: login, admin hub landing, live `Operations`, `Access`, and `Platform` screens, merchant-route deny, logout
- access lifecycle: admin can reset a user password, promote the user to `ADMIN`, and the promoted user can log into the admin shell
- membership scope: admin membership changes the merchant-visible restaurant scope end-to-end
- platform guardrail: `intakePublishEnabled=false` blocks publish from the browser review-ops flow
- publication chain: merchant saves a Google Maps URL, admin syncs to draft, approves valid items, publishes, and merchant sees refreshed published data
- concurrent source handoff: merchant and admin stay live in separate browser sessions while that Google Maps source moves through sync, approval, and publish
- intake/review guardrails: invalid non-Google source URLs are rejected and publish remains blocked until approval exists
- manual intake full flow: admin creates a draft batch, adds evidence, curates it, approves it, publishes it, and the new evidence becomes merchant-visible
- concurrent live publish: a merchant stays logged into the reviews surface while an admin manually curates and publishes a draft, then sees the new evidence after a same-session refresh
- crawl operations full flow: admin previews a seeded Google Maps source, upserts it from the crawl screen, creates a run, waits for crawl completion, materializes the run into intake, and verifies the resulting draft batch is approvable
- runner policy: the suite intentionally stays on `--workers=1` because the specs still mutate shared seeded restaurants, platform controls, and the isolated review-crawl queue state
- latest baseline run on `2026-03-27`: `12 passed` with `npx playwright test e2e --workers=1`
- latest dual-session rerun on `2026-03-27`: `2 passed` with the persistent-preview command pair above

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

Meaning:

- `*.service.test.js`: business logic
- `*.controller.test.js`: validation and error mapping
- `*.integration.test.js`: mocked HTTP behavior
- `*.realdb.test.js`: smoke or integration proof on real Postgres

Current real-DB suite:

- `auth.realdb.test.js`: register -> session cookie -> refresh rotation -> logout proof
- `duplicate-publish.realdb.test.js`: same source review across multiple batches must reuse canonical review rows and keep insight totals stable
- `publish.realdb.test.js`: publish -> canonical review -> dashboard refresh -> durable `ReviewPublishEvent` lineage rows
- `merchant-read.realdb.test.js`: user-facing route -> auth -> service -> Prisma proof, plus `USER` versus `ADMIN` boundaries and admin restaurant overview smoke
- `merchant-read.realdb.test.js`: also proves admin queue consumption by linking a merchant source submission into a real crawl source, by escalating a submission into the `PRIORITY` scheduling lane, and by preserving/resetting lease state correctly when a merchant re-saves the same URL versus changes it on fresh baseline data
- `merchant-read.realdb.test.js`: now also proves the audit-backed `source-submission/history` endpoint survives submit -> replace URL -> clear URL on real Postgres data
- `restaurant.service.test.js`: proves milestone ordering, current-step derivation, fallback `LIVE` history when currently reviewing new evidence, and dataset-backed live detection when the active source links after older published Google Maps data already exists
- `restaurants.integration.test.js`: proves create/update/clear responses include the merchant-facing `sourceSubmission.timeline` contract, that clearing the URL resets timeline state without leaking prior progress events, and that the dedicated history endpoint returns durable attempt/event records with snapshot metadata
- `merchant-read.realdb.test.js`: proves seeded merchant detail responses expose `sourceSubmission.timeline` in both `REVIEWING` and `SUBMITTED` states on real Postgres data
- `review-crawl.service.test.js`: now also proves scheduler bootstrap from canonical-ready merchant submissions into crawl-source linking plus initial queued runs, ahead of due-source scanning when capacity is limited, while honoring explicit platform-managed enable/disable and per-tick backpressure controls

Current auth-lifecycle service suite:

- `refresh-token.service.test.js`
- `password-reset.service.test.js`

Current role and route boundary suite:

- `data-isolation.integration.test.js`
- `admin-restaurants.integration.test.js`
- `auth.integration.test.js`

## 4. Shared Seed Dataset

The shared seed currently provides:

- 2 restaurants
- 5 users:
  - 3 `USER` accounts with restaurant membership
  - 1 `USER` outsider without restaurant membership
  - 1 `ADMIN` operator
- 2 published baseline batches
- 1 open Google Maps crawl draft batch
- 1 queued-crawl audit trail with raw reviews
- 1 invalid raw review example

This dataset must support:

- user-facing dashboard demo
- review evidence demo
- admin curation demo
- publish smoke
- role-boundary smoke
- user-flow versus admin-flow verification

## 5. Commands

Fast suite:

```powershell
cd "D:\Project 3\backend-sentify"
npm test
```

Seed local database:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:seed
```

Real Postgres smoke:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm run db:seed
npm run test:realdb
```

Targeted backend regression for audit, lineage, and platform teardown:

```powershell
cd "D:\Project 3\backend-sentify"
node --test test/admin-intake.service.test.js test/admin-intake.repository.test.js
node --test test/review-crawl.service.test.js test/review-ops.service.test.js
node --test test/admin-access.integration.test.js test/admin-platform.integration.test.js
npm run db:reset:local-baseline
npm run test:realdb
```

Release-evidence verification:

```powershell
cd "D:\Project 3\backend-sentify"
node scripts/managed-redis-proof.js --redis-url "redis://127.0.0.1:6379"
node scripts/staging-recovery-drill.js --source-mode existing --restaurant-slug "demo-quan-pho-hong" --output "load-reports/staging-recovery-drill-managed.json"
node scripts/release-evidence.js --source-mode existing --restaurant-slug "demo-quan-pho-hong" --managed-redis-url "redis://127.0.0.1:6379"
```

Latest local proof on `2026-03-27`:

- managed BullMQ probe: passed
- existing-source backup, restore, and rollback rehearsal: passed
- bundled release-evidence status: `MANAGED_PROOF_PARTIAL`
- open gap in that bundle: deployed staging API health probe was skipped because no staging base URL was provided

Queued crawl smoke:

```powershell
cd "D:\Project 3\backend-sentify"
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\redis-server.exe
npm run smoke:review-crawl-queue -- --url "https://maps.app.goo.gl/..."
```

Operator-triggered queue smoke:

```powershell
cd "D:\Project 3\backend-sentify"
set REVIEW_CRAWL_REDIS_BINARY=D:\tools\memurai.exe
node scripts/review-ops-sync-draft-smoke.js --url "https://maps.app.goo.gl/..." --strategy incremental
```

Latest dual-role concurrency rerun on `2026-03-27`:

```powershell
cd "D:\Project 3\apps\web"
npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line
```

- result: `2/2 passed`
- current harness also auto-started the isolated backend stack and managed frontend preview during that rerun, so the direct command is healthy again on this workstation
- keep the manual `playwright-preview.js` reuse path as fallback only if local port `4173` gets sticky again after an interrupted run

Local SMB load proof:

```powershell
cd "D:\Project 3\backend-sentify"
npm run load:merchant-reads -- --extra-reviews 4000 --concurrency 8 --rounds 45 --output load-reports/merchant-reads-smb-local.json
npm run load:review-crawl-workers -- --source-count 24 --concurrency 4 --pages-per-run 12 --reviews-per-page 20 --step-ms 40 --output load-reports/review-crawl-workers-smb-local.json
```

Recovery drills:

```powershell
cd "D:\Project 3\backend-sentify"
npm run smoke:recovery-drill
npm run smoke:staging-recovery-drill
```

## 6. Minimum Evidence

| Area | Minimum expected evidence |
|---|---|
| Auth | register, login, logout, session, invalid token, expired token, refresh rotation and reuse detection, forgot/reset password lifecycle |
| CSRF | issue cookie, missing token -> `403`, correct token -> success |
| User flow role boundary | `USER` can use `/api/restaurants/*`; `ADMIN` gets `403` there |
| Restaurant scope boundary | member can read own restaurant; outsider gets `404` |
| Admin flow role boundary | `USER` gets `403` on `/api/admin/*`; `ADMIN` is allowed |
| User-facing routes | seeded `GET /api/restaurants`, `/:id`, `/:id/reviews`, KPI, sentiment, trend, complaints, top issue |
| Merchant actions | `GET /api/restaurants/:id/dashboard/actions` proves backend-owned action summary, top-issue enrichment, and evidence-backed action-card payloads |
| Admin overview flow | `GET /api/admin/restaurants` and `GET /api/admin/restaurants/:id` expose restaurant discovery plus combined `userFlow` and `adminFlow` overview |
| Admin access | `GET /api/admin/users`, `POST /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/role`, `PATCH /api/admin/users/:id/account-state`, `POST /api/admin/users/:id/password-reset`, `GET/POST/DELETE /api/admin/memberships*` |
| Admin platform | `GET /api/admin/platform/health-jobs`, `GET /api/admin/platform/integrations-policies`, `GET /api/admin/platform/audit`, `PATCH /api/admin/platform/controls` |
| Admin intake | create, add, update, delete, publish, duplicate reuse |
| Review crawl | source upsert, queued run, worker processing, materialize-intake |
| Review ops | sync-to-draft, source list, run detail, readiness, approve-valid, publish |
| Performance | local SMB read-load report and worker-pressure report for high-risk backend changes |
| Ops | `/health`, `/api/health`, migrations, seed, worker startup, local logical recovery drill, shadow-database restore plus rollback rehearsal |

## 7. Remaining Gaps

The main testing gaps still left are:

  - deployed staging queue proof is now implemented, but the Render baseline still needs one redeploy to pick up the new server-side runtime bootstrap path before the proof can be rerun cleanly
  - real staging proof and managed-environment backup, restore, and rollback beyond local logical and shadow-database drills
- browser coverage still treats admin `Access` and `Platform` as critical-path structure checks, not full lifecycle execution
- browser coverage is still limited to first-wave critical paths and does not yet exercise deep intake publish or queue-backed crawl execution inside the browser

## 7.1 2026-03-28 Hardening Regressions

- `node --test test/restaurants.integration.test.js test/google-maps.service.test.js test/review-crawl.runtime.test.js` now covers:
  - merchant create/update rollback when audit insertion fails inside the transaction
  - browser-like Google Maps fetch timeout abort forwarding
  - review-page timeout enforcement
  - heartbeat-index reads with `SCAN` fallback and stale-member pruning
- `node --test test/restaurant.service.test.js test/review-crawl.service.test.js test/review-crawl.worker-runtime.test.js test/admin-platform.integration.test.js` reran green after the hardening changes
- `npm run test:realdb` reran green on the same pass
- `cd D:\Project 3\apps\web && npx playwright test e2e --workers=1` reran green after the hardening changes: `12/12 passed`
- local release-evidence rerun on `2026-03-28` in compatibility mode:
  - `managedRedis`: passed
  - `backupRestoreRollback`: passed
  - `stagingApi`: passed against `http://127.0.0.1:3000`
  - `performanceProof`: passed
  - `managedDbProof`: skipped
- latest local performance proof numbers from the same bundle:
  - merchant reads: `p95=50.95ms`, `309.46 req/s`, `0%` error rate
  - worker pressure: `1342.58 raw reviews/s`, `totalRunP95=4322ms`, `24/24` completed
  - scale estimate: target `20,000` reviews still fits the current leg budget, but completeness at that scale is still an estimate until proven against a comparable live source
- latest external staging read-performance numbers:
  - merchant reads over Render plus Neon staging: `p95=899.53ms`, `3.37 req/s`, `0%` error rate
  - interpretation:
    - the merchant read surface is healthy under light external concurrency
    - these numbers should not be compared directly to the local worker-pressure harness because the staging proof excludes queue throughput on purpose

## 8. Merge Gate

- `npm test` passes
- `npm run db:validate` passes
- any high-risk backend change ships with test or smoke evidence
- changes to publish or crawl runtime need real evidence, not only mocks
- role-boundary changes must prove:
  - `USER` allow on `/api/restaurants/*`
  - `USER` deny on `/api/admin/*`
  - `ADMIN` allow on `/api/admin/*`
  - `ADMIN` deny on `/api/restaurants/*`
- user-facing or worker performance changes should refresh the local load report or equivalent evidence
- source-of-truth docs stay synced when behavior changes
