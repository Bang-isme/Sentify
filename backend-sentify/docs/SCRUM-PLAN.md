# Sentify Scrum Completion Plan

Updated: 2026-03-19

## Overview

Sentify should be completed as a merchant-first, manual-first review intelligence product for restaurants.
The product goal is unchanged from the current source-of-truth docs: help a restaurant owner move from raw customer feedback to one clear operational decision quickly, with evidence they can trust.

This plan keeps the current project reality intact:

- manual admin curation is the intake model
- canonical `Review` data is the only merchant-facing source of truth
- the backend remains a modular monolith
- the team completes the backend trust contract before deep frontend integration

Working scope guards:

- do not reintroduce merchant-triggered Google Maps scraping or hidden ingestion automation
- do not let admins write directly into canonical `Review` without review and publish state
- do not expose admin-only intake notes or diagnostics to merchants
- do not extract shared packages before there are at least two real app consumers

Primary grounding documents:

- `D:\Project 3\backend-sentify\docs\PROPOSAL.md`
- `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`
- `D:\Project 3\backend-sentify\docs\API.md`
- `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- `D:\Project 3\backend-sentify\docs\DATABASE.md`
- `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`

## Finished Product Snapshot

When Sentify is product-complete, it should look like this:

- Merchant experience: login, restaurant selection, dashboard, reviews evidence, and settings in a stable app shell. The merchant sees KPI cards, sentiment split, trend, complaint keywords, top issue, next action, dataset freshness, last publish time, and review evidence filters.
- Admin experience: internal curation workspace with intake inbox, batch detail, quick entry, bulk paste, duplicate handling, approval and rejection flow, publish summary, and basic audit trail.
- Backend experience: secure auth, restaurant membership controls, admin intake workflow, canonical review store, insight refresh, health endpoints, request logging, and clear module boundaries.
- Operations experience: HTTPS deployment, environment setup, migrations, health checks, backups, rollback plan, smoke tests, and release evidence.
- Quality experience: core unit tests, real Postgres integration coverage for critical flows, browser E2E for merchant and admin paths, and a repeatable demo dataset.

## Success Criteria

### Product-complete

Sentify is product-complete when all of the following are true:

- a merchant can log in, select a restaurant, and reach an actionable view in under 60 seconds
- the dashboard shows top issue, sentiment, trend, complaint keywords, dataset freshness, and last publish time
- the reviews screen supports evidence drill-down with working rating and date filters
- the settings flow covers restaurant profile, source policy messaging, and dataset status without exposing admin-only controls
- an admin can create a batch, add items, normalize content, approve or reject items, publish approved items, and see the merchant-facing dataset update only after publish
- the CSRF and auth contract is fully wired for browser write flows
- the backend docs and operational runbook match the codebase

### Release-complete

Sentify is release-complete when all product-complete criteria are true and all of the following are true:

- `backend-sentify` test suite passes on a fresh checkout
- Prisma schema validates and migrations apply cleanly
- at least one real Postgres smoke flow proves `create batch -> add items -> publish -> dashboard update`
- browser E2E covers merchant critical path and admin publish critical path
- staging or production-like deployment proves `/health` and `/api/health`
- backup restore drill and rollback drill have been executed and recorded
- a human reviewer signs off that the merchant dashboard is understandable and useful

### Scale-complete

Scale readiness is deliberately split into levels:

- Small scale: yes after Sprint 4. A single VPS plus one PostgreSQL instance is a valid release target.
- Medium scale: yes after Sprint 5. This requires async publish processing, shared rate-limit state, stronger observability, and database read scaling.
- Large scale: no, not after the core project alone. True large-scale readiness needs a separate architecture track for job orchestration, read-model separation, load testing, storage lifecycle management, and multi-instance operations.

## Tech Stack

Current product stack:

- Frontend: React 19, Vite, TypeScript, Vitest, ESLint
- Backend: Node.js, Express, Prisma, PostgreSQL
- Security: JWT, refresh tokens, HTTP-only auth cookies, CSRF middleware, Helmet, rate limiting
- Operations: single service deployment, health endpoints, structured request logging

Planned additions for completion and hardening:

- Browser E2E: Playwright for merchant and admin critical paths
- Real DB smoke coverage: dedicated Postgres-backed integration test or smoke runner
- Release operations: reverse proxy with HTTPS, documented deploy and rollback flow
- Medium-scale hardening: Redis plus BullMQ or an equivalent worker pattern for publish and insight recompute
- Capacity validation: k6 or Artillery for dashboard-read and publish-load testing

Why this stack is appropriate:

- the current modular monolith is sufficient for a thesis-grade product and an MVP release
- Prisma plus PostgreSQL already model the domain well enough to avoid premature service decomposition
- Playwright and real DB smoke tests close the biggest trust gaps without requiring a platform rewrite
- Redis and a queue should arrive only when throughput and latency justify them

## Seed and Demo Data Strategy

Sentify needs one repeatable demo dataset that powers:

- backend real DB smoke checks
- sprint review demos
- browser E2E
- release walkthroughs

Target seed contents:

- 2 restaurants with clear membership boundaries
- 3 `USER` members, 1 `USER` outsider, and 1 `ADMIN` operator
- 1 published dataset with enough reviews to show KPI, sentiment, complaints, trend, and evidence drill-down
- 1 draft or in-review intake batch with mixed approved and rejected items
- edge cases for duplicate detection, invalid rating rejection, and empty-state restaurant setup

The same seeded scenario should be reusable across local dev, CI smoke, and staging demos to avoid "works on one machine" drift.

## Scrum Operating Model

### Roles

- Product Owner: protects the merchant-first goal, enforces scope guards, accepts sprint outcomes
- Scrum Master: runs planning, daily scrum, review, retrospective, and dependency/risk tracking
- Development Team: backend, frontend, and database implementation owners
- QA and Release Owner: owns release evidence, test matrix, smoke validation, backup and rollback proof

### Cadence

- Sprint length: 2 weeks
- Working days per sprint: 10
- Sprint planning: first working block of each sprint
- Daily scrum: every working day, 15 minutes, focused on blockers and sprint goal
- Backlog refinement: middle of each sprint
- Sprint review: end of sprint with live walkthrough of merchant and admin flows
- Retrospective: immediately after sprint review
- Release go or no-go: end of Sprint 4 and end of Sprint 5

### Team Capacity Assumptions

- Core implementation team: 2 developers across backend and frontend
- Shared support: 0.5 QA or release owner capacity for smoke proof, release evidence, and UAT coordination
- Planned sprint capacity: 20 to 24 story points per sprint
- Reserve: 2 to 3 points per sprint stay unassigned for bug fixing, review feedback, and doc sync
- If the team drops below 2 implementation developers, Sprint 1 and Sprint 2 should be split instead of forcing overtime

### Core Artifacts

- product goal statement
- ordered product backlog
- sprint goal
- sprint backlog
- risk and dependency register
- release evidence pack
- demo script with seeded data
- retrospective action list

### Definition of Ready

A story is ready only when:

- it maps to one current route, endpoint, model, or module in this repo
- acceptance criteria cover happy path and failure path
- permissions are explicit
- data and migration impact are understood
- the verification method is named before coding begins
- if the story touches admin behavior, it must respect the live proposal split:
  - user-facing access stays scoped by `RestaurantUser` membership
  - internal control-plane access stays on `User.role = ADMIN`

### Definition of Done

A story is done only when:

- code is merged without breaking existing source-of-truth behavior
- required tests pass for the touched surface
- docs are updated when public behavior changes
- migrations are committed when schema changes occur
- staging or local smoke proof exists for high-risk auth, publish, or release work
- the sprint review can demonstrate the story with realistic seeded data
- merchant-facing stories include loading, empty, and error states, plus basic mobile responsiveness and accessibility checks for focus order, labels, and contrast

## Sprint Roadmap

### Stage A: Product Completion

#### Sprint 1: Trust Contract and Platform Hardening

Sprint goal:
Close the backend trust gaps so future feature work rests on a secure, testable baseline.

Sprint review demo:
Cookie and bearer auth both work, role boundaries are stable, and a real Postgres smoke flow proves publish updates merchant-facing insight data.

Planned capacity:
22 story points

#### Sprint 2: Admin Intake Completion

Sprint goal:
Make manual curation complete and reliable from inbox to publish summary.

Sprint review demo:
Admin creates a batch, edits items, approves and rejects items, skips duplicates, publishes, and sees the resulting dataset update.

Planned capacity:
22 story points

#### Sprint 3: Merchant Decision Loop

Sprint goal:
Make the merchant app feel complete, understandable, and focused on decisions instead of internal mechanics.

Sprint review demo:
Merchant logs in, selects a restaurant, sees top issue and next action, opens review evidence, and checks settings and dataset freshness without touching admin concepts.

Planned capacity:
22 story points

#### Sprint 4: Release Readiness

Sprint goal:
Make Sentify deployable, supportable, and defensible as a finished product.

Sprint review demo:
Live staging walkthrough with health checks, seeded data, browser E2E proof, and backup and rollback evidence.

Planned capacity:
19 story points

### Stage B: Medium-Scale Hardening

#### Sprint 5: Medium-Scale Readiness

Sprint goal:
Raise throughput and operational confidence enough for multi-instance deployment and higher publish volume without rewriting the product.

Sprint review demo:
Publish and insight recompute run asynchronously, the app can run behind more than one instance, and load testing produces documented capacity thresholds.

### Stage C: Large-Scale Architecture Track

#### Sprint 6: Large-Scale Design Only

Sprint goal:
Produce an architecture upgrade path for high-scale deployment. This sprint is not required to call the thesis project complete.

Sprint review demo:
Architecture decision record, capacity model, storage lifecycle plan, and a cost-aware roadmap for read-model separation and large-volume operations.

## Task Breakdown

### S1-T01. Freeze source-of-truth scope and backlog guardrails

- Domain: backend
- Priority: P0
- Estimate: XS, 1 point
- Dependencies: none
- Files: `D:\Project 3\backend-sentify\docs\README.md`, `D:\Project 3\backend-sentify\docs\PROPOSAL.md`, `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`, `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`
- Input: current manual-first docs, current backend docs, current route and API surface
- Output: one agreed project scope line, explicit non-goals, synced testing roadmap, and sprint acceptance boundaries
- Verify: every Sprint 1 to Sprint 4 story maps to the manual-first product; no backlog item depends on removed import automation
- Rollback: revert doc-only changes and restore prior backlog ordering

### S1-T02. Close the CSRF and auth write contract

- Domain: backend
- Priority: P0
- Estimate: L, 5 points
- Dependencies: S1-T01
- Files: `D:\Project 3\backend-sentify\src\controllers\auth.controller.js`, `D:\Project 3\backend-sentify\src\middleware\csrf.js`, `D:\Project 3\backend-sentify\src\lib\auth-cookie.js`, `D:\Project 3\backend-sentify\src\routes\auth.js`, `D:\Project 3\backend-sentify\docs\API.md`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- Input: current bearer plus cookie auth behavior and current CSRF middleware expectations
- Output: stable cookie issuance, token header contract, and documented write-path behavior for browser clients. Acceptance criteria: login sets the CSRF cookie, browser POST with cookie auth and no CSRF token returns `403`, and browser POST with cookie auth plus the correct CSRF token succeeds.
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` plus a manual or scripted browser-style POST smoke that proves the `403` and success cases
- Rollback: temporarily disable cookie-authenticated write flow and fall back to bearer-only writes until CSRF wiring is repaired

