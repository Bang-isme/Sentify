# 📋 Changelog — Sentify Backend

> Ghi lại mọi thay đổi qua từng sprint. Format: [Sprint].[Task] — Description.

---

## [Sprint 2] — Auth Hoàn Thiện (2026-03-16)

### Added
- `RefreshToken` model + `PasswordResetToken` model in `schema.prisma`
- `src/services/refresh-token.service.js` — token rotation with family-based reuse detection
- `src/services/password-reset.service.js` — hashed token, expiry, single-use
- `src/services/email.service.js` — console/Resend abstraction layer
- `src/middleware/csrf.js` — Double Submit Cookie CSRF protection
- 3 new auth endpoints: `POST /refresh`, `POST /forgot-password`, `POST /reset-password`
- Refresh token cookie (`sentify_refresh_token`, 7-day TTL, scoped to `/api/auth`)
- `JWT_SECRET_PREVIOUS` support for zero-downtime secret rotation
- New env vars: `APP_URL`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `JWT_SECRET_PREVIOUS`

### Changed
- `login()` / `register()` now return refresh token alongside access token
- `logout()` revokes all refresh tokens + clears both cookies
- `changePassword()` rotates refresh tokens (revoke old → issue new)
- CORS `allowedHeaders` updated to include `X-CSRF-Token`

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
