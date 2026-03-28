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
