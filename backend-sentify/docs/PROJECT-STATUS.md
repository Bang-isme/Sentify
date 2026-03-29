# Sentify Backend Project Status

Updated: 2026-03-29

This document answers three questions: where the backend is now, what is already done, and what should happen next.

## 1. Overall Assessment

Current status:

- product direction: locked
- backend foundation: strong
- database direction: stable for the current product scope
- core business flow: working
- role model: clarified
- release evidence:
  - historical compatibility proof complete and managed sign-off complete on the `2026-03-28` Render plus Neon staging baseline
  - current live staging runtime has been revalidated green after the `2026-03-29` Render `TRUST_PROXY=1` fix
  - latest managed Redis durability proof now fails on the current provider because `maxmemory-policy=volatile-lru`
- freshest local rerun evidence on `2026-03-28`:
  - `npm run test:realdb`: passed
  - `npx playwright test e2e --workers=1`: `12/12 passed`
  - `node scripts/release-evidence.js ...`: `COMPATIBILITY_PROOF_COMPLETE`
  - `node scripts/release-evidence.js ... --require-managed-signoff`: failed correctly with `MANAGED_SIGNOFF_PENDING` while the proof still pointed at local targets and had no managed DB artifact
- freshest backend-only rerun evidence on `2026-03-29`:
  - `npm test`: passed (`204` tests: `190` pass, `14` skipped, `0` fail)
  - `npm run test:realdb`: passed
  - `managed-signoff-preflight.test.js` was hardened so the full suite no longer reads workstation-local `.env.release-evidence` state
  - env loader now supports explicit override files through:
    - `SENTIFY_RUNTIME_ENV_FILE`
    - `SENTIFY_RELEASE_EVIDENCE_ENV_FILE`
  - env config now also rejects `TRUST_PROXY=true` and requires a hop count or explicit proxy list instead
  - env config now rejects unsafe timeout combinations where `HEADERS_TIMEOUT_MS <= REQUEST_TIMEOUT_MS` or `KEEP_ALIVE_TIMEOUT_MS >= HEADERS_TIMEOUT_MS`
  - runtime now enforces explicit HTTP request/header/keep-alive timeouts instead of leaving long-lived sockets to defaults
  - runtime Postgres URLs now normalize explicit connect/query/idle transaction timeout parameters, not only `sslmode=verify-full`
  - controller and middleware error handling now map Prisma pool exhaustion, initialization failure, transaction failure, and concurrency conflicts to explicit non-500 API errors
  - request logging now flags slow successful requests instead of only status-code failures
  - queue health now degrades cleanly when Redis/BullMQ probes fail, and worker runtime logs `error` plus `stalled` events explicitly
  - external Postgres URLs are now normalized to `sslmode=verify-full`
  - queue health now degrades if Redis deployment safety says BullMQ durability is unsafe
  - live contract additions on the same baseline:
    - `PATCH /api/auth/profile`
    - `GET /api/admin/platform/controls`
- freshest external staging evidence:
  - healthy baseline on `2026-03-28`:
  - Render staging API: `https://sentify-2fu0.onrender.com`
  - `GET /api/health`: `{"status":"ok","db":"up"}`
  - `node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com ...`: `STAGING_PROOF_COMPLETE`
  - `node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json`: `MANAGED_SIGNOFF_READY`
  - `node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --require-managed-signoff --output load-reports/managed-release-evidence.latest.json`: `COMPATIBILITY_PROOF_COMPLETE` with `managedEnvProofStatus=MANAGED_SIGNOFF_COMPLETE`
  - latest post-redeploy rerun on `2026-03-29`:
    - first rerun after deploy:
      - `GET /health`: `{"status":"ok"}`
      - `GET /api/health`: `{"status":"unavailable","db":"down"}`
      - `node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com ...`: `STAGING_PROOF_FAILED`
      - root cause: `TRUST_PROXY=true` on Render triggered `ERR_ERL_PERMISSIVE_TRUST_PROXY`
    - after fixing Render env to `TRUST_PROXY=1`:
      - `GET /health`: `{"status":"ok"}`
      - `GET /api/health`: `{"status":"ok","db":"up"}`
      - `node scripts/staging-api-proof.js --base-url https://sentify-2fu0.onrender.com ...`: `STAGING_PROOF_COMPLETE`
      - `node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --require-managed-signoff --output load-reports/managed-release-evidence.latest.json`: `COMPATIBILITY_PROOF_COMPLETE` with `managedEnvProofStatus=MANAGED_SIGNOFF_COMPLETE`
    - `node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json`: still `MANAGED_SIGNOFF_READY`
    - implication:
      - input readiness still holds
      - live staging runtime health is green again after the fix
  - external staging read-performance rerun on `2026-03-29`:
    - `node scripts/staging-performance-proof.js --output load-reports/staging-performance-proof-managed.json`: `STAGING_PERFORMANCE_PROOF_COMPLETE`
    - `40` authenticated merchant read requests
    - `0%` error rate
    - `p95 = 899.53ms`
    - throughput `3.37 req/s`
    - caveat:
      - this is an HTTP read-path proof only
      - worker-pressure and queue throughput still rely on the local Redis harness, not Render free staging
  - external staging operator queue proof on `2026-03-29`:
    - `node scripts/staging-review-ops-proof.js --output load-reports/staging-review-ops-proof-managed.json`: failed after the seeded source's active run remained `QUEUED` for more than `5m`
    - `GET /api/admin/platform/health-jobs` on the same staging baseline showed:
      - queue `HEALTHY`
      - workers `DEGRADED`
      - `scheduler = null`
      - `processors = []`
    - root cause in repo:
      - `src/server.js` was not booting `startReviewCrawlWorkerRuntime()` for the Render web service
    - repo fix now exists:
      - `src/server.js` starts review-crawl runtime whenever Redis is configured and inline mode is off
    - next operational step:
      - redeploy Render staging and rerun `proof:staging-review-ops`
  - latest managed Redis durability proof on `2026-03-29`:
    - `node scripts/managed-redis-proof.js --output load-reports/managed-redis-proof.latest.json`: completed with `passed=false`
    - observed Redis state:
      - version `8.4.0`
      - `maxmemory-policy = volatile-lru`
      - `evictionPolicyStatus = FAILED`
      - `safeForBullMq = false`
    - implication:
      - connectivity is fine
      - durability is not acceptable for BullMQ until provider policy is changed to `noeviction`

