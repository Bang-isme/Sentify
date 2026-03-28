Updated: 2026-03-28

Environment split:

- `.env.example` documents normal backend runtime and local queue settings
- `.env.release-evidence.example` documents managed Redis / staging API / release-evidence inputs
- proof scripts auto-load `.env.release-evidence` after `.env`, so staging proof secrets can stay separate from local runtime config
- `npm run env:check` verifies the example files still match the backend config contract
- the fastest path to obtain `RELEASE_EVIDENCE_STAGING_API_URL` is the Render staging blueprint in [RENDER-STAGING.md](/D:/Project%203/backend-sentify/docs/RENDER-STAGING.md)

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

There is now a third layer on top:

- managed release evidence bundle
  - script: `npm run proof:release-evidence`
  - purpose: combine a BullMQ compatibility probe against a supplied Redis URL with the staging-compatible recovery drill and an optional deployed staging API probe
  - supporting probes:
    - `npm run proof:staging-api`
    - `npm run proof:performance`

## 2. Shadow-Database Recovery Drill

Default local run:

```powershell
cd "D:\Project 3\backend-sentify"
npm run smoke:staging-recovery-drill
```

What the drill does:

1. seeds the source database with the shared demo dataset
2. captures a backup slice for the seeded demo users, restaurants, memberships, reviews, intake state, crawl state, dashboard aggregates, durable audit rows, publish-lineage rows, and platform controls
3. creates a temporary shadow database and applies Prisma migrations there
4. verifies the target database is empty before restore
5. restores the captured backup slice into that database
6. boots the backend against the restored target database
7. hits `/health`, `/api/health`, and authenticated merchant-read routes
8. rehearses rollback by booting the backend against the source database again and re-running health plus read checks
9. drops the temporary target database unless keep mode is enabled

Existing-source mode is now available for staging-safe use:

```powershell
cd "D:\Project 3\backend-sentify"
node scripts/staging-recovery-drill.js --source-mode existing --restaurant-slug demo-quan-pho-hong
```

Use that mode when the source database already contains the slice you want to rehearse. It will not seed the source DB first.

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

- `--source-mode existing` to skip seeding and read an existing source DB
- `--source-db-url "<postgres-url>"` to point the drill at a different source database
- `--target-db-url "<postgres-url>"` to restore into another Postgres database
- `--target-database "<database-name>"` to control the temporary restore database name when a target DB URL is not provided
- `--keep-target-database` to keep the restored database for inspection
- `--restaurant-slug "<slug>"` to narrow the drill to a subset of the seeded demo slice
- `--smoke-user-id "<user-uuid>"` to force the authenticated smoke user in existing-source mode
- `--output "<file>"` to write the summary report somewhere else

## 4. What Counts As Success

For the current codebase, the drill is considered green when:

- target migrations apply cleanly
- target `/health` returns `200`
- target `/api/health` returns `200` with `db: up`
- authenticated merchant-read smoke returns the expected seeded restaurant slice
- restored semantic digest matches the source backup digest
- rollback smoke against the source database returns healthy health and read-route responses

## 5. Managed Release Evidence Bundle

Bundle command:

```powershell
cd "D:\Project 3\backend-sentify"
node scripts/release-evidence.js --source-mode existing --restaurant-slug demo-quan-pho-hong --managed-redis-url "redis://127.0.0.1:6379" --staging-api-url "http://127.0.0.1:3000" --staging-user-email "demo.user.primary@sentify.local" --staging-user-password "DemoPass123!" --staging-admin-email "demo.admin@sentify.local" --staging-admin-password "DemoPass123!" --include-performance-proof --performance-scale-url "https://maps.app.goo.gl/yWeP9xmjowpkYVbU7"
```

Artifacts:

- `load-reports/managed-redis-proof.json`
- `load-reports/staging-api-proof-managed.json`
- `load-reports/performance-proof-managed.json`
- `load-reports/staging-recovery-drill-managed.json`
- `load-reports/managed-release-evidence.json`

Status semantics:

- `COMPATIBILITY_PROOF_COMPLETE`: the configured bundle checks passed
- `COMPATIBILITY_PROOF_PARTIAL`: the configured bundle checks are usable but at least one check was skipped or partial
- `COMPATIBILITY_PROOF_FAILED`: a required bundle check failed
- `COMPATIBILITY_PROOF_STALE`: a previously green heavy bundle artifact exists but is older than the managed proof freshness window
- `MANAGED_SIGNOFF_PENDING`: compatibility proof is present, but external managed sign-off is still missing
- `MANAGED_SIGNOFF_STALE`: release readiness is based on stale managed artifacts and should be rerun before any claim
- `MANAGED_SIGNOFF_COMPLETE`: compatibility proof passed and the bundle was run against non-loopback Redis plus staging targets with a provider-managed Postgres backup/PITR proof artifact attached
- `LOCAL_PROOF_STALE`: required local proof artifacts exist but are older than the local proof freshness window

Managed DB proof artifact support:

- validator: `npm run proof:managed-db -- --artifact <file>`
- example artifact: `docs/examples/managed-db-proof-artifact.example.json`
- bundle wiring: `release-evidence.js` now validates the artifact and records a `managedDbProof` check instead of only checking whether the file path exists

Managed sign-off preflight:

- script: `npm run proof:managed-signoff:preflight`
- direct form with custom output:
  - `node scripts/managed-signoff-preflight.js --output load-reports/managed-signoff-preflight.json`
- purpose:
  - fail fast on missing managed Redis URL
  - fail fast on missing staging API URL
  - fail fast on missing merchant/admin staging credentials
  - validate the managed DB proof artifact before the heavy bundle runs
- output now also includes `nextSteps`, which tells you the next env keys to fill and the exact follow-up action for each remaining blocker

Recommended order while preflight is still pending:

1. fill `RELEASE_EVIDENCE_MANAGED_REDIS_URL`
2. fill `RELEASE_EVIDENCE_STAGING_API_URL`
3. fill merchant and admin staging proof accounts
4. attach `RELEASE_EVIDENCE_MANAGED_DB_PROOF_ARTIFACT`
5. rerun `npm run proof:managed-signoff:preflight -- --require-ready`
6. only then run `npm run proof:managed-signoff`

The latest local compatibility verification on `2026-03-28` produced:

- managed BullMQ probe: passed against Redis `7.2.5`

Freshness controls:

- `ADMIN_PLATFORM_LOCAL_PROOF_MAX_AGE_HOURS` defaults to `24`
- `ADMIN_PLATFORM_MANAGED_PROOF_MAX_AGE_HOURS` defaults to `72`
- `admin-platform` now reports:
  - `freshArtifactKeys`
  - `staleArtifactKeys`
  - `compatibilityProofFreshnessStatus`
  - `managedSignoffPreflightFreshnessStatus`
- if stale statuses appear, rerun the relevant proof instead of treating the artifact as valid evidence
- existing-source shadow restore and rollback: passed
- authenticated staging API proof: passed for merchant and admin read smoke
- bundled performance proof: passed
- bundled release evidence status: `COMPATIBILITY_PROOF_COMPLETE`
- bundled managed sign-off status: `MANAGED_SIGNOFF_PENDING`
- important caveat:
  - this green artifact used local Memurai `7.2.5` and local API base URL `http://127.0.0.1:3000`
  - repeat the same bundle with real managed Redis and deployed staging endpoints before external release sign-off
  - attach a provider-managed Postgres backup/PITR proof artifact if you want `--require-managed-signoff` to pass
  - the example managed DB proof artifact validates successfully, but it does not turn local loopback Redis or staging API targets into external sign-off
  - the preflight script surfaces those remaining blockers immediately without rerunning Redis, staging API smoke, or recovery drills

## 6. What Is Still Missing

This runbook does not yet prove:

- a real deployed staging environment
- managed Postgres snapshot or point-in-time restore behavior
- infrastructure rollback for the deployed app image or release artifact
- end-to-end managed Redis and worker behavior in a deployed staging environment

Those remain the next release-readiness step after the current shadow-database rehearsal.
