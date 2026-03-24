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
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, draft materialization, fresh-session recovery, repeated deep-crawl benchmarks to the same public ceiling, local worker-pressure harness | Redis-backed SMB load proof and dedicated Redis ops evidence |
| Review ops control plane | Mostly done | One-click draft sync, source list, run list, readiness, bulk approve valid, publish proxy | End-to-end queue proof through the operator surface |
| Publish integrity | Mostly done | Stable external review identity, canonical reuse, and real-DB duplicate publish regression | Keep widening edge-case coverage as source rules evolve |
| Database | Mostly done | Runtime models, crawl invariants, seed dataset | Backup and restore evidence |
| Testing | Partial | `npm test`, `db:seed`, `test:realdb`, queued crawl smoke, seeded merchant-read HTTP proof, local SMB load harnesses | Redis-backed queue load proof and staged smoke |
| Docs | Mostly done | Current-state docs match code more closely | Keep sync as code evolves |
| Ops and release | Partial | Health endpoints, worker runtime, setup docs | Staging, backup, restore, rollback |

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

- Redis-backed queued-worker load proof

### Sprint 4 backend

Release evidence is still incomplete.

Still missing:

- staging deployment proof
- near-production health smoke
- backup, restore, and rollback drills

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

## 5. Risk If Work Stops Here

- confidence still lacks staging-style release proof
- queue worker load behavior is still unmeasured under real Redis SMB concurrency
- Google-reported totals can still exceed the public review rows exposed through the unofficial RPC
- release operations are not yet demonstrated in staging

## 6. Recommended Next Order

The next backend priorities should be:

1. run the new worker load harness against real Redis and the operator-triggered queue path
2. document operator policy when `reportedTotal` exceeds crawlable public reviews
3. prepare staging, backup, restore, and rollback evidence
4. keep tightening staged auth and ops smoke as release confidence rises

## 7. Short Conclusion

The backend is already strong enough for FE to rely on later.

What remains is mostly:

- stronger evidence
- Redis-backed queue proof
- release discipline

The missing work is no longer about whether a core backend exists. It is about proving that the backend can be trusted under more realistic operating conditions and being explicit about the limits of unofficial Google review completeness.