Current product/backend completion goal is also locked more tightly now:

- merchant Google Maps URL submission must be a first-class backend contract
- user-facing restaurant responses must explain where that submitted source is in the admin-operated pipeline
- restaurant entitlement must stay simple and backend-owned:
  - `RestaurantEntitlement.planTier`
  - derived capability policy in services/read models
- free/premium queue mechanics and very large-scale deduped submission handling should come after this contract stays stable

The backend is no longer a mock demo. It already behaves like a real product foundation, but it still needs more operational proof before it should be called release-ready.

## 2. Status By Workstream

| Area | Status | Already in place | Still missing |
|---|---|---|---|
| Product direction | Done | Manual-first, canonical user-facing reads, admin-curated publish boundary | Keep scope stable |
| Core architecture | Mostly done | Modular monolith, feature modules for `admin-intake`, `review-crawl`, `review-ops`, and `admin-restaurants` | Continue refactor for auth and restaurant areas |
| Auth and security | Mostly done | JWT, refresh, cookies, CSRF, lockout, reset flow, service-level lifecycle proof, controller proof, real-DB auth smoke, explicit `USER` vs `ADMIN` split | Staging-style auth smoke if release confidence needs to go higher |
| User-facing read APIs | Mostly done | Dashboard, reviews, sentiment, trend, complaints, top issue, merchant actions read model, seeded real-DB HTTP smoke, restaurant membership boundary separated from admin control plane, merchant source preview before save, durable `RestaurantSourceSubmission` persistence, best-effort Google Maps save behavior when canonical resolution is temporarily unavailable, explicit persisted submission handoff states for unresolved vs canonical-ready vs linked submissions, persisted `dedupeKey` plus default `STANDARD` scheduling-lane metadata on merchant source ingress, merchant-facing `sourceSubmission.timeline` on restaurant create/update/detail so FE can render current progress from backend truth, a dedicated `GET /api/restaurants/:id/source-submission/history` contract so FE can inspect prior source attempts without reverse-engineering audit rows, and a backend-owned entitlement contract on restaurant list/detail plus merchant actions (`FREE`/`PREMIUM` with derived capability policy) | Staging-style soak and perf guardrails |
| Admin intake | Mostly done | Create, edit, review, publish, canonical reuse, admin-only route contract, browser proof for full manual intake create->curate->approve->publish flow, durable audit events for batch create/review/publish, actor/timestamp lineage on item review and batch publish, explicit `ReviewPublishEvent` lineage from canonical `Review` rows back to intake items and optional crawl/raw evidence | More multi-batch regression proof and operator-facing lineage inspection if troubleshooting depth needs to grow |
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, draft materialization, fresh-session recovery, structured `crawlCoverage`, Google Maps short-link fetch hardening, durable crawl-source mutation audit, local Memurai-backed SMB worker load proof, browser proof for preview->run->materialize flow, executable managed-Redis BullMQ probe harness, scheduler bootstrap from canonical-ready merchant source submissions into crawl-source linking plus initial queued runs, explicit platform-managed auto-bootstrap/backpressure controls for that merchant-ingress scheduler path, and queue-health degradation when Redis deployment safety is below BullMQ durability requirements | External managed Redis still uses `volatile-lru`; change provider policy to `noeviction` or replace the provider/plan before calling runtime durability done |
| Review ops control plane | Mostly done | One-click draft sync, source list, run list, readiness, bulk approve valid, publish proxy, Redis-backed sync-to-draft smoke with auto-materialized draft proof, browser guardrail proof for publish-before-approval | Staging-style operator smoke |
| Admin restaurant overview | Done | Dedicated admin discovery and overview endpoints for full admin flow, plus a deduped admin source-submission queue read model, restaurant-level pending work item wiring, admin write actions to resolve/link merchant source submissions into crawl sources, actionable queue filtering backed by explicit persisted submission lifecycle states, operator-managed scheduling-lane triage for merchant ingress, lease-based claim-next behavior for deduped source-submission groups, runtime bootstrap semantics that honor active operator leases before auto-linking canonical-ready submissions, platform-visible policy truth for when that auto-bootstrap path is enabled or throttled, and admin entitlement update control that can change restaurant `planTier` while re-aligning only entitlement-default queue items | Keep docs and FE aligned |
| Admin access management | Done | User directory, user detail, create user, role changes, password-reset trigger, lock/unlock/deactivate/reactivate lifecycle, membership list/create/delete, integration coverage, durable membership assignment/removal audit for create-user, manual membership changes, and promotion-to-admin cleanup | Keep FE and docs aligned as workflow expands |
| Admin platform visibility | Done | Health & jobs, integrations & policies, audit feed, runtime controls, release-readiness summary, integration coverage, durable audit rows for intake, platform-control, membership, and crawl-source history going forward, managed release-evidence artifact ingestion from `managed-release-evidence.json`, and explicit visibility/control over merchant source auto-bootstrap enablement plus per-tick backpressure | Deployed staging API proof plus a product decision on whether user-lifecycle and crawl-run feed entries should also become fully durable |
| Publish integrity | Mostly done | Stable external review identity, canonical reuse, and real-DB duplicate publish regression | Keep widening edge-case coverage as source rules evolve |
| Database | Mostly done | Runtime models, crawl invariants, seed dataset, local logical recovery drill, local shadow-database restore rehearsal, durable `AuditEvent` ledger, intake review/publish lineage fields, durable `ReviewPublishEvent` lineage rows from canonical reviews back to staging/raw evidence, a persisted `RestaurantSourceSubmission` ingress model keyed to each restaurant, explicit persisted source-submission handoff states (`PENDING_IDENTITY_RESOLUTION`, `READY_FOR_SOURCE_LINK`, `LINKED_TO_SOURCE`), persisted submission `dedupeKey` and `schedulingLane` metadata for future queue policy, `schedulingLaneSource` so admin overrides stay distinct from entitlement defaults, `RestaurantEntitlement` as the only persisted merchant-facing plan truth, lease metadata (`claimedByUserId`, `claimedAt`, `claimExpiresAt`) for claimable deduped groups, explicit `PlatformControl` fields for merchant source auto-bootstrap enablement and max-per-tick backpressure, audit-backed `sourceSubmissionSnapshot` metadata so cross-attempt merchant source history survives URL replace/clear flows, and existing-source restore of platform controls plus durable history rows | Provider-managed backup and rollback evidence plus optional legacy-history backfill if older audit visibility is required |
| Testing | Mostly done | `npm test`, `db:seed`, `db:reset:local-baseline`, `test:realdb`, queued crawl smoke, seeded HTTP read proof, local SMB load harnesses, Redis-backed operator and worker smoke on local Memurai, local logical recovery drill, local shadow-database recovery smoke, executable `proof:managed-redis`, executable `proof:staging-api`, executable `proof:staging-performance`, executable `proof:staging-review-ops`, executable `proof:performance`, executable `proof:release-evidence`, implemented browser E2E for `USER` and `ADMIN` critical paths plus publication-chain, concurrent dual-session role handoff proofs, review-ops guardrails, manual intake full flow, and crawl operations full flow on an isolated real stack (`4173` FE, `3100` API, `review-crawl-playwright` queue), targeted backend proof for durable membership audit, crawl-source mutation audit, publish lineage, merchant source-submission persistence under both resolved and unresolved Google Maps save paths, explicit persisted source-submission lifecycle/backfill migration proof, merchant-facing source-submission timeline/history derivation, admin source-submission queue grouping/read-model behavior, admin source-submission resolve/link write actions, scheduling-lane triage behavior, lease-based claim-next behavior, scheduler bootstrap from canonical-ready submissions into crawl-source linking plus initial queued runs, explicit platform-control coverage for auto-bootstrap enable/disable and per-tick backpressure, same-URL lease preservation versus changed-URL lease reset, audit-backed cross-attempt source history proof, entitlement policy regression for restaurant list/detail, merchant actions, crawl-source sync cadence, admin entitlement update flow, external DB TLS normalization regression coverage, Redis deployment safety regression coverage, and admin-platform proof that unsafe Redis policy degrades queue health; full `test:realdb` now resets and reseeds before each `.realdb.test.js` file for deterministic suite isolation; real deployed staging auth/read proof now also passes on Render plus Neon; external staging merchant read latency now has a dedicated HTTP proof; repo code now also contains an external operator queue proof plus the server-side runtime bootstrap fix it exposed | Redeploy Render staging and rerun external operator proof; change external Redis policy to `noeviction` before calling managed runtime durability done; after that, only non-free staging worker-throughput proof remains if queue-performance confidence must exceed the current Render free benchmark |
| Docs | Mostly done | Source-of-truth docs now describe the simplified `USER` vs `ADMIN` contract | Keep sync as code evolves |
| Ops and release | Mostly done | Health endpoints, worker runtime, setup docs, local recovery drills, existing-source restore runner, authenticated staging API proof, external staging merchant read-performance proof, local bundled performance proof, managed release-evidence bundle, admin-surface visibility into managed proof artifacts, a live Render plus Neon staging baseline with seeded merchant and admin proof accounts, validated provider-managed DB proof artifact, a passing strict managed-signoff rerun against the external staging stack, rotated staging DB credentials after the setup leak, a repo-level fix so the Render web service now boots review-crawl runtime instead of only the HTTP API, and runtime proof that external Postgres TLS settings are normalized to `verify-full` | Redeploy Render staging to apply the runtime-bootstrap fix, rerun external operator queue proof, and change managed Redis policy to `noeviction` before claiming BullMQ-safe external durability |

