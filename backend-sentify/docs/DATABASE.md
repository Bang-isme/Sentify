# Sentify Database

Updated: 2026-03-25

This document reflects the current Prisma schema in `prisma/schema.prisma`.

## Stack

- PostgreSQL
- Prisma 7
- Prisma config via `prisma.config.ts`

## Current Schema Summary

Current schema has 13 models and 10 enums.

Models:

1. `User`
2. `RefreshToken`
3. `PasswordResetToken`
4. `Restaurant`
5. `RestaurantUser`
6. `Review`
7. `InsightSummary`
8. `ComplaintKeyword`
9. `ReviewIntakeBatch`
10. `ReviewIntakeItem`
11. `ReviewCrawlSource`
12. `ReviewCrawlRun`
13. `ReviewCrawlRawReview`

Enums:

1. `UserRole`
2. `ReviewSentiment`
3. `ReviewCrawlProvider`
4. `ReviewCrawlSourceStatus`
5. `ReviewCrawlRunStrategy`
6. `ReviewCrawlRunStatus`
7. `ReviewCrawlRunPriority`
8. `ReviewIntakeBatchSourceType`
9. `ReviewIntakeBatchStatus`
10. `ReviewIntakeItemApprovalStatus`

## Role and Scope Model

The current data model intentionally separates system role from restaurant scope:

- `User.role`
  - `USER`
  - `ADMIN`
- `RestaurantUser`
  - membership only
  - no restaurant sub-role column

Operational meaning:

- `USER` enters the user-facing product routes
- `ADMIN` enters the internal control plane
- `RestaurantUser` only answers which restaurant a `USER` belongs to

## Core Relationships

- `User` to `Restaurant` is many-to-many through `RestaurantUser`
- `Restaurant` to `Review` is one-to-many
- `Restaurant` to `InsightSummary` is one-to-one
- `Restaurant` to `ComplaintKeyword` is one-to-many
- `User` to `ReviewIntakeBatch` is one-to-many through `createdByUserId`
- `ReviewIntakeBatch` to `ReviewIntakeItem` is one-to-many
- `ReviewIntakeItem` to `Review` is optional many-to-one through `canonicalReviewId`
- `Restaurant` to `ReviewCrawlSource` is one-to-many
- `Restaurant` to `ReviewCrawlRun` is one-to-many
- `ReviewCrawlSource` to `ReviewCrawlRun` is one-to-many
- `ReviewCrawlSource` to `ReviewCrawlRawReview` is one-to-many
- `User` to `RefreshToken` is one-to-many
- `User` to `PasswordResetToken` is one-to-many

## Model Notes

### User

Purpose:

- account identity
- system role assignment
- login lockout state
- JWT revocation state

Key fields:

- `email` unique
- `fullName`
- `role`
- `passwordHash`
- `tokenVersion`
- `failedLoginCount`
- `lockedUntil`
- `lastLoginAt`

### RefreshToken

Purpose:

- long-lived refresh session
- token family rotation
- reuse detection

Key fields:

- `tokenHash` unique
- `familyId`
- `expiresAt`
- `revokedAt`

### PasswordResetToken

Purpose:

- single-use password reset flow

Key fields:

- `tokenHash` unique
- `expiresAt`
- `usedAt`

### Restaurant

Purpose:

- top-level restaurant entity for both user-facing reads and admin-side intake/crawl work

Key fields:

- `name`
- `slug` unique
- `address`
- `googleMapUrl`

### RestaurantUser

Purpose:

- pure membership binding between `User` and `Restaurant`

Key fields:

- `userId`
- `restaurantId`

Constraints:

- unique membership per `(userId, restaurantId)`

Important note:

- there is no `permission` field anymore
- user-facing access uses membership existence only

### Review

Purpose:

- canonical user-facing review dataset

Key fields:

- `externalId`
- `rating`
- `content`
- `sentiment`
- `keywords`
- `reviewDate`
- `updatedAt`

Constraints and indexes:

