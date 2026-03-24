# Sentify Backend Project Status

Updated: 2026-03-25

This document answers three questions: where the backend is now, what is already done, and what should happen next.

## 1. Overall Assessment

Current status:

- product direction: locked
- backend foundation: strong
- database direction: correct
- core business flow: working
- release evidence: still incomplete

The backend is no longer a mock-demo. It already behaves like a real product foundation, but it still needs more operational proof before it should be called release-ready.

## 2. Status By Workstream

| Area | Status | Already in place | Still missing |
|---|---|---|---|
| Product direction | Done | Manual-first, canonical merchant reads, admin-curated publish boundary | Keep scope stable |
| Core architecture | Mostly done | Modular monolith, feature modules for `admin-intake`, `review-crawl`, `review-ops` | Continue refactor for auth and restaurant areas |
| Auth and security | Mostly done | JWT, refresh, cookies, CSRF, lockout, reset flow, service-level lifecycle proof for refresh rotation/reuse and forgot/reset password, controller proof for refresh and reset route contracts | Staging-style auth smoke if release confidence needs to go higher |
| Merchant read APIs | Mostly done | Dashboard, reviews, sentiment, trend, complaints, top issue, seeded real-DB HTTP smoke, local SMB read-load proof | Staging-style soak and perf guardrails |
| Admin intake | Mostly done | Create, edit, review, publish, canonical reuse | More multi-batch regression proof |
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, draft materialization, fresh-session recovery, repeated deep-crawl benchmarks to the same public ceiling, structured `crawlCoverage` diagnostics, local Memurai-backed SMB worker load proof | Managed Redis or staging-backed queue evidence |
| Review ops control plane | Mostly done | One-click draft sync, source list, run list, readiness, bulk approve valid, publish proxy, operator policy for `reportedTotal` mismatch, Redis-backed sync-to-draft smoke with auto-materialized draft batch proof | Staging-style operator smoke |
| Publish integrity | Mostly done | Stable external review identity, canonical reuse, and real-DB duplicate publish regression | Keep widening edge-case coverage as source rules evolve |
| Database | Mostly done | Runtime models, crawl invariants, seed dataset, local logical recovery drill | Managed backup and rollback evidence |
| Testing | Partial | `npm test`, `db:seed`, `test:realdb`, queued crawl smoke, seeded merchant-read HTTP proof, local SMB load harnesses, Redis-backed operator and worker smoke on local Memurai, local logical recovery drill | staged smoke and managed-environment proof |
| Docs | Mostly done | Current-state docs match code more closely | Keep sync as code evolves |
| Ops and release | Partial | Health endpoints, worker runtime, setup docs, local logical recovery drill | Staging and managed-environment rollback proof |

## 3. Sprint Lens

### Sprint 1 backend

Functionally closed for the current backend foundation scope.

Done:

- auth and CSRF trust contract
- refresh rotation, reuse, and password reset lifecycle proof
- restaurant-scoped authorization
- docs synced to live backend

Still thin:

- no release-style staged auth smoke yet

### Sprint 2 backend

Substantial progress.

Done:

- shared seed and demo dataset
- one real Postgres smoke path for publish and dashboard refresh

Still missing:

- richer admin-intake state coverage

### Sprint 3 backend

Foundation is present.

Done:

- better publish invariants
- stronger canonical dedupe semantics
- backend-only review ops layer for crawl-to-draft control
- seeded real-DB HTTP smoke for merchant read APIs
- real-DB duplicate publish regression across batches

Still missing:

- managed Redis or staging queued-worker proof

### Sprint 4 backend

Release evidence is still incomplete.

Still missing:

- staging deployment proof
- near-production health smoke
- managed-environment backup, restore, and rollback drills beyond the local logical recovery harness

## 4. Milestones Already Reached

Key backend milestones already achieved:

1. Fully moved to manual-first admin intake
2. Separated canonical dataset from intake workflow
3. Closed the cookie auth and CSRF contract
4. Hardened publish invariants and canonical review reuse
5. Moved review crawl to queue and worker processing
6. Added shared seed data for demos and regression
7. Added real Postgres publish smoke
8. Added queued crawl smoke with local Redis
9. Added a backend-only operator surface to cut down crawl-to-draft steps
10. Benchmarked deep Google Maps crawl throughput and lowered default backfill delay without losing extracted review quality
11. Added local SMB load harnesses for merchant reads and crawl worker checkpoint pressure
12. Added local Memurai-backed Redis proof for worker pressure and operator-triggered sync-to-draft
13. Added a local logical recovery drill for seeded restaurant-state restore proof

## 5. Risk If Work Stops Here

- confidence still lacks staging-style release proof
- queue worker load behavior is now measured under local Memurai-backed Redis compatibility, but not yet under managed Redis or staging
- Google-reported totals can still exceed the public review rows exposed through the unofficial RPC, even though operator surfaces now label that mismatch as advisory when the public chain is exhausted
- release operations are not yet demonstrated in staging or against managed backup and rollback workflows

## 6. Recommended Next Order

The next backend priorities should be:

1. prepare staging deployment plus managed backup, restore, and rollback evidence
2. rerun queue proof on managed Redis or staging infrastructure
3. keep tightening staged auth and ops smoke as release confidence rises

## 7. Short Conclusion

The backend is already strong enough for FE to rely on later.

What remains is mostly:

- stronger evidence
- managed-environment queue proof
- release discipline

The missing work is no longer about whether a core backend exists. It is about proving that the backend can be trusted under more realistic operating conditions and being explicit about the limits of unofficial Google review completeness.
