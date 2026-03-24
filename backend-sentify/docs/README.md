# Sentify Backend Docs

Updated: 2026-03-25

This folder now keeps only backend documents that are intended to match the current codebase.

Recommended reading order:

1. `CURRENT-STATE.md`
2. `PROJECT-STATUS.md`
3. `PROPOSAL.md`
4. `SETUP.md`
5. `API.md`
6. `ARCHITECTURE.md`
7. `DATABASE.md`
8. `TESTING-STRATEGY.md`
9. `REVIEW-CRAWLER.md`
10. `SCRUM-PLAN.md`
11. `BACKEND-STAGE-A-BACKLOG.md`
12. `STAGE-A-BACKLOG.md`
13. `CODING-CONVENTIONS.md`
14. `CHANGELOG.md`

Notes:

- speculative roadmap and gap-analysis docs were removed because they no longer matched the live backend implementation
- planning docs related to backend delivery now also live inside this folder
- `CURRENT-STATE.md` is the fastest way to understand what the codebase already has today
- `PROJECT-STATUS.md` is the fastest way to understand progress, remaining gaps, and next priorities
- `PROPOSAL.md` is the concise project proposal aligned to the current manual-first direction
- `REVIEW-CRAWLER.md` documents the non-browser Google Maps review crawler, queued run model, benchmark evidence, mismatch semantics for reported totals, and the backend-only `review-ops` control plane
- `SETUP.md` includes `db:seed`, `test:realdb`, the local queued crawl smoke commands, and the inline-queue fallback for local benchmarking
- `BACKEND-STAGE-A-BACKLOG.md` is the backend-only execution slice
- `STAGE-A-BACKLOG.md` is the broader Stage A delivery view when cross-functional context is needed
