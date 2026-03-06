# 6. Project Structure - Sprint 1

Date: 2026-03-03  
Updated: 2026-03-07 (Sprint 1 scope sync)

This document describes the practical project layout for the current repo, not an idealized future monorepo.

## 6.1 Current Repo Shape

```text
Project 3/
├── apps/
│   └── web/                     # Frontend: React + Vite
├── backend-sentify/             # Backend: Express + Prisma
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── lib/
│   │       └── prisma.js
│   ├── .env
│   ├── .env.example
│   ├── prisma.config.ts
│   └── package.json
└── output/
    └── doc/
```

## 6.2 Backend Structure

### Why split `app.js` and `server.js`

- `app.js` defines the Express application: middleware and routes
- `server.js` is the runtime entrypoint: load env and call `listen`
- This separation makes testing and refactoring easier

### Why add `prisma.config.ts`

Prisma 7 no longer keeps the datasource URL inside `schema.prisma`.
`prisma.config.ts` is now the place where Prisma CLI commands receive `DATABASE_URL`.

### Recommended next folders

```text
backend-sentify/src/
├── routes/          # Express route files by domain
├── controllers/     # Request/response handlers
├── services/        # Business logic: scraper, sentiment, insights
├── middleware/      # JWT auth, permission guard, error handler
├── lib/             # Prisma client, shared helpers
└── utils/           # Small reusable helpers
```

## 6.3 Suggested Growth Order

### Step 1: Foundation

- `src/app.js`
- `src/server.js`
- `prisma/schema.prisma`
- `prisma.config.ts`
- `src/lib/prisma.js`

### Step 2: Auth

- `src/routes/auth.js`
- `src/controllers/auth.controller.js`
- `src/services/auth.service.js`
- `src/middleware/auth.js`

### Step 3: Restaurant

- `src/routes/restaurants.js`
- `src/controllers/restaurants.controller.js`
- `src/services/restaurants.service.js`

### Step 4: Import + Insights

- `src/routes/reviews.js`
- `src/services/googleScraper.js`
- `src/services/sentimentAnalyzer.js`
- `src/services/insight.service.js`

## 6.4 Frontend Structure

Current frontend already exists in `apps/web`.
Sprint 1 additions should stay focused on these groups:

```text
apps/web/src/
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── reviews/
│   └── settings/
├── components/
│   ├── dashboard/
│   ├── reviews/
│   └── common/
├── lib/
│   └── api.ts
└── hooks/
```

## 6.5 Structure Decisions For Sprint 1

- No `apps/api`
- No worker service
- No Redis layer
- No shared workspace package yet
- No report module
- No organization module

The goal is to keep the backend small enough that one developer can trace request flow from route to DB without getting lost.
