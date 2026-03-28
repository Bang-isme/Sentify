# Sentify

Sentify is an AI-assisted customer insight tool for F&B businesses with a strict two-surface product split:

- `USER` for the restaurant-facing workspace
- `ADMIN` for the internal control plane

## Current Scope

- Auth: register, login, logout
- Restaurant: create restaurant, join restaurant-scoped user flow, save Google Maps URL
- Role-aware FE shells: merchant app separated from admin control plane
- Merchant app IA: `Home`, `Reviews`, `Actions`, `Settings`
- Review intake: admin-curated manual intake (batch, approve, publish) to canonical reviews
- Review ops: sync Google Maps sources to draft batches, inspect run readiness, approve valid items, publish
- Review crawl: preview, queue, monitor, and materialize Google Maps crawl runs
- Admin control-plane IA:
  - `Operations` live now
  - `Access` live now
  - `Platform` live now

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma ORM

## Project Structure

```text
apps/web/           Frontend app
backend-sentify/    Backend API + Prisma schema
backend-sentify/docs/ Active backend and database documentation
```

## Local Setup

Backend setup details live in [backend-sentify/docs/SETUP.md](backend-sentify/docs/SETUP.md).
Frontend setup and FE route architecture live in [apps/web/README.md](apps/web/README.md).
Tracked project memory now also lives in:

- [PROJECT-MEMORY-SHORT.md](PROJECT-MEMORY-SHORT.md)
- [PROJECT-MEMORY-LONG.md](PROJECT-MEMORY-LONG.md)

Recommended local bootstrap:

```powershell
cd "D:\Project 3\backend-sentify"
npm run db:reset:local-baseline
node src/server.js

cd "D:\Project 3\apps\web"
npm run dev
```

## Role Contract

The source of truth for role-aware workflow is now:

- `User.role` in [backend-sentify/prisma/schema.prisma](backend-sentify/prisma/schema.prisma)
- `RestaurantUser` membership in [backend-sentify/prisma/schema.prisma](backend-sentify/prisma/schema.prisma)

`RestaurantUser` no longer carries a permission enum. It only answers whether a `USER` belongs to a restaurant.

| Role | Merchant flow | Admin control plane | Restaurant settings |
| --- | --- | --- | --- |
| `USER` | Yes, if restaurant member | No | Edit, if restaurant member |
| `ADMIN` | No | Yes | No merchant settings surface |

Admin control plane means:

- `Operations`
  - restaurants
  - intake
  - review ops
  - crawl
- `Access`
  - users
  - user lifecycle
  - memberships
- `Platform`
  - health & jobs
  - integrations & policies
  - audit
  - runtime controls

Merchant flow means:

- home
- reviews
- actions
- settings

Fail-closed routing rules:

- direct `#/admin/*` by `USER` redirects to `#/app`
- direct `#/app/*` by `ADMIN` redirects to `#/admin`
- admin navigation never renders in the user shell
- merchant navigation never renders in the admin shell

Seeded local credentials after `npm run db:reset:local-baseline`:

- `USER`: `demo.user.primary@sentify.local` / `DemoPass123!`
- `ADMIN`: `demo.admin@sentify.local` / `DemoPass123!`

Critical-path browser validation:

```powershell
cd "D:\Project 3\apps\web"
npx playwright test e2e --workers=1
```

That browser gate now self-manages an isolated real stack:

- resets the local baseline by default
- runs the FE test server on `127.0.0.1:4173`
- runs the backend API on `127.0.0.1:3100`
- runs the crawl worker on the dedicated queue `review-crawl-playwright`
- tears the isolated API and worker down after the suite

What that suite proves now:

- `USER` can login, land in the merchant app, move across `Home`, `Reviews`, `Actions`, and `Settings`, update settings, and logout
- `ADMIN` can login, land in the admin hub, move across live `Operations`, `Access`, and `Platform` screens, and logout
- `ADMIN` can reset a user password and promote that user to `ADMIN`, and the promoted account can log into the admin shell
- admin membership changes propagate to merchant-visible restaurant scope
- platform publish controls block review-ops publish from the browser flow when disabled
- a merchant-saved Google Maps URL can move through the full admin publication chain and become merchant-visible published data
- merchant and admin can stay live in separate browser sessions while that source-operationalization flow completes
- review-ops keeps publish blocked until at least one draft item is approved
- manual intake works end-to-end: create batch, add evidence, curate, approve, publish, and verify the evidence appears in the merchant product
- a merchant can stay logged into the reviews surface while an admin manually publishes fresh evidence, then see it after a same-session refresh
- crawl operations works end-to-end: preview a Google Maps source, upsert it, create a crawl run, materialize it into intake, and verify the resulting draft is approvable
- direct cross-role routes fail closed
- runner policy stays on `--workers=1` because the suite still mutates shared seeded restaurants, platform controls, and queue state
- latest clean-baseline run on `2026-03-27`: `12 passed`

## Runtime Docs

Current backend, database, crawler, and project status docs live in [backend-sentify/docs/README.md](backend-sentify/docs/README.md).
