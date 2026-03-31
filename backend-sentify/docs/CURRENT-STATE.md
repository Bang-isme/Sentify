# Sentify Backend Current State

Updated: 2026-04-01

This document describes the backend exactly as it exists in the current codebase.

## 1. Product Direction

The backend is aligned to a manual-first, merchant-first product:

- admin-curated intake is the only way new evidence enters the system
- publish is the only step that moves data into canonical `Review`
- user-facing dashboard and review APIs read only from canonical published data
- crawl runtime is an admin-side ingestion aid, not a user-triggered product flow

Important role clarification:

- business surface still has two actor groups: user-facing restaurant users and internal admins
- system roles are now simplified to exactly two values:
  - `User.role = USER`
  - `User.role = ADMIN`
- `RestaurantUser` is now a pure membership relation
- there is no secondary permission enum on restaurant membership anymore

In practice, this means:

- `/api/restaurants/*` is the user-facing surface for authenticated `USER` accounts that belong to the restaurant
- `/api/admin/*` is the internal control-plane surface for authenticated `ADMIN` accounts
- admin access no longer inherits from restaurant membership
- admin users are intentionally blocked from the user-facing restaurant routes

Current FE shell contract on top of that split:

- merchant app for `USER`
  - `/app`
  - `/app/reviews`
  - `/app/actions`
  - `/app/settings`
- admin app for `ADMIN`
  - `Operations` is backed now:
    - `/admin/operations/restaurants`
    - `/admin/operations/intake`
    - `/admin/operations/review-ops`
    - `/admin/operations/crawl`
  - `Access` is backed now:
    - `/admin/access/users`
    - `/admin/access/memberships`
  - `Platform` is backed now:
    - `/admin/platform/health-jobs`
    - `/admin/platform/integrations-policies`
    - `/admin/platform/audit`

## 2. Runtime Stack

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- BullMQ plus Redis for queued crawl jobs
- CommonJS runtime

The backend is a modular monolith. `admin-intake`, `review-crawl`, `review-ops`, and `admin-restaurants` are now clear backend feature modules. Auth and restaurant reads still use the older route-controller-service shape.

Recent architecture cleanup:

- shared restaurant source-submission and dataset-state helpers now live in `src/services/restaurant-state.service.js`
- merchant-facing source-submission timeline/history/read-model builders now live in `src/services/restaurant-source-submission-view.service.js`
- source-submission audit/history reconstruction helpers now live in `src/services/restaurant-source-submission-history.service.js`
- source-submission read-side query/fetch composition now lives in `src/services/restaurant-source-submission-read.service.js`
- source-submission write-side sync and audit helpers now live in `src/services/restaurant-source-submission-write.service.js`
- admin restaurant source-submission queue/read-write control-plane helpers now live in `src/modules/admin-restaurants/admin-restaurants-source-submission.service.js`
- review-crawl source-submission scheduler bootstrap now lives in `src/modules/review-crawl/review-crawl-source-submission-bootstrap.service.js`
- review-crawl canonical source upsert and mutation-audit persistence now lives in `src/modules/review-crawl/review-crawl-source-persistence.service.js`
- review-crawl intake materialization now lives in `src/modules/review-crawl/review-crawl-materialization.service.js`
- `admin-restaurants` and `review-crawl` no longer depend on `restaurant.service.__private` for cross-module logic
- `fetchIntakeSummary()` no longer synthesizes fake review items just to satisfy `buildDatasetStatus()`; it now returns real aggregate counts through `openBatchSummary`
- `restaurant.service.js` now focuses on restaurant orchestration, source-submission write path, and access-aware composition instead of owning every source-submission helper inline
- after the latest read-side and write-side extractions, `restaurant.service.js` is down to `476` lines and the source-submission seam is split across explicit state, view, read, and write modules instead of one large private-helper bag
- after the latest history extraction, `restaurant-source-submission-view.service.js` is down to `439` lines and now keeps only merchant-facing timeline plus payload composition while `restaurant-source-submission-history.service.js` owns audit snapshot parsing, attempt grouping, and history event reconstruction
- after the latest admin-restaurants extraction, `admin-restaurants.service.js` is down to `352` lines while `admin-restaurants-source-submission.service.js` now owns queue grouping, lease-aware claim-next, resolve, create-source, and scheduling-lane control-plane actions
- after the latest review-crawl extractions, `review-crawl.service.js` is now `1112` lines and the source-submission scheduler bootstrap seam, canonical source persistence/audit seam, plus intake materialization seam now sit behind explicit background-job modules instead of staying embedded inside run-processing orchestration

Runtime hardening now also includes:

- normalized runtime Postgres URLs with explicit `connect_timeout`, `statement_timeout`, and `idle_in_transaction_session_timeout` defaults when the connection string does not already define them
- explicit HTTP server `requestTimeout`, `headersTimeout`, and `keepAliveTimeout` guards
- fail-closed env validation so `HEADERS_TIMEOUT_MS` and `KEEP_ALIVE_TIMEOUT_MS` cannot be configured into an unsafe relationship
- shared Prisma and timeout error mapping so pool exhaustion, initialization failure, transaction conflicts, missing-record writes, foreign-key conflicts, and request timeouts no longer fall through as generic `500`
- slow-request logging on successful responses so latency regressions become visible before they become outages
- queue-health degradation and worker event logging for Redis/BullMQ runtime failures instead of silent hangs
- `/api/health` now stays lightweight by checking Postgres plus a bounded Redis `PING` instead of running BullMQ queue counts on the public readiness path
- heavy queue, Redis deployment-safety, and worker diagnostics stay on admin platform health surfaces instead of the public health route
- the default `npm test` path now preloads `scripts/runtime-env-bootstrap.js`, which keeps unit and mocked integration tests hermetic against workstation-local `.env` values such as external `REDIS_URL`

## 3. Current Role Model

### System roles

- `USER`
  - uses the user-facing product routes
  - must also belong to the target restaurant through `RestaurantUser`
- `ADMIN`
  - uses only the admin control-plane routes
  - does not need restaurant membership to inspect or operate on a restaurant

### Account lifecycle

`User` now carries explicit lifecycle state beyond role:

- `ACTIVE`
- `LOCKED`
  - manual admin lock via `manuallyLockedAt`
  - or auth lockout via `lockedUntil`
- `DEACTIVATED`
  - admin deactivation via `deactivatedAt`

Operational effect:

- locked accounts cannot log in or refresh sessions until unlocked
- deactivated accounts cannot log in or refresh sessions until reactivated
- admin lifecycle actions revoke sessions by bumping `tokenVersion` and revoking refresh tokens
- the last available `ADMIN` account cannot be locked, deactivated, or downgraded

### Flow split

#### User-facing flow

Endpoints:

- `PATCH /api/auth/profile`
- `POST /api/restaurants`
- `GET /api/restaurants`
- `GET /api/restaurants/:id`
- `PATCH /api/restaurants/:id`
- `POST /api/restaurants/:id/source-submission/preview`
- `GET /api/restaurants/:id/reviews`
- `GET /api/restaurants/:id/dashboard/*`