### S1-T03. Expand auth and permission coverage

- Domain: backend
- Priority: P0
- Estimate: M, 3 points
- Dependencies: S1-T02
- Files: `D:\Project 3\backend-sentify\test\auth.integration.test.js`, `D:\Project 3\backend-sentify\test\auth.service.test.js`, `D:\Project 3\backend-sentify\test\data-isolation.integration.test.js`, `D:\Project 3\backend-sentify\test\test-helpers.js`, `D:\Project 3\backend-sentify\src\middleware\require-user-role.js`, `D:\Project 3\backend-sentify\src\middleware\require-internal-role.js`, `D:\Project 3\backend-sentify\src\services\restaurant-access.service.js`, `D:\Project 3\backend-sentify\src\services\user-access.service.js`
- Input: current `USER | ADMIN` model, restaurant membership scoping, and known auth edge cases
- Output: explicit coverage for bearer path, cookie path, expired token, invalid token, and cross-restaurant denial
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Rollback: remove newly added failing cases and restore last green baseline while keeping the bug list open

### S1-T04. Add a real Postgres publish smoke path

- Domain: backend
- Priority: P0
- Estimate: XL, 8 points
- Dependencies: S1-T03
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\test`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`
- Input: current schema, current publish service, current dashboard reads
- Output: seeded real database scenario that proves `create batch -> add items -> publish -> insight refresh`
- Verify: `cd "D:\Project 3\backend-sentify" ; npm run db:validate` and a dedicated real DB smoke command agreed in the package scripts
- Rollback: keep mocked integration suite as baseline and mark the real DB harness experimental until it is stable