## 3. Key Contract Decisions

The main backend simplification now in place is:

- `User.role` has only two values:
  - `USER`
  - `ADMIN`
- `RestaurantUser` is now pure membership
- there is no restaurant-level permission enum anymore

Operational effect:

- `/api/restaurants/*` is the user-facing product surface for `USER` accounts with restaurant membership
- `/api/admin/*` is the internal control-plane surface for `ADMIN` accounts
- admin access no longer depends on restaurant membership
- admin users are intentionally denied on user-facing restaurant routes

## 3.1 Optional Endpoint Backlog

These endpoints are intentionally tracked as optional backlog, not as live API surface:

| Endpoint | Priority | Reason |
|---|---|---|
| `DELETE /api/restaurants/:id` | Low | Useful only if merchant self-service soft-delete becomes part of the product. |
| `GET /api/restaurants/:id/reviews/:reviewId` | Low | Useful for deep-linking into one canonical review if FE later needs a dedicated review detail screen. |
| `DELETE /api/admin/restaurants/:id` | Low | Useful if admin restaurant lifecycle needs archive or delete semantics beyond read and operate flows. |
| `GET /api/admin/restaurants/:id/reviews` | Low | Useful if admin needs a direct canonical review read surface instead of combining other endpoints. |
| `POST /api/admin/review-batches/:id/archive` | Low | Useful because batch archive is already a valid business state, but there is no dedicated route yet. |

