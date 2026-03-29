# Backend API Gap Plan

## 1. Overview

This plan converts the audit in [backend_api_audit.md](/D:/Project%203/backend_api_audit.md) into a constrained backend roadmap that does not bloat the current `backend-sentify` codebase.

The goal is not to implement every suggested endpoint. The goal is to:

- normalize the audit into the current backend contract
- accept only gaps that fit existing product flow and module boundaries
- prefer extending existing read or filter surfaces over adding new endpoints
- avoid destructive lifecycle routes unless archive or soft-delete is clearly required
- keep docs, tests, and runtime behavior aligned

## 2. Success Criteria

- every audit suggestion is classified as `accept now`, `defer`, or `reject for current scope`
- no proposed route is described as live unless it exists in code, tests, and API docs
- medium-priority additions reuse existing modules and data shapes instead of creating parallel services
- low-priority routes stay documented as backlog only
- implementation order is small, verifiable, and reversible
- merge gate stays green after each accepted slice:
  - `npm test`
  - `npm run test:realdb`

## 2.1 Current Progress

- done:
  - `PATCH /api/auth/profile`
  - `GET /api/admin/platform/controls`
- still planned:
  - `sentiment` filter on `GET /api/restaurants/:id/reviews`
  - admin audit filters
  - admin list pagination
- latest backend gates after the first two accepted slices:
  - `npm test` -> passed (`204` tests: `190` pass, `14` skipped, `0` fail)
  - `npm run test:realdb` -> passed

## 3. Tech Stack

- Node.js
- Express 5
- PostgreSQL
- Prisma 7
- Existing backend modules:
  - `src/controllers`
  - `src/routes`
  - `src/services`
  - `src/modules/admin-*`
  - `src/modules/review-crawl`
  - `src/modules/review-ops`

Rationale:

- the repo is already a modular monolith
- the safest path is to extend existing surfaces inside current modules
- no new cross-cutting framework, event bus, or versioned API layer should be introduced for this audit pass

## 4. Scope Decision Matrix

### Accept now or next

These fit existing data, workflows, and FE value without forcing new architecture:

1. `PATCH /api/auth/profile`
2. `GET /api/admin/platform/controls`
3. add `sentiment` filter to `GET /api/restaurants/:id/reviews`
4. add filter set to `GET /api/admin/platform/audit`
5. add pagination to admin list endpoints
6. optionally `GET /api/admin/review-crawl/sources/:sourceId/raw-reviews` if operator workflow proves real need

### Defer

These are valid ideas but should not land until product demand is concrete:

1. `DELETE /api/restaurants/:id`
2. `GET /api/restaurants/:id/reviews/:reviewId`
3. `DELETE /api/admin/restaurants/:id`
4. `GET /api/admin/restaurants/:id/reviews`
5. `POST /api/admin/review-batches/:id/archive`
6. `PATCH /api/admin/review-batches/:id/status`
7. review text search
8. export endpoints
9. platform-wide stats

### Reject for current scope

These expand product scope or platform obligations too early:

1. `DELETE /api/auth/account`
2. email verification flow
3. notification or webhook system
4. API versioning as a route migration project
5. hard-delete user endpoint

Reason:

- none of them are required to make the current manual-first product better
- each adds operational or compliance surface disproportionate to current product stage

## 4.5 Evidence & Monitoring

Evidence required before claiming any accepted endpoint is done:

- route exists in code
- route is documented in [API.md](/D:/Project%203/backend-sentify/docs/API.md)
- route has unit or integration coverage in the owning module
- full backend gates stay green

Signals to watch after rollout:

- auth error rate for profile updates
- admin latency for list endpoints after pagination or filtering changes
- review query latency after sentiment filter lands
- audit query latency after filter expansion

Drift or failure looks like:

- duplicate read surfaces returning overlapping shapes
- new route requiring FE-only interpretation to be useful
- route exists without tests or docs
- admin list endpoints regressing into unbounded scans

