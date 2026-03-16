# 📋 Changelog — Sentify Backend

> Ghi lại mọi thay đổi qua từng sprint. Format: [Sprint].[Task] — Description.

---

## [Sprint 1] — Foundation Hardening (2026-03-16)

### Added
- `src/middleware/validate-uuid.js` — UUID validation middleware, applied to 18 routes
- `src/config/constants.js` — centralized magic numbers
- `passwordChangeLimiter` in `src/middleware/rate-limit.js`
- 2 new indexes on Review model: `[restaurantId]`, `[restaurantId, createdAt]`
- `timestamp` field in all error responses (`controller-error.js`)
- HTML sanitization (`stripHtmlTags`) in admin-intake service
- Future date validation for `rawReviewDate` in intake validation

### Changed
- `getSentimentBreakdown()` → Prisma `groupBy` (no longer loads all reviews into memory)
- `getTrend()` → raw SQL `date_trunc` aggregation (database-level grouping)
- `fetchIntakeSummary()` → `_count` + `groupBy` instead of loading all items
- `publishApprovedItems()` → `Promise.all` (parallel DB updates instead of sequential)

### Removed
- `isMissingIntakeTableError()` workaround (no longer needed post-migration)

### Fixed
- Invalid UUID params now return 400 instead of Prisma P2023 → 500
- `.env.example` — added `NODE_ENV`, `DB_POOL_MAX`, `TRUST_PROXY`, `AUTH_COOKIE_DOMAIN`
- `.gitignore` — added `src/generated/`
- Test IDs updated to valid UUIDs for dashboard and data-isolation tests

---

## [Pre-Sprint] — Documentation Setup (2026-03-16)

### Added
- `docs/SPRINT-ROADMAP.md` — 6 sprints, 50+ tasks, 41 endpoints roadmap
- `docs/API.md` — Full reference for 21 current API endpoints
- `docs/DATABASE.md` — Schema ERD, 7 models, index strategy, migration history
- `docs/ARCHITECTURE.md` — Directory structure, request lifecycle, module patterns
- `docs/SETUP.md` — Development environment setup guide
- `docs/GAPS-AND-IMPROVEMENTS.md` — 25 subtle issues across 7 categories
- `docs/CODING-CONVENTIONS.md` — Code style and pattern conventions
- `docs/TESTING-STRATEGY.md` — Test pyramid, mock patterns, coverage targets
- `docs/CHANGELOG.md` — This file