- unique `(restaurantId, externalId)`
- indexes on `restaurantId`
- indexes on `(restaurantId, createdAt)`
- indexes on `(restaurantId, rating)`
- indexes on `(restaurantId, reviewDate)`
- indexes on `(restaurantId, sentiment)`

Operational note:

- manual intake publish uses stable derived ids in the form `manual-intake:v1:*`
- this lets later batches update the same canonical review instead of duplicating it

### InsightSummary

Purpose:

- cached KPI snapshot for one restaurant

Key fields:

- `averageRating`
- `totalReviews`
- `positivePercentage`
- `neutralPercentage`
- `negativePercentage`
- `lastCalculatedAt`

Constraint:

- unique `restaurantId`

### ComplaintKeyword

Purpose:

- cached complaint keyword aggregates per restaurant

Key fields:

- `keyword`
- `count`
- `percentage`
- `lastUpdatedAt`

Constraint:

- unique `(restaurantId, keyword)`

### ReviewIntakeBatch

Purpose:

- admin-curated staging batch before publish

Key fields:

- `restaurantId`
- `createdByUserId`
- `crawlSourceId`
- `title`
- `sourceType`
- `status`
- `publishedAt`

Indexes:

- `(restaurantId)`
- `(restaurantId, status, createdAt)`
- `(restaurantId, updatedAt, createdAt)`
- `(createdByUserId, createdAt)`
- `(crawlSourceId)`

### ReviewIntakeItem

Purpose:

- raw and normalized review row inside an intake batch

Key fields:

- raw fields:
  - `rawAuthorName`
  - `rawRating`
  - `rawContent`
  - `rawReviewDate`
- normalized fields:
  - `normalizedAuthorName`
  - `normalizedRating`
  - `normalizedContent`
  - `normalizedReviewDate`
- `approvalStatus`
- `reviewerNote`
- `canonicalReviewId`

Indexes:

- `(batchId, approvalStatus)`
- `(batchId, createdAt)`
- `(canonicalReviewId)`
- `(restaurantId, approvalStatus)`
- `(sourceProvider, sourceExternalId)`

Operational note:

- `canonicalReviewId` is intentionally not unique
- multiple intake items from different batches may point to the same canonical review after dedupe or correction

### ReviewCrawlSource

Purpose:

- persistent admin-owned source registration for queue-backed crawl runs

Key fields:

- `restaurantId`
- `provider`
- `externalPlaceId`
- `placeUrl`
- `status`

Operational note:

- one restaurant can have multiple crawl sources over time
- source status is part of the admin control plane, not a user-facing concept

### ReviewCrawlRun

Purpose:

- one queued or historical crawl execution

Key fields:

- `restaurantId`
- `sourceId`
- `requestedByUserId`
- `status`
- `strategy`
- `priority`
- `pageSize`
- `maxPages`
- `maxReviews`
- `delayMs`
- `startedAt`
- `finishedAt`
- `nextPageToken`
- `extractedCount`
- `validCount`
- `warningCount`
- `intakeBatchId`

Operational note:

- run state is persisted so crawl progress can survive restarts
- the run may later materialize into one draft intake batch

### ReviewCrawlRawReview

Purpose:

- persisted raw crawl evidence before intake materialization

Key fields:

- `sourceId`
- `runId`
- `provider`
- `sourceExternalId`
- raw review fields
- normalized validity flags and warnings

Operational note:

- this model is part of the admin ingest pipeline only
- user-facing routes never read from it directly

## Operational Meaning

Current write model:

- `ADMIN` users create intake batches, run crawl flows, approve evidence, and publish
- publish creates or updates canonical `Review` rows
- publish refreshes `InsightSummary` and `ComplaintKeyword`

Current read model:

- `USER` routes read canonical `Review`, `InsightSummary`, and `ComplaintKeyword`
- draft intake items and crawl raw rows stay behind the admin boundary

## Final Database Summary

The database now encodes a simpler access model than earlier iterations:

- one system role for the user-facing app: `USER`
- one system role for the internal control plane: `ADMIN`
- one restaurant scope table: `RestaurantUser`

This keeps the data model aligned to the product goal:

- user-facing routes read stable canonical data
- admin routes own the intake and crawl mechanics
