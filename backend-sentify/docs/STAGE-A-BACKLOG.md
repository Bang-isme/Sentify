# Stage A Backlog

Updated: 2026-03-19

## Overview

This backlog turns Stage A of Sentify into an execution-ready Scrum artifact.
It converts the Stage A roadmap from `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md` into sprint-sized epics and stories that a team can take straight into planning, delivery, review, and release preparation.

Stage A is the product-completion track.
Its job is to get Sentify from a late-MVP codebase into a coherent, launch-ready product that is still honest about scale limits.

This backlog keeps the same scope guards:

- manual-first intake stays the source of truth
- canonical `Review` data stays merchant-facing
- no return to merchant-triggered scraping or hidden ingestion automation
- no admin-only notes or diagnostics leak into merchant views
- no large-scale claims are made as part of Stage A

Role-based ownership is intentional.
Replace role labels with actual names during sprint planning without changing the backlog structure.

## Success Criteria

This backlog is complete and ready for execution when:

- every Stage A task from `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md` is represented as an epic or story
- each story has one sprint, one owner, measurable acceptance criteria, and a verification path
- sprint point totals stay within the planned Stage A capacity
- dependencies across backend, frontend, QA, and release work are explicit
- the backlog can be used directly in sprint planning without needing another interpretation pass

Stage A is considered delivered when:

- Sprint 1 proves the trust contract and real DB smoke baseline
- Sprint 2 completes admin intake from inbox to publish confidence
- Sprint 3 completes the merchant decision loop
- Sprint 4 proves release readiness with browser E2E, staging health, and backup or rollback evidence

## Tech Stack

- Frontend: Vue 3, Vue Router, Vite, Vitest, ESLint
- Backend: Node.js, Express, Prisma, PostgreSQL
- Security: JWT, refresh tokens, HTTP-only cookies, CSRF middleware, rate limiting, Helmet
- Release and QA: Playwright, real Postgres smoke flow, health checks, seed data, backup and rollback drills

## Sprint Summary

| Sprint | Sprint Goal | Sprint Owner | Capacity |
|---|---|---|---|
| Sprint 1 | Close trust gaps and establish real-data confidence | Backend Lead | 22 points |
| Sprint 2 | Complete admin curation and publish workflow | Backend Lead | 22 points |
| Sprint 3 | Complete the merchant-facing decision loop | Frontend Lead | 22 points |
| Sprint 4 | Prove release readiness and signoff | QA/Release Owner | 19 points |

## Epic Breakdown

### Epic A1. Trust Contract Foundation

- Sprint: 1
- Epic Owner: Backend Lead
- Goal: lock scope, close browser auth and CSRF ambiguity, and raise confidence in permission handling
- Stories: A1-S1, A1-S2, A1-S3
- Total Points: 9

#### Story A1-S1. Freeze scope and sync testing roadmap

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S1-T01`
- Domain: backend
- Estimate: 1 point
- Dependencies: none
- Files: `D:\Project 3\output\doc\README.md`, `D:\Project 3\output\doc\10-manual-first-admin-architecture.md`, `D:\Project 3\output\doc\11-merchant-first-plan.md`, `D:\Project 3\backend-sentify\docs\README.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\sentify-scrum-plan.md`
- Acceptance Criteria:
  - manual-first and merchant-first scope is the documented source of truth
  - no Sprint 1 to Sprint 4 backlog item depends on retired import automation
  - testing roadmap is aligned with the Stage A sprint sequence
- Verify: review the linked docs and confirm Stage A story mapping remains consistent
- Rollback: revert only the doc sync if it introduces scope ambiguity

#### Story A1-S2. Close the cookie auth and CSRF contract

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S1-T02`
- Domain: backend
- Estimate: 5 points
- Dependencies: A1-S1
- Files: `D:\Project 3\backend-sentify\src\controllers\auth.controller.js`, `D:\Project 3\backend-sentify\src\middleware\csrf.js`, `D:\Project 3\backend-sentify\src\lib\auth-cookie.js`, `D:\Project 3\backend-sentify\src\routes\auth.js`, `D:\Project 3\backend-sentify\docs\API.md`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- Acceptance Criteria:
  - login sets the expected auth cookies and CSRF cookie for browser write flows
  - browser POST with cookie auth and missing CSRF token returns `403`
  - browser POST with cookie auth and valid CSRF token succeeds
  - the API and architecture docs describe the final contract clearly
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test` and a scripted browser-style POST smoke
- Rollback: disable cookie-authenticated writes and keep bearer-only writes until fixed

#### Story A1-S3. Expand auth and permission coverage

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S1-T03`
- Domain: backend
- Estimate: 3 points
- Dependencies: A1-S2
- Files: `D:\Project 3\backend-sentify\test\auth.integration.test.js`, `D:\Project 3\backend-sentify\test\auth.service.test.js`, `D:\Project 3\backend-sentify\test\data-isolation.integration.test.js`, `D:\Project 3\backend-sentify\test\test-helpers.js`, `D:\Project 3\backend-sentify\src\middleware\require-permission.js`, `D:\Project 3\backend-sentify\src\services\restaurant-access.service.js`
- Acceptance Criteria:
  - bearer token path is covered
  - cookie auth path is covered
  - expired or invalid token cases are covered
  - cross-restaurant denial remains enforced
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Rollback: remove only the unstable cases and keep the bug list open