Fallback path:

- remove route registration
- keep docs entry in optional backlog
- preserve existing route behavior and query defaults

## 5. Task Breakdown

### T01. Freeze audit triage

- Domain: `backend`
- Priority: `P0`
- Dependencies: none
- Input:
  - [backend_api_audit.md](/D:/Project%203/backend_api_audit.md)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [PROJECT-STATUS.md](/D:/Project%203/backend-sentify/docs/PROJECT-STATUS.md)
- Output:
  - explicit triage of audit items into `accept now`, `defer`, `reject`
- Files:
  - [backend_api_audit.md](/D:/Project%203/backend_api_audit.md)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [PROJECT-STATUS.md](/D:/Project%203/backend-sentify/docs/PROJECT-STATUS.md)
- Commands:
  - `Get-Content "D:\Project 3\backend_api_audit.md"`
- Verify:
  - no medium or low item is treated as live without code
- Rollback:
  - keep current docs and treat audit as advisory only

### T02. Keep backlog separate from live contract

- Domain: `backend`
- Priority: `P0`
- Dependencies: `T01`
- Input:
  - accepted and deferred audit items
- Output:
  - optional endpoints stay documented as backlog, not live API
- Files:
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [PROJECT-STATUS.md](/D:/Project%203/backend-sentify/docs/PROJECT-STATUS.md)
- Commands:
  - `node -e "console.log('docs-only step')"`
- Verify:
  - docs clearly separate `live contract` vs `optional backlog`
- Rollback:
  - remove backlog section, leave API contract unchanged

### T03. Implement `PATCH /api/auth/profile` - Done

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - current auth session contract
  - existing user/account state logic
- Output:
  - authenticated self-service profile update for `fullName` and optionally `email`
- Files:
  - [auth controller/service files under `src/controllers` and `src/services`](/D:/Project%203/backend-sentify/src)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - matching tests under [test](/D:/Project%203/backend-sentify/test)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; npm test`
  - `cd "D:\Project 3\backend-sentify"; npm run test:realdb`
- Verify:
  - session owner can update allowed profile fields
  - role and lifecycle invariants remain unchanged
- Rollback:
  - remove route and revert to admin-only profile edits

### T04. Add dedicated `GET /api/admin/platform/controls` - Done

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - current controls payload in `health-jobs` and `integrations-policies`
- Output:
  - narrow read model for runtime controls only
- Files:
  - [admin-platform.service.js](/D:/Project%203/backend-sentify/src/modules/admin-platform/admin-platform.service.js)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [admin-platform.integration.test.js](/D:/Project%203/backend-sentify/test/admin-platform.integration.test.js)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; node --test test/admin-platform.integration.test.js`
- Verify:
  - FE can fetch controls without parsing unrelated health data
- Rollback:
  - keep controls embedded only in existing broader platform endpoints

### T05. Add `sentiment` filter to merchant reviews list

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - existing `GET /api/restaurants/:id/reviews`
  - current sentiment fields on canonical reviews
- Output:
  - drill-down from dashboard sentiment to evidence list
- Files:
  - merchant review route/controller/service files under [src](/D:/Project%203/backend-sentify/src)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - merchant review tests under [test](/D:/Project%203/backend-sentify/test)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; npm test`
- Verify:
  - `sentiment=POSITIVE|NEUTRAL|NEGATIVE` filters canonical reviews correctly
- Rollback:
  - remove query param support without affecting existing rating/date filters

### T06. Add filter set to admin audit feed

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - existing `GET /api/admin/platform/audit?limit=25`
  - audit indexes already present in schema
- Output:
  - filters for `restaurantId`, `actorUserId`, `action`, `resourceType`, `from`, `to`
- Files:
  - [admin-platform.service.js](/D:/Project%203/backend-sentify/src/modules/admin-platform/admin-platform.service.js)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [admin-platform.integration.test.js](/D:/Project%203/backend-sentify/test/admin-platform.integration.test.js)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; node --test test/admin-platform.integration.test.js`
