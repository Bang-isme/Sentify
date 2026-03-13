# 10. Manual-First Admin Architecture

Date: 2026-03-12

## 10.1 Decision Summary

Sentify should shift from `merchant-triggered Google Maps automation` to `admin-curated review intake`.

Reason:

- the current automation pipeline solves a technically hard problem well, but it now carries more complexity than the business flow needs
- data accuracy is expected to come from human review, not from deeper extraction sophistication
- frontend and backend boundaries should now optimize for clarity, not for automation-runtime richness

This document defines the target architecture, not the legacy Sprint 1 shape.

## 10.2 Product Positioning

### Old promise

`Merchant triggers ingestion -> system extracts Google Maps reviews -> dashboard updates`

### New promise

`Admin captures and reviews customer feedback -> publishes a trusted dataset -> merchant reads stable insights`

### Consequences

- Google Maps automation is out of scope for the manual-first product
- merchant UI should show dataset freshness and quality, not internal intake mechanics
- canonical reviews come from a reviewed intake flow

## 10.3 Recommended User Flows

### Admin flow

1. Select restaurant
2. Create intake batch
3. Add reviews
   - single manual entry
   - bulk paste
   - optional CSV import for internal use
4. Edit and normalize fields
5. Mark items approved or rejected
6. Publish approved items to canonical `Review`
7. Recalculate insight summary and complaint keywords

### Merchant flow

1. Select restaurant
2. Read dashboard, reviews, and settings
3. See:
   - last dataset publish time
   - item count
   - source policy summary
4. Do not manage raw intake jobs

## 10.4 Recommended Frontend Structure

Do not start with `packages/*` immediately.
First, fix boundaries inside the existing frontend.

### Phase 1 target inside `apps/web`

```text
apps/web/src/
  app/
    AppProviders.tsx
    AppRouter.tsx
    routes.tsx
  features/
    auth/
      api/
      components/
      pages/
    restaurants/
      api/
      components/
      pages/
    reviews/
      api/
      components/
      pages/
    insights/
      api/
      components/
      pages/
    settings/
      api/
      components/
      pages/
    admin-intake/
      api/
      components/
      pages/
      hooks/
  shared/
    ui/
    lib/
    config/
    types/
  content/
  contexts/
```

### Phase 2 target if admin grows

```text
apps/
  web/      # merchant-facing product
  admin/    # internal curation tool
```

Only after both apps exist should the repo consider:

```text
packages/
  api-client/
  contracts/
  ui/
```

This avoids premature package extraction.

## 10.5 Recommended Backend Structure

The backend should remain a modular monolith.

```text
backend-sentify/src/
  modules/
    auth/
      auth.controller.js
      auth.routes.js
      auth.service.js
    restaurants/
      restaurants.controller.js
      restaurants.routes.js
      restaurants.service.js
    reviews/
      reviews.controller.js
      reviews.service.js
      reviews.repository.js
    insights/
      insights.controller.js
      insights.service.js
    admin-intake/
      admin-intake.controller.js
      admin-intake.routes.js
      admin-intake.service.js
      admin-intake.repository.js
      admin-intake.validation.js
  shared/
    db/
    lib/
    middleware/
    config/
  app.js
  server.js
```

Key rule:

- `admin-intake` owns manual capture and review
- `reviews` owns the canonical published dataset

## 10.6 Recommended Data Model

Keep `Review` as the canonical merchant-facing table.
Add intake-oriented tables rather than forcing admins to write directly into `Review`.

### Proposed tables

#### `ReviewIntakeBatch`

- `id`
- `restaurantId`
- `sourceType` = `MANUAL | BULK_PASTE | CSV`
- `status` = `DRAFT | IN_REVIEW | READY_TO_PUBLISH | PUBLISHED | ARCHIVED`
- `createdByUserId`
- `publishedAt`
- `createdAt`
- `updatedAt`

#### `ReviewIntakeItem`

- `id`
- `batchId`
- `restaurantId`
- `rawAuthorName`
- `rawRating`
- `rawContent`
- `rawReviewDate`
- `normalizedAuthorName`
- `normalizedRating`
- `normalizedContent`
- `normalizedReviewDate`
- `approvalStatus` = `PENDING | APPROVED | REJECTED`
- `reviewerNote`
- `canonicalReviewId`
- `createdAt`
- `updatedAt`

### Why this is better

- admins can review before publish
- audit trail remains intact
- merchant data stays stable
- future CSV intake reuses the same review queue

## 10.7 Recommended API Surface

### Admin intake API

- `POST /api/admin/review-batches`
- `GET /api/admin/review-batches`
- `GET /api/admin/review-batches/:id`
- `POST /api/admin/review-batches/:id/items`
- `PATCH /api/admin/review-items/:id`
- `POST /api/admin/review-batches/:id/publish`

### Merchant read API

Keep the existing read surface where possible:

- `GET /api/restaurants/:id`
- `GET /api/restaurants/:id/reviews`
- `GET /api/restaurants/:id/dashboard/kpi`
- `GET /api/restaurants/:id/dashboard/sentiment`
- `GET /api/restaurants/:id/dashboard/trend`
- `GET /api/restaurants/:id/dashboard/complaints`

## 10.8 Recommended Admin Screens

### Screen A. Intake Inbox

Purpose:

- show all batches by restaurant and status
- let admin continue unfinished work

### Screen B. Batch Detail

Purpose:

- edit raw and normalized fields
- approve or reject each item
- detect duplicates before publish

### Screen C. Quick Entry

Purpose:

- fast single review input for hand-curated data

### Screen D. Bulk Paste

Purpose:

- admin pastes multiple reviews into a guided parser
- preview before items are created

### Screen E. Publish Summary

Purpose:

- show approved count, rejected count, publish result
- trigger insight refresh confirmation

## 10.9 Merchant UI Changes

Merchant UI should replace automation-heavy messaging with dataset messaging.

### Show

- last publish time
- total reviews in canonical dataset
- current source policy
- optional note: `Data reviewed by admin`

### Hide from merchant

- admin review notes
- raw intake audit trail
- internal validation diagnostics

## 10.10 Migration Strategy

### Phase 0. Freeze the target

- approve this document
- stop adding new merchant-facing ingestion mechanics

### Phase 1. Introduce intake model

- add schema
- add admin-intake API

### Phase 2. Extract frontend feature boundaries

- split `App.tsx`
- split `ProductWorkspace.tsx`
- add admin-intake pages

### Phase 3. Simplify merchant mental model

- change cards and copy from `sync status` to `dataset status`
- keep merchant reads tied to canonical `Review`

## 10.11 What To Avoid

- do not create `packages/ui`, `packages/types`, or `packages/utils` before there are two consumers
- do not let admins write directly into `Review` without a review state
- do not keep adding merchant UI logic for admin-only states if admins are the real source of truth
- do not perform a big-bang refactor across FE and BE in one step

## 10.12 First Practical Refactor Targets

The highest-value first cuts are:

1. split `apps/web/src/App.tsx` into app shell plus feature loaders
2. split `apps/web/src/components/product/ProductWorkspace.tsx` into page-level feature files
3. add intake schema and admin-intake backend module