Current rule:

- these should not be added until a real FE or operator workflow justifies them
- do not blur the current live contract by treating them as already supported
- for delete-style actions, prefer archive or soft-delete semantics unless product direction changes

## 4. Milestones Already Reached

Key backend milestones already achieved:

1. Fully moved to manual-first admin intake
2. Separated canonical dataset from intake workflow
3. Closed the cookie auth and CSRF contract
4. Backfilled the missing auth-token migration so runtime auth tables match the live Prisma schema
5. Hardened publish invariants and canonical review reuse
6. Moved review crawl to queue and worker processing
7. Added shared seed data for demos and regression
8. Added real Postgres publish smoke
9. Added queued crawl smoke with local Redis
10. Added a backend-only operator surface to cut down crawl-to-draft steps
11. Added dedicated admin restaurant overview endpoints so the admin flow is complete without borrowing user routes
12. Added local SMB load harnesses for user-facing reads and crawl worker checkpoint pressure
13. Added local Memurai-backed Redis proof for worker pressure and operator-triggered sync-to-draft
14. Added a local logical recovery drill for seeded restaurant-state restore proof
15. Added a local shadow-database restore plus rollback rehearsal for staging-compatible backend smoke
16. Simplified the system role model to `USER` vs `ADMIN`
17. Added a deterministic local baseline reset command for seeded development and browser testing
18. Added browser E2E proof for strict `USER` vs `ADMIN` shell separation and fail-closed route behavior
19. Reset the FE IA into two post-login products:
    - merchant app: `Home`, `Reviews`, `Actions`, `Settings`
    - admin hub: `Operations`, `Access`, and `Platform`
20. Added live backend surfaces for admin `Access` and `Platform` so FE no longer depends on placeholders for those domains
21. Added explicit admin account lifecycle controls:
    - create user
    - lock / unlock
    - deactivate / reactivate
    - last-admin safety rules
22. Added singleton platform runtime controls and enforced them in live backend flows:
    - crawl queue writes
    - crawl materialization
    - intake publish
23. Added release-readiness summary so FE can distinguish local proof from missing managed-environment evidence
24. Fixed query-style frontend API helpers so they no longer emit `/api/api/...`, then locked that regression with frontend API tests
25. Added browser E2E proof for the merchant-to-admin publication chain:
    - merchant saves Google Maps URL
    - admin syncs to draft
    - admin approves valid items
    - admin publishes
    - merchant sees refreshed published dataset
26. Added browser guardrail proof that admin cannot publish a synced draft before approval
27. Hardened Google Maps short-link source resolution with timeout and retry handling for transient upstream fetch failures
28. Fixed review-ops sync form behavior so operator-entered Google Maps URLs are not overwritten by late detail hydration
29. Added browser E2E proof for the full manual intake flow:
    - create batch
    - add evidence
    - curate item
    - approve
    - publish
    - merchant sees published evidence
30. Added browser E2E proof for crawl operations:
    - preview seeded crawl source
    - upsert source from crawl screen
    - create run
    - wait for crawl completion
    - materialize into intake
    - confirm draft readiness
