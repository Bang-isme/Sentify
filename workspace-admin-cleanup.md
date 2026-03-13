## Overview

Split `ProductWorkspace` into feature-focused modules to reduce file size and improve ownership boundaries, add dedicated unit-style tests for the adminâ€‘intake service/controller layer, and remove legacy import automation surfaces.

## Success Criteria

- `apps/web/src/components/product/ProductWorkspace.tsx` no longer contains feature panel implementations (Dashboard, Reviews, Settings, Onboarding).
- New feature panel files compile and preserve the current UI behavior and routing.
- New tests cover adminâ€‘intake service and controller success + failure paths.
- `apps/web` builds and tests pass.
- `backend-sentify` tests pass.
- Backend admin-intake hotspots avoid obvious N+1 patterns.
- Schema indexes support common admin-intake list and batch detail access paths.
- Browser automation and auto-import surfaces are removed from the product UI and schema.

## Progress (2026-03-12)

- [x] T01 â€” Extract Workspace Shared Utilities and UI Primitives
- [x] T02 â€” Split Panels Into Feature Modules
- [x] T03 â€” Wire New Panel Imports and Clean Dead Imports
- [x] T04 â€” Add Adminâ€‘Intake Service Tests
- [x] T05 â€” Add Adminâ€‘Intake Controller Tests
- [x] T06 â€” Final Verification
- [x] T07 â€” Reduce N+1 Risk + Add Supporting Indexes

## Tech Stack

- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + Prisma.
- Tests: `node:test` + `node:assert` (backend), Vitest (frontend).

## Task Breakdown

### T01 â€” Extract Workspace Shared Utilities and UI Primitives

- Domain: frontend
- Priority: P0
- Dependencies: none
- Input:
  - `apps/web/src/components/product/ProductWorkspace.tsx`
- Output:
  - New files `apps/web/src/components/product/workspace/shared.tsx` and `apps/web/src/components/product/workspace/shared-utils.ts`
  - Shared UI primitives live in `shared.tsx`, shared formatting helpers live in `shared-utils.ts`.
- Files:
  - Create: `apps/web/src/components/product/workspace/shared.tsx`
  - Create: `apps/web/src/components/product/workspace/shared-utils.ts`
  - Modify: `apps/web/src/components/product/ProductWorkspace.tsx`
- Code (move unchanged, only adjust imports/exports):
  - Utilities (move to `shared-utils.ts`):
    - `formatNumber`, `formatPercentage`, `formatRating`, `formatReviewDate`, `formatDateTime`
    - `formatSourcePreview`, `getReviewToneClasses`
  - Shared UI (keep in `shared.tsx`):
    - `PageIntro`, `SectionCard`
    - `StatusMessage`, `EmptyPanel`, `SidebarStatusPill`, `FieldError`
    - `RestaurantSetupForm`
  - Ensure helpers import from `shared-utils.ts` and UI primitives import from `shared.tsx`.
- Verify:
  - `npm run build` in `apps/web`
- Rollback:
  - Revert file moves and restore original declarations in `ProductWorkspace.tsx`.

### T02 â€” Split Panels Into Feature Modules

- Domain: frontend
- Priority: P0
- Dependencies: T01
- Input:
  - `apps/web/src/components/product/ProductWorkspace.tsx`
- Output:
  - New panel files with existing logic moved unchanged.
- Files:
  - Create:
    - `apps/web/src/components/product/workspace/OnboardingPanel.tsx`
    - `apps/web/src/components/product/workspace/DashboardPanel.tsx`
    - `apps/web/src/components/product/workspace/ReviewsPanel.tsx`
    - `apps/web/src/components/product/workspace/SettingsPanel.tsx`
  - Modify:
    - `apps/web/src/components/product/ProductWorkspace.tsx`
- Code (move unchanged, adjust imports/exports only):
  - Move `OnboardingPanel` and `RestaurantSetupForm` into `OnboardingPanel.tsx`.
  - Move `DashboardPanel` into `DashboardPanel.tsx`.
  - Move `ReviewsPanel` into `ReviewsPanel.tsx`.
  - Move `SettingsPanel`, `RestaurantProfileForm`, `SourceSettingsForm` into `SettingsPanel.tsx` (remove import history UI).
  - Import shared utilities/components from `workspace/shared.tsx`.
  - `ProductWorkspace.tsx` keeps shell layout, routing, `RestaurantSwitcher`, and navbar.
- Verify:
  - `npm run build` in `apps/web`
  - `npm run test:run` in `apps/web`
