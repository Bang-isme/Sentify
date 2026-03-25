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
  - memberships
- `Platform`
  - health & jobs
  - integrations & policies
  - audit

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
npx playwright test e2e/user-critical-path.spec.ts e2e/admin-critical-path.spec.ts
```

What that suite proves now:

- `USER` can login, land in the merchant app, move across `Home`, `Reviews`, `Actions`, and `Settings`, update settings, and logout
- `ADMIN` can login, land in the admin hub, move across live `Operations`, `Access`, and `Platform` screens, and logout
- direct cross-role routes fail closed

## Runtime Docs

Current backend, database, crawler, and project status docs live in [backend-sentify/docs/README.md](backend-sentify/docs/README.md).
