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
| Auth and security | Mostly done | JWT, refresh, cookies, CSRF, lockout, reset flow | Deeper refresh and reset proof |
| Merchant read APIs | Mostly done | Dashboard, reviews, sentiment, trend, complaints, top issue | Wider seeded smoke coverage |
| Admin intake | Mostly done | Create, edit, review, publish, canonical reuse | More multi-batch regression proof |
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, draft materialization, fresh-session recovery, repeated deep-crawl benchmarks to the same public ceiling | SMB load testing and dedicated Redis ops proof |
| Review ops control plane | Mostly done | One-click draft sync, source list, run list, readiness, bulk approve valid, publish proxy | End-to-end queue proof through the operator surface |
| Publish integrity | Mostly done | Stable external review identity and canonical reuse | Duplicate publish smoke on real DB |
| Database | Mostly done | Runtime models, crawl invariants, seed dataset | Backup and restore evidence |
| Testing | Partial | `npm test`, `db:seed`, `test:realdb`, queued crawl smoke | Load testing, staged smoke, broader read-path proof |
| Docs | Mostly done | Current-state docs match code more closely | Keep sync as code evolves |
| Ops and release | Partial | Health endpoints, worker runtime, setup docs | Staging, backup, restore, rollback |

## 3. Sprint Lens

### Sprint 1 backend

Almost closed, but not fully complete.

Done:

- auth and CSRF trust contract
- restaurant-scoped authorization
- docs synced to live backend

Still thin:

- refresh lifecycle evidence
- forgot/reset password evidence

### Sprint 2 backend

Substantial progress.

Done:

- shared seed and demo dataset
- one real Postgres smoke path for publish and dashboard refresh

Still missing:

- broader read-path smoke on seeded data
- richer admin-intake state coverage

### Sprint 3 backend

Foundation is present.

Done:

- better publish invariants
- stronger canonical dedupe semantics
- backend-only review ops layer for crawl-to-draft control

Still missing:

- deeper confidence on seeded merchant reads
- SMB scale proof for crawl workers

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

## 5. Risk If Work Stops Here

- confidence still leans too much on mocked tests
- merchant read-path proof is not broad enough yet
- queue worker load behavior is still unmeasured under SMB concurrency
- Google-reported totals can still exceed the public review rows exposed through the unofficial RPC
- release operations are not yet demonstrated in staging

## 6. Recommended Next Order

The next backend priorities should be:

1. add seeded smoke for merchant read APIs
2. add real-DB duplicate publish regression across batches
3. deepen refresh and password reset coverage
4. run SMB load tests for queue workers and dashboard reads
5. document operator policy when `reportedTotal` exceeds crawlable public reviews
6. prepare staging, backup, restore, and rollback evidence

## 7. Short Conclusion

The backend is already strong enough for FE to rely on later.

What remains is mostly:

- stronger evidence
- scale proof
- release discipline

The missing work is no longer about whether a core backend exists. It is about proving that the backend can be trusted under more realistic operating conditions and being explicit about the limits of unofficial Google review completeness.
