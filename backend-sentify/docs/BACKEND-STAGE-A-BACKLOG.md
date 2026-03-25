# Backend Stage A Backlog

Updated: 2026-03-19

## Overview

This is the backend-only execution slice of Stage A from `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`.
It is intentionally filtered so the backend team can plan and deliver without carrying frontend scope.

In this artifact:

- backend API, database, auth, publish flow, testing, docs, and backend ops are in scope
- frontend routes, screens, components, and browser UX work are out of scope
- release readiness is interpreted as backend release readiness only

The product goal stays the same:
Sentify must help restaurant owners receive trusted, decision-ready insight from a manually curated dataset.
This backlog exists to make the backend trustworthy enough that frontend integration can happen later without shifting backend foundations again.

Source-of-truth inputs:

- `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`
- `D:\Project 3\backend-sentify\docs\API.md`
- `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- `D:\Project 3\backend-sentify\docs\DATABASE.md`
- `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`
- `D:\Project 3\output\doc\11-merchant-first-plan.md`
- `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`

## Success Criteria

Backend Stage A is complete when all of the following are true:

- the auth and CSRF contract is closed for browser-authenticated write requests
- restaurant-scoped authorization is tested and stable
- one real Postgres smoke flow proves `create batch -> add items -> publish -> dashboard refresh`
- the shared seed dataset supports backend smoke, review demo, and release verification
- admin-intake publish flow is audit-safe and idempotent enough for repeated use
- merchant-facing read APIs for restaurants, reviews, KPI, sentiment, trend, complaints, and top issue are verified against seeded real data
- backend docs match the actual API, architecture, database, and testing posture
- backend staging deployment, health checks, backup, restore, and rollback proof exist

This artifact is successful as a sprint backlog when:

- every story has one sprint, one owner, dependencies, and measurable acceptance criteria
- all sprint totals stay within backend-only capacity
- nothing in this file requires frontend implementation to be considered done

## Tech Stack

- Runtime: Node.js, Express 5, CommonJS
- Data: PostgreSQL, Prisma 7
- Security: JWT, refresh tokens, auth cookies, CSRF middleware, Helmet, rate limiting
- Testing: `node --test`, mocked integration, planned real Postgres smoke
- Operations: health endpoints, request logging, documented staging and recovery flow

## Team Capacity

- Team shape: 1 backend lead plus 0.5 QA/release support
- Sprint length: 2 weeks
- Working days per sprint: 10
- Planned backend capacity: 14 to 18 points per sprint
- Reserve: 2 points per sprint for defects, doc sync, and release fallout

## Sprint Summary

| Sprint | Goal | Sprint Owner | Capacity |
|---|---|---|---|
| Sprint 1 | Close trust gaps in auth, CSRF, and permissions | Backend Lead | 13 points |
| Sprint 2 | Prove real-data publish flow and shared seed baseline | Backend Lead | 18 points |
| Sprint 3 | Harden publish invariants and merchant-read API confidence | Backend Lead | 15 points |
| Sprint 4 | Prove backend release readiness in staging | QA/Release Owner | 14 points |

## Task Breakdown

### Epic B1. Trust Contract

- Sprint: 1
- Epic Owner: Backend Lead
- Goal: eliminate backend trust ambiguity before more features land
- Total Points: 13

#### Story B1-S1. Freeze scope and sync testing roadmap

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 1 point
- Dependencies: none
- Files: `D:\Project 3\output\doc\README.md`, `D:\Project 3\output\doc\11-merchant-first-plan.md`, `D:\Project 3\backend-sentify\docs\README.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\BACKEND-STAGE-A-BACKLOG.md`
- Input: current manual-first product scope, current backend docs, current Stage A plan
- Output: one backend-only sprint roadmap that does not depend on frontend completion
- Acceptance Criteria:
  - backend roadmap is aligned with the manual-first product direction
  - testing strategy references the same sprint focus as this backend backlog
  - no story in this artifact depends on frontend route or page work
- Verify: review the linked docs and confirm sprint mapping is consistent
- Rollback: revert the doc-only sync if scope becomes less clear

#### Story B1-S2. Close the CSRF and auth write contract

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 5 points
- Dependencies: B1-S1
- Files: `D:\Project 3\backend-sentify\src\controllers\auth.controller.js`, `D:\Project 3\backend-sentify\src\middleware\csrf.js`, `D:\Project 3\backend-sentify\src\lib\auth-cookie.js`, `D:\Project 3\backend-sentify\src\routes\auth.js`, `D:\Project 3\backend-sentify\docs\API.md`, `D:\Project 3\backend-sentify\docs\ARCHITECTURE.md`
- Input: current bearer-plus-cookie auth implementation and current CSRF middleware behavior
- Output: final browser write contract for backend auth
- Acceptance Criteria:
  - login issues the expected CSRF cookie for cookie-authenticated writes
  - write requests with cookie auth and no CSRF token return `403`
  - write requests with cookie auth and valid CSRF token succeed
  - backend docs describe the final behavior clearly
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: run a scripted browser-style POST smoke that proves both the `403` and success path
- Rollback: disable cookie-authenticated writes and keep bearer writes only until fixed

#### Story B1-S3. Expand auth and permission coverage

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 3 points
- Dependencies: B1-S2
- Files: `D:\Project 3\backend-sentify\test\auth.integration.test.js`, `D:\Project 3\backend-sentify\test\auth.service.test.js`, `D:\Project 3\backend-sentify\test\data-isolation.integration.test.js`, `D:\Project 3\backend-sentify\test\test-helpers.js`, `D:\Project 3\backend-sentify\src\middleware\require-user-role.js`, `D:\Project 3\backend-sentify\src\middleware\require-internal-role.js`, `D:\Project 3\backend-sentify\src\services\restaurant-access.service.js`, `D:\Project 3\backend-sentify\src\services\user-access.service.js`
- Input: current `USER | ADMIN` model, restaurant membership scoping, and auth edge cases
- Output: stronger denial-path and token-path coverage
- Acceptance Criteria:
  - bearer token path is covered
  - cookie-authenticated path is covered
  - invalid and expired token cases are covered
  - cross-restaurant access remains denied
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Rollback: remove only unstable test additions and keep issue tracking open

#### Story B1-S4. Harden session and token lifecycle endpoints

- Sprint: 1
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P1
- Estimate: 4 points
- Dependencies: B1-S3
- Files: `D:\Project 3\backend-sentify\src\controllers\auth.controller.js`, `D:\Project 3\backend-sentify\src\services\refresh-token.service.js`, `D:\Project 3\backend-sentify\src\services\password-reset.service.js`, `D:\Project 3\backend-sentify\test\auth.integration.test.js`, `D:\Project 3\backend-sentify\docs\API.md`
- Input: current register, login, session, refresh, logout, forgot-password, and reset-password endpoints
- Output: stable lifecycle contract for backend auth flows
- Acceptance Criteria:
  - refresh rotates tokens correctly
  - logout revokes the current session version
  - password reset and password change flows remain documented and test-covered
  - session endpoint returns the correct restaurant membership payload
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Rollback: keep the existing auth surface and defer risky token changes

### Epic B2. Real Data Baseline

- Sprint: 2
- Epic Owner: Backend Lead
- Goal: prove the backend on real seeded Postgres data instead of mock-only confidence
- Total Points: 18

#### Story B2-S1. Add a real Postgres publish smoke path

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 8 points
- Dependencies: B1-S4
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\test`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`
- Input: current publish flow, Prisma schema, and dashboard read surface
- Output: one real DB smoke path that proves publish affects canonical insight data
- Acceptance Criteria:
  - smoke flow uses actual Postgres, not mocked Prisma
  - smoke flow proves `create batch -> add items -> publish -> dashboard refresh`
  - setup docs explain how to run it locally and in staging-like environments
- Verify: `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- Verify: run the agreed real DB smoke command for the publish path
- Rollback: keep the real DB smoke path experimental while mocked tests remain the baseline