### Epic A2. Real Data Confidence

- Sprint: 1
- Epic Owner: Backend Lead
- Goal: prove Stage A with real seeded data instead of mocked confidence alone
- Stories: A2-S1, A2-S2
- Total Points: 13

#### Story A2-S1. Add real Postgres publish smoke

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S1-T04`
- Domain: backend
- Estimate: 8 points
- Dependencies: A1-S3
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\test`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`
- Acceptance Criteria:
  - one real Postgres smoke path proves `create batch -> add items -> publish -> insight refresh`
  - the smoke path runs outside the mocked Prisma harness
  - setup docs tell the team how to run the smoke path consistently
- Verify: `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- Verify: run the agreed real DB smoke command for the publish path
- Rollback: keep the real DB path experimental while the mocked suite remains green

#### Story A2-S2. Create the shared seed and demo dataset

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S1-T05`
- Domain: backend
- Estimate: 5 points
- Dependencies: A2-S1
- Files: `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\sentify-scrum-plan.md`
- Acceptance Criteria:
  - the seed dataset creates at least 2 restaurants with role-based access coverage
  - the dataset includes one published merchant-facing review set and one in-review intake batch
  - the dataset supports dashboard, reviews, settings, and admin publish demos without hand edits
- Verify: seed a clean local database and run a walkthrough of dashboard plus publish flow
- Rollback: keep a reduced manual seed only for demos until the shared seed is stable

### Epic A3. Admin Intake UX Completion

- Sprint: 2
- Epic Owner: Frontend Lead
- Goal: finish the admin-facing workflow from inbox to curation
- Stories: A3-S1, A3-S2
- Total Points: 13

#### Story A3-S1. Complete intake inbox and status surfaces

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Frontend Lead
- Source Task: `S2-T01`
- Domain: frontend
- Estimate: 5 points
- Dependencies: A2-S1, A2-S2
- Files: `D:\Project 3\apps\web\src\features\admin-intake\components\AdminIntakePanel.vue`, `D:\Project 3\apps\web\src\features\admin-intake\components\PublishBatchCard.vue`, `D:\Project 3\apps\web\src\features\admin-intake\adminIntakeLabels.js`, `D:\Project 3\apps\web\src\lib\api.js`, `D:\Project 3\apps\web\src\content\productUiCopy.js`
- Acceptance Criteria:
  - inbox shows batch status, item counts, and publish state clearly
  - unfinished and published states guide the next admin action
  - copy stays internal-facing and never becomes merchant-facing text
- Verify: `cd "D:\Project 3\apps\web" ; npm run build`
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: hide incomplete states behind a local feature flag

#### Story A3-S2. Finish batch detail editing and duplicate handling

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Frontend Lead
- Source Task: `S2-T02`
- Domain: frontend
- Estimate: 8 points
- Dependencies: A3-S1
- Files: `D:\Project 3\apps\web\src\features\admin-intake\components\ReviewCurationTable.vue`, `D:\Project 3\apps\web\src\features\admin-intake\components\ReviewEntryForm.vue`, `D:\Project 3\apps\web\src\lib\api.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.controller.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.validation.js`
- Acceptance Criteria:
  - admins can edit normalized fields safely
  - admins can approve or reject each intake item
  - duplicate handling rules are visible to admins and do not leak to merchants
  - invalid ratings or malformed records are blocked with useful feedback
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: keep edit-only flow if duplicate automation is not yet trustworthy

### Epic A4. Publish Integrity and Canonical Safety

- Sprint: 2
- Epic Owner: Backend Lead
- Goal: make publish behavior auditable, idempotent, and safe for merchant-facing reads
- Stories: A4-S1, A4-S2
- Total Points: 9

#### Story A4-S1. Add publish summary and audit-safe evidence

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S2-T03`
- Domain: backend
- Estimate: 5 points
- Dependencies: A3-S2
- Files: `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.repository.js`, `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\apps\web\src\features\admin-intake\components\PublishBatchCard.vue`, `D:\Project 3\backend-sentify\docs\DATABASE.md`
- Acceptance Criteria:
  - publish result shows approved count, rejected count, and publish timestamp
  - actor trace is captured in a merchant-safe way
  - merchant-facing reads still depend only on canonical published data
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: rerun the real DB publish smoke from Sprint 1
- Rollback: keep publish minimal and track audit details externally until safe