### S1-T05. Create the shared seed and demo dataset

- Domain: backend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S1-T04
- Files: `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\sentify-scrum-plan.md`
- Input: current Prisma schema, current merchant-first product demo needs, and the real DB smoke path
- Output: a repeatable seed dataset for merchant demo, admin publish flow, QA smoke, and release walkthroughs
- Verify: the team can seed a clean local database and demonstrate dashboard, reviews, settings, and admin publish without hand-editing data
- Rollback: keep a smaller manual seed fallback for demos until the shared dataset is stable

### S2-T01. Complete admin intake inbox and status surfaces

- Domain: frontend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S1-T04, S1-T05
- Files: `D:\Project 3\apps\web\src\features\admin-intake\components\AdminIntakePanel.vue`, `D:\Project 3\apps\web\src\features\admin-intake\components\PublishBatchCard.vue`, `D:\Project 3\apps\web\src\features\admin-intake\adminIntakeLabels.js`, `D:\Project 3\apps\web\src\lib\api.js`, `D:\Project 3\apps\web\src\content\productUiCopy.js`
- Input: list and detail admin intake API plus current product copy
- Output: inbox list with clear batch status, publish state, item counts, and next-step messaging
- Verify: `cd "D:\Project 3\apps\web" ; npm run build` and `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: keep the current panel and hide unfinished status controls behind a local feature flag or route guard

### S2-T02. Finish batch detail editing, approval, rejection, and duplicate handling

- Domain: frontend
- Priority: P1
- Estimate: L, 8 points
- Dependencies: S2-T01
- Files: `D:\Project 3\apps\web\src\features\admin-intake\components\ReviewCurationTable.vue`, `D:\Project 3\apps\web\src\features\admin-intake\components\ReviewEntryForm.vue`, `D:\Project 3\apps\web\src\lib\api.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.controller.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.validation.js`
- Input: admin-intake item update API and current curation UI
- Output: stable row-level editing and approval workflow with duplicate handling rules visible to admins only
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` and `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: preserve edit-only behavior and postpone duplicate automation to the next sprint if it blocks publish correctness

### S2-T03. Add publish summary and audit-safe publish evidence

- Domain: backend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S2-T02
- Files: `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.repository.js`, `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\apps\web\src\features\admin-intake\components\PublishBatchCard.vue`, `D:\Project 3\backend-sentify\docs\DATABASE.md`
- Input: current publish transaction and current intake schema
- Output: publish result summary with counts, timestamps, actor trace, and merchant-safe boundaries
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` and the real DB smoke path from S1-T04
- Rollback: keep publish minimal and log evidence externally until schema support is safe