31. Fixed crawl-operations URL hydration so manual operator edits are not overwritten by late restaurant detail hydration
32. Added durable database-backed audit events for intake batch creation, item review transitions, intake batch publish, and platform control updates
33. Added actor and timestamp lineage on intake review and publish through `ReviewIntakeItem.lastReviewedAt`, `ReviewIntakeItem.lastReviewedByUserId`, and `ReviewIntakeBatch.publishedByUserId`
34. Fixed backend integration-test teardown so review-crawl queue resources are closed after app shutdown and interrupted runs no longer leave hanging `node --test` processes behind
35. Added durable database-backed membership audit for create-user restaurant assignment, manual membership assignment/removal, and automatic membership cleanup when a user is promoted to `ADMIN`
36. Added durable crawl-source mutation audit for source creation, reconfiguration, sync enable/disable, and lifecycle enable/disable transitions
37. Added `ReviewPublishEvent` as an explicit canonical-review lineage table linking published `Review` rows back to the intake item, batch, publisher, and optional crawl source, crawl run, and raw review evidence
38. Removed synthetic membership and crawl-source history generation from the admin audit feed so those domains now rely on durable audit rows going forward
39. Expanded backend verification to prove the new audit and lineage behavior through targeted suites plus fresh-baseline `test:realdb`
40. Added a managed Redis BullMQ probe script so release evidence can verify enqueue/process/complete behavior against a supplied Redis URL
41. Upgraded `staging-recovery-drill.js` with `existing` source mode so a source database can be rehearsed without reseeding it first
42. Extended staging recovery slices to include `PlatformControl`, `AuditEvent`, and `ReviewPublishEvent` so restore evidence matches the current backend state more closely
43. Added a bundled `release-evidence.js` report and wired `admin-platform` release-readiness to read `managed-release-evidence.json`
44. Locked the next backend-completion goal around merchant source submission instead of jumping straight to freemium or large-scale queue policy
45. Added backend-side Google Maps URL validation on merchant restaurant create/update so source submission now rejects non-Google links before they enter the pipeline
46. Added `sourceSubmission` to merchant-facing restaurant create, update, and detail responses so the user-facing product can explain whether a submitted URL is unconfigured, submitted, queued, crawling, under review, ready to publish, live, or needs admin attention
47. Added durable merchant source-submission audit events for submit, update, and clear actions on `googleMapUrl`
48. Added fast regression coverage plus real-DB proof for the new merchant source-submission contract
49. Added merchant-side source preview so a Google Maps URL can be resolved into canonical place identity before save and checked for duplicate-place hints
50. Added recommendation codes for merchant source preview:
    - `ALREADY_CONNECTED`
    - `REUSE_SHARED_IDENTITY`
    - `SUBMIT_FOR_ADMIN_SYNC`
51. Added mocked integration coverage for the new merchant source-preview endpoint plus regression reruns on `test:realdb`
52. Added `RestaurantSourceSubmission` as a durable 1:1 merchant ingress record so source input no longer lives only on `Restaurant.googleMapUrl`
53. Made merchant source save best-effort against Google Maps resolution failures and proved the persisted submission contract through mocked regression plus fresh-baseline real-DB create/detail smoke
54. Added admin queue visibility for pending merchant source submissions at `GET /api/admin/restaurants/source-submissions`, grouped by canonical place identity when available
55. Wired restaurant-specific source-submission work items into admin restaurant detail and next-actions so operators can see whether they need to resolve identity, reuse a shared place, or create a new crawl source
56. Expanded regression proof so the admin source-submission queue is covered by mocked integration tests and fresh-baseline `test:realdb`
57. Added `POST /api/admin/restaurants/source-submissions/:submissionId/resolve` so operators can re-resolve a merchant-submitted Google Maps URL into canonical place identity on demand
58. Added `POST /api/admin/restaurants/source-submissions/:submissionId/create-source` so operators can create/link a crawl source directly from persisted canonical identity instead of re-calling Google during source creation
59. Expanded regression proof so admin source-submission write actions are covered by mocked integration, review-crawl unit proof for persisted-identity source creation, and fresh-baseline real-DB queue-consumption smoke
60. Hardened the full `test:realdb` runner so it resets and reseeds the local baseline before each real-DB file, removing cross-file database residue from suite results
61. Refined `RestaurantSourceSubmission` persisted lifecycle so the database now distinguishes unresolved ingress, canonical-place-ready ingress, and linked crawl-source ingress instead of collapsing everything into one pending state
62. Added a migration backfill that reclassifies older submission rows from canonical identity and linked source data while keeping real-DB baseline resets green
63. Updated merchant/admin contract logic so unresolved submissions remain actionable for admin resolution, canonical-ready submissions move straight to source-link work, and linked submissions drop out of the pending admin queue
64. Re-ran targeted source-submission regression plus fresh-baseline `test:realdb` to prove the new persisted lifecycle contract end to end
65. Added persisted `RestaurantSourceSubmission.dedupeKey` and `RestaurantSourceSubmission.schedulingLane` so merchant ingress now carries queue-group and triage metadata without inferring it on every admin read
66. Added `POST /api/admin/restaurants/source-submissions/:submissionId/scheduling-lane` so operators can move a merchant source submission between `STANDARD` and `PRIORITY` triage lanes with durable audit history
67. Hardened `prisma/seed-data.js` with retry-on-deadlock behavior after the per-file baseline reset in `test:realdb` exposed an intermittent local Postgres seed deadlock during real-DB verification
68. Added lease metadata to `RestaurantSourceSubmission` plus `POST /api/admin/restaurants/source-submissions/claim-next` so the deduped queue is now claimable instead of being read-only triage
69. Proved that same-URL merchant resubmits preserve an active claim and triage lane, while changing the Google Maps URL clears the lease and resets the scheduling lane to `STANDARD`
70. Extended the review-crawl scheduler so canonical-ready merchant source submissions can bootstrap themselves into crawl-source links plus an initial queued run when no active operator lease is present
71. Proved that scheduler bootstrap respects internal triage lanes by mapping `PRIORITY -> HIGH` runtime run priority, while the fresh-baseline backend suite stayed green across `review-crawl.service`, `review-crawl.worker-runtime`, and `test:realdb`
72. Added explicit `PlatformControl` fields for merchant source auto-bootstrap enablement and max-per-tick backpressure so scheduler behavior is no longer hidden behind only internal runtime code
73. Proved that `admin-platform` now exposes and updates those merchant-ingress scheduler controls, while `review-crawl.service` respects both throttle and full-disable paths without reopening queue/worker handle leaks in tests
74. Enriched merchant, admin, and scheduler source-submission audit writes with a normalized `sourceSubmissionSnapshot` so cross-attempt history can survive URL replace and clear flows
75. Added `GET /api/restaurants/:id/source-submission/history` as an audit-backed user-facing contract that exposes `current.attemptKey`, historical attempts, and durable source-submission events without introducing a separate history table
76. Proved the new source-submission history contract through targeted unit/integration suites (`21/21`, `20/20`) plus fresh-baseline real-DB merchant HTTP proof (`8/8`) and a green `npm run test:realdb`
77. Added `GET /api/restaurants/:id/dashboard/actions` as a backend-native merchant prioritization read model so FE no longer has to infer action cards and next-step messaging from `complaints` and `top-issue` alone
78. Proved the merchant actions contract through unit, mocked integration, targeted real-DB merchant read proof, and a green full `npm run test:realdb`
79. Added `RestaurantEntitlement` as the stable 1:1 restaurant plan contract with only two merchant-facing plan tiers:
    - `FREE`
    - `PREMIUM`
