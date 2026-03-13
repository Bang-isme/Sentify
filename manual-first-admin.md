# Overview

This plan repositions Sentify from `merchant-triggered Google Maps import` to `admin-curated review intake`.

Why it matters:

- the current import subsystem is expensive to maintain
- the business direction now values data accuracy over automation depth
- frontend and backend need clearer module boundaries before further feature work

# Success Criteria

- Merchant-facing UI no longer depends on Google import run state to explain dataset trust.
- Admin can add review data manually through a dedicated intake flow before publishing it to the canonical review dataset.
- Frontend code is split by feature boundaries instead of a single app shell plus a single mega workspace file.
- Backend code isolates `admin intake`, `reviews`, and `insights` into explicit modules.
- Browser automation and auto-import paths are removed from the product surface and schema.
- Existing restaurant, review, dashboard, and insight behavior remains functional during migration.

# Tech Stack

- Frontend: React + Vite
  - keep the existing stack to reduce migration risk
  - add feature-folder boundaries before considering a separate `apps/admin`
- Backend: Node.js + Express + Prisma
  - keep the current runtime
  - move toward modular monolith boundaries inside `src/modules`
- Database: PostgreSQL + Prisma schema migrations
  - add intake-oriented tables before retiring or shrinking import-oriented runtime paths

# Task Breakdown

## T01. Lock the target architecture
- id: T01
- domain: frontend
- priority: P0
- dependencies: none
- input: current repo structure, proposal docs, audit findings
- output: approved manual-first architecture doc and phased execution plan
- files:
  - `manual-first-admin.md`
  - `output/doc/10-manual-first-admin-architecture.md`
  - `output/doc/README.md`
- commands:
  - `Get-Content manual-first-admin.md`
  - `Get-Content output/doc/10-manual-first-admin-architecture.md`
- verify:
  - architecture doc names the target FE tree, BE tree, admin flow, and migration phases
  - plan file names task dependencies and rollback paths
- rollback:
  - delete the new docs if the team rejects the direction

## T02. Add canonical manual-intake data model
- id: T02
- domain: backend
- priority: P0
- dependencies: T01
- input: current `Restaurant`, `Review`, and import-oriented schema
- output: schema for admin-curated review intake
- files:
  - `backend-sentify/prisma/schema.prisma`
  - `backend-sentify/prisma/migrations/*`
- commands:
  - `npm run db:validate`
  - `npm run db:generate`
- verify:
  - schema adds `ReviewIntakeBatch` and `ReviewIntakeItem` or equivalent status-driven tables
  - canonical `Review` table remains merchant-facing read model
- rollback:
  - revert the migration and schema additions

## T03. Create backend module boundaries
- id: T03
- domain: backend
- priority: P0
- dependencies: T02
- input: flat `src/services`, `src/controllers`, and `src/routes`
- output: modular backend layout without breaking existing routes
- files:
  - `backend-sentify/src/modules/auth/*`
  - `backend-sentify/src/modules/restaurants/*`
  - `backend-sentify/src/modules/reviews/*`
  - `backend-sentify/src/modules/insights/*`
  - `backend-sentify/src/modules/admin-intake/*`
  - `backend-sentify/src/shared/*`
- commands:
  - `npm test`
- verify:
  - new modules own their controller, service, repository/query logic, and validation entry points
  - `google-browser-review-tool.service.js` is no longer treated as a general-purpose service
- rollback:
  - keep compatibility re-export files from old paths until consumers are updated

## T04. Add admin intake API
- id: T04
- domain: backend
- priority: P0
- dependencies: T03
- input: target intake schema and module boundaries
- output: admin endpoints for capture, edit, review, publish
- files:
  - `backend-sentify/src/modules/admin-intake/admin-intake.routes.js`
  - `backend-sentify/src/modules/admin-intake/admin-intake.controller.js`
  - `backend-sentify/src/modules/admin-intake/admin-intake.service.js`
  - `backend-sentify/src/modules/admin-intake/admin-intake.validation.js`
  - `backend-sentify/src/app.js`
- commands:
  - `npm test`
- verify:
  - endpoints exist for `POST /api/admin/review-batches`
  - endpoints exist for `POST /api/admin/review-batches/:id/items`
  - endpoints exist for `PATCH /api/admin/review-items/:id`
  - endpoints exist for `POST /api/admin/review-batches/:id/publish`