Behavior:

- update the authenticated user's own `fullName` or `email`
- create or select a restaurant
- submit only public Google Maps place URLs as merchant source input
- preview a Google Maps URL before saving it to resolve the canonical place identity and check duplicate-place hints
- read the backend-owned entitlement contract for that restaurant:
  - `planTier`
  - `effectivePolicy`
- inspect canonical dataset status
- inspect `sourceSubmission` status for the current Google Maps URL
- read KPI, sentiment, trend, complaints, top issue, merchant actions, and review evidence

#### Admin flow

Endpoints:

- `GET /api/admin/restaurants`
- `GET /api/admin/restaurants/source-submissions`
- `PATCH /api/admin/restaurants/:id/entitlement`
- `POST /api/admin/restaurants/source-submissions/:submissionId/resolve`
- `POST /api/admin/restaurants/source-submissions/:submissionId/create-source`
- `POST /api/admin/restaurants/source-submissions/:submissionId/scheduling-lane`
- `GET /api/admin/restaurants/:id`
- `GET /api/admin/review-batches*`
- `POST /api/admin/review-batches*`
- `PATCH /api/admin/review-items/:id`
- `POST /api/admin/review-crawl/*`
- `POST /api/admin/review-ops/*`
- `GET /api/admin/platform/controls`

Behavior:

- inspect all restaurants
- inspect or update the merchant-facing restaurant entitlement contract without leaking queue internals into FE
- read runtime controls through a dedicated admin platform endpoint instead of only through broader health or policy payloads
- inspect merchant source-submission queue items grouped by canonical place identity before crawl-source creation
- resolve or re-resolve a merchant-submitted Google Maps URL into canonical place identity
- create or link a restaurant-specific crawl source from persisted canonical place identity without forcing a second Google resolution
- move a merchant source submission between `STANDARD` and `PRIORITY` scheduling lanes without changing user-facing data
- let the review-crawl scheduler bootstrap canonical-ready merchant submissions into crawl sources plus an initial queued run when no active operator lease is blocking that deduped group
- review user-facing dataset status plus admin-side next actions
- curate intake batches
- run or inspect Google Maps crawl jobs
- sync crawl evidence into draft batches
- publish approved evidence into canonical reviews

## 4. What The Backend Already Has

### External staging proof status

- A real staging API is now live at `https://sentify-2fu0.onrender.com`.
- The deployed staging stack is currently:
  - Render web service for the API
  - Neon Postgres for the staging database
  - external managed Redis for release-evidence targeting
- Historical healthy staging proof on `2026-03-28`:
  - `GET /health` returned `200`
  - `GET /api/health` returned `200` with `{"status":"ok","db":"up"}`
  - `staging-api-proof-managed.json` reported `STAGING_PROOF_COMPLETE`
  - merchant authenticated read smoke passed
  - admin authenticated control-plane smoke passed
- A short-lived post-redeploy regression happened on `2026-03-29`:
  - `GET /health` still returned `200`
  - `GET /api/health` regressed to `503` with `{"status":"unavailable","db":"down"}`
  - `staging-api-proof-managed.json` regressed to `STAGING_PROOF_FAILED`
  - merchant authenticated read smoke failed with login `500`
  - admin authenticated control-plane smoke failed with login `500`
  - root cause:
    - Render had `TRUST_PROXY=true`
    - `express-rate-limit` rejected permissive trust-proxy mode with `ERR_ERL_PERMISSIVE_TRUST_PROXY`
  - fix:
    - set `TRUST_PROXY=1` on Render
    - repo baseline now also uses `TRUST_PROXY=1` in `render.yaml`
    - backend env parsing now rejects `TRUST_PROXY=true` so permissive trust-proxy config fails fast at startup
- Latest post-fix staging revalidation on `2026-03-29`:
  - `GET /health` returns `200`
  - `GET /api/health` returns `200` with `{"status":"ok","db":"up"}`
  - `staging-api-proof-managed.json` reports `STAGING_PROOF_COMPLETE`
  - merchant authenticated read smoke passed
  - admin authenticated control-plane smoke passed
- Latest post-public-readiness revalidation on `2026-04-01`:
  - `GET /health` returns `200`
  - `GET /api/health` returns `200` with `{"status":"ok","db":"up","redis":"up"}`
  - `staging-api-proof-managed.json` reports `STAGING_PROOF_COMPLETE`
  - `managed-release-evidence.latest.json` reports:
    - `overallStatus = COMPATIBILITY_PROOF_COMPLETE`
    - `managedEnvProofStatus = MANAGED_SIGNOFF_COMPLETE`
  - hosted `REVIEW_CRAWL_REQUIRE_SAFE_REDIS=true` is enabled on the active Render baseline
- Latest managed Redis durability check on `2026-03-31`:
  - `managed-redis-proof.latest.json` reports:
    - Redis version `8.4.0`
    - connectivity `PONG`
    - BullMQ enqueue/process/complete probe passed
    - `maxmemory-policy = noeviction`
    - `evictionPolicyStatus = PASSED`
    - `safeForBullMq = true`
  - interpretation:
    - the queue target is reachable, functionally compatible, and now BullMQ-safe for durability
  - historical direct config attempt against the managed instance before the provider-side fix:
    - `CONFIG SET maxmemory-policy noeviction`
    - result:
      - `ERR Unsupported CONFIG parameter: maxmemory-policy`
    - meaning:
      - runtime config commands were not sufficient on that managed instance
      - the successful fix came from provider-side configuration
  - current codebase behavior:
    - review-crawl queue health now exposes Redis deployment safety details to admin-platform
    - unsafe eviction policy degrades queue health instead of only logging a raw BullMQ warning
    - managed Redis proof now fails explicitly when eviction policy is not `noeviction`
    - `REVIEW_CRAWL_REQUIRE_SAFE_REDIS=true` now makes queued-run enqueue plus worker-runtime startup fail fast when Redis durability is not BullMQ-safe
    - queue health now also exposes:
      - `durabilityEnforced`
      - `durabilityBlocking`
- Historical strict managed-signoff posture proven on `2026-03-28`:
  - managed Redis target is configured and verified
  - staging API target is configured and verified
  - merchant and admin staging proof accounts are configured and verified
  - a provider-managed DB proof artifact now validates cleanly
  - `managed-release-evidence.latest.json` reports:
    - `overallStatus = COMPATIBILITY_PROOF_COMPLETE`
    - `managedEnvProofStatus = MANAGED_SIGNOFF_COMPLETE`