### S2-T04. Tighten canonical data invariants

- Domain: backend
- Priority: P1
- Estimate: M, 4 points
- Dependencies: S2-T03
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\services\insight.service.js`, `D:\Project 3\backend-sentify\test\admin-intake.service.test.js`, `D:\Project 3\backend-sentify\docs\DATABASE.md`
- Input: current uniqueness, duplicate handling, publish logic, and insight recompute logic
- Output: clearer invariants for dedupe, idempotent publish behavior, and repeatable insight summary generation
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` and `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- Rollback: revert the last migration and restore prior publish behavior if idempotency or duplicate rules regress

### S3-T01. Split the product router into real page boundaries

- Domain: frontend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S1-T04, S1-T05
- Files: `D:\Project 3\apps\web\src\router\index.js`, `D:\Project 3\apps\web\src\components\product\ProductApp.vue`, `D:\Project 3\apps\web\src\components\product\ProductWorkspace.vue`, `D:\Project 3\apps\web\src\features`, `D:\Project 3\apps\web\src\features\admin-intake`, `D:\Project 3\apps\web\src\features\insights`
- Input: current router that mounts the same shell across multiple child routes
- Output: route-level pages with clear ownership, loaders, and access boundaries. Target route map: `/app` redirects to `/app/dashboard`, `/app/dashboard` mounts the dashboard page, `/app/reviews` mounts the reviews page, `/app/settings` mounts the settings page, and `/app/admin` mounts the admin-intake page.
- Verify: `cd "D:\Project 3\apps\web" ; npm run build`
- Rollback: keep the original `ProductApp` shell and introduce new page files behind route-by-route migration

### S3-T02. Complete the dashboard as a decision screen

- Domain: frontend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S3-T01, S2-T04
- Files: `D:\Project 3\apps\web\src\components\product\workspace\DashboardPanel.vue`, `D:\Project 3\apps\web\src\features\insights\components\DatasetStatusCard.vue`, `D:\Project 3\apps\web\src\content\productUiCopy.js`, `D:\Project 3\apps\web\src\lib\api.js`
- Input: dashboard KPI, sentiment, trend, complaints, and dataset metadata endpoints
- Output: top issue, next action, dataset freshness, last publish time, merchant-safe copy, and explicit loading, empty, and error states for dashboard reads. The screen must remain usable on mobile and preserve basic accessibility.
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run` and a review demo using seeded publish data that covers data-ready, empty, loading, and error cases
- Rollback: remove the top issue and next action layer while preserving existing KPI and review read surfaces