80. Explicitly separated public entitlement truth from internal queue machinery by keeping `RestaurantSourceSubmission.schedulingLane` as operator/runtime state and recording `schedulingLaneSource` as either `ENTITLEMENT_DEFAULT` or `ADMIN_OVERRIDE`
81. Wired restaurant list/detail plus merchant actions to return backend-owned entitlement and derived capabilities so FE no longer has to guess free-vs-premium behavior
82. Wired crawl-source creation to derive default sync cadence from restaurant entitlement instead of a hardcoded interval
83. Added `PATCH /api/admin/restaurants/:id/entitlement` so admin can upgrade or downgrade a restaurant plan and automatically re-align only entitlement-default pending source-submission lanes
84. Proved the entitlement contract through:
    - targeted backend suite: `45/45 passed`
    - direct real-DB merchant suite: `9/9 passed`
    - green full `npm run test:realdb`
85. Locked a runtime/testing invariant in docs: baseline-resetting real-DB commands must be run serially against the local Postgres baseline because `test:realdb` already owns reset+seed per file
86. Added `staging-api-proof.js` so release evidence can verify authenticated merchant and admin control-plane reads against a supplied staging API base URL instead of checking only health endpoints
87. Added `performance-proof.js` so release evidence can bundle merchant read load, Redis worker-pressure load, and live-source scale-estimate evidence into one pass/fail artifact
88. Fixed Redis worker-pressure proof so it no longer collides with the inline test path or shared local queue names:
    - Redis-mode load proof now uses a dedicated ephemeral queue name
    - Redis-mode load proof no longer sets `NODE_ENV=test`, so `scheduleInlineRunProcessing()` does not double-run jobs outside BullMQ
89. Hardened `staging-recovery-drill.js` for large existing-source slices by removing the short interactive transaction bottleneck and making restore digests compare semantic content under stable ordering
90. Proved a full local compatibility release-evidence bundle on `2026-03-28`:
    - managed Redis BullMQ probe: passed
    - existing-source backup/restore/rollback: passed
    - authenticated staging API proof: passed
    - performance proof: passed
    - overall local artifact status: `COMPATIBILITY_PROOF_COMPLETE`
    - managed sign-off status: `MANAGED_SIGNOFF_PENDING`
91. Kept the release-readiness caveat explicit: the current green bundle used local Memurai plus local API base URL, so real cloud-managed Redis and deployed staging still need one final rerun for external sign-off
92. Re-ran the freshest local acceptance evidence on `2026-03-28` instead of relying on older notes:
    - `npm run test:realdb`: passed
    - `npx playwright test e2e --workers=1`: `12/12 passed`
    - `release-evidence.js`: green again once the local target API was actually running, proving the earlier `ECONNREFUSED` result was target unavailability rather than a backend contract regression
93. Added an honest release gate on `2026-03-28`:
    - local bundle status is now reported as compatibility proof, not managed sign-off
    - admin-platform now exposes both `compatibilityProofStatus` and `managedEnvProofStatus`
    - `--require-managed-signoff` now exits non-zero until Redis and staging targets are non-loopback and a provider-managed Postgres backup/PITR proof artifact is attached