- Current live runtime posture on `2026-04-01`:
  - `managed-signoff-preflight.latest.json` reports `MANAGED_SIGNOFF_READY`
  - `managed-release-evidence.latest.json` reports:
    - `overallStatus = COMPATIBILITY_PROOF_COMPLETE`
    - `managedEnvProofStatus = MANAGED_SIGNOFF_COMPLETE`
  - live staging runtime remains green after the earlier Render `TRUST_PROXY=1` fix, the lightweight `/api/health` hardening, and hosted Redis durability enforcement
  - public readiness now returns:
    - `GET /api/health` -> `{"status":"ok","db":"up","redis":"up"}`
  - current required checks now evaluate as:
    - managed Redis proof: `PASSED`
    - backup/restore/rollback proof: `PASSED`
    - staging API proof: `PASSED`
    - managed DB proof artifact validation: `PASSED`
  - latest full runtime audit:
    - `node scripts/operational-health-check.js --refresh --output load-reports/operational-health-check.current.json`
    - `overallStatus = OPERATIONAL_HEALTH_COMPLETE`
    - dimensions:
      - `liveRuntime = PASS`
      - `adminControlPlane = PASS`
      - `operatorPathCorrectness = PASS`
      - `redisDurability = PASS`
      - `averageCaseRead = PASS`
      - `strongerConcurrencyRead = PASS`
    - current recommendation:
      - none
- Current provider-managed DB proof drill status:
  - the Neon restore or PITR drill is now completed for the current staging baseline
  - one demo review was intentionally deleted so the restore proof is meaningful
  - deleted review checkpoint:
    - `checkpointUtc = 2026-03-28T16:27:47.747Z`
    - `deletedReviewId = 81c35358-64de-485e-9e8a-febbf07c7631`
    - `deletedExternalId = source-review:v1:google_maps:demo-phohong-published-001`
    - `reviewsAfter = 15`
  - Neon restored the staging branch to `2026-03-28T16:27:00.000Z`
  - restored proof:
    - review count returned to `16`
    - deleted review id returned
  - proof artifacts:
    - `load-reports/managed-db-proof-staging.json`
    - `load-reports/managed-db-proof-validation-staging.json`
- Operational note:
  - the Neon database password was exposed during setup in chat
  - staging DB credentials have since been rotated and Render `DATABASE_URL` updated
- Current Render blueprint now makes runtime timeout defaults explicit instead of relying on implicit code defaults:
  - `REQUEST_TIMEOUT_MS=30000`
  - `HEADERS_TIMEOUT_MS=31000`
  - `KEEP_ALIVE_TIMEOUT_MS=5000`
  - `SLOW_REQUEST_THRESHOLD_MS=1000`
  - `DB_CONNECT_TIMEOUT_SECONDS=10`
  - `DB_STATEMENT_TIMEOUT_MS=15000`
  - `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS=15000`
- External staging HTTP read-performance proof on `2026-03-29`:
  - script:
    - `scripts/staging-performance-proof.js`
    - `scripts/operational-health-check.js`
  - average-case artifact:
    - `load-reports/staging-performance-proof-average.json`
  - stronger-concurrency artifact:
    - `load-reports/staging-performance-proof-strengthened.json`
  - aggregate artifact:
    - `load-reports/operational-health-check.current.json`
  - target:
    - Render staging API `https://sentify-2fu0.onrender.com`
    - merchant restaurant `demo-quan-pho-hong`
  - latest refreshed average-case result (`--concurrency 2 --rounds 20`):
    - `overallStatus = STAGING_PERFORMANCE_PROOF_COMPLETE`
    - `40` measured requests
    - `0%` error rate
    - `p50 = 712.07ms`
    - `p95 = 1245.79ms`
    - `p99 = 1507.52ms`
    - throughput `2.47 req/s`
    - `predictability.classification = VARIABLE`
    - current interpretation:
      - average authenticated merchant reads stay within the current pass/fail bar
      - this remains acceptable current evidence, not a claim of strong deterministic latency
  - latest refreshed stronger-concurrency result (`--concurrency 4 --rounds 30`):
    - `overallStatus = STAGING_PERFORMANCE_PROOF_COMPLETE`
    - `120` measured requests
    - `0%` error rate
    - `p50 = 688.29ms`
    - `p95 = 1407.31ms`
    - `p99 = 1935.76ms`
    - throughput `4.88 req/s`
    - `predictability.classification = VARIABLE`
    - current interpretation:
      - the latest rerun clears the current stronger bar on Render plus Neon
      - response shape is still variable enough that worst-case claims should stay conservative
  - scope caveat:
    - this proof measures authenticated merchant HTTP read paths only
    - it intentionally does not replace the local Redis worker-pressure proof because Render free staging is not a reliable worker-throughput benchmark
- External staging operator queue proof on `2026-03-30`:
  - script:
    - `scripts/staging-review-ops-proof.js`
  - current target:
    - pre-seeded crawl source for `demo-quan-pho-hong`
  - current live result against the deployed Render service:
    - `overallStatus = STAGING_REVIEW_OPS_PROOF_COMPLETE`
    - `runId = f39b2c84-2e54-4a2f-8421-79a20eac2954`
    - observed:
      - `status = COMPLETED`
      - `intakeBatchId = bb81bf83-b5e1-4930-a335-8c84b028c313`
      - `extractedCount = 30`
      - `validCount = 30`
      - `pagesFetched = 3`
      - `totalWallClockMs = 15733`
      - `rawReviewsPerSecond = 1.91`
      - `queueJobState = completed`
      - `crawlCoveragePolicyCode = NONE`
  - proof-tooling hardening:
    - `src/server.js` now boots review-crawl runtime in the Render web service when Redis is configured and inline mode is off
    - `scripts/staging-review-ops-proof.js` now evaluates the post-materialization snapshot instead of incorrectly failing when the terminal run snapshot predates intake-batch linkage
    - `scripts/staging-proof-helpers.js` now pre-warms `/health` plus `/api/health` and retries transient timeout or retryable HTTP failures during staging login, session fetch, and operator polling so Render free-tier cold starts do not produce false-negative proof failures
  - interpretation:
    - external admin run, queue, and materialization flow is now proven on the deployed Render baseline

### Auth and security

- register, login, session, logout
- password change
- refresh token rotation
- body-token refresh now schema-validates `refreshToken` before the rotation service sees it
- forgot password and reset password
- cookie auth and bearer auth
- CSRF double-submit protection for cookie writes
- rate limits and login lockout
- token revocation through `tokenVersion`
- explicit route separation between `USER` and `ADMIN`
- console-email fallback now logs only redacted delivery metadata instead of full HTML bodies or reset-link secrets
- shared UUID validation now guards `restaurantId` across admin-intake, review-crawl admin endpoints, and review-ops inputs
- review-ops approvable-item checks now use an explicit helper instead of silent `try/catch {}` loops

### User-facing reads

- restaurant list and detail
- restaurant list and detail now also return `entitlement`:
  - `planTier`
  - `effectivePolicy.sourceSubmissionLane`
  - `effectivePolicy.sourceSyncIntervalMinutes`
  - `effectivePolicy.actionCardsLimit`
  - `effectivePolicy.prioritySync`
  - `effectivePolicy.processingClass`
- `RestaurantEntitlement.planTier` is now the only merchant-facing pricing/entitlement truth in BE:
  - `FREE`
  - `PREMIUM`
