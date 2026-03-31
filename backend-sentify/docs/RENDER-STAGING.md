# Render Staging

Updated: 2026-03-28

This is the fastest path to get a real backend staging URL for managed-signoff work.

## 1. What This Blueprint Optimizes For

- a real public staging API URL quickly
- minimal setup on Render
- free-friendly initial path

The current `render.yaml` uses a single web service with:

- `REVIEW_CRAWL_INLINE_QUEUE_MODE=false`
- `REVIEW_CRAWL_RUNTIME_MODE=both`
- `TRUST_PROXY=1`
- explicit runtime timeout defaults:
  - `REQUEST_TIMEOUT_MS=30000`
  - `HEADERS_TIMEOUT_MS=31000`
  - `KEEP_ALIVE_TIMEOUT_MS=5000`
  - `SLOW_REQUEST_THRESHOLD_MS=1000`
  - `DB_CONNECT_TIMEOUT_SECONDS=10`
  - `DB_STATEMENT_TIMEOUT_MS=15000`
  - `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS=15000`

That keeps the first staging deploy simple. Once staging is stable, you can split scheduler and worker into separate Render services if you need closer production topology.

## 2. Files

- blueprint: [render.yaml](/D:/Project%203/backend-sentify/render.yaml)
- runtime env template: [/.env.example](/D:/Project%203/backend-sentify/.env.example)
- release-proof env template: [/.env.release-evidence.example](/D:/Project%203/backend-sentify/.env.release-evidence.example)

## 3. Render Steps

1. Push the repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Use [render.yaml](/D:/Project%203/backend-sentify/render.yaml).
4. Set the missing secret env vars in Render:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - optional `JWT_SECRET_PREVIOUS`
   - `CORS_ORIGIN`
   - `APP_URL`
   - optional `AUTH_COOKIE_DOMAIN`
5. Keep `TRUST_PROXY=1` on Render.
   - do not set `TRUST_PROXY=true`
   - `express-rate-limit` treats boolean `true` as permissive and will raise `ERR_ERL_PERMISSIVE_TRUST_PROXY`
   - backend config now also rejects `TRUST_PROXY=true` at startup, so the bad value fails fast instead of degrading later under auth traffic
6. Deploy the service.
7. When you run release-proof scripts against a free Render staging host, set:
   - `RELEASE_EVIDENCE_STAGING_TIMEOUT_MS=90000`
   - this is the current proven baseline for `staging-api-proof.js` on the Render free tier

Database and Redis hardening for staging:

- external Postgres URLs should use an explicit TLS mode such as `sslmode=verify-full`
  - the runtime now upgrades external `sslmode=require|prefer|verify-ca` URLs to `verify-full` before Prisma connects so the stronger behavior is explicit
- managed Redis should use `maxmemory-policy=noeviction`
  - BullMQ queue durability is not sign-off safe on `volatile-lru`, `allkeys-lru`, or similar eviction policies
  - if your Redis provider plan cannot set `noeviction`, treat that as a staging limitation and keep managed sign-off blocked
  - once the provider really does use `noeviction`, you can enable `REVIEW_CRAWL_REQUIRE_SAFE_REDIS=true` to make the runtime fail fast on future drift instead of only reporting degraded health
  - if the active database or plan cannot change policy in place, migrate to a new Redis database or provider that supports `noeviction`, then update both:
    - Render `REDIS_URL`
    - release-evidence `RELEASE_EVIDENCE_MANAGED_REDIS_URL`
  - after the provider change, rerun:
    - `node scripts/managed-redis-proof.js`
    - `node scripts/release-evidence.js --require-managed-signoff`

## 4. Important Commands

- build: `npm install && npm run db:generate`
- pre-deploy migration: `npm run db:migrate:deploy`
- start: `npm start`

`db:migrate:deploy` is the correct deploy-time Prisma command for Render. Do not use `prisma migrate dev` on staging deploys.

`npm start` now boots both:
- the HTTP API from `src/server.js`
- the review-crawl runtime from the same process when:
  - `REDIS_URL` is configured
  - `REVIEW_CRAWL_INLINE_QUEUE_MODE=false`

That means a plain Render web service can host the first staging topology without a second worker service. Any change to crawl-runtime bootstrap code still requires a Render redeploy before queue health reflects it.

## 5. After Deploy

Once the service is healthy:

1. Copy the Render service URL.
2. Put it into [/.env.release-evidence](/D:/Project%203/backend-sentify/.env.release-evidence) as:

```env
RELEASE_EVIDENCE_STAGING_API_URL=https://your-render-service.onrender.com
```

3. Create one staging merchant account and one staging admin account.
4. Fill those credentials into [/.env.release-evidence](/D:/Project%203/backend-sentify/.env.release-evidence).
5. Run:

```powershell
cd "D:\Project 3\backend-sentify"
node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.latest.json
```

## 6. Limits Of The Free-Friendly Path

This Render setup is meant to unlock staging quickly. It is not the final production topology.

Known tradeoff:

- one web service is doing API + scheduler + processor work

Recommended later upgrade:

- split API and review-crawl worker into separate services
- keep managed Redis and managed Postgres
- rerun managed sign-off on that closer-to-production topology
