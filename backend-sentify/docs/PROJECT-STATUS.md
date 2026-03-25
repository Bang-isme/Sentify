# Sentify Backend Project Status

Updated: 2026-03-26

This document answers three questions: where the backend is now, what is already done, and what should happen next.

## 1. Overall Assessment

Current status:

- product direction: locked
- backend foundation: strong
- database direction: correct
- core business flow: working
- role model: clarified
- release evidence: still incomplete

The backend is no longer a mock demo. It already behaves like a real product foundation, but it still needs more operational proof before it should be called release-ready.

## 2. Status By Workstream

| Area | Status | Already in place | Still missing |
|---|---|---|---|
| Product direction | Done | Manual-first, canonical user-facing reads, admin-curated publish boundary | Keep scope stable |
| Core architecture | Mostly done | Modular monolith, feature modules for `admin-intake`, `review-crawl`, `review-ops`, and `admin-restaurants` | Continue refactor for auth and restaurant areas |
| Auth and security | Mostly done | JWT, refresh, cookies, CSRF, lockout, reset flow, service-level lifecycle proof, controller proof, real-DB auth smoke, explicit `USER` vs `ADMIN` split | Staging-style auth smoke if release confidence needs to go higher |
| User-facing read APIs | Mostly done | Dashboard, reviews, sentiment, trend, complaints, top issue, seeded real-DB HTTP smoke, restaurant membership boundary separated from admin control plane | Staging-style soak and perf guardrails |
| Admin intake | Mostly done | Create, edit, review, publish, canonical reuse, admin-only route contract | More multi-batch regression proof |
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, draft materialization, fresh-session recovery, structured `crawlCoverage`, local Memurai-backed SMB worker load proof | Managed Redis or staging-backed queue evidence |
| Review ops control plane | Mostly done | One-click draft sync, source list, run list, readiness, bulk approve valid, publish proxy, Redis-backed sync-to-draft smoke with auto-materialized draft proof | Staging-style operator smoke |
| Admin restaurant overview | Done | Dedicated admin discovery and overview endpoints for full admin flow | Keep docs and FE aligned |
| Admin access management | Done | User directory, user detail, create user, role changes, password-reset trigger, lock/unlock/deactivate/reactivate lifecycle, membership list/create/delete, integration coverage | Keep FE and docs aligned as workflow expands |
| Admin platform visibility | Done | Health & jobs, integrations & policies, audit feed, runtime controls, release-readiness summary, integration coverage | Managed-environment proof still needs to catch up with the visibility |
| Publish integrity | Mostly done | Stable external review identity, canonical reuse, and real-DB duplicate publish regression | Keep widening edge-case coverage as source rules evolve |
| Database | Mostly done | Runtime models, crawl invariants, seed dataset, local logical recovery drill, local shadow-database restore rehearsal | Managed backup and rollback evidence |
| Testing | Mostly done | `npm test`, `db:seed`, `db:reset:local-baseline`, `test:realdb`, queued crawl smoke, seeded HTTP read proof, local SMB load harnesses, Redis-backed operator and worker smoke on local Memurai, local logical recovery drill, local shadow-database recovery smoke, implemented browser E2E for `USER` and `ADMIN` critical paths | Staged smoke and managed-environment proof |
| Docs | Mostly done | Source-of-truth docs now describe the simplified `USER` vs `ADMIN` contract | Keep sync as code evolves |
| Ops and release | Partial | Health endpoints, worker runtime, setup docs, local recovery drills | Staging and managed-environment rollback proof |

## 3. Key Contract Decisions

The main backend simplification now in place is:

- `User.role` has only two values:
  - `USER`
  - `ADMIN`
- `RestaurantUser` is now pure membership
- there is no restaurant-level permission enum anymore

Operational effect:

- `/api/restaurants/*` is the user-facing product surface for `USER` accounts with restaurant membership
- `/api/admin/*` is the internal control-plane surface for `ADMIN` accounts
- admin access no longer depends on restaurant membership
- admin users are intentionally denied on user-facing restaurant routes

## 4. Milestones Already Reached

Key backend milestones already achieved:

1. Fully moved to manual-first admin intake
2. Separated canonical dataset from intake workflow
3. Closed the cookie auth and CSRF contract
4. Backfilled the missing auth-token migration so runtime auth tables match the live Prisma schema
5. Hardened publish invariants and canonical review reuse
6. Moved review crawl to queue and worker processing
7. Added shared seed data for demos and regression
8. Added real Postgres publish smoke
9. Added queued crawl smoke with local Redis
10. Added a backend-only operator surface to cut down crawl-to-draft steps
11. Added dedicated admin restaurant overview endpoints so the admin flow is complete without borrowing user routes
12. Added local SMB load harnesses for user-facing reads and crawl worker checkpoint pressure
13. Added local Memurai-backed Redis proof for worker pressure and operator-triggered sync-to-draft
14. Added a local logical recovery drill for seeded restaurant-state restore proof
15. Added a local shadow-database restore plus rollback rehearsal for staging-compatible backend smoke
16. Simplified the system role model to `USER` vs `ADMIN`
17. Added a deterministic local baseline reset command for seeded development and browser testing
18. Added browser E2E proof for strict `USER` vs `ADMIN` shell separation and fail-closed route behavior
19. Reset the FE IA into two post-login products:
    - merchant app: `Home`, `Reviews`, `Actions`, `Settings`
    - admin hub: `Operations`, `Access`, and `Platform`
20. Added live backend surfaces for admin `Access` and `Platform` so FE no longer depends on placeholders for those domains
21. Added explicit admin account lifecycle controls:
    - create user
    - lock / unlock
    - deactivate / reactivate
    - last-admin safety rules
22. Added singleton platform runtime controls and enforced them in live backend flows:
    - crawl queue writes
    - crawl materialization
    - intake publish
23. Added release-readiness summary so FE can distinguish local proof from missing managed-environment evidence

## 5. Risk If Work Stops Here

- confidence still lacks staging-style release proof
- queue worker behavior is measured under local Memurai-backed Redis compatibility, but not yet under managed Redis or staging
- Google-reported totals can still exceed the public review rows exposed through the unofficial RPC, even though operator surfaces now label that mismatch as advisory when the public chain is exhausted
- FE can now see lifecycle and runtime-control truth, but the managed-environment evidence behind those screens is still incomplete
- release operations are not yet demonstrated in a real staging deployment or against managed backup and rollback workflows

## 6. Recommended Next Order

The next backend priorities should be:

1. prepare staging deployment plus managed backup, restore, and rollback evidence
2. rerun queue proof on managed Redis or staging infrastructure
3. keep tightening staged auth and ops smoke as release confidence rises
4. expand admin browser proof from structural nav into deeper `Access` lifecycle and `Platform` control execution

## 7. Short Conclusion

The backend is already strong enough for FE to rely on.

What remains is mostly:

- stronger evidence
- managed-environment queue proof
- release discipline

The important system-role contract is now explicit and simpler:

- `USER` owns the user-facing restaurant flow
- `ADMIN` owns the internal control plane
- restaurant membership scopes user data access but does not create extra sub-roles