#### Story B2-S2. Create the shared seed and demo dataset

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 5 points
- Dependencies: B2-S1
- Files: `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\BACKEND-STAGE-A-BACKLOG.md`
- Input: current schema, merchant-first data needs, real DB smoke path
- Output: one repeatable seed dataset for backend smoke, demo, and release checks
- Acceptance Criteria:
  - dataset includes at least 2 restaurants and role-based membership cases
  - dataset includes one published review set and one in-review intake batch
  - dataset includes duplicates and invalid-input cases for backend validation
- Verify: seed a clean database and run the publish smoke plus dashboard read checks without hand edits
- Rollback: keep a smaller manual seed fallback for demos

#### Story B2-S3. Add publish summary and audit-safe publish evidence

- Sprint: 2
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P1
- Estimate: 5 points
- Dependencies: B2-S2
- Files: `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.repository.js`, `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\docs\DATABASE.md`, `D:\Project 3\backend-sentify\docs\API.md`
- Input: current publish transaction and intake schema
- Output: safer backend publish result with actor trace and summary information
- Acceptance Criteria:
  - publish returns counts and timestamps consistently
  - publish records remain merchant-safe and do not leak intake-only state into read APIs
  - publish evidence supports release review and issue triage
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: rerun the real DB publish smoke and inspect publish result output
- Rollback: keep publish minimal and track extra evidence outside the API until stable