- Rollback:
  - Revert panel files and restore inline panel functions in `ProductWorkspace.tsx`.

### T03 â€” Wire New Panel Imports and Clean Dead Imports

- Domain: frontend
- Priority: P1
- Dependencies: T02
- Input:
  - `ProductWorkspace.tsx`
- Output:
  - ProductWorkspace uses new panel modules and shared utilities.
- Files:
  - Modify: `apps/web/src/components/product/ProductWorkspace.tsx`
- Code:
  - Import `OnboardingPanel`, `DashboardPanel`, `ReviewsPanel`, `SettingsPanel`
    from `apps/web/src/components/product/workspace/*`.
  - Import shared format helpers from `apps/web/src/components/product/workspace/shared-utils.ts`.
  - Remove obsolete local declarations and unused imports.
- Verify:
  - `npm run lint` in `apps/web`
- Rollback:
  - Revert import changes and restore old references.

### T04 â€” Add Adminâ€‘Intake Service Tests

- Domain: backend
- Priority: P0
- Dependencies: none
- Input:
  - `backend-sentify/src/modules/admin-intake/admin-intake.service.js`
- Output:
  - New test file with mock-driven service tests.
- Files:
  - Create: `backend-sentify/test/admin-intake.service.test.js`
- Code (full test file, mock style mirrors existing tests):
  - Test `createReviewBatch`:
    - mocks `getRestaurantAccess`, `repository.createBatch`
    - asserts output shape and `counts`.
  - Test `addReviewItems`:
    - mocks `repository.findBatchById`, `repository.createItems`, `repository.updateBatch`
    - verifies status transitions `DRAFT` -> `READY_TO_PUBLISH` when all items approved.
  - Test `updateReviewItem`:
    - mocks `repository.findItemById`, `repository.updateItem`, `repository.findBatchById`
  - Test `publishReviewBatch`:
    - negative: no approved items -> `INTAKE_BATCH_NOT_READY`
    - positive: approved items -> `publishApprovedItems` called and `recalculateRestaurantInsights`
  - Test `__private.buildReviewPayload`:
    - invalid rating throws `INTAKE_REVIEW_INVALID_RATING`
- Verify:
  - `npm test` in `backend-sentify`
- Rollback:
  - Remove the new test file.

### T05 â€” Add Adminâ€‘Intake Controller Tests

- Domain: backend
- Priority: P1
- Dependencies: T04
- Input:
  - `backend-sentify/src/modules/admin-intake/admin-intake.controller.js`
- Output:
  - Controller tests for happy path and validation failure.
- Files:
  - Create: `backend-sentify/test/admin-intake.controller.test.js`
- Code:
  - Mock `admin-intake.service` functions.
  - Create `req`/`res` stubs and assert HTTP status + JSON payload.
  - Add one validation failure case (bad body) to verify 400.
- Verify:
  - `npm test` in `backend-sentify`
- Rollback:
  - Remove the new test file.

### T06 â€” Final Verification

- Domain: frontend + backend
- Priority: P0
- Dependencies: T01â€“T05
- Input:
  - Refactor + tests
- Output:
  - Clean verification run and summary.
- Commands:
  - `npm run lint` in `apps/web`
  - `npm run test:run` in `apps/web`
  - `npm run build` in `apps/web`
  - `npm test` in `backend-sentify`
- Rollback:
  - Revert the last taskâ€™s edits until the failing step is resolved.

### T07 â€” Reduce N+1 Risk + Add Supporting Indexes

- Domain: backend + database
- Priority: P0
- Dependencies: none
- Input:
  - `backend-sentify/src/modules/admin-intake/admin-intake.repository.js`
  - `backend-sentify/prisma/schema.prisma`
- Output:
  - Reduce per-item insert loops where safe.
  - Add admin-intake query-supporting indexes.
- Files:
  - Modify: `backend-sentify/src/modules/admin-intake/admin-intake.repository.js`
  - Modify: `backend-sentify/prisma/schema.prisma`
  - Create: new migration SQL with intake indexes
- Verify:
  - `npm test` in `backend-sentify`
- Rollback:
  - Revert repository + service changes and remove the migration/indexes.

## Phase X Verification Checklist

- [x] `apps/web` lint passes.
- [x] `apps/web` tests pass.
- [x] `apps/web` build passes.
- [x] `backend-sentify` tests pass.
- [x] Adminâ€‘intake service/controller tests added and passing.
- [x] ProductWorkspace split with no behavior regression.
- [x] Admin-intake publish and list paths avoid N+1 query patterns.
