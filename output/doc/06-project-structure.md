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
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── controllers/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
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

### Actual backend folders

```text
backend-sentify/src/
├── routes/              # auth.js, restaurants.js
├── controllers/         # auth, restaurants, import, reviews, dashboard
├── services/            # auth, restaurant, scraper, sentiment, insight, dashboard
├── middleware/          # JWT auth, requestId
└── lib/                 # Prisma client, AppError, controller error mapper
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
- `src/services/restaurant.service.js`
- `src/services/restaurant-access.service.js`

### Step 4: Import + Insights

- `src/controllers/import.controller.js`
- `src/controllers/reviews.controller.js`
- `src/controllers/dashboard.controller.js`
- `src/services/google-scraper.service.js`
- `src/services/sentiment-analyzer.service.js`
- `src/services/insight.service.js`
- `src/services/review-import.service.js`
- `src/services/review.service.js`
- `src/services/dashboard.service.js`

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
