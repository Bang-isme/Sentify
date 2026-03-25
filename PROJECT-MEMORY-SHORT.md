# Project Memory Short

Updated: 2026-03-26 Asia/Bangkok

## Current Runtime Contract

- Sentify has exactly two runtime roles:
  - `USER`
  - `ADMIN`
- Post-login is split into two distinct products:
  - merchant app at `/app`
  - admin control plane at `/admin`

## Current Live Backend Surfaces

- Merchant:
  - restaurant list/detail
  - reviews
  - KPI, sentiment, trend, complaints, top issue
  - restaurant settings update
- Admin `Operations`:
  - restaurants overview
  - intake
  - review ops
  - crawl runtime
- Admin `Access`:
  - user directory
  - user detail
  - role changes
  - password-reset trigger
  - membership list/create/delete
- Admin `Platform`:
  - health & jobs
  - integrations & policies
  - audit feed

## Current Frontend Route Tree

- Public/auth:
  - `/`
  - `/login`
  - `/signup`
- Merchant:
  - `/app`
  - `/app/reviews`
  - `/app/actions`
  - `/app/settings`
- Admin:
  - `/admin`
  - `/admin/operations/restaurants`
  - `/admin/operations/intake`
  - `/admin/operations/review-ops`
  - `/admin/operations/crawl`
  - `/admin/access/users`
  - `/admin/access/memberships`
  - `/admin/platform/health-jobs`
  - `/admin/platform/integrations-policies`
  - `/admin/platform/audit`

## Local Baseline

- Reset:
  - `cd D:\Project 3\backend-sentify && npm run db:reset:local-baseline`
- Seeded credentials:
  - `USER`: `demo.user.primary@sentify.local` / `DemoPass123!`
  - `ADMIN`: `demo.admin@sentify.local` / `DemoPass123!`

## Latest Verification

- Backend targeted integration:
  - `cd D:\Project 3\backend-sentify && node --test test/admin-access.integration.test.js test/admin-platform.integration.test.js`
- Frontend unit:
  - `cd D:\Project 3\apps\web && npx vitest run test/App.test.tsx test/api.test.ts --reporter=verbose`
- Browser critical paths:
  - `cd D:\Project 3\apps\web && npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts`

## Immediate Next Priorities

1. Deepen admin `Access` from read/control into fuller account lifecycle if product needs it.
2. Deepen admin `Platform` from visibility into active system controls only when backend policy is ready.
3. Keep FE aligned to backend truth; do not invent third roles or restaurant permission tiers.
