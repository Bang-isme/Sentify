# 🧪 Sentify Backend — Testing Strategy

> Chiến lược testing để đảm bảo chất lượng nhất quán qua mọi sprint.

---

## Test Stack

| Tool | Purpose |
|---|---|
| `node --test` | Built-in test runner (Node.js 18+) |
| `node:assert` | Built-in assertions |
| `test-helpers.js` | Mock setup, HTTP client, app bootstrap |

Không dùng external test framework (Jest, Mocha) — giữ zero-dependency testing.

---

## Test Pyramid

```
        ╱ ╲
       ╱ E2E╲          ← Sprint 5+ (real DB + browser)
      ╱───────╲
     ╱  Integ  ╲       ← Current: controller + routes (mocked DB)
    ╱───────────╲
   ╱    Unit     ╲     ← Current: service logic, helpers
  ╱───────────────╲
```

**Hiện tại**: Unit + Integration (mocked Prisma)
**Sprint 5**: Thêm real DB integration tests

---

## File Naming & Location

```
test/
├── <module>.service.test.js        # Unit: service business logic
├── <module>.controller.test.js     # Unit: controller validation + error handling
├── <module>.integration.test.js    # Integration: full request → response
├── test-helpers.js                 # Shared utilities
└── integration/                    # Future: real DB tests
    └── setup.js
```

---

## Mock Strategy

### Prisma Client
Toàn bộ Prisma được mock qua `test-helpers.js`:

```js
const { startApp, stopApp, request, createTestToken } = require('./test-helpers')

// startApp() mocks:
// - prisma (all models)
// - rate-limit middleware (pass through)
// - security-event logger (noop)
```

Override specific Prisma methods per test:
```js
const { server } = await startApp({
    user: {
        findUnique: async () => ({ id: 'user-1', tokenVersion: 0 }),
    },
    review: {
        groupBy: async () => [
            { sentiment: 'POSITIVE', _count: { _all: 28 } },
        ],
    },
})
```

### Auth Token
```js
const token = createTestToken({ userId: 'user-1' })
const expired = createExpiredToken()
const invalid = createInvalidToken()
```

---

## Test Structure

Mỗi test file follow pattern:

```js
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startApp, stopApp, request, createTestToken } = require('./test-helpers')

describe('Module: <name>', () => {
    let server, token

    before(async () => {
        const app = await startApp({ /* prisma overrides */ })
        server = app.server
        token = createTestToken()
    })

    after(async () => {
        await stopApp(server)
    })

    describe('POST /api/<path>', () => {
        it('should create resource with valid input', async () => {
            const res = await request(server, 'POST', '/api/path', {
                token,
                body: { name: 'test' },
            })
            assert.equal(res.status, 201)
            assert.ok(res.body.data.id)
        })

        it('should return 400 for invalid input', async () => { ... })
        it('should return 401 without auth', async () => { ... })
        it('should return 403 without permission', async () => { ... })
    })
})
```

---

## What to Test per endpoint

| Case | Mức độ | Ví dụ |
|---|---|---|
| Happy path | Bắt buộc | Create thành công → 201 + data |
| Validation error | Bắt buộc | Missing required field → 400 |
| Auth missing | Bắt buộc | No token → 401 |
| Auth expired | Nên có | Expired token → 401 |
| Permission denied | Nên có (nếu có permission) | VIEWER gọi OWNER endpoint → 403 |
| Not found | Nên có | Invalid ID → 404 |
| Conflict | Nên có (nếu unique constraint) | Duplicate email → 409 |
| Edge cases | Nice-to-have | Empty array, null fields, boundary values |

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test test/dashboard.integration.test.js

# Run with verbose output
node --test --test-reporter spec test/auth.integration.test.js
```

---

## Coverage Targets

| Sprint | Target | Focus |
|---|---|---|
| S1 | Existing tests pass + test new changes | Dashboard, UUID validation |
| S2 | Auth flow fully covered | Refresh token, reset password |
| S3 | Team management covered | Invite, permission, transfer |
| S4 | Review features covered | Search, export, archive |
| S5 | Real DB integration | Full stack tests |

---

## Checklist trước khi merge

- [ ] `npm test` — tất cả test pass
- [ ] Thêm test cho mỗi endpoint mới
- [ ] Test cả happy path và error cases
- [ ] Không hardcode IDs / secrets trong test (dùng test-helpers)
- [ ] Mock cleanup trong `after()` hook