- internal `RestaurantSourceSubmission.schedulingLane` remains queue machinery:
  - it is not the public plan model
  - it can still be admin-overridden for operational triage
- dataset status
- merchant source submission contract on restaurant create, update, and detail:
  - rejects non-Google Maps URLs
  - returns `sourceSubmission` state for the current `googleMapUrl`
  - returns `sourceSubmission.timeline` for the current active `googleMapUrl` with:
    - `currentStage`
    - `currentStepCode`
    - `isLive`
    - `latestEventAt`
    - `steps`
    - `events`
  - returns durable cross-attempt history at `GET /api/restaurants/:id/source-submission/history` with:
    - `current.attemptKey`
    - `current.sourceSubmission`
    - `history.attempts`
    - `history.events`
  - surfaces whether the current URL is unconfigured, submitted, source-ready, queued, crawling, reviewing, ready to publish, live, or needs attention
  - persists a dedicated `RestaurantSourceSubmission` row keyed to the restaurant instead of relying only on `Restaurant.googleMapUrl`
  - persists explicit handoff truth on `RestaurantSourceSubmission.status`:
    - `PENDING_IDENTITY_RESOLUTION`
    - `READY_FOR_SOURCE_LINK`
    - `LINKED_TO_SOURCE`
  - persists a durable `dedupeKey` so queue grouping does not have to rebuild its place-identity key on every read
  - defaults each submission into a `STANDARD` scheduling lane and keeps that lane stable across same-URL resubmits until admin changes it
  - saves a pending submission row even when Google Maps canonical resolution is temporarily unavailable
  - distinguishes a canonical-place-ready submission from a fully linked crawl source instead of collapsing both into one generic pending state
  - clears the persisted submission row when the merchant removes the saved Google Maps URL
  - derives the merchant timeline from existing persisted state instead of a separate history model:
    - `RestaurantSourceSubmission`
    - matching crawl source and latest crawl run
    - linked/open or published intake batch state
    - durable source-submission audit rows when available
  - keeps active-state and historical-state split intentionally explicit:
    - `sourceSubmission.timeline` covers the current active Google Maps URL only
    - cross-URL historical visibility now comes from the dedicated history endpoint
    - that history endpoint is audit-backed and snapshot-driven, not a separate submission-history table
  - exposes merchant-facing milestone/event codes such as:
    - `URL_SUBMITTED`
    - `PLACE_CONFIRMED`
    - `SOURCE_CONNECTED`
    - `SYNC_QUEUED`
    - `SYNC_IN_PROGRESS`
    - `EVIDENCE_IN_REVIEW`
    - `READY_TO_PUBLISH`
    - `LIVE`
    - `SYNC_FAILED`
    - `ATTENTION_REQUIRED`
  - allows canonical-ready submissions to auto-advance into a linked crawl source and initial queued run through the review-crawl scheduler, so the merchant-facing contract can move from `SUBMITTED` to `QUEUED` without requiring the admin to press `create-source` first in every happy-path case
- merchant source preview:
  - resolves a submitted Google Maps URL into canonical place identity before save
  - detects whether the same canonical Google Maps place is already connected to the same restaurant
  - exposes duplicate-place hints when the same canonical place already exists on other restaurants
  - returns a recommendation code of:
    - `ALREADY_CONNECTED`
    - `REUSE_SHARED_IDENTITY`
    - `SUBMIT_FOR_ADMIN_SYNC`
- admin source-submission queue contract:
  - operators can list pending merchant submissions across restaurants
  - operators can resolve or re-resolve a submission into canonical place identity
  - operators can create/link a crawl source directly from persisted canonical place identity without re-calling Google during source creation
  - operators can move a submission into the `PRIORITY` scheduling lane when it needs faster handling
  - operators can claim the next deduped submission group through a lease instead of freehand triage
  - canonical-ready submissions can now also be claimed and consumed by the review-crawl scheduler itself when no operator lease is active, linking each restaurant submission to a crawl source and queueing an initial incremental run
  - scheduler bootstrap is now governed by explicit platform controls instead of only implicit runtime code:
    - `sourceSubmissionAutoBootstrapEnabled`
    - `sourceSubmissionAutoBootstrapMaxPerTick`
  - durable audit rows now exist for:
    - `ADMIN_SOURCE_SUBMISSION_RESOLVED`
    - `ADMIN_SOURCE_SUBMISSION_LINKED`
    - `ADMIN_SOURCE_SUBMISSION_SCHEDULING_LANE_UPDATED`
    - `ADMIN_SOURCE_SUBMISSION_GROUP_CLAIMED`
    - `SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED`
    - `SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR`
    - `SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED`
- review evidence list
- dashboard KPI
- sentiment breakdown
- trend
- complaint keywords
- top issue and next action
- merchant actions read model at `GET /api/restaurants/:id/dashboard/actions`:
  - returns `entitlement` plus entitlement-derived `capabilities`
  - `summary.state`:
    - `AWAITING_SOURCE`
    - `AWAITING_FIRST_PUBLISH`
    - `ACTIONABLE_NOW`
    - `MONITORING`
  - `snapshot` of live published dataset:
    - source connected or not
    - total reviews
    - average rating
    - negative percentage
  - `executionLayer` to separate current prioritization from later tasking capability
  - `topIssue` enriched with recommendation code, evidence summary, and evidence review
  - `actionCards` built only from canonical published complaints plus negative published review evidence, so merchant-facing actions no longer depend on FE heuristics
  - `capabilities` now come from backend entitlement policy instead of FE guesses:
    - `sourceSubmissionLane`
    - `sourceSyncIntervalMinutes`
    - `actionCardsLimit`
    - `prioritySync`
    - `processingClass`
- durable merchant source-submission audit rows for:
  - `MERCHANT_SOURCE_SUBMITTED`
  - `MERCHANT_SOURCE_UPDATED`
  - `MERCHANT_SOURCE_CLEARED`

### Admin control plane

- restaurant list for admin selection
- admin source-submission queue with:
  - actionable merchant submissions grouped by canonical Google Maps place identity when available
  - grouping backed by persisted `dedupeKey`
  - unresolved submissions separated from known shared-identity submissions
  - queue input filtered from persisted submissions that are still in `PENDING_IDENTITY_RESOLUTION` or `READY_FOR_SOURCE_LINK`
  - scheduling lanes backed by persisted `schedulingLane` so admin can triage which submissions should float ahead inside the control plane
  - claim leases backed by persisted `claimedByUserId`, `claimedAt`, and `claimExpiresAt` so one admin can take a deduped group without another admin silently double-working it
  - scheduler bootstrap respects those same lease fields, so an actively claimed group stays manual until the lease expires or is released
  - per-restaurant work items that tell admin whether to resolve identity, reuse a shared identity, or create a new crawl source
