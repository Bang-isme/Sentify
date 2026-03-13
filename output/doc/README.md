# Sentify - Design Pack (Sprint 1)

Updated: 2026-03-12

This folder contains the implementation-ready documentation set for Sentify Sprint 1.
The current baseline is intentionally small, synchronous, and restaurant-scoped so the team can learn and ship without carrying Sprint 2 complexity.

> Status (2026-03-12): Import automation has been removed. Treat `10-manual-first-admin-architecture.md` as the primary source of truth; earlier import-focused docs remain for historical context.

## Documents

1. `01-proposal-analysis.md`  
   Product goal, practical value, Sprint 1 scope, requirements, and delivery risks.

2. `02-flow-diagram.md`  
   User flows for authentication, restaurant setup, Google review import, dashboard, and insights.

3. `03-architecture-design.md`  
   Sprint 1 architecture, module boundaries, request flow, security baseline, and deployment notes.

4. `04-database-design.md`  
   PostgreSQL + Prisma data model for the 6 Sprint 1 tables.

5. `05-user-interface-design.md`  
   UI direction, screen inventory, states, and interaction rules for Sprint 1.

6. `06-project-structure.md`  
   Practical folder structure for the current repo: `apps/web` + `backend-sentify`.

7. `07-api-specification.md`  
   JSON contract for Sprint 1 endpoints.

8. `08-environment-setup.md`  
   Local setup guide for Express + Prisma + PostgreSQL.

9. `09-ai-pipeline-design.md`  
   Sentiment + complaint keyword pipeline for Sprint 1, with future upgrade path.

10. `10-manual-first-admin-architecture.md`
   Refactor direction that shifts Sentify toward admin-curated data intake and cleaner FE/BE module boundaries.

## Diagram Sources

- `diagrams/flow.mmd`
- `diagrams/architecture.mmd`
- `diagrams/erd.mmd`

## Sprint 1 Source of Truth

- Auth: Register, Login, Logout (JWT access token)
- Restaurant: Create restaurant, select restaurant, save `google_map_url`
- Review Intake: Admin-curated batches -> approve -> publish -> canonical reviews
- Dashboard: Review list + filter by rating and date
- Insights: Top complaint keywords, sentiment percentages, rating trend

## Tech Baseline

- Frontend: React + Vite (`apps/web`)
- Backend: Node.js + Express (`backend-sentify`)
- Database: PostgreSQL + Prisma ORM
- Processing: synchronous import in request for Sprint 1
- AI: keyword-based sentiment + optional OpenAI fallback

## Not In Sprint 1

- CSV upload
- Email verification / forgot password
- Invite member flow
- Reports / PDF export
- Embedding / clustering / RAG
- Subscription / payment
- Redis / BullMQ / async worker
- Multi-tenant organization model

## Reading Order

1. `01-proposal-analysis.md`
2. `02-flow-diagram.md`
3. `03-architecture-design.md`
4. `04-database-design.md`
5. `07-api-specification.md`
6. `08-environment-setup.md`
7. `10-manual-first-admin-architecture.md`
