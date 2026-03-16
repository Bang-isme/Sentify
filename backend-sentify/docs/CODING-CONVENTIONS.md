# 📏 Sentify Backend — Coding Conventions

> Quy ước code để đảm bảo nhất quán qua mọi sprint và session.

---

## Project Structure

### Module mới → dùng feature module pattern

```
src/modules/<feature-name>/
├── <feature>.routes.js        # Express Router
├── <feature>.controller.js    # Validate + delegate
├── <feature>.service.js       # Business logic
├── <feature>.validation.js    # Zod schemas
└── <feature>.repository.js    # Prisma queries (nếu > 3 queries)
```

**Khi nào cần repository?** Nếu module có > 3 Prisma queries hoặc có transaction logic. Nếu đơn giản (1-2 queries) → gọi Prisma trực tiếp từ service.

### Shared code → `src/lib/` hoặc `src/middleware/`
- `lib/`: Utility functions, helpers, constants
- `middleware/`: Express middleware (auth, validation, logging)

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| File names | kebab-case | `restaurant-access.service.js` |
| Variables, functions | camelCase | `getRestaurantDetail` |
| Constants | UPPER_SNAKE_CASE | `ACCESS_TOKEN_EXPIRES_IN_SECONDS` |
| Classes | PascalCase | `AppError` |
| Database table | PascalCase (Prisma default) | `ReviewIntakeBatch` |
| DB columns | camelCase (Prisma default) | `createdByUserId` |
| Route paths | kebab-case | `/api/admin/review-batches` |
| Error codes | UPPER_SNAKE_CASE | `AUTH_INVALID_TOKEN` |
| Enum values | UPPER_SNAKE_CASE | `READY_TO_PUBLISH` |

---

## Controller Pattern

```js
// ✅ Correct
async function createResource(req, res) {
    try {
        const input = createResourceSchema.parse(req.body)
        const result = await service.createResource({
            userId: req.user.userId,
            ...input,
        })
        return res.status(201).json({ data: result })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

// ❌ Wrong — business logic in controller
async function createResource(req, res) {
    const existing = await prisma.resource.findFirst(...)  // NO: Prisma in controller
    if (req.body.name.length > 100) throw new Error(...)   // NO: manual validation
}
```

**Rules**:
1. Controller ONLY does: Zod validate → call service → format response
2. NEVER import Prisma directly in controller
3. ALWAYS use `handleControllerError` for try-catch
4. Use `201` for create, `200` for others

---

## Service Pattern

```js
// ✅ Correct — service owns business logic
async function createResource({ userId, name }) {
    await ensureAccess(userId, restaurantId)  // Access check
    // Business logic here
    const result = await repository.create(data)  // OR prisma.xxx.create()
    return formatResult(result)
}

// ❌ Wrong — service returns res
async function createResource(req, res) {  // NO: don't pass req/res to service
```

**Rules**:
1. Service NEVER receives `req`/`res` — only plain data objects
2. Service throws `AppError` for business rule violations
3. Access control checked at service level via `getRestaurantAccess()`

---

## Error Creation

```js
const { badRequest, notFound, conflict, forbidden } = require('../lib/app-error')

// ✅ Correct — use factory functions
throw notFound('NOT_FOUND', 'Restaurant not found')
throw badRequest('VALIDATION_FAILED', 'Rating must be 1-5')
throw conflict('ALREADY_EXISTS', 'Email already registered')

// ❌ Wrong
throw new Error('Not found')                    // NO: generic Error
throw { status: 404, message: 'Not found' }     // NO: plain object
```

**Error code format**: `DOMAIN_ACTION_REASON`
- `AUTH_INVALID_CREDENTIALS`
- `INTAKE_BATCH_LOCKED`
- `INTAKE_REVIEW_INVALID_RATING`

---

## Response Envelope

```js
// Non-paginated
{ data: T }

// Paginated (when applicable)
{ data: T[], pagination: { page, limit, total, totalPages } }

// Error
{ error: { code, message, timestamp, requestId, details? } }
```

---

## Validation (Zod)

```js
// ✅ Correct — schema in separate .validation.js file
const schema = z.object({
    name: z.string().trim().min(1).max(120),
    rating: z.number().int().min(1).max(5),
    email: z.string().email().toLowerCase(),
})

// ❌ Wrong — inline Zod in controller
```

**Tips**:
- Use `.trim()` on all string inputs
- Use `.toLowerCase()` on email
- Use `z.preprocess` for type coercion (query params come as strings)
- Tách validation file riêng khi module có > 2 schemas

---

## Prisma Queries

```js
// ✅ Correct — select only needed fields
const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true }
})

// ⚠️ Avoid — fetching all fields when not needed
const users = await prisma.user.findMany()

// ✅ Correct — use transactions for multi-step writes
await prisma.$transaction(async (tx) => {
    await tx.review.createMany({ data: reviews })
    await tx.insightSummary.upsert({ ... })
})
```

---

## Git Commit Messages

```
<type>(<scope>): <description>

Types: feat, fix, refactor, docs, test, chore
Scope: auth, restaurant, dashboard, intake, middleware, prisma

Examples:
feat(dashboard): replace in-memory aggregation with groupBy
fix(auth): add rate limit to password change
refactor(intake): batch publishApprovedItems updates
docs: add API reference and architecture guide
test(dashboard): add integration test for trend endpoint
chore: update .env.example with missing vars
```