### Epic B3. Publish Integrity and API Confidence

- Sprint: 3
- Epic Owner: Backend Lead
- Goal: harden canonical writes and prove the merchant-read API surface on real data
- Total Points: 15

#### Story B3-S1. Tighten canonical publish invariants

- Sprint: 3
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 4 points
- Dependencies: B2-S3
- Files: `D:\Project 3\backend-sentify\prisma\schema.prisma`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\src\services\insight.service.js`, `D:\Project 3\backend-sentify\test\admin-intake.service.test.js`, `D:\Project 3\backend-sentify\docs\DATABASE.md`
- Input: current duplicate handling, publish logic, insight regeneration logic
- Output: clearer idempotency and canonical write guarantees
- Acceptance Criteria:
  - repeated publish attempts behave safely
  - duplicate handling is consistent with canonical review constraints
  - insight regeneration remains deterministic from canonical data
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- Rollback: revert the last migration or invariant change if write safety regresses

#### Story B3-S2. Add merchant-read API confidence on seeded data

- Sprint: 3
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 6 points
- Dependencies: B2-S2, B3-S1
- Files: `D:\Project 3\backend-sentify\src\routes\restaurants.js`, `D:\Project 3\backend-sentify\src\controllers\dashboard.controller.js`, `D:\Project 3\backend-sentify\src\controllers\reviews.controller.js`, `D:\Project 3\backend-sentify\src\services\dashboard.service.js`, `D:\Project 3\backend-sentify\src\services\review.service.js`, `D:\Project 3\backend-sentify\test\dashboard.integration.test.js`, `D:\Project 3\backend-sentify\test\data-isolation.integration.test.js`, `D:\Project 3\backend-sentify\docs\API.md`
- Input: seeded canonical data, current dashboard and review endpoints
- Output: stronger backend confidence for merchant-facing reads
- Acceptance Criteria:
  - restaurants, reviews, KPI, sentiment, trend, complaints, and top-issue endpoints are verified against seeded data
  - cross-restaurant isolation remains intact
  - dataset status and insight summary payloads are stable enough for later frontend integration
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: run the read-path smoke against seeded Postgres data
- Rollback: keep the existing API surface and defer only the unstable endpoint contract changes

#### Story B3-S3. Add admin-intake API confidence on seeded data

- Sprint: 3
- Sprint Owner: Backend Lead
- Story Owner: Backend Lead
- Domain: backend
- Priority: P1
- Estimate: 5 points
- Dependencies: B2-S2, B3-S1
- Files: `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.controller.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.validation.js`, `D:\Project 3\backend-sentify\src\modules\admin-intake\admin-intake.service.js`, `D:\Project 3\backend-sentify\test\admin-intake.controller.test.js`, `D:\Project 3\backend-sentify\test\admin-intake.service.test.js`, `D:\Project 3\backend-sentify\docs\API.md`
- Input: current admin create, list, detail, item update, and publish routes
- Output: stronger backend confidence for the admin intake API surface
- Acceptance Criteria:
  - batch create, list, detail, add item, update item, and publish flows are covered by meaningful tests
  - invalid ratings, malformed input, and duplicate data cases are handled consistently
  - permission and restaurant membership rules stay intact
- Verify: `cd "D:\Project 3\backend-sentify" ; npm test`
- Verify: run seeded admin flow smoke through create-to-publish path
- Rollback: keep existing routes and validation rules if a change weakens publish correctness

### Epic B4. Backend Release Readiness

- Sprint: 4
- Epic Owner: QA/Release Owner
- Goal: prove the backend can be deployed, observed, and recovered safely
- Total Points: 14

#### Story B4-S1. Stand up backend staging deployment flow

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: Backend Lead
- Domain: backend
- Priority: P0
- Estimate: 5 points
- Dependencies: B3-S2, B3-S3
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\backend-sentify\src\app.js`, `D:\Project 3\README.md`
- Input: current runbook, env config, health endpoints
- Output: one documented backend staging deploy path
- Acceptance Criteria:
  - backend can start with correct environment variables in staging
  - migrations run cleanly in staging
  - `/health` and `/api/health` report expected status