### S3-T03. Complete review evidence drill-down

- Domain: frontend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S3-T01, S2-T04
- Files: `D:\Project 3\apps\web\src\components\product\workspace\ReviewsPanel.vue`, `D:\Project 3\apps\web\src\components\product\workspace\RatingFilterSelect.vue`, `D:\Project 3\apps\web\src\components\product\workspace\DateFilterField.vue`, `D:\Project 3\apps\web\src\lib\api.js`
- Input: canonical review read API and dashboard complaint surfaces
- Output: fast review filtering and complaint-to-evidence drill-down without page churn, plus loading, empty, and error states for slow or failed review fetches. The screen must remain responsive on mobile and keyboard-friendly.
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run` with cases for empty result, failed fetch, and filtered evidence drill-down
- Rollback: keep filters client-only or read-only if server-backed filtering introduces instability

### S3-T04. Complete restaurant setup and settings

- Domain: frontend
- Priority: P1
- Estimate: M, 7 points
- Dependencies: S3-T01
- Files: `D:\Project 3\apps\web\src\components\product\RestaurantSwitcher.vue`, `D:\Project 3\apps\web\src\components\product\workspace\RestaurantProfileForm.vue`, `D:\Project 3\apps\web\src\components\product\workspace\SettingsPanel.vue`, `D:\Project 3\apps\web\src\components\product\workspace\SourceSettingsForm.vue`, `D:\Project 3\apps\web\src\lib\api.js`
- Input: restaurant create, update, select, and settings APIs
- Output: complete onboarding and settings flow with empty, loading, success, and failure states
- Verify: `cd "D:\Project 3\apps\web" ; npm run build` and `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: keep current profile form baseline and defer non-blocking settings polish

### S4-T01. Add browser E2E for merchant and admin critical paths