- admin restaurant overview with:
  - current user-facing dataset status
  - restaurant entitlement and effective merchant capability policy
  - current restaurant-specific source-submission queue item when one is still pending
  - source stats
  - latest crawl run
  - open intake batches
  - next recommended admin actions
- admin restaurant entitlement control with:
  - `PATCH /api/admin/restaurants/:id/entitlement`
  - supported `planTier` values:
    - `FREE`
    - `PREMIUM`
  - realigns pending source submissions that still use `ENTITLEMENT_DEFAULT` lane source
  - keeps operator-overridden queue items on their explicit override lane
- admin access management with:
  - user directory and user detail
  - create user
  - role changes between `USER` and `ADMIN`
  - lock, unlock, deactivate, and reactivate lifecycle actions
  - password-reset trigger
  - restaurant membership mapping
- admin platform visibility and controls with:
  - API, database, queue, and worker health
  - integration and route-boundary policy visibility
  - audit event feed across users, membership changes, crawl-source changes, intake, crawl, and publish history
  - durable audit rows for intake batch creation, item review transitions, batch publish, platform control updates, membership assignment/removal, and crawl-source create/reconfigure/enable/disable mutations
  - runtime control switches for queue writes, crawl materialization, intake publish, merchant source auto-bootstrap enablement, and merchant source auto-bootstrap max-per-tick backpressure
  - release-readiness summary separating local proof from managed release-evidence artifacts
- intake create, edit, delete, publish
- intake review and publish actor/timestamp lineage on draft items and batches
- explicit `ReviewPublishEvent` lineage from canonical published reviews back to intake items and optional crawl source, crawl run, and raw review evidence
- canonical review reuse when external review identity matches
- review crawl source upsert and queued runs
- crawl-to-draft orchestration via `review-ops`

### Review crawl runtime

- Google Maps source upsert
- newly linked crawl sources now derive their default sync cadence from `RestaurantEntitlement`:
  - `FREE -> 1440 minutes`
  - `PREMIUM -> 360 minutes`
- queued crawl runs
- scheduler bootstrap of canonical-ready `RestaurantSourceSubmission` groups into:
  - crawl-source linking from persisted canonical identity
  - initial incremental run queueing with `PRIORITY -> HIGH` and `STANDARD -> NORMAL` runtime priority mapping
  - platform-managed backpressure via `sourceSubmissionAutoBootstrapMaxPerTick`, capped again by `REVIEW_CRAWL_SCHEDULER_BATCH_SIZE`
  - full skip behavior when `sourceSubmissionAutoBootstrapEnabled=false`, leaving all scheduler capacity available for already-linked due sources
  - retry-friendly lease release when automatic bootstrap cannot complete
- worker process with checkpoint, cancel, and resume
- raw review persistence
- draft materialization into intake batches
- timeout and retry hardening for Google Maps short-link source resolution
- fresh-session cursor recovery for suspicious empty pages
- backfill auto-resume from persisted checkpoint cursors
- structured `crawlCoverage` diagnostics and mismatch warnings when preview totals exceed extracted public reviews

## 5. Current Database Shape

The schema currently contains 18 models:

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
14. `RestaurantSourceSubmission`
15. `RestaurantEntitlement`
16. `PlatformControl`
17. `AuditEvent`
18. `ReviewPublishEvent`

Important role and ownership invariants:

- `User.role` is the only system-role switch
- `RestaurantUser` only answers “does this user belong to this restaurant?”
- `Review` is the canonical user-facing dataset
- `ReviewIntakeBatch` and `ReviewIntakeItem` are admin-side staging
- `ReviewCrawlSource`, `ReviewCrawlRun`, and `ReviewCrawlRawReview` are admin-side crawl runtime and audit state
- `RestaurantSourceSubmission` is the merchant-facing source-ingress record keyed 1:1 to a restaurant and may exist before any admin-created crawl source exists
- `RestaurantSourceSubmission.status` now captures the handoff boundary explicitly:
  - unresolved Google Maps identity
  - canonical place known and ready for crawl-source creation
  - crawl source already linked
- `RestaurantSourceSubmission.dedupeKey` is the persisted queue-group key derived from canonical CID when available, otherwise from normalized/input URL
- `RestaurantSourceSubmission.schedulingLane` is the persisted admin triage lane:
  - `STANDARD`
  - `PRIORITY`
- `RestaurantSourceSubmission.schedulingLaneSource` now explains why that lane currently applies:
  - `ENTITLEMENT_DEFAULT`
  - `ADMIN_OVERRIDE`
- `RestaurantSourceSubmission.claimedByUserId`, `claimedAt`, and `claimExpiresAt` now form the lease state for claimable deduped source-submission groups
- `RestaurantEntitlement` is a 1:1 restaurant contract and the only persisted merchant-facing entitlement truth:
  - `planTier=FREE`
  - `planTier=PREMIUM`
- merchant-facing capability promises are derived from `RestaurantEntitlement`, not copied into separate tables:
  - default source-submission lane
  - default crawl-source sync cadence
  - merchant action-card limit
  - priority-sync capability
- `AuditEvent` is the durable admin/event ledger now used for intake, platform control, membership, and crawl-source mutation history
- `AuditEvent.metadata.sourceSubmissionSnapshot` is now the durable evidence used to rebuild merchant source-submission history across URL submit, replace, clear, resolve, link, and scheduler-bootstrap actions
- `ReviewPublishEvent` is the durable lineage bridge from canonical `Review` rows back to the intake item/batch and optional crawl raw evidence that produced them

Additional invariants:

- account lifecycle is stored on `User` and is independent from restaurant membership
- `PlatformControl` is a singleton runtime policy record for global admin controls, including crawl queue writes, crawl materialization, intake publish, merchant source auto-bootstrap enablement, and merchant source bootstrap per-tick backpressure
- `RestaurantSourceSubmission.restaurantId` is unique so each restaurant has at most one live merchant submission record at a time
- `ReviewIntakeBatch.publishedByUserId` captures the admin actor that crossed the publish boundary
- `ReviewIntakeItem.lastReviewedAt` and `lastReviewedByUserId` capture the latest review transition lineage on each draft item
- `ReviewPublishEvent.intakeItemId` is unique so each published intake item has exactly one durable publish-lineage row

## 6. Seed And Demo Data

The shared seed dataset currently creates:

- 2 restaurants
- 5 users:
  - 3 `USER` accounts with realistic restaurant memberships
  - 1 `USER` outsider account with no membership
  - 1 `ADMIN` operator account
- published baseline data
- an open Google Maps crawl draft batch
- a crawl source, a crawl run, and raw review audit rows
- at least one invalid raw review example for readiness diagnostics

This dataset supports:

- user-facing dashboard demo
- review evidence demo
- admin curation demo
- admin access lifecycle demo
- admin platform controls demo
- publish smoke
- role-boundary smoke

Local deterministic reset and browser entrypoints:

- `npm run db:reset:local-baseline`
- seeded `USER` login: `demo.user.primary@sentify.local` / `DemoPass123!`
- seeded `ADMIN` login: `demo.admin@sentify.local` / `DemoPass123!`
- browser E2E entrypoint: `cd "D:\Project 3\apps\web" ; npx playwright test`