94. Added `managed-db-proof-validate.js` plus an example provider-managed DB proof artifact so managed sign-off no longer depends on an undocumented file shape
95. Proved the stricter sign-off path on `2026-03-28`:
    - managed DB proof validator: passed on the example artifact
    - release-evidence with that artifact: `managedDbProof=PASSED`
    - `--require-managed-signoff` still failed correctly because Redis and staging API targets were still local loopback endpoints
96. Added `managed-signoff-preflight.js` so the repo can report missing managed Redis, staging API, staging creds, and DB proof inputs in a few hundred milliseconds before running the heavy bundle
97. Proved the preflight contract on `2026-03-28`:
    - local/no-input preflight: `MANAGED_SIGNOFF_PENDING` with blocker list
    - external-target sample preflight with valid DB artifact: `MANAGED_SIGNOFF_READY`
98. Wired `admin-platform` release readiness to surface managed-signoff preflight status and blockers in addition to the heavier release-evidence artifact
99. Hardened release readiness on `2026-03-28` so stale evidence no longer looks healthy:
    - `admin-platform` now marks stale local proof as `LOCAL_PROOF_STALE`
    - stale managed release artifacts downgrade to `COMPATIBILITY_PROOF_STALE` and `MANAGED_SIGNOFF_STALE`
    - stale preflight artifacts downgrade `managedSignoffPreflightStatus` to `MANAGED_SIGNOFF_STALE`
    - release readiness now exposes fresh vs stale local artifact keys instead of only “available vs missing”

100. Fixed `release-evidence` compatibility semantics on `2026-03-28`:
    - optional skipped checks no longer downgrade local compatibility from `COMPATIBILITY_PROOF_COMPLETE` to `COMPATIBILITY_PROOF_PARTIAL`
    - added direct regression coverage in `test/release-evidence.test.js`
    - reran the local compatibility bundle and it now reports `COMPATIBILITY_PROOF_COMPLETE` while still keeping `managedEnvProofStatus=MANAGED_SIGNOFF_PENDING`
101. Split backend env templates on `2026-03-28`:
    - `.env.example` now documents normal backend runtime only
    - `.env.release-evidence.example` now documents managed-signoff inputs only
    - proof scripts now auto-load `.env.release-evidence`
    - `npm run env:check` now guards drift between env templates and the runtime config contract
102. Added actionable managed-signoff guidance on `2026-03-28`:
    - `managed-signoff-preflight.js` now emits `nextSteps` with env keys and follow-up actions
    - after filling the managed Redis URL locally, the remaining blockers are now limited to staging API URL, staging credentials, and the managed DB proof artifact
103. Chose Render as the fast staging path on `2026-03-28`:
    - added `backend-sentify/render.yaml`
    - added `backend-sentify/docs/RENDER-STAGING.md`
    - added deploy-safe Prisma command `npm run db:migrate:deploy`
104. Fixed an env regression on `2026-03-28`:
    - `JWT_SECRET_PREVIOUS=` empty string no longer breaks backend startup
    - added regression coverage in `test/env.test.js`
105. Brought up a real staging API on `2026-03-28`:
    - Render service live at `https://sentify-2fu0.onrender.com`
    - Neon Postgres connected successfully
    - `/api/health` now returns `{"status":"ok","db":"up"}`
106. Revalidated staging after redeploy on `2026-03-29`:
    - `/health` still returns `200`
    - first rerun regressed because `TRUST_PROXY=true` on Render triggered `ERR_ERL_PERMISSIVE_TRUST_PROXY`
    - after changing Render to `TRUST_PROXY=1`, `/api/health` returned `{"status":"ok","db":"up"}`
    - `staging-api-proof-managed.json` returned to `STAGING_PROOF_COMPLETE`
    - `managed-release-evidence.latest.json` again reports `managedEnvProofStatus=MANAGED_SIGNOFF_COMPLETE`
    - the repo baseline was updated so Render now defaults to `TRUST_PROXY=1`
106. Applied Prisma migrations and seeded the real staging database on `2026-03-28`:
    - `npm run db:migrate:deploy` succeeded against Neon staging
    - `node prisma/seed.js` succeeded against Neon staging
    - merchant and admin proof accounts now exist on the deployed staging stack
107. Proved real deployed staging auth and role flows on `2026-03-28`:
    - `staging-api-proof-managed.json` reports `STAGING_PROOF_COMPLETE`
    - merchant authenticated read smoke passed
    - admin authenticated control-plane smoke passed
108. Reduced managed sign-off to one remaining blocker on `2026-03-28`:
    - `managed-signoff-preflight.latest.json` reported only `RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT`
    - a live Neon restore drill was started after intentionally deleting demo review `81c35358-64de-485e-9e8a-febbf07c7631` at `2026-03-28T16:27:47.747Z`
109. Completed provider-managed DB proof on `2026-03-28`:
    - Neon restored the staging branch to `2026-03-28T16:27:00.000Z`
    - review count returned from `15` to `16`
    - deleted review `81c35358-64de-485e-9e8a-febbf07c7631` was present again
    - `managed-db-proof-staging.json` validated as `MANAGED_DB_PROOF_COMPLETE`
