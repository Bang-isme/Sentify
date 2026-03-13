# 12. Minimal Ops Runbook (MVP)

Date: 2026-03-13

## 12.1 Scope

This runbook defines the minimum operational baseline required to deploy and run Sentify for the MVP.
It is intentionally small and assumes a single VPS with PostgreSQL.

## 12.2 Environments

- Runtime: Node.js + Express API, Vite static build.
- Database: PostgreSQL (single instance).
- Reverse proxy: Nginx or Caddy with HTTPS.

Reference: `08-environment-setup.md` for full local setup and base environment variables.

## 12.3 Required Environment Variables

Backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ISSUER`, `JWT_AUDIENCE`
- `CORS_ORIGIN`
- `AUTH_COOKIE_*`
- `API_RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `REGISTER_RATE_LIMIT_*`
- `DB_POOL_MAX`

Frontend:
- API base URL (see `apps/web/src/lib/api.ts`)

## 12.4 Deployment Checklist

1. Provision VPS and install Node.js (or Docker), PostgreSQL, and reverse proxy.
2. Create database and user; set `DATABASE_URL`.
3. Configure env variables for backend and frontend.
4. Run Prisma migrations:
   - `npx prisma migrate deploy`
5. Start backend with a process manager (PM2/systemd) or container.
6. Build frontend (`npm run build`) and serve static files via Nginx/Caddy.
7. Configure HTTPS and domain (TLS cert).
8. Verify health:
   - `GET /health` (liveness)
   - `GET /api/health` (readiness, returns 503 when DB is down)

## 12.5 Operational Baselines

Health checks:
- `/health` should always return 200 for liveness.
- `/api/health` should return 200 only when DB is reachable.

Logging:
- Request logs are structured JSON (or pretty in dev).
- Keep logs for at least 7 days; rotate to avoid disk pressure.

Backups:
- Weekly database snapshot or managed Postgres backups.
- Validate restore process at least once per month.

## 12.6 Incident Response (MVP)

If the API returns 503 on `/api/health`:
1. Check Postgres status and credentials.
2. Verify `DATABASE_URL` and connectivity from the API host.
3. Restart the API after DB is healthy.

## 12.7 Rollback Plan

- Keep the previous backend build or image available.
- Roll back to the last known good release if startup or migration fails.
- Do not edit historical migrations; create a new migration for fixes.