## 7. Quality And Evidence Already In Place

Current verification evidence includes:

- `npm test`
- `npm run db:validate`
- `npm run db:seed`
- `npm run test:realdb`
- full `npm run test:realdb` now resets and reseeds the local baseline before each `.realdb.test.js` file so suite results no longer depend on cross-file database residue
- `cd "D:\Project 3\apps\web" ; npm run test:run -- test/api.test.ts test/App.test.tsx`
- `cd "D:\Project 3\apps\web" ; npm run build`
- `cd "D:\Project 3\apps\web" ; npx playwright test e2e --workers=1`
- `cd "D:\Project 3\backend-sentify" ; node scripts/review-ops-sync-draft-smoke.js --url "https://maps.app.goo.gl/yWeP9xmjowpkYVbU7" --strategy incremental`
- `cd "D:\Project 3\backend-sentify" ; node --test test/review-crawl.service.test.js`
- `cd "D:\Project 3\backend-sentify" ; node --test test/review-crawl.worker-runtime.test.js`
- queued crawl smoke
- review crawl scale-validation harness
- local SMB user-read load proof
- local worker-pressure proof
- local operator-path proof
- local logical recovery drill
- local shadow-database restore and rollback rehearsal
- latest scheduler bootstrap verification on `2026-03-27`:
  - `cd "D:\Project 3\backend-sentify" ; node --test test/review-crawl.service.test.js` -> `13/13 passed`
  - `cd "D:\Project 3\backend-sentify" ; node --test test/admin-platform.integration.test.js` -> `2/2 passed`
  - `cd "D:\Project 3\backend-sentify" ; node --test test/review-crawl.worker-runtime.test.js` -> `2/2 passed`
  - `cd "D:\Project 3\backend-sentify" ; npm run test:realdb` -> passed
- latest merchant actions verification on `2026-03-27`:
  - `cd "D:\Project 3\backend-sentify" ; node --test test/dashboard.service.test.js test/dashboard.integration.test.js` -> `4/4 passed`
  - `cd "D:\Project 3\backend-sentify" ; $env:RUN_REAL_DB_TESTS='true'; node --test test/merchant-read.realdb.test.js` -> `8/8 passed`
  - `cd "D:\Project 3\backend-sentify" ; npm run test:realdb` -> passed

Important proof points already exist:

- auth token tables now match the live Prisma schema on fresh and existing local databases
- route guards now enforce the simplified `USER` vs `ADMIN` split
- admin users can inspect restaurants through dedicated admin endpoints instead of borrowing user-facing routes
- admin users can now inspect live `Access` and `Platform` data through dedicated `/api/admin/*` endpoints instead of FE-only placeholders
- admin users can now execute account lifecycle actions through dedicated `Access` endpoints
- browser E2E now proves account lifecycle, membership scope changes, platform publish kill-switch behavior, intake publish guardrails, the full merchant-to-admin publication chain, the full manual intake publish path, and the crawl-operations preview->run->materialize path in one suite
- durable audit coverage now persists intake batch creation, intake item approve/reject/reset transitions, intake batch publish, platform control updates, membership assignment/removal, and crawl-source lifecycle mutations
- admin audit feed now reads durable membership and crawl-source change rows going forward instead of synthesizing those domains from current state
- real-DB publish smoke now asserts publish actor lineage on the batch, review-actor lineage on approved intake items, and `ReviewPublishEvent` rows linking canonical `Review` data back to intake items with raw-review linkage when available
- runtime platform controls now gate live backend flows for queueing, materialization, and publish
- health and policy endpoints now expose release-readiness and runtime-control truth so FE can distinguish local proof from managed-environment gaps
- real Postgres HTTP smoke covers user-facing read routes
- real Postgres smoke covers publish and duplicate publish behavior
- browser E2E now proves:
  - strict `USER` vs `ADMIN` shell separation
  - direct-route fail-close behavior
  - merchant critical path across `Home`, `Reviews`, `Actions`, and `Settings`
  - admin critical path across live `Operations`, `Access`, and `Platform` screens
  - merchant-to-admin publication chain from Google Maps URL save through publish
  - merchant/admin concurrent source operationalization in separate live sessions
  - review-ops guardrail that publish stays blocked until at least one item is approved
  - manual intake create -> curate -> approve -> publish -> merchant evidence visibility
  - merchant/admin concurrent manual-intake publish with merchant refresh in the same live session
  - crawl operations preview -> source upsert -> run -> materialize -> intake readiness
- browser E2E now runs on an isolated real stack instead of borrowing the developer's local API/runtime:
  - frontend test server on `127.0.0.1:4173`
  - backend API on `127.0.0.1:3100`
  - queue namespace `review-crawl-playwright`
  - stack namespace `playwright-e2e`
- the latest clean-baseline browser run on `2026-03-27` passed `12/12` tests with `npx playwright test e2e --workers=1`
- the latest concurrency-focused browser rerun on `2026-03-27` re-proved the two dual-session admin/user flows with:
  - persistent preview server: `cd "D:\Project 3\apps\web" ; node .\scripts\playwright-preview.js --host 127.0.0.1 --port 4173 --strictPort`
  - dual-suite command: `cd "D:\Project 3\apps\web" ; npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line`
  - result: `2/2 passed`
- that preview-reuse path is currently the most reliable way to rerun the two dual-session proofs repeatedly on this Windows workstation without getting tripped up by stale preview-port ownership between suites
- the latest direct dual-session rerun on `2026-03-27` also passed `2/2` with just:
  - `cd "D:\Project 3\apps\web" ; npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line`
  - during that rerun, the Playwright harness successfully auto-started both the isolated backend stack and the managed frontend preview server
  - practical reading: the self-managed harness path is healthy again; keep the preview-reuse path as a fallback when port `4173` gets sticky after interrupted local runs
- the suite still stays on `--workers=1` intentionally because the browser specs share seeded restaurants, platform controls, and the isolated review-crawl queue namespace
- Redis-backed local smoke covers worker and operator queue flow
- managed Redis release-evidence harness now exists through:
  - `scripts/managed-redis-proof.js`
  - `scripts/staging-api-proof.js`
  - `scripts/staging-performance-proof.js`
  - `scripts/staging-review-ops-proof.js`
  - `scripts/performance-proof.js`
  - `scripts/release-evidence.js`
- `staging-recovery-drill.js` now supports `existing` source mode so a source database can be rehearsed without reseeding it first
- staging-compatible recovery proof now includes singleton `PlatformControl`, durable `AuditEvent`, and durable `ReviewPublishEvent` rows in the restored slice
- `staging-recovery-drill.js` restore now avoids Prisma interactive-transaction timeout pressure on larger existing-source slices and computes semantic restore digests from stable row ordering instead of timestamp-derived ordering
- `admin-platform` release-readiness now reads `load-reports/managed-release-evidence.json` instead of hardcoding managed proof to `PENDING`
- provider-managed Postgres proof now has a documented and validated artifact contract:
  - validator script: `scripts/managed-db-proof-validate.js`
  - example artifact: `docs/examples/managed-db-proof-artifact.example.json`
