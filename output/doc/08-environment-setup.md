# 8. Environment Setup - Sprint 1

Date: 2026-03-03  
Updated: 2026-03-07 (Sprint 1 scope sync)

## 8.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| npm | 10+ | Package manager |
| PostgreSQL | 16+ | Database |
| Git | 2.40+ | Version control |

## 8.2 Backend Folder

```text
backend-sentify/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.js
│   ├── server.js
│   └── lib/
│       └── prisma.js
├── .env
├── .env.example
├── prisma.config.ts
└── package.json
```

## 8.3 Install Dependencies

```bash
cd backend-sentify
npm install
```

If starting from scratch, the important packages are:

```bash
npm install express cors dotenv @prisma/client @prisma/adapter-pg pg bcryptjs jsonwebtoken zod
npm install -D prisma nodemon
```

## 8.4 Create Local Database

### Option A: local PostgreSQL already installed

Create a database named `sentify`.

If `psql` is on PATH:

```bash
createdb sentify
```

If `psql` is not on PATH on Windows, use the full executable path or a GUI client like pgAdmin / DBeaver.
A common path is:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432
```

Then run:

```sql
CREATE DATABASE sentify;
```

## 8.5 Environment Variables

Create `backend-sentify/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/sentify?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
CORS_ORIGIN="http://localhost:5173"
PORT=3000
```

### Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `JWT_SECRET` | Yes | Secret used to sign access tokens |
| `CORS_ORIGIN` | Yes | Frontend origin allowed by the API |
| `PORT` | No | Express port, default `3000` |
| `OPENAI_API_KEY` | No | Only needed if using OpenAI fallback for sentiment |

### Not needed in Sprint 1

- `JWT_REFRESH_SECRET`
- `REDIS_URL`
- `BULLMQ_*`
- `UPLOAD_MAX_SIZE_MB`

## 8.6 Prisma 7 Files

### `prisma.config.ts`

```ts
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
```

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

This is a pragmatic choice for Sprint 1: Prisma 7 config model, but CommonJS-friendly client generation.

## 8.7 Prisma Commands

Run in `backend-sentify/`:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate -- --name init
```

### Meaning of each command

- `db:format`: formats `schema.prisma`
- `db:validate`: checks if schema syntax is valid
- `db:generate`: generates Prisma Client into `node_modules/@prisma/client`
- `db:migrate`: creates and applies SQL migration to PostgreSQL

## 8.8 Run The API

```bash
npm run dev
```

Expected log:

```text
Server running on port 3000
```

## 8.9 Verify Setup

In another terminal:

```bash
curl.exe -i http://localhost:3000/health
```

Expected response:

```text
HTTP/1.1 200 OK
{"status":"ok"}
```

## 8.10 Frontend Note

Frontend already lives in `apps/web`.
Run it separately:

```bash
cd apps/web
npm run dev
```
