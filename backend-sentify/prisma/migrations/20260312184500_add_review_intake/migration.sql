CREATE TYPE "ReviewIntakeBatchSourceType" AS ENUM ('MANUAL', 'BULK_PASTE', 'CSV', 'GOOGLE_ASSISTED');

CREATE TYPE "ReviewIntakeBatchStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "ReviewIntakeItemApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ReviewIntakeBatch" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT,
  "sourceType" "ReviewIntakeBatchSourceType" NOT NULL DEFAULT 'MANUAL',
  "status" "ReviewIntakeBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewIntakeBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewIntakeItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "rawAuthorName" TEXT,
  "rawRating" INTEGER,
  "rawContent" TEXT,
  "rawReviewDate" TIMESTAMP(3),
  "normalizedAuthorName" TEXT,
  "normalizedRating" INTEGER,
  "normalizedContent" TEXT,
  "normalizedReviewDate" TIMESTAMP(3),
  "approvalStatus" "ReviewIntakeItemApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerNote" TEXT,
  "canonicalReviewId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewIntakeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewIntakeItem_canonicalReviewId_key" ON "ReviewIntakeItem"("canonicalReviewId");
CREATE INDEX "ReviewIntakeBatch_restaurantId_status_createdAt_idx" ON "ReviewIntakeBatch"("restaurantId", "status", "createdAt");
CREATE INDEX "ReviewIntakeBatch_createdByUserId_createdAt_idx" ON "ReviewIntakeBatch"("createdByUserId", "createdAt");
CREATE INDEX "ReviewIntakeItem_batchId_approvalStatus_idx" ON "ReviewIntakeItem"("batchId", "approvalStatus");
CREATE INDEX "ReviewIntakeItem_restaurantId_approvalStatus_idx" ON "ReviewIntakeItem"("restaurantId", "approvalStatus");

ALTER TABLE "ReviewIntakeBatch"
ADD CONSTRAINT "ReviewIntakeBatch_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewIntakeBatch"
ADD CONSTRAINT "ReviewIntakeBatch_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewIntakeItem"
ADD CONSTRAINT "ReviewIntakeItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "ReviewIntakeBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewIntakeItem"
ADD CONSTRAINT "ReviewIntakeItem_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewIntakeItem"
ADD CONSTRAINT "ReviewIntakeItem_canonicalReviewId_fkey"
FOREIGN KEY ("canonicalReviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
