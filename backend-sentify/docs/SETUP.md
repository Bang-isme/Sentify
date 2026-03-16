# 🛠️ Sentify Backend — Setup Guide

> Hướng dẫn setup môi trường development từ đầu.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 18.x | `node --version` |
| npm | ≥ 9.x | `npm --version` |
| PostgreSQL | ≥ 15.x | `psql --version` |

---

## 1. Clone & Install

```bash
cd backend-sentify
npm install
```

---

## 2. PostgreSQL Setup

### Tạo database

```sql
-- Kết nối psql
psql -U postgres

-- Tạo database
CREATE DATABASE sentify;
```

### Connection string format
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

---

## 3. Environment Variables

Copy file example và chỉnh sửa:

```bash
cp .env.example .env
```

### Các biến bắt buộc

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@127.0.0.1:5432/sentify?schema=public` |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Các biến tuỳ chọn (có default)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `3000` | Server port |
| `LOG_FORMAT` | `auto` | `auto` / `json` / `pretty` |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend URL (comma-separated for multiple) |
| `BODY_LIMIT` | `100kb` | Max request body size |
| `JWT_ISSUER` | `sentify-api` | JWT issuer claim |
| `JWT_AUDIENCE` | `sentify-web` | JWT audience claim |
| `DB_POOL_MAX` | `10` | Max DB connections |
| `AUTH_COOKIE_NAME` | `sentify_access_token` | Cookie name |
| `AUTH_COOKIE_SAME_SITE` | `lax` | `lax` / `strict` / `none` |
| `AUTH_COOKIE_SECURE` | `false` (dev) | Set `true` in production (HTTPS) |
| `AUTH_COOKIE_DOMAIN` | — | Cookie domain (e.g., `.sentify.app`) |
| `TRUST_PROXY` | `false` | Express trust proxy setting |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Rate limit window |
| `API_RATE_LIMIT_MAX` | `500` | Max requests per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `60000` (1 min) | Login rate limit window |
| `AUTH_RATE_LIMIT_MAX` | `5` | Max login attempts per window |
| `REGISTER_RATE_LIMIT_WINDOW_MS` | `900000` | Register rate limit window |
| `REGISTER_RATE_LIMIT_MAX` | `10` | Max registrations per window |
| `LOGIN_LOCK_THRESHOLD` | `5` | Failed logins before lock |
| `LOGIN_LOCK_MINUTES` | `15` | Account lock duration |

---

## 4. Database Migration

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio — visual DB browser
npm run db:studio
```

---

## 5. Start Dev Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`. Verify:

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","db":"up"}
```

---

## 6. Run Tests

```bash
npm test
```

Sử dụng Node.js built-in test runner (`node --test`). Không cần database thật — tests mock Prisma client.

---

## 7. Useful Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Nodemon auto-reload |
| Production | `npm start` | Node.js direct |
| Tests | `npm test` | Run all tests |
| DB generate | `npm run db:generate` | Regenerate Prisma client |
| DB migrate | `npm run db:migrate` | Apply pending migrations |
| DB studio | `npm run db:studio` | Visual database browser |
| DB format | `npm run db:format` | Format schema.prisma |
| DB validate | `npm run db:validate` | Validate schema |

---

## Troubleshooting

### `JWT_SECRET must be at least 32 characters`
Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `DATABASE_URL is required`
Ensure `.env` file exists and contains `DATABASE_URL`.

### Prisma migration fails
```bash
# Reset database (⚠️ destroys all data)
npx prisma migrate reset

# Or create fresh migration
npx prisma migrate dev --name describe_change
```

### Port already in use
```bash
# Windows: find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Tests fail with module errors
Tests clear the module cache. Ensure no stale cached modules:
```bash
# Re-install dependencies
rm -rf node_modules
npm install
npm run db:generate
npm test
```

---

## Next Steps

- Read [API.md](./API.md) for full endpoint reference
- Read [DATABASE.md](./DATABASE.md) for schema documentation
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for project structure
- Read [SPRINT-ROADMAP.md](./SPRINT-ROADMAP.md) for upcoming features
