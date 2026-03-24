# Sentify Web

Frontend app for the Sentify merchant and admin workspace.

## Backend contract

The app is wired to the current backend contract in `backend-sentify`:

- default local API base: `http://localhost:3000/api`
- cookie-authenticated requests use `credentials: "include"`
- write requests automatically send `X-CSRF-Token` from the `XSRF-TOKEN` cookie
- when a request gets `401`, the client bootstraps `/auth/csrf`, calls `/auth/refresh`, then retries once

You can override the API base with:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Local run

Start the backend first:

```bash
cd D:\Project 3\backend-sentify
npm run dev
```

Then run the frontend:

```bash
cd D:\Project 3\apps\web
npm install
npm run dev
```

## Validation

```bash
npm run test:run
npm run build
```

## Current FE scope

- auth shell
- restaurant onboarding and settings
- merchant dashboard and review evidence
- admin intake over the current backend review-batch APIs

The app now understands backend intake batches with `GOOGLE_MAPS_CRAWL` source type for display, while the create-batch form stays scoped to manual source types.