- Verify: deploy to staging and hit both health endpoints successfully
- Rollback: stay on local-only backend release path until staging is stable

#### Story B4-S2. Add backend smoke, health, and log verification in staging

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: QA/Release Owner
- Domain: backend
- Priority: P0
- Estimate: 4 points
- Dependencies: B4-S1
- Files: `D:\Project 3\backend-sentify\src\app.js`, `D:\Project 3\backend-sentify\src\middleware\request-logger.js`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-stage-a-backlog.md`
- Input: staging deployment, request logging, health endpoints
- Output: one backend smoke routine for pre-release validation
- Acceptance Criteria:
  - staging smoke checks cover auth, publish, dashboard read, and health
  - request logging is usable enough for incident triage
  - smoke routine is documented for repeatable release checks
- Verify: run the staging smoke routine and capture outputs in release notes
- Rollback: block release if smoke routine is incomplete or health checks drift

#### Story B4-S3. Execute backup, restore, and rollback drills

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: QA/Release Owner
- Domain: backend
- Priority: P0
- Estimate: 3 points
- Dependencies: B4-S2
- Files: `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\OPS-RUNBOOK.md`, `D:\Project 3\backend-sentify\prisma`, `D:\Project 3\backend-sentify\src\server.js`, `D:\Project 3\README.md`
- Input: staging database, release candidate data, deploy flow
- Output: recovery proof for Stage A backend release
- Acceptance Criteria:
  - backup drill is completed and recorded
  - restore drill recreates expected dashboard and review state
  - rollback drill returns the backend to the last healthy release
- Verify: execute the drills in staging and capture the evidence
- Rollback: block release until recovery proof exists

#### Story B4-S4. Package backend release evidence and signoff

- Sprint: 4
- Sprint Owner: QA/Release Owner
- Story Owner: QA/Release Owner
- Domain: backend
- Priority: P1
- Estimate: 2 points
- Dependencies: B4-S3
- Files: `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`, `D:\Project 3\backend-sentify\docs\SETUP.md`, `D:\Project 3\backend-sentify\docs\BACKEND-STAGE-A-BACKLOG.md`, `D:\Project 3\backend-sentify\docs\SCRUM-PLAN.md`
- Input: test outputs, staging smoke, deploy notes, recovery drills
- Output: backend Stage A release packet
- Acceptance Criteria:
  - release packet includes auth, publish, read API, health, and recovery evidence
  - Backend Lead signs off backend readiness
  - QA/Release Owner signs off backend release confidence
- Verify: review the release packet against the success criteria in this file
- Rollback: hold the backend in release-candidate state and open follow-up stories

## Evidence and Monitoring

### Required backend evidence before completion

- green `backend-sentify` test suite on a fresh checkout
- green `npm run db:validate`
- one real Postgres smoke proof for publish and dashboard refresh
- seeded dataset walkthrough proof
- staging health proof for `/health` and `/api/health`
- backup, restore, and rollback drill notes
- backend release packet with signoff

### Signals to watch

- repeated CSRF failures on cookie-authenticated writes
- publish latency and insight refresh delays
- cross-restaurant data leakage
- data drift between intake publish result and merchant-read endpoints
- staging health degradation after deploy

### Fallback paths

- fall back to bearer-only writes if cookie plus CSRF remains unstable
- keep publish synchronous during Stage A if correctness is at risk
- block release if staging health or recovery proof is incomplete

## Verification Commands

Use these commands as the minimum runnable proof set while executing this backend backlog:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:validate
npm test

# Sprint 2 and later
node --test test\publish.realdb.test.js
```

Expected outcome:

- Prisma schema validates cleanly
- backend tests stay green
- the real DB smoke path proves publish and read-model refresh once implemented

## Phase X Verification Checklist

- [ ] Sprint 1 stays at 13 points or below
- [ ] Sprint 2 stays at 18 points or below
- [ ] Sprint 3 stays at 15 points or below
- [ ] Sprint 4 stays at 14 points or below
- [ ] every story has one sprint, one owner, and measurable acceptance criteria
- [ ] `cd "D:\Project 3\backend-sentify" ; npm run db:validate`
- [ ] `cd "D:\Project 3\backend-sentify" ; npm test`
- [ ] real Postgres publish smoke is green
- [ ] staging `/health` and `/api/health` are proven
- [ ] backup, restore, and rollback drills are recorded
- [ ] Backend Lead and QA/Release Owner sign off the release packet
