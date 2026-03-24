# Sentify Database

Updated: 2026-03-24

This document reflects the current Prisma schema in `prisma/schema.prisma`.

## Stack

- PostgreSQL
- Prisma 7
- Prisma adapter: `@prisma/adapter-pg`

## Current Schema Summary

Current schema has 10 models and 5 enums.

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

Enums:

1. `RestaurantPermission`
2. `ReviewSentiment`
3. `ReviewIntakeBatchSourceType`
4. `ReviewIntakeBatchStatus`
5. `ReviewIntakeItemApprovalStatus`

## Core Relationships

- `User` to `Restaurant` is many-to-many through `RestaurantUser`
- `Restaurant` to `Review` is one-to-many
- `Restaurant` to `InsightSummary` is one-to-one
- `Restaurant` to `ComplaintKeyword` is one-to-many
- `User` to `ReviewIntakeBatch` is one-to-many through `createdByUserId`
- `ReviewIntakeBatch` to `ReviewIntakeItem` is one-to-many
- `ReviewIntakeItem` to `Review` is optional many-to-one through `canonicalReviewId`
- `User` to `RefreshToken` is one-to-many
- `User` to `PasswordResetToken` is one-to-many

## Model Notes

### User

Purpose:

- account identity
- login lockout state
- JWT revocation state

Key fields:

- `email` unique
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

- merchant-facing entity that owns reviews and insights

Key fields:

- `name`
- `slug` unique
- `address`
- `googleMapUrl`

### RestaurantUser

Purpose:

- membership and permission binding between user and restaurant

Key fields:

- `userId`
- `restaurantId`
- `permission`

Constraints:

- unique membership per `(userId, restaurantId)`

### Review

Purpose:

- canonical merchant-facing review dataset

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

- manual intake publish uses stable derived ids in the form `manual-intake:v1:*` so the same source review can be updated across batches instead of duplicated

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

- staging batch for curated review intake before publish

Key fields:

- `restaurantId`
- `createdByUserId`
- `title`
- `sourceType`
- `status`
- `publishedAt`

Indexes:

- `(restaurantId)`
- `(restaurantId, status, createdAt)`
- `(restaurantId, updatedAt, createdAt)`
- `(createdByUserId, createdAt)`

### ReviewIntakeItem

Purpose:

- raw and normalized review row inside an intake batch

Key fields:

- raw fields: `rawAuthorName`, `rawRating`, `rawContent`, `rawReviewDate`
- normalized fields: `normalizedAuthorName`, `normalizedRating`, `normalizedContent`, `normalizedReviewDate`
- `approvalStatus`
- `reviewerNote`
- `canonicalReviewId`

Indexes:

- `(batchId, approvalStatus)`
- `(batchId, createdAt)`
- `(canonicalReviewId)`
- `(restaurantId, approvalStatus)`

Operational note:

- `canonicalReviewId` is intentionally not unique; multiple intake items from different batches may point to the same canonical review after dedupe or correction

## Operational Meaning

Current write model:

- admins or restaurant members curate data into `ReviewIntakeBatch` and `ReviewIntakeItem`
- publish creates or updates canonical `Review` rows using stable derived external ids
- insights are recalculated into `InsightSummary` and `ComplaintKeyword`

Current read model:

- merchant dashboard reads canonical `Review`, `InsightSummary`, and `ComplaintKeyword`

## Migration Direction Visible in History

Migration history shows a clear product shift:

- early migrations introduced import-run automation tables
- later migrations removed automated import state
- newer migrations introduced manual intake tables and indexes

So the current database direction is manual-first curation, not automated import runtime.
