# Project Memory Long

Updated: 2026-03-26 Asia/Bangkok

## Stable Product Decisions

- Sentify is one codebase with two post-login products:
  - merchant product for `USER`
  - internal control plane for `ADMIN`
- Do not reintroduce old role ideas unless explicitly requested:
  - `MERCHANT`
  - `ANALYST`
  - `OWNER`
  - `MANAGER`
  - `MEMBER`
  - membership `permission`

## Stable Access Rules

- `USER` uses `/api/restaurants/*`
- `ADMIN` uses `/api/admin/*`
- `USER` must also have restaurant membership to access a restaurant
- `ADMIN` does not need restaurant membership for admin control-plane flows
- Cross-role routing must fail closed:
  - `USER` cannot enter `/admin`
  - `ADMIN` cannot enter `/app`

## Stable Information Architecture

### Merchant product

- `Home`
- `Reviews`
- `Actions`
- `Settings`

Principles:

- insight-first
- evidence-backed
- no crawl/runtime/operator jargon

### Admin control plane

- `Operations`
  - Restaurants
  - Intake
  - Review ops
  - Crawl
- `Access`
  - Users
  - Memberships
- `Platform`
  - Health & jobs
  - Integrations & policies
  - Audit

Principles:

- desktop-first
- system-aware
- restaurant context is persistent only inside `Operations`
- `Access` and `Platform` are global admin domains
- `Access` owns user lifecycle, not just directory visibility
- `Platform` may expose active controls, but FE must show the proof level behind them

## Stable Backend Shape

- Backend root:
  - `D:\Project 3\backend-sentify`
- Frontend root:
  - `D:\Project 3\apps\web`
- Core backend live modules:
  - `admin-restaurants`
  - `admin-intake`
  - `review-ops`
  - `review-crawl`
  - `admin-access`
  - `admin-platform`
  - `platform-control.service`
  - `user-account-state.service`

## Docs To Trust First

- Runtime truth:
  - `D:\Project 3\backend-sentify\docs\CURRENT-STATE.md`
- API contract:
  - `D:\Project 3\backend-sentify\docs\API.md`
- Setup:
  - `D:\Project 3\backend-sentify\docs\SETUP.md`
- Testing:
  - `D:\Project 3\backend-sentify\docs\TESTING-STRATEGY.md`
- Delivery/gaps:
  - `D:\Project 3\backend-sentify\docs\PROJECT-STATUS.md`

## Local Memory And Handoff

Machine-local high-detail memory still exists under:

- `D:\Project 3\.codex\SHORT_TERM.md`
- `D:\Project 3\.codex\LONG_TERM.md`
- `D:\Project 3\.codex\handoff.md`
- `D:\Project 3\.codex\context\genome.md`

These tracked project-memory files exist so project context survives clone/session boundaries even without local `.codex` history.

## Working Rules

- Before changing roles, re-check this file and `schema.prisma`.
- Before saying a surface is live, verify the backend endpoint exists now.
- Before saying a platform control is safe or ready, verify both backend enforcement and the proof level behind it.
- Before changing FE IA, keep merchant and admin as separate products.
- After major architecture changes:
  - refresh docs
  - refresh tracked memory
  - rerun targeted verification
