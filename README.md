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
backend-sentify/docs/ Active backend and database documentation
```

## Local Setup

Backend setup details live in [backend-sentify/docs/SETUP.md](backend-sentify/docs/SETUP.md).

## Runtime Docs

Current backend, database, crawler, and project status docs live in [backend-sentify/docs/README.md](backend-sentify/docs/README.md).