#### Story A4-S2. Tighten canonical data invariants

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Source Task: `S2-T04`
- Domain: backend
- Estimate: 4 points
- Dependencies: A4-S1
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\services\insight.service.js`, `D:\Project 3\backend-sentify\test\admin-intake.service.test.js`, `D:\Project 3\backend-sentify\docs\DATABASE.md`
- Acceptance Criteria:
  - publish is idempotent for repeated or replayed actions
  - duplicate review handling is consistent with canonical constraints
  - insight regeneration remains deterministic from published data
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- Rollback: revert the last migration or rule change if write safety regresses

### Epic A5. Merchant Navigation and Settings Completion

- Sprint: 3
- Epic Owner: Frontend Lead
- Goal: give the merchant app real page boundaries and a complete setup/settings path
- Stories: A5-S1, A5-S2
- Total Points: 12

#### Story A5-S1. Split the router into real page boundaries

- Sprint: 3
- Sprint Owner: Frontend Lead
- Story Owner: Frontend Lead
- Source Task: `S3-T01`
- Domain: frontend
- Estimate: 5 points
- Dependencies: A2-S1, A2-S2
- Files: `D:\Project 3\apps\web\src\router\index.js`, `D:\Project 3\apps\web\src\components\product\ProductApp.vue`, `D:\Project 3\apps\web\src\components\product\ProductWorkspace.vue`, `D:\Project 3\apps\web\src\features`, `D:\Project 3\apps\web\src\features\admin-intake`, `D:\Project 3\apps\web\src\features\insights`
- Acceptance Criteria:
  - `/app` redirects to `/app/dashboard`
  - `/app/dashboard` mounts the dashboard page
  - `/app/reviews` mounts the reviews page
  - `/app/settings` mounts the settings page
  - `/app/admin` mounts the admin-intake page
- Verify: `cd "D:\Project 3\apps\web" ; npm run build`
- Rollback: keep `ProductApp` as the shell while migrating route by route

#### Story A5-S2. Complete restaurant setup and settings

- Sprint: 3
- Sprint Owner: Frontend Lead
- Story Owner: Frontend Lead
- Source Task: `S3-T04`
- Domain: frontend
- Estimate: 7 points
- Dependencies: A5-S1
- Files: `D:\Project 3\apps\web\src\components\product\RestaurantSwitcher.vue`, `D:\Project 3\apps\web\src\components\product\workspace\RestaurantProfileForm.vue`, `D:\Project 3\apps\web\src\components\product\workspace\SettingsPanel.vue`, `D:\Project 3\apps\web\src\components\product\workspace\SourceSettingsForm.vue`, `D:\Project 3\apps\web\src\lib\api.js`
- Acceptance Criteria:
  - merchant can create, update, and select restaurants without admin-only leakage
  - settings screens handle empty, loading, success, and failure states
  - forms remain usable on mobile widths and keyboard navigation paths
- Verify: `cd "D:\Project 3\apps\web" ; npm run build`
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run`
- Rollback: defer non-blocking settings polish and keep the current profile baseline