- Domain: frontend
- Priority: P0
- Estimate: L, 8 points
- Dependencies: S2-T04, S3-T04
- Files: `D:\Project 3\apps\web\package.json`, `D:\Project 3\apps\web\src\test`, `D:\Project 3\apps\web\src\router\index.js`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\docs\SETUP.md`
- Input: stable UI routes, stable seeded dataset, and staging or local test environment contract
- Output: repeatable browser tests for login, restaurant select, dashboard read, batch publish, and dataset refresh
- Verify: `cd "D:\Project 3\apps\web" ; npx playwright test`
- Rollback: keep E2E as nightly or manual gating if CI timing or flakiness blocks release

### S4-T02. Stand up staging and release deployment flow

- Domain: backend
- Priority: P0
- Estimate: M, 5 points
- Dependencies: S4-T01
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\backend-sentify\src\app.js`, `D:\Project 3\README.md`
- Input: current runbook, current environment variables, and current health endpoints
- Output: one documented staging deployment path with HTTPS, app startup, migrations, health checks, and rollback steps
- Verify: deployed `/health` and `/api/health` return healthy responses; smoke walkthrough succeeds
- Rollback: restore the last known local-only deploy path while staging config is corrected

### S4-T03. Execute backup, restore, and rollback drills

- Domain: backend
- Priority: P0
- Estimate: S, 3 points
- Dependencies: S4-T02
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\README.md`
- Input: deployed environment, Postgres instance, and release candidate dataset
- Output: repeatable backup, restore, and rollback procedure with time-to-recover evidence
- Verify: restore produces expected dashboard and review data; rollback returns the app to last healthy release
- Rollback: mark the release blocked and stay on current version until drills pass

### S4-T04. Package release evidence and UAT signoff

- Domain: frontend
- Priority: P0
- Estimate: S, 3 points
- Dependencies: S4-T03
- Files: `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\output\doc\11-merchant-first-plan.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\sentify-scrum-plan.md`
- Input: test results, staging walkthrough, backup proof, and merchant reviewer feedback
- Output: one launch packet proving the product is coherent, shippable, and useful
- Verify: Product Owner and QA sign off against the Success Criteria section of this plan
- Rollback: keep the build in release-candidate state and open follow-up backlog items instead of forcing launch

### S5-T01. Move publish and insight recompute off the request path

- Domain: backend
- Priority: P1
- Estimate: L, 8 points
- Dependencies: S4-T04
- Files: `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\services\insight.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake`, `D:\Project 3\backend-sentify\src\services`, `D:\Project 3\backend-sentify\package.json`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- Input: synchronous publish and recompute flow from Stage A
- Output: queued publish processing with observable status and safe retry behavior
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` and a staging publish run that returns quickly while background work completes correctly
- Rollback: keep synchronous publish enabled behind a feature toggle until queue behavior is trusted

### S5-T02. Add shared state for multi-instance readiness

- Domain: backend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S5-T01
- Files: `D:\Project 3\backend-sentify\src\middleware\rate-limit.js`, `D:\Project 3\backend-sentify\src\config\env.js`, `D:\Project 3\backend-sentify\src\app.js`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`
- Input: single-instance assumptions in current middleware and deployment flow
- Output: central cache or coordination layer for rate limiting and multi-instance operation
- Verify: staging smoke passes with more than one app instance behind the same proxy
- Rollback: return to single-instance deployment if shared state causes correctness or latency issues

### S5-T03. Add database read scaling and data retention strategy

- Domain: backend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S5-T02
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\src\services\dashboard.service.js`, `D:\Project 3\backend-sentify\src\services\review.service.js`, `D:\Project 3\backend-sentify\docs\DATABASE.md`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- Input: dashboard-heavy read paths, review growth expectations, and current indexes
- Output: tuned queries, additional indexes where justified, read replica plan, and archival or partition notes for long-term review storage
- Verify: dashboard latency remains within target under seeded load; schema validation remains green
- Rollback: remove non-essential index or query changes that regress write performance

### S5-T04. Run load tests and define capacity thresholds