- Verify:
  - filtered audit queries use existing indexed dimensions and preserve default limit behavior
- Rollback:
  - keep the current limit-only audit feed

### T07. Add pagination to admin list endpoints

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - current admin list endpoints for restaurants, users, review batches
- Output:
  - stable `page`, `limit`, `total`, `totalPages` contract on admin lists
- Files:
  - [admin-restaurants](/D:/Project%203/backend-sentify/src/modules/admin-restaurants)
  - [admin-access](/D:/Project%203/backend-sentify/src/modules/admin-access)
  - [admin-intake or review-batches routes/services](/D:/Project%203/backend-sentify/src)
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - matching tests under [test](/D:/Project%203/backend-sentify/test)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; npm test`
  - `cd "D:\Project 3\backend-sentify"; npm run test:realdb`
- Verify:
  - list endpoints no longer imply unbounded reads
  - default behavior stays backward-compatible enough for current FE
- Rollback:
  - keep current list shape and defer pagination until FE is ready

### T08. Decide whether raw crawl review read is necessary

- Domain: `backend`
- Priority: `P1`
- Dependencies: `T01`
- Input:
  - actual operator workflow pain around materialize-before-preview
  - existing `ReviewCrawlRawReview` model and admin crawl screens
- Output:
  - go or no-go decision for `GET /api/admin/review-crawl/sources/:sourceId/raw-reviews`
- Files:
  - [backend_api_audit.md](/D:/Project%203/backend_api_audit.md)
  - [PROJECT-STATUS.md](/D:/Project%203/backend-sentify/docs/PROJECT-STATUS.md)
- Commands:
  - `Get-Content "D:\Project 3\backend_api_audit.md"`
- Verify:
  - only implement if operator flow cannot be solved by existing source/run/detail payloads
- Rollback:
  - leave it as deferred backlog

### T09. Explicitly defer destructive or scope-expanding routes

- Domain: `backend`
- Priority: `P2`
- Dependencies: `T01`
- Input:
  - delete, export, notifications, verification, versioning proposals
- Output:
  - backlog remains documented, but no implementation work is started
- Files:
  - [API.md](/D:/Project%203/backend-sentify/docs/API.md)
  - [PROJECT-STATUS.md](/D:/Project%203/backend-sentify/docs/PROJECT-STATUS.md)
- Commands:
  - `node -e "console.log('defer backlog items')"`
- Verify:
  - no accidental route growth
- Rollback:
  - none needed

### T10. Run final backend gates after each accepted slice

- Domain: `backend`
- Priority: `P0`
- Dependencies: `T03`, `T04`, `T05`, `T06`, `T07`
- Input:
  - implemented accepted slices
- Output:
  - verified non-regression
- Files:
  - [test](/D:/Project%203/backend-sentify/test)
  - [docs](/D:/Project%203/backend-sentify/docs)
- Commands:
  - `cd "D:\Project 3\backend-sentify"; npm test`
  - `cd "D:\Project 3\backend-sentify"; npm run test:realdb`
- Verify:
  - all gates green
  - docs reflect live behavior only
- Rollback:
  - revert the last accepted slice only, not the whole audit backlog

## 6. Phase X Verification Checklist

- [ ] live API docs reflect only implemented routes
- [ ] optional backlog stays separated from live contract
- [x] `PATCH /api/auth/profile` is implemented and tested
- [x] `GET /api/admin/platform/controls` is implemented and tested
- [ ] merchant review sentiment drill-down is either implemented and tested or explicitly deferred
- [ ] admin audit filters are either implemented and tested or explicitly deferred
- [ ] admin pagination plan is implemented or deliberately postponed with reason
- [x] `npm test` passes
- [x] `npm run test:realdb` passes
- [ ] no delete or archive route lands without explicit lifecycle semantics
- [ ] no new endpoint duplicates an existing surface with only cosmetic payload differences
