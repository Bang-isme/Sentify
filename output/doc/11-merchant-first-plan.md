# 11. Merchant-First Product Vision and 90-Day Plan

Date: 2026-03-13

## 11.1 Current State Snapshot

This snapshot is derived from the running codebase and the updated manual-first documentation.

Product scope today:
- Auth: register, login, logout
- Restaurants: create, update, select
- Admin intake: create batch, add items, review, publish
- Merchant: dashboard, reviews evidence, settings
- Insights: sentiment split, complaint keywords, rating trend

User-facing routes:
- `/` landing
- `/login`, `/signup`
- `/app` dashboard
- `/app/reviews` review evidence
- `/app/settings` restaurant + source settings
- `/app/admin` admin intake

Core data model:
- `ReviewIntakeBatch` and `ReviewIntakeItem` for curation
- `Review` for the canonical merchant dataset
- `InsightSummary` and `ComplaintKeyword` for analytics

Backend API surface:
- `/api/auth/*` for auth
- `/api/restaurants/*` for merchant reads and restaurant management
- `/api/admin/review-batches*` for admin intake

Current system framing:
- Manual-first intake is the approved direction.
- Automation and browser import are removed.
- Merchant trust should be tied to the curated dataset, not intake mechanics.

## 11.2 Product Vision

Vision statement:
Sentify turns raw customer feedback into the single most important operational decision for a restaurant owner, fast and without guesswork.

Core value:
- Merchant sees the top complaint and trend quickly.
- Merchant can verify the evidence without wading through noise.

## 11.3 Personas

Primary persona: Merchant owner or manager.
Secondary persona: Admin or analyst who curates review data.

The roadmap prioritizes merchant clarity and decision support. Admin tooling should be stable but minimal.

## 11.4 User Workflows

Merchant workflow:
1. Select restaurant.
2. Confirm dataset status is curated and current.
3. Review top complaints and sentiment split.
4. Check review evidence for the top issue.
5. Decide one action to fix first.

Admin workflow:
1. Create intake batch.
2. Add reviews via manual or bulk paste.
3. Approve or reject items.
4. Publish to canonical `Review`.
5. Recalculate insights.

## 11.5 Information Architecture

Top-level IA:
- Landing
- Auth
- App shell

App shell IA:
- Dashboard: metrics, sentiment, complaints, trend, dataset status
- Reviews: filterable evidence
- Settings: restaurant profile and source URL
- Admin: intake inbox, batch detail, quick entry, publish

Navigation should continue to keep these four pages visible and stable.

## 11.6 UX Communication Observations

Observed strengths:
- Dashboard communicates KPI, sentiment, complaints, and trend in one view.
- Dataset status card explains data policy and last publish.
- Admin intake is accessible without hidden routes.

Gaps to address for merchant-first clarity:
- Review evidence is available, but the link between top complaint and action should be validated with real merchant feedback.
- Dataset freshness and next-step CTA are now visible, but comprehension should be validated with real merchants.

## 11.7 Operating Model (Minimal Ops, Live Deployment)

Runtime components:
- Frontend: Vite static build
- Backend: Express API
- Database: PostgreSQL

Deployment stance:
- Single VPS is acceptable for the MVP.
- Use HTTPS and a custom domain.
- Use a process manager or containerized runtime.

Minimum operational baseline:
- Health checks via `/health` and `/api/health`.
- Structured request logs already emitted by the backend.
- Documented environment variables and deploy steps.
- Weekly database snapshot or managed Postgres backups.

Admin operations:
- Intake batches are the only path to canonical reviews.
- Publishing a batch is the only action that alters merchant-visible data.

## 11.8 90-Day Roadmap (Merchant-First)

Month 1: Clarity and workflow
- Publish this vision and IA as the baseline.
- Add a merchant-facing "Top issue and next action" summary. (Done: 2026-03-13)
- Tighten dashboard copy so each section answers a single question.
- Ensure review evidence is one click away from the top issue.

Month 2: Data confidence and admin efficiency
- Add JSON intake and simple de-duplication.
- Improve admin batch overview filters and status visibility.
- Add basic audit trail in admin intake for publish actions.

Month 3: Live deployment and quality gates
- Deploy to a live domain with HTTPS.
- Write a minimal ops runbook and deployment checklist.
- Add a regression test that ensures merchant dashboard never depends on admin-only fields.

## 11.9 Success Metrics

Merchant success:
- Time to first actionable insight under 60 seconds.
- Weekly active merchant sessions.
- Repeat visits to review evidence per complaint.

Data success:
- Intake-to-publish lead time under 1 day.
- Publish cadence at least weekly for active restaurants.

Ops success:
- Uptime above 99% during MVP.
- Zero data loss incidents.

## 11.10 Immediate Next Steps

1. Confirm this document as the current product vision and roadmap.
2. Implement a merchant-facing "Top issue and next action" summary on the dashboard. (Done: 2026-03-13)
3. Draft the minimal ops runbook with deployment steps and env config. (Done: 2026-03-13)

## 11.11 Progress Log

- 2026-03-13: Shipped the merchant-facing "Top issue and next action" summary on the dashboard, updated copy (EN/VI/JA), and added regression tests.
- 2026-03-13: Hardened backend runtime (graceful shutdown, permission guard, health check) and documented minimal ops runbook.
