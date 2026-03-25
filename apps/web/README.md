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
- `src/features/merchant-shell/`: `USER` flow for dashboard, review evidence, and settings
- `src/features/admin-shell/`: `ADMIN` flow for restaurant overview, intake, review ops, and crawl runtime
- `src/features/access/restaurantAccess.ts`: strict `USER` vs `ADMIN` guard helpers
- `src/lib/api/*`: module-aligned clients for auth, restaurants, admin restaurants, intake, review ops, and review crawl

Current route map:

- `/app`
- `/app/reviews`
- `/app/settings`
- `/admin`
- `/admin/intake`
- `/admin/review-ops`
- `/admin/review-crawl`

Legacy `#/app/admin` hashes are redirected to `#/admin`.

## Role model

The runtime role model is now exactly two system roles:

- `USER`
  - enters the user-facing restaurant shell
  - sees dashboard, reviews, settings, restaurant switcher, and profile/logout
  - can update a restaurant only if the backend reports membership for that restaurant
- `ADMIN`
  - enters the internal admin control plane
  - sees restaurants overview, intake, review ops, crawl runtime, and profile/logout
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
npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts
```

The first-wave browser coverage proves:

- `USER` can login, land in the merchant shell, view dashboard and review evidence, update settings, and logout
- `ADMIN` can login, land in the admin overview, inspect intake, review ops, crawl runtime, and logout
- cross-role direct-route attempts are redirected fail-closed

## Current FE scope

- auth shell
- restaurant onboarding and restaurant-scoped settings
- user dashboard and review evidence over `/api/restaurants/*`
- admin restaurant overview over `/api/admin/restaurants*`
- admin intake over review-batch APIs
- admin review ops for `sync-to-draft`, run history, readiness, approve-valid, and publish
- admin review crawl for preview, source upsert, run lifecycle, and intake materialization

The app understands intake batches with `GOOGLE_MAPS_CRAWL` source type for display, while manual batch creation remains scoped to manual source types.
