# Sentify

Sentify is a Sprint 1 implementation of an AI-assisted customer insight tool for F&B businesses.

## Current Scope

- Auth: register, login, logout
- Restaurant: create restaurant, save Google Maps URL
- Review intake: admin-curated manual intake (batch, approve, publish) to canonical reviews
- Dashboard: review list, rating filter, date filter
- Insights: sentiment breakdown, complaint keywords, rating trend

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma ORM

## Project Structure

```text
apps/web/           Frontend app
backend-sentify/    Backend API + Prisma schema
output/doc/         Sprint 1 design documentation
```

## Local Setup

Backend setup details live in [output/doc/08-environment-setup.md](output/doc/08-environment-setup.md).

## Runtime Docs

Manual intake and admin workflows are captured in the `manual-first-admin.md` plan and related Sprint 1 docs.