- rollback:
  - leave routes dark or behind admin-only registration if publish flow is not ready

## T05. Build frontend feature shell
- id: T05
- domain: frontend
- priority: P0
- dependencies: T01
- input: current `App.tsx` and `ProductWorkspace.tsx`
- output: feature-first frontend skeleton
- files:
  - `apps/web/src/app/*`
  - `apps/web/src/features/auth/*`
  - `apps/web/src/features/restaurants/*`
  - `apps/web/src/features/reviews/*`
  - `apps/web/src/features/insights/*`
  - `apps/web/src/features/settings/*`
  - `apps/web/src/features/admin-intake/*`
  - `apps/web/src/shared/*`
- commands:
  - `npm run build`
  - `npm run test:run`
- verify:
  - routing/providers move out of a monolithic `App.tsx`
  - product workspace panels no longer live in one file
- rollback:
  - keep compatibility barrel exports and migrate one feature at a time

## T06. Build admin manual-entry screens
- id: T06
- domain: frontend
- priority: P0
- dependencies: T04, T05
- input: admin intake API and feature shell
- output: admin UI for capture, curation, publish
- files:
  - `apps/web/src/features/admin-intake/pages/AdminReviewInboxPage.tsx`
  - `apps/web/src/features/admin-intake/pages/AdminReviewBatchPage.tsx`
  - `apps/web/src/features/admin-intake/components/ReviewEntryForm.tsx`
  - `apps/web/src/features/admin-intake/components/ReviewCurationTable.tsx`
  - `apps/web/src/features/admin-intake/components/PublishBatchCard.tsx`
- commands:
  - `npm run test:run`
- verify:
  - admin can create a batch, add reviews, edit fields, and publish
  - UI supports at least single-entry and bulk-paste modes
- rollback:
  - keep the screens internal-only until publish behavior is trusted

## T07. Simplify merchant-facing dataset status
- id: T07
- domain: frontend
- priority: P0
- dependencies: T05, T06
- input: current import run polling and status UI
- output: merchant UI shows dataset freshness, not crawler internals
- files:
  - `apps/web/src/features/insights/components/DatasetStatusCard.tsx`
  - `apps/web/src/App.tsx`
- commands:
  - `npm run test:run`
- verify:
  - merchant dashboard reflects dataset status without import polling or history
  - settings no longer exposes import/debug details
- rollback:
  - retain the old card behind a temporary feature flag if required

## T08. Remove Google Maps importer and browser automation
- id: T08
- domain: backend
- priority: P1
- dependencies: T03, T04, T07
- input: current import subsystem + automation scripts
- output: importer/automation removed, schema cleaned of import artifacts
- files:
  - `backend-sentify/src/services/review-import*.js`
  - `backend-sentify/src/services/google-browser-review-tool.service.js`
  - `backend-sentify/scripts/*review*`
  - `backend-sentify/prisma/schema.prisma`
- commands:
  - `npm test`
- verify:
  - browser automation and auto-import endpoints are gone
  - merchant reads canonical reviews and insights regardless of automation removal
- rollback:
  - restore removed modules if automation is explicitly re-approved

## T09. Add regression coverage
- id: T09
- domain: debug
- priority: P0
- dependencies: T04, T06, T07
- input: new admin intake and simplified merchant surface
- output: tests that protect the new product contract
- files:
  - `backend-sentify/test/admin-intake.service.test.js`
  - `backend-sentify/test/admin-intake.routes.test.js`
  - `apps/web/test/admin-intake.test.tsx`
  - `apps/web/test/merchant-dataset-status.test.tsx`
- commands:
  - `npm test`
  - `npm run test:run`
- verify:
  - publishing a reviewed batch creates canonical reviews and recalculates insights
  - merchant app still loads dashboard and reviews without import-run coupling
- rollback:
  - stop rollout until tests are green

# Phase X Verification Checklist

- [ ] Architecture blueprint approved
- [ ] Prisma schema validated
- [ ] Backend tests pass with the new intake module
- [ ] Frontend tests pass with the new admin flow
- [ ] Frontend build passes
- [ ] Merchant flows still work for restaurant selection, dashboard, reviews, and settings
- [ ] Google Maps importer is no longer the default merchant mental model
- [ ] Docs updated so new contributors can follow the new boundaries