### Epic A6. Merchant Decision Loop Completion

- Sprint: 3
- Epic Owner: Frontend Lead
- Goal: make the merchant app useful as a decision tool, not just a data viewer
- Stories: A6-S1, A6-S2
- Total Points: 10

#### Story A6-S1. Complete the dashboard as a decision screen

- Sprint: 3
- Sprint Owner: Frontend Lead
- Story Owner: Frontend Lead
- Source Task: `S3-T02`
- Domain: frontend
- Estimate: 5 points
- Dependencies: A5-S1, A4-S2
- Files: `D:\Project 3\apps\web\src\components\product\workspace\DashboardPanel.vue`, `D:\Project 3\apps\web\src\features\insights\components\DatasetStatusCard.vue`, `D:\Project 3\apps\web\src\content\productUiCopy.js`, `D:\Project 3\apps\web\src\lib\api.js`
- Acceptance Criteria:
  - dashboard shows top issue, next action, dataset freshness, and last publish time
  - loading, empty, and error states are explicit
  - the screen is usable on mobile and preserves basic accessibility
  - merchant copy remains decision-focused instead of admin-workflow-focused
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run`
- Verify: run a seeded demo that covers ready, empty, loading, and failure states
- Rollback: keep KPI reads and drop only the top issue and next action layer if needed

#### Story A6-S2. Complete review evidence drill-down

- Sprint: 3
- Sprint Owner: Frontend Lead
- Story Owner: Frontend Lead
- Source Task: `S3-T03`
- Domain: frontend
- Estimate: 5 points
- Dependencies: A5-S1, A4-S2
- Files: `D:\Project 3\apps\web\src\components\product\workspace\ReviewsPanel.vue`, `D:\Project 3\apps\web\src\components\product\workspace\RatingFilterSelect.vue`, `D:\Project 3\apps\web\src\components\product\workspace\DateFilterField.vue`, `D:\Project 3\apps\web\src\lib\api.js`
- Acceptance Criteria:
  - merchant can filter by rating and date without page churn
  - complaint-to-evidence drill-down is possible from the seeded dataset
  - loading, empty, and error states are explicit
  - keyboard and mobile usage remain acceptable
- Verify: `cd "D:\Project 3\apps\web" ; npm run test:run`
- Verify: run a seeded evidence drill-down demo with empty and failed-fetch cases
- Rollback: keep basic review listing if filtered drill-down becomes unstable

### Epic A7. Release Platform Proof

- Sprint: 4
- Epic Owner: QA/Release Owner
- Goal: prove that the product can run on staging with health, deployment, backup, and rollback confidence
- Stories: A7-S1, A7-S2, A7-S3
- Total Points: 16

#### Story A7-S1. Add browser E2E for merchant and admin critical paths

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: Frontend Lead
- Source Task: `S4-T01`
- Domain: frontend
- Estimate: 8 points
- Dependencies: A4-S2, A5-S2, A6-S1, A6-S2
- Files: `D:\Project 3\apps\web\package.json`, `D:\Project 3\apps\web\src\test`, `D:\Project 3\apps\web\src\router\index.js`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\docs\SETUP.md`
- Acceptance Criteria:
  - login and restaurant selection are covered in browser E2E
  - merchant dashboard read path is covered in browser E2E
  - admin publish and dataset refresh path is covered in browser E2E
  - seeded data is stable enough to support repeatable E2E runs
- Verify: `cd "D:\Project 3\apps\web" ; npx playwright test`
- Rollback: keep E2E as manual or nightly if CI flakiness blocks release

