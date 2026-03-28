# Sentify Web

Frontend app for the Sentify user workspace and admin control plane.

## Backend contract

The app is wired to the current backend contract in `backend-sentify`:

- default local API base: `http://localhost:3000/api`
- cookie-authenticated requests use `credentials: "include"`
- write requests automatically send `X-CSRF-Token` from the `XSRF-TOKEN` cookie
- the client retries once through `/auth/refresh` only when a real session cookie exists

You can override the API base with:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Frontend architecture

The FE now mirrors the backend route families instead of routing everything through one mixed workspace:

- `src/App.tsx`: session bootstrap, auth guards, route split, and shell selection
- `src/features/app-shell/`: route tree, navigation metadata, and the shared dense shell frame
- `src/features/merchant-shell/`: `USER` shell orchestration against `/app/*`
- `src/features/merchant-hub/`: merchant wireframe screens for Home, Reviews, Actions, and Settings
- `src/features/admin-shell/`: `ADMIN` shell orchestration against `/admin/*`
- `src/features/admin-hub/`: admin command-center wireframes for `Operations`, `Access`, and `Platform`
- `src/features/access/restaurantAccess.ts`: strict `USER` vs `ADMIN` guard helpers
- `src/lib/api/*`: module-aligned clients for auth, restaurants, admin restaurants, intake, review ops, and review crawl

Current route map:

- merchant app
  - `/app`
  - `/app/reviews`
  - `/app/actions`
  - `/app/settings`
- admin app
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

Legacy `#/app/admin` hashes are redirected to `#/admin`.

## Role model

The runtime role model is now exactly two system roles:

- `USER`
  - enters the user-facing restaurant shell
  - sees dashboard, reviews, settings, restaurant switcher, and profile/logout
  - can update a restaurant only if the backend reports membership for that restaurant
- `ADMIN`
  - enters the internal admin control plane
  - sees 3 grouped domains:
    - `Operations` = live now
    - `Access` = live now
    - `Platform` = live now
  - `Access` includes user lifecycle and membership administration
  - `Platform` includes runtime controls plus release-readiness visibility
  - does not use merchant routes to inspect restaurants

Fail-closed rules:

- direct `#/admin/*` by `USER` redirects to `#/app`
- direct `#/app/*` by `ADMIN` redirects to `#/admin`
- admin navigation never renders in the user shell
- merchant navigation never renders in the admin shell

Source of truth:

- backend roles: `D:\Project 3\backend-sentify\prisma\schema.prisma`
- FE route guards: `src/App.tsx`
- FE access helpers: `src/features/access/restaurantAccess.ts`

## Local run

Reset the shared local demo baseline first:

```bash
cd D:\Project 3\backend-sentify
npm run db:reset:local-baseline
```

Start the backend API:

```bash
cd D:\Project 3\backend-sentify
node src/server.js
```

If you want queue-backed admin crawl flows outside the browser-critical path, start the crawl worker in a second backend terminal:

```bash
cd D:\Project 3\backend-sentify
npm run worker:review-crawl
```

Then run the frontend:

```bash
cd D:\Project 3\apps\web
npm install
npm run dev
```

## Seeded browser credentials

- `USER`: `demo.user.primary@sentify.local` / `DemoPass123!`
- `ADMIN`: `demo.admin@sentify.local` / `DemoPass123!`

## Validation

Unit and build:

```bash
cd D:\Project 3\apps\web
npx vitest run test/api.test.ts test/App.test.tsx
npm run build
```

Browser E2E:

```bash
cd D:\Project 3\apps\web
npx playwright test e2e --workers=1
```

The browser suite now manages its own isolated real stack automatically:

- resets the shared Postgres baseline before the run unless `PLAYWRIGHT_SKIP_DB_RESET=1`
- starts an isolated backend API on `http://127.0.0.1:3100`
- starts the browser-facing Vite server on `http://127.0.0.1:4173`
- uses the dedicated queue namespace `review-crawl-playwright`
- tears down the isolated API and worker after the run unless `PLAYWRIGHT_PRESERVE_BACKEND_STACK=1`

For the most reliable local rerun of the two concurrency-heavy admin/user proofs on this Windows workstation, keep one preview server alive and let Playwright reuse it:

```bash
cd D:\Project 3\apps\web
node .\scripts\playwright-preview.js --host 127.0.0.1 --port 4173 --strictPort
```

Then, from a second terminal:

```bash
cd D:\Project 3\apps\web
npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line
```

That dual-suite command was re-verified on `2026-03-27` with `2/2 passed`.

The same dual-suite command was also re-verified again on `2026-03-27` without prestarting preview manually:

```bash
cd D:\Project 3\apps\web
npx playwright test e2e/admin-user-concurrent-full-flow.spec.ts e2e/admin-user-parallel-live-flow.spec.ts --workers=1 --reporter=line
```

That rerun also passed `2/2`, and the current Playwright harness successfully auto-started the isolated backend stack plus the managed frontend preview on its own. Keep the manual preview-reuse path above as a fallback if an interrupted local run leaves port `4173` sticky.

Current browser coverage proves:

- `USER` can login, land in the merchant app, move across `Home`, `Reviews`, `Actions`, and `Settings`, update settings, and logout
- `ADMIN` can login, land in the admin hub, inspect live `Operations`, `Access`, and `Platform` screens
- `ADMIN` can complete manual intake end-to-end
- `ADMIN` can preview, run, and materialize crawl output from `/admin/operations/crawl`
- merchant-to-admin publication and guardrail flows stay green on the isolated real queue-backed stack
- the two most concurrency-sensitive proofs now have a dedicated rerun path:
  - merchant/admin concurrent source operationalization
  - merchant/admin concurrent manual-intake live publish
- cross-role direct-route attempts are redirected fail-closed

## Current FE scope

- auth shell
- merchant onboarding and restaurant-scoped settings
- merchant insight surfaces over `/api/restaurants/*`
  - `Home` = live now
  - `Reviews` = live now
  - `Actions` = wireframed with live evidence-backed priorities
  - `Settings` = live now with edit mutation
- admin `Operations` over `/api/admin/*`
  - `Restaurants` = live now
  - `Intake` = live now
  - `Review ops` = live now
  - `Crawl` = live now
- admin `Access` and `Platform`
  - `Users` = live now
  - `Memberships` = live now
  - `Health & jobs` = live now
  - `Integrations & policies` = live now
  - `Audit` = live now

The app understands intake batches with `GOOGLE_MAPS_CRAWL` source type for display, while manual batch creation remains scoped to manual source types.