- Domain: backend
- Priority: P1
- Estimate: M, 5 points
- Dependencies: S5-T03
- Files: `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`, `D:\Project 3\backend-sentify\docs\DATABASE.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-sentify\src\app.js`
- Input: staging environment, seeded dataset, and monitored app metrics
- Output: documented thresholds for concurrent dashboard reads, publish throughput, and acceptable latency and failure rate
- Verify: `cd "D:\Project 3" ; k6 run .\load\dashboard.js` and `cd "D:\Project 3" ; k6 run .\load\publish.js`
- Rollback: treat the environment as non-scale-ready and keep deployment limited to low-volume usage until fixes land

### S6-T01. Produce the large-scale architecture package

- Domain: backend
- Priority: P2
- Estimate: M, 5 points
- Dependencies: S5-T04
- Files: `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`, `D:\Project 3\backend-sentify\docs\DATABASE.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`
- Input: measured load thresholds, known bottlenecks, and cost constraints
- Output: architecture decision record for moving from medium-scale to large-scale operation
- Verify: the team can explain when to split read models, when to add workers, and what storage lifecycle policy keeps costs controlled
- Rollback: keep the system at medium-scale operating limits and do not market it as large-scale ready

## Evidence and Monitoring

## Verification Commands

Use these commands as the minimum runnable proof set while executing the plan:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm test

cd "D:\Project 3\apps\web"
npm run build
npm run test:run

# Sprint 4 and later
npx playwright test

# Sprint 5 and later
k6 run .\load\dashboard.js
k6 run .\load\publish.js
```

### Evidence required before calling Stage A complete

- green `backend-sentify` test suite on a fresh checkout
- green `apps/web` build and unit test run
- one real Postgres smoke proof for publish and dashboard refresh
- browser E2E proof for merchant and admin critical paths
- staging walkthrough with healthy `/health` and `/api/health`
- backup restore and rollback drill reports
- merchant UAT note confirming that top issue and next action are understandable

### Evidence required before calling Stage B complete

- publish requests no longer block on recompute
- multi-instance staging smoke proof exists
- load-test report with explicit saturation thresholds exists
- dashboard latency and publish latency targets are documented and met under agreed test load

### Monitoring signals after release

- publish latency
- dashboard latency
- 5xx rate
- auth failure rate
- database CPU, memory, and connection saturation
- backup success and restore confidence
- time to first actionable insight
- intake-to-publish lead time
- weekly publish cadence per active restaurant

### What drift or failure looks like

- merchants wait too long after publish before insights update
- repeated auth or CSRF errors appear in browser write flows
- dashboard numbers diverge from the published canonical dataset
- staging or production cannot restore from backup within the agreed recovery window
- new feature work revives retired import automation or leaks admin-only concepts into merchant pages

### Fallback paths

- fall back to bearer-only writes if cookie plus CSRF flow becomes unstable
- fall back to synchronous publish if async jobs threaten correctness
- fall back to single-instance deployment if shared state or load balancing is not reliable
- block release if backup restore or rollback proof is missing

## Phase X Verification Checklist

- [ ] Every Sprint 1 to Sprint 4 story maps to the manual-first merchant-first product goal
- [ ] `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- [ ] `cd "D:\Project 3\backend-sentify" ; npm test`
- [ ] `cd "D:\Project 3\apps\web" ; npm run build`
- [ ] `cd "D:\Project 3\apps\web" ; npm run test:run`
- [ ] Browser E2E is green for merchant and admin critical paths
- [ ] Real DB smoke flow is green
- [ ] Health endpoints are verified in a deployed environment
- [ ] Backup restore and rollback drills are documented
- [ ] Release evidence pack exists under `D:\Project 3\release-evidence`
- [ ] Product Owner signs off that the merchant app remains a decision tool, not a data-entry tool
- [ ] QA signs off that the project is whole, shippable, and trustworthy at the claimed scale level

## Final Recommendation

Use this plan in two commitments:

- Commit to Stage A if the goal is to finish the project as a coherent, defendable, launch-ready product.
- Commit to Stage B only if the project must support higher usage immediately after launch.

Do not promise large-scale readiness as part of the core thesis scope.
The honest claim after Stage A is: complete product, solid MVP release, good small-scale readiness.
The honest claim after Stage B is: medium-scale ready with a clear runway.
Large-scale operation remains a separate architecture investment, not a missing checkbox on the current product.