- managed sign-off now also has a fast preflight gate:
  - script: `scripts/managed-signoff-preflight.js`
  - purpose: report whether managed Redis URL, staging API URL, staging creds, and provider-managed DB proof inputs are present before running the heavy release-evidence bundle
  - `admin-platform` now also reads the resulting preflight artifact and exposes:
    - `managedSignoffPreflightStatus`
    - `managedSignoffPreflightBlockers`
- worker-pressure proof now isolates itself from live developer queues by:
  - forcing a dedicated ephemeral `REVIEW_CRAWL_QUEUE_NAME`
  - running Redis-mode proof with `NODE_ENV=development` so the service does not also auto-run the inline test path
- the latest local compatibility release-evidence bundle on `2026-03-28` reported:
  - managed Redis BullMQ probe: passed
  - existing-source backup, restore, and rollback rehearsal: passed
  - authenticated staging API proof: passed for:
    - root `/health`
    - `/api/health`
    - merchant session + restaurant detail + dashboard actions
    - admin session + restaurant detail + source-submission queue
  - performance proof: passed for:
    - merchant HTTP read load
    - Redis worker-pressure load
    - live-source scale estimate
  - compatibility proof status: `COMPATIBILITY_PROOF_COMPLETE`
  - managed sign-off status: `MANAGED_SIGNOFF_PENDING`
  - artifact caveat: this local run used Memurai `7.2.5` plus a local API base URL `http://127.0.0.1:3000`, so it is a full local compatibility artifact, not yet a cloud-managed sign-off
  - enforced gate: `release-evidence.js --require-managed-signoff` now exits non-zero until Redis and staging targets are non-loopback and a provider-managed Postgres backup/PITR proof artifact is attached
  - the new managed DB proof validator accepted the example artifact, and the bundle then reported `managedDbProof=PASSED` while still keeping managed sign-off pending because the remaining targets were local
  - the new preflight script reports the same blockers in a fast non-invasive way before the heavy bundle runs
  - admin-platform now also freshness-gates those artifacts:
    - local required proof older than `ADMIN_PLATFORM_LOCAL_PROOF_MAX_AGE_HOURS` defaults to `LOCAL_PROOF_STALE`
    - stale heavy bundle artifacts downgrade to `COMPATIBILITY_PROOF_STALE` and `MANAGED_SIGNOFF_STALE`
    - stale preflight artifacts downgrade to `managedSignoffPreflightStatus=MANAGED_SIGNOFF_STALE`
    - release readiness now returns `freshArtifactKeys`, `staleArtifactKeys`, `compatibilityProofFreshnessStatus`, and `managedSignoffPreflightFreshnessStatus`
- a separate external staging read-proof now exists on `2026-03-29`:
  - commands:
    - `cd "D:\Project 3\backend-sentify" ; node scripts/staging-performance-proof.js --concurrency 2 --rounds 20 --timeout-ms 120000 --output load-reports/staging-performance-proof-average.json`
    - `cd "D:\Project 3\backend-sentify" ; node scripts/staging-performance-proof.js --concurrency 4 --rounds 30 --timeout-ms 120000 --output load-reports/staging-performance-proof-strengthened.json`
    - `cd "D:\Project 3\backend-sentify" ; node scripts/operational-health-check.js --refresh --output load-reports/operational-health-check.current.json`
  - results:
    - average-case:
      - `overallStatus = STAGING_PERFORMANCE_PROOF_COMPLETE`
      - `40` authenticated merchant read requests
      - `0%` error rate
      - `p95 = 892.93ms`
      - `p99 = 1119.11ms`
      - `3.32 req/s`
      - `predictability = VARIABLE`
    - stronger-concurrency:
      - `overallStatus = STAGING_PERFORMANCE_PROOF_COMPLETE`
      - `120` authenticated merchant read requests
      - `0%` error rate
      - `p95 = 872.16ms`
      - `p99 = 1207.29ms`
      - `6.74 req/s`
      - `predictability = VARIABLE`
    - aggregate runtime audit:
      - historical `2026-03-29` result:
        - `overallStatus = OPERATIONAL_HEALTH_DEGRADED`
        - only degraded dimension is `redisDurability`
      - latest `2026-03-31` result:
        - `overallStatus = OPERATIONAL_HEALTH_COMPLETE`
        - all dimensions pass on the active Render plus Neon baseline
  - interpretation:
    - Render plus Neon staging currently clears correctness, Redis durability, and the active read-latency bars
    - the topology is acceptable for current pass/fail bars, but response shape remains variable enough that worst-case claims should stay conservative
    - queue and worker throughput still rely on the local Redis worker-pressure harness, not on Render free staging
- Merchant actions read-path optimization on `2026-03-31`:
  - `dashboard/actions` now:
    - loads a recent negative-review window first
    - issues a second targeted evidence query only for still-missing top complaint keywords
    - keeps the response contract unchanged while avoiding a default full negative-review scan
- latest local deterministic load proofs on `2026-03-29` now reset the database baseline before each run:
  - merchant reads:
    - command:
      - `cd "D:\Project 3\backend-sentify" ; node scripts/load-merchant-reads.js --extra-reviews 8000 --chunk-size 1000 --concurrency 16 --rounds 80 --timeout-ms 15000 --output load-reports/merchant-read-load-strengthened.json`
    - result:
      - `1280` requests
      - `0%` error rate
      - `p50 = 57.91ms`
      - `p95 = 119.76ms`
      - `p99 = 163.23ms`
      - `244.05 req/s`
      - mixed-surface overall `predictability = VOLATILE`
  - worker pressure:
    - command:
      - `cd "D:\Project 3\backend-sentify" ; node scripts/load-review-crawl-workers.js --force-inline --source-count 36 --concurrency 6 --pages-per-run 15 --reviews-per-page 25 --step-ms 35 --sample-ms 100 --output load-reports/review-crawl-worker-load-strengthened.json`
    - result:
      - `13500` synthetic raw reviews persisted
      - `2318.83 rawReviews/s`
      - `92.75 pages/s`
      - `6.18 runs/s`
      - processing leg:
        - `p95 = 988ms`
        - `predictability = STABLE`
      - queue wait leg:
        - `p95 = 4760ms`
        - `predictability = VOLATILE`
      - utilization proxy:
        - `averageUtilizationPercent = 94.17`
        - `classification = SATURATED`
  - interpretation:
    - local read latency is strong, but mixed-route predictability still needs route-level reading
    - local worker processing is stable; volatility is concentrated in queue wait once concurrency is saturated
