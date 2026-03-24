Updated: 2026-03-25

# Backend Ops Runbook

This runbook tracks the current backend-only operations path for release-readiness work.

## 1. Current Recovery Layers

The codebase now has two recovery drill layers:

- local logical recovery drill
  - script: `npm run smoke:recovery-drill`
  - purpose: prove that the shared demo restaurant slice can be snapshotted, damaged, restored, and semantically verified inside the current runtime schema
- shadow-database staging-compatible recovery drill
  - script: `npm run smoke:staging-recovery-drill`
  - purpose: prove a backup, restore, health, read-smoke, and rollback rehearsal against a separately migrated Postgres database

These drills are useful for local and staging-like confidence, but they are not a substitute for a real deployed staging run against managed backups, managed Redis, and actual deployment rollback controls.

## 2. Shadow-Database Recovery Drill

Default local run:

```powershell
cd "D:\Project 3\backend-sentify"
npm run smoke:staging-recovery-drill
```

What the drill does:

1. seeds the source database with the shared demo dataset
2. captures a backup slice for the seeded demo users, restaurants, memberships, reviews, intake state, crawl state, and dashboard aggregates
3. creates a temporary shadow database and applies Prisma migrations there
4. verifies the target database is empty before restore
5. restores the captured backup slice into that database
6. boots the backend against the restored target database
7. hits `/health`, `/api/health`, and authenticated merchant-read routes
8. rehearses rollback by booting the backend against the source database again and re-running health plus read checks
9. drops the temporary target database unless keep mode is enabled

Guardrails built into the drill:

- target and source database identities must differ
- an explicit `--target-db-url` cannot silently disagree with `--target-database`
- the target database must be empty before the restore begins

Default local output:

- `load-reports/staging-recovery-drill-local.json`

Latest local baseline:

- duration about `8.15s`
- restored slice: `2` restaurants, `3` users, `16` reviews, `3` batches, `19` intake items, `1` crawl source, `1` crawl run, `4` raw reviews
- source and target semantic digests matched exactly
- target and rollback both returned `200` for `/health`, `/api/health`, restaurant list, restaurant detail, and dashboard KPI smoke

## 3. Useful Flags

```powershell
node scripts/staging-recovery-drill.js --help
```

Useful options:

- `--target-db-url "<postgres-url>"` to restore into another Postgres database
- `--target-database "<database-name>"` to control the temporary restore database name when a target DB URL is not provided
- `--keep-target-database` to keep the restored database for inspection
- `--restaurant-slug "<slug>"` to narrow the drill to a subset of the seeded demo slice
- `--output "<file>"` to write the summary report somewhere else

## 4. What Counts As Success

For the current codebase, the drill is considered green when:

- target migrations apply cleanly
- target `/health` returns `200`
- target `/api/health` returns `200` with `db: up`
- authenticated merchant-read smoke returns the expected seeded restaurant slice
- restored semantic digest matches the source backup digest
- rollback smoke against the source database returns healthy health and read-route responses

## 5. What Is Still Missing

This runbook does not yet prove:

- a real deployed staging environment
- managed Postgres snapshot or point-in-time restore behavior
- infrastructure rollback for the deployed app image or release artifact
- managed Redis and worker behavior in staging

Those remain the next release-readiness step after the current shadow-database rehearsal.