110. Completed strict managed sign-off on `2026-03-28`:
    - `managed-signoff-preflight.latest.json` now reports `MANAGED_SIGNOFF_READY`
    - `managed-release-evidence.latest.json` now reports:
      - `overallStatus = COMPATIBILITY_PROOF_COMPLETE`
      - `managedEnvProofStatus = MANAGED_SIGNOFF_COMPLETE`
111. Hardened release-evidence against Render free cold starts on `2026-03-28`:
    - `release-evidence.js` now accepts `--staging-timeout-ms`
    - env fallback added:
      - `RELEASE_EVIDENCE_STAGING_TIMEOUT_MS`
    - `.env.release-evidence.example` now documents the timeout knob for slow staging hosts
    - this removed the false-negative timeout on `stagingApi` during strict sign-off
112. Re-hardened full backend test isolation on `2026-03-29`:
    - `scripts/load-env-files.js` now accepts explicit env-file overrides for runtime and release-evidence contexts
    - `managed-signoff-preflight.test.js` now uses an isolated empty release-evidence env file during test execution
    - `npm test` is green again without depending on machine-local managed-signoff secrets
113. Added a separate external staging read-performance proof on `2026-03-29`:
    - `scripts/staging-performance-proof.js` now measures authenticated merchant read-path latency directly against deployed staging
    - current Render plus Neon artifact: `STAGING_PERFORMANCE_PROOF_COMPLETE`
    - observed result:
      - `40` requests
      - `0%` error rate
      - `p95 = 899.53ms`
      - `3.37 req/s`
    - explicit caveat:
      - this proves HTTP merchant reads on external staging
      - it does not replace the local Redis worker-pressure proof
114. Added a trust-proxy security guardrail on `2026-03-29`:
    - `src/config/env.js` now rejects `TRUST_PROXY=true`
    - hosted deployments must use a hop count like `1` or an explicit proxy subnet list
    - regression coverage added in `test/env.test.js`

## 5. Risk If Work Stops Here

- confidence no longer lacks strict managed sign-off on the current staging baseline
- release-evidence tooling is green locally and the current external staging baseline is now fully signed off
- queue worker behavior is measured under local Redis compatibility and an executable BullMQ probe harness, but not yet under a non-free external staging worker fleet
- audit history is now durable for intake, platform control, membership, and crawl-source mutations going forward, but legacy membership/source changes from before the durable ledger are not backfilled automatically
- Google-reported totals can still exceed the public review rows exposed through the unofficial RPC, even though operator surfaces now label that mismatch as advisory when the public chain is exhausted
- FE can now see lifecycle, runtime-control truth, audit-backed source-attempt history, and managed-evidence status, and the current staging baseline now has complete managed sign-off evidence
- user-creation and crawl-run projections in the admin audit feed are still partly synthetic unless they are promoted to durable audit events later
- release operations are already demonstrated against the current Render plus Neon staging baseline, but worker-throughput evidence still leans on local Redis rather than an external staging worker fleet

## 6. Recommended Next Order

The next backend priorities should be:

1. redeploy Render staging so `src/server.js` can apply the new review-crawl runtime bootstrap path
2. rerun `proof:staging-review-ops` against Render plus Neon to confirm external queue worker health is no longer `DEGRADED`
3. if queue-performance confidence still needs to go higher after that, rerun throughput proof on a non-free external staging worker topology instead of relying only on Render free plus local Redis evidence
4. decide whether merchant actions remain a derived read model or later grow into a persisted task/ownership domain
5. decide whether legacy membership/source history needs a one-time backfill into the durable audit ledger
6. avoid new schema expansion unless the next product decision truly requires it; for current scope the BE + database contract is stable enough to drive FE safely

## 7. Short Conclusion

The backend is already strong enough for FE to rely on.

What remains is mostly:

- stronger evidence
- managed-service proof on real staging infrastructure
- release discipline

The important system-role contract is now explicit and simpler:

- `USER` owns the user-facing restaurant flow
- `ADMIN` owns the internal control plane
- restaurant membership scopes user data access but does not create extra sub-roles

## 8. 2026-03-28 Reliability Fixes

- fixed the merchant source-ingress partial-write bug so restaurant create/update no longer commit before source-submission and audit writes finish
- fixed Google Maps crawl timeout enforcement so browser-like client requests now receive abortable timeout budgets on session bootstrap and review-page fetches
- fixed runtime heartbeat discovery so Redis health reads no longer rely on blocking `KEYS`
- added rollback regressions for create/update audit failure, timeout abort regressions for Google Maps fetches, and runtime heartbeat-index regressions
- reran full browser E2E after the backend hardening pass: `12/12 passed`
- reran the local release-evidence bundle in the correct compatibility mode:
  - backup/restore/rollback: passed
  - staging API proof against the local stack: passed
  - performance proof: passed
  - remaining readiness gaps: local Redis target, local API target, and missing provider-managed DB artifact
- fixed the local compatibility status semantics so skipped optional managed sign-off checks no longer downgrade the artifact to `COMPATIBILITY_PROOF_PARTIAL`
- patched `local-review-stack.js` so runtime status no longer shows the heartbeat index key as a fake stale processor