- Google Maps short-link sync proof now includes retry-hardened source resolution for transient upstream fetch failures
- crawl-operations UI now preserves an operator-typed URL after manual edits instead of letting late restaurant detail hydration overwrite it
- shadow-database recovery proof covers restore plus app-level rollback smoke
- backend targeted integration teardown now closes review-crawl queue resources after HTTP shutdown, so `admin-platform.integration` no longer leaves hanging `node --test` orphan processes behind
- the latest targeted backend audit/lineage regression run on `2026-03-27` passed `35/35` tests across admin-intake, review-crawl, review-ops, admin-access, and admin-platform coverage before `npm run test:realdb` also passed on a fresh local baseline
- the latest targeted backend access rerun on `2026-03-27` also reconfirmed `admin-access.integration.test.js` at `4/4 passed`
- the latest merchant-source contract regression run on `2026-03-27` passed `32/32` tests across review-crawl, admin-restaurants, restaurant source-preview, restaurant service, and restaurant integration coverage
- the latest full `npm run test:realdb` pass on `2026-03-27` used the per-file migrated+seeded baseline runner so each real-DB file started from a clean database

## 8. What Is Still Missing

The backend is still not fully release-ready. Main remaining gaps:

- a deployed staging API or worker proof against a real staging base URL
- provider-managed Postgres snapshot or point-in-time restore proof beyond the current shadow-database rehearsal
- managed Redis proof against a real managed Redis URL, not only the local Redis-compatible runtime used to verify the harness
- optional backfill if older membership and crawl-source history from before durable `AuditEvent` coverage must appear in the audit feed
- optional backfill if older source-submission audit rows need richer snapshot metadata than the fallback URL-only reconstruction now available
- decide whether user-lifecycle and crawl-run projections should also become fully durable audit rows instead of partly synthetic feed entries
- continued refactor of older auth and restaurant modules toward the same feature-module shape

## 9. Short Conclusion

The backend is already beyond the demo-only stage.

The important contract is now simpler than before:

- user-facing app flow belongs to `USER`
- admin control-plane flow belongs to `ADMIN`
- restaurant membership answers scope, not privilege level

That keeps the codebase closer to the real product goal:

- users read stable restaurant intelligence
- admins operate intake, crawl, and publish mechanics

## 10. 2026-03-28 Hardening Pass

The latest backend hardening pass fixed three concrete reliability/performance issues:

- restaurant create/update now commit `restaurant`, `RestaurantSourceSubmission`, and merchant source audit in the same transaction, so source-ingress writes no longer partially persist when audit insertion fails
- Google Maps browser-like fetches now receive real `AbortSignal` time budgets, and both session bootstrap plus review-page fetches now obey the timeout wrapper instead of calling `client.fetch()` without cancellation
- review-crawl runtime health no longer uses Redis `KEYS` for processor heartbeat discovery; it now uses a heartbeat index with `SCAN` fallback and stale-member pruning

Fresh verification on `2026-03-28`:

- `cd D:\Project 3\backend-sentify && node --test test/restaurants.integration.test.js test/google-maps.service.test.js test/review-crawl.runtime.test.js` -> `20/20 passed`
- `cd D:\Project 3\backend-sentify && node --test test/restaurant.service.test.js test/review-crawl.service.test.js test/review-crawl.worker-runtime.test.js test/admin-platform.integration.test.js` -> `34/34 passed`
- `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
- `cd D:\Project 3\apps\web && npx playwright test e2e --workers=1` -> `12/12 passed`
- `cd D:\Project 3\backend-sentify && node scripts/managed-db-proof-validate.js --artifact load-reports/managed-db-proof-staging.json --output load-reports/managed-db-proof-validation-staging.json` -> `MANAGED_DB_PROOF_COMPLETE`
- `cd D:\Project 3\backend-sentify && node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json` -> `MANAGED_SIGNOFF_READY`
- historical `2026-03-28` green baseline:
  - `cd D:\Project 3\backend-sentify && node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --require-managed-signoff --output load-reports/managed-release-evidence.latest.json` -> `COMPATIBILITY_PROOF_COMPLETE`, with `managedEnvProofStatus=MANAGED_SIGNOFF_COMPLETE`
- `release-evidence.js` now keeps local compatibility at `COMPATIBILITY_PROOF_COMPLETE` when only optional checks such as `managedDbProof` are `SKIPPED`
- local `stack:review-crawl:status` was also patched to stop misreporting the new heartbeat index key as a stale processor
- backend env hygiene is now explicit:
  - `.env.example` is runtime-only
  - `.env.release-evidence.example` is release-proof-only
  - proof scripts auto-load `.env.release-evidence` after `.env`
  - `npm run env:check` verifies the example files still match the runtime contract
- `managed-signoff-preflight.js` now emits `nextSteps` with exact env keys and the next action per blocker, so missing managed-signoff inputs no longer have to be inferred manually
- Render free cold starts now have an explicit release-proof timeout knob:
  - `release-evidence.js` accepts `--staging-timeout-ms`
  - `.env.release-evidence` can provide `RELEASE_EVIDENCE_STAGING_TIMEOUT_MS`
  - current staging proof uses `90000`
- Render is now the chosen fast staging path:
  - blueprint: `backend-sentify/render.yaml`
  - runbook: `backend-sentify/docs/RENDER-STAGING.md`
  - deploy-safe Prisma command: `npm run db:migrate:deploy`
- env parsing was hardened so `JWT_SECRET_PREVIOUS=` can be left blank without breaking backend startup or admin-platform integration tests
- Fresh fast backend rerun on `2026-03-31`:
- `cd D:\Project 3\backend-sentify && npm run env:check` -> passed
- `cd D:\Project 3\backend-sentify && npm test` -> passed (`230` tests: `216` pass, `14` skipped, `0` fail)
  - runtime hardening now also has direct regression proof for:
    - opt-in Redis durability enforcement through `REVIEW_CRAWL_REQUIRE_SAFE_REDIS`
    - worker-runtime fail-fast when durability enforcement is enabled on an unsafe Redis deployment
    - queue-health reporting for `durabilityEnforced` and `durabilityBlocking`
- Latest real-DB rerun on `2026-03-31`:
- `cd D:\Project 3\backend-sentify && npm run test:realdb` -> passed
  - runtime hardening now also has direct regression proof for:
    - env timeout invariants
    - database URL timeout normalization
    - Prisma pool/init/transaction error mapping
    - Prisma `P2025 -> 404 RECORD_NOT_FOUND`
    - Prisma `P2003 -> 409 FOREIGN_KEY_CONSTRAINT_FAILED`
    - `/api/health` DB + Redis runtime contract
    - queue-health degradation when Redis probes fail
    - worker stalled/runtime-error event wiring
    - slow-request request logging
  - `managed-signoff-preflight.test.js` is now hermetic against workstation-local `.env.release-evidence`
  - proof scripts can now be isolated explicitly with:
    - `SENTIFY_RUNTIME_ENV_FILE`
    - `SENTIFY_RELEASE_EVIDENCE_ENV_FILE`
  - the full suite now also covers:
    - `staging-performance-proof.test.js`
    - `staging-review-ops-proof.test.js`
