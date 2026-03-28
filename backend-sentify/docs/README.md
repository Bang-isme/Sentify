# Sentify Backend Docs

Updated: 2026-03-27

This folder now keeps only backend documents that are intended to match the current codebase.

Recommended reading order:

1. `BUSINESS-FLOW-MAP.md`
2. `CURRENT-STATE.md`
3. `PROJECT-STATUS.md`
4. `PROPOSAL.md`
5. `SETUP.md`
6. `API.md`
7. `ARCHITECTURE.md`
8. `DATABASE.md`
9. `TESTING-STRATEGY.md`
10. `REVIEW-CRAWLER.md`
11. `REVIEW-CRAWLER-SCALE.md`
12. `OPS-RUNBOOK.md`
13. `RENDER-STAGING.md`
14. `SCRUM-PLAN.md`
15. `BACKEND-STAGE-A-BACKLOG.md`
16. `STAGE-A-BACKLOG.md`
17. `CODING-CONVENTIONS.md`
18. `CHANGELOG.md`

Notes:

- speculative roadmap and gap-analysis docs were removed because they no longer matched the live backend implementation
- planning docs related to backend delivery now also live inside this folder
- `BUSINESS-FLOW-MAP.md` is the fastest way to understand the actor split, the canonical publish boundary, and the missing fine-grained workflow events that are still implicit in code
- `CURRENT-STATE.md` is the fastest way to understand what the codebase already has today
- `PROJECT-STATUS.md` is the fastest way to understand progress, remaining gaps, and next priorities
- those two docs now track the durable `AuditEvent` ledger, the `ReviewPublishEvent` lineage table, the merchant `RestaurantSourceSubmission` contract, the admin source-submission queue read/write actions, and the remaining gaps around legacy-history backfill and managed-environment proof
- `PROPOSAL.md` is the concise project proposal aligned to the current manual-first direction
- `REVIEW-CRAWLER.md` documents the non-browser Google Maps review crawler, queued run model, benchmark evidence, mismatch semantics for reported totals, and the backend-only `review-ops` control plane; it also records the important `Cong Ca Phe` case where preview metadata reported `15098` but the visible public review surface converged at `9744`
- `REVIEW-CRAWLER-SCALE.md` documents the scale-validation checklist and the harness used to estimate larger-source runtime
- `SETUP.md` includes `db:seed`, `test:realdb`, the local queued crawl smoke commands, the managed `stack:review-crawl:*` workflow, and the inline-queue fallback for local benchmarking
- `OPS-RUNBOOK.md` is now the shortest path to the new managed release-evidence workflow, including the BullMQ Redis probe and existing-source staging recovery rehearsal
- `RENDER-STAGING.md` is the fastest path to getting a real staging backend URL on Render so managed sign-off can move past the current local-only proof boundary
- local real-queue verification now works with a Redis 7.2-compatible runtime (`REDIS_URL` set, `REVIEW_CRAWL_INLINE_QUEUE_MODE=false`, worker process running); for deterministic manual `review-ops` testing, a `REVIEW_CRAWL_RUNTIME_MODE=processor` local override avoids scheduler background noise while still exercising BullMQ transport
- the managed local stack now cleans up stale worker heartbeats and rolls back partial startup, so `start -> stop -> start` is deterministic for local queue testing
- root-level `PROJECT-MEMORY-SHORT.md` and `PROJECT-MEMORY-LONG.md` keep a tracked cross-session memory snapshot for the whole repo
- `BACKEND-STAGE-A-BACKLOG.md` is the backend-only execution slice
- `STAGE-A-BACKLOG.md` is the broader Stage A delivery view when cross-functional context is needed