#### Story A7-S2. Stand up staging deployment flow

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: Backend Lead
- Source Task: `S4-T02`
- Domain: backend
- Estimate: 5 points
- Dependencies: A7-S1
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\output\doc\12-minimal-ops-runbook.md`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\backend-sentify\src\app.js`, `D:\Project 3\README.md`
- Acceptance Criteria:
  - staging has a documented deploy path
  - app startup, migrations, and health endpoints work in staging
  - rollback steps are documented and usable
- Verify: deployed `/health` and `/api/health` respond successfully
- Rollback: stay on the local-only release path until staging is stable

#### Story A7-S3. Execute backup, restore, and rollback drills

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: QA/Release Owner
- Source Task: `S4-T03`
- Domain: backend
- Estimate: 3 points
- Dependencies: A7-S2
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\output\doc\12-minimal-ops-runbook.md`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\README.md`
- Acceptance Criteria:
  - backup drill is executed and recorded
  - restore drill rebuilds expected dashboard and review state
  - rollback drill returns the app to the last healthy release
- Verify: run the drill in staging and capture evidence in release notes
- Rollback: block release until recovery proof exists

### Epic A8. Launch Packet and Signoff

- Sprint: 4
- Epic Owner: QA/Release Owner
- Goal: close Stage A with evidence, UAT, and release signoff
- Stories: A8-S1
- Total Points: 3

#### Story A8-S1. Package release evidence and merchant UAT signoff

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: QA/Release Owner
- Source Task: `S4-T04`
- Domain: frontend
- Estimate: 3 points
- Dependencies: A7-S3
- Files: `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\output\doc\11-merchant-first-plan.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`
- Acceptance Criteria:
  - one launch packet exists with test, smoke, deploy, and recovery evidence
  - Product Owner confirms the merchant experience remains a decision tool
  - QA signs off that Stage A is whole, shippable, and trustworthy at small scale
- Verify: signoff review against the Stage A success criteria in the main plan
- Rollback: keep the release in candidate state and open explicit follow-up stories

## Evidence and Monitoring

### Stage A evidence pack

- Stage A evidence should include sprint review demos, seeded dataset proof, smoke outputs, Playwright output, staging health proof, backup and rollback notes, and merchant UAT notes.
- The release candidate should not be called complete without proof for auth, CSRF, canonical publish, merchant reads, and recovery operations.

### Stage A signals to watch during delivery

- CSRF failures in browser write flows
- data drift between published intake results and merchant-facing reads
- review filter latency or broken drill-down behavior
- staging health regressions after deploys
- inability to recreate the seeded demo reliably

### Stage A fallback paths

- fall back to bearer-only writes if cookie and CSRF behavior is unstable
- keep publish synchronous during Stage A if correctness would otherwise drift
- reduce the release claim to "internal demo ready" if staging, recovery, or E2E evidence is missing

## Verification Commands

Use these commands as the minimum runnable proof set while executing the Stage A backlog:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm test

cd "D:\Project 3\apps\web"
npm run build
npm run test:run
npx playwright test
```

Expected outcome:

- backend schema validation completes without Prisma errors
- backend test suite stays green
- frontend build completes successfully
- frontend test suite stays green
- Playwright passes once Sprint 4 critical-path coverage is in place

## Phase X Verification Checklist

- [ ] Sprint 1 point total remains at 22 or below
- [ ] Sprint 2 point total remains at 22 or below
- [ ] Sprint 3 point total remains at 22 or below
- [ ] Sprint 4 point total remains at 19 or below
- [ ] every story has one owner, one sprint, and measurable acceptance criteria
- [ ] `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- [ ] `cd "D:\Project 3\backend-sentify" ; npm test`
- [ ] `cd "D:\Project 3\apps\web" ; npm run build`
- [ ] `cd "D:\Project 3\apps\web" ; npm run test:run`
- [ ] `cd "D:\Project 3\apps\web" ; npx playwright test`
- [ ] staging `/health` and `/api/health` are proven
- [ ] backup, restore, and rollback drills are recorded
- [ ] Product Owner and QA sign off the Stage A launch packet
